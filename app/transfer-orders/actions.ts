"use server";

import { revalidatePath } from "next/cache";
import type { Prisma, ProjectSubCategory, TransferOrderStatus } from "@prisma/client";

import { findOpenCicoAttendance } from "@/lib/cico-attendance";
import {
  InsufficientEquipmentAssetsError,
  assertEquipmentInventoryInvariants,
  isEquipmentItemType,
  markAvailableEquipmentAssetsInTransit,
} from "@/lib/equipment-asset";
import {
  issueInTransitStockToProject,
  returnInTransitStockToWarehouse,
  transferOrderInTransitNote,
  writeOffInTransitStock,
} from "@/lib/transfer-order-return";
import { formatEmployeeName } from "@/lib/employee-user-link";
import { translate } from "@/lib/i18n/translate";
import { getServerLocale } from "@/lib/i18n/locale";
import {
  formatInventoryQty,
  inventoryQtyFromDecimal,
  movementTotalCost,
  normalizeInventoryQty,
  toDecimal,
} from "@/lib/inventory";
import { lockInventoryItemRow } from "@/lib/inventory-access";
import type { AppLocale } from "@/lib/i18n/locale";
import { canAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/project-billing";
import { getProjectWhereForUser } from "@/lib/project-access";
import {
  requireModule,
  requireSession,
  toPermissionUser,
} from "@/lib/session";
import {
  ATTENDANCE_INTERNAL_CLIENT_NAME,
  ATTENDANCE_INTERNAL_ROUTE_CLIENT_ID,
  attendanceInternalSortRank,
  isAttendanceInternalProject,
} from "@/lib/attendance-internal-sites";
import { normalizeClientName } from "@/lib/client-login-id";
import { ensureInternalAttendanceSites } from "@/lib/ensure-internal-attendance-sites";
import {
  TRANSFER_ORDER_OPEN_STATUSES,
  type TransferOrderClientRow,
  type TransferOrderDirectory,
  type TransferOrderInternalSiteRow,
  type TransferOrderPendingRow,
  type TransferOrderProjectRow,
  transferOrderPendingRank,
  transferOrderQueueHref,
  transferOrderRouteClientId,
} from "@/lib/transfer-order-directory";

function toActionError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error;
  return new Error(fallback);
}

async function requireCompany(locale: AppLocale) {
  const company = await prisma.company.findFirst({ select: { id: true } });
  if (!company) {
    throw new Error(translate(locale, "pages.inventory.companyNotFound"));
  }
  return company;
}

async function requireLinkedEmployee(userId: string, companyId: string) {
  const employee = await prisma.employee.findFirst({
    where: { userId, companyId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!employee) {
    throw new Error("Employee profile required.");
  }
  return employee;
}

function revalidateTransferOrderTree(input: {
  clientId?: string | null;
  projectId?: string | null;
}) {
  revalidatePath("/transfer-orders");
  const routeClientId =
    input.clientId && input.clientId.trim()
      ? input.clientId
      : ATTENDANCE_INTERNAL_ROUTE_CLIENT_ID;
  revalidatePath(`/transfer-orders/${routeClientId}`);
  if (input.projectId) {
    revalidatePath(`/transfer-orders/${routeClientId}/${input.projectId}`);
  }
}

type OpenOrderCounts = { pendingSend: number; inTransit: number };

function emptyOpenCounts(): OpenOrderCounts {
  return { pendingSend: 0, inTransit: 0 };
}

function mapPendingTransferOrder(order: {
  id: string;
  status: TransferOrderStatus;
  createdAt: Date;
  project: {
    id: string;
    name: string;
    clientId: string | null;
    subCategory: ProjectSubCategory;
    serviceArea: string;
    client: { id: string; name: string } | null;
  };
  lines: Array<{
    quantity: Prisma.Decimal;
    item: { name: string; unit: string };
  }>;
  _count: { lines: number };
}): TransferOrderPendingRow {
  const isInternal =
    isAttendanceInternalProject(order.project) || !order.project.clientId;
  const routeClientId = transferOrderRouteClientId(order.project);
  const first = order.lines[0];
  return {
    id: order.id,
    status: order.status,
    createdAt: order.createdAt,
    href: transferOrderQueueHref({
      clientId: routeClientId,
      projectId: order.project.id,
      orderId: order.id,
    }),
    isInternal,
    clientName: isInternal
      ? ATTENDANCE_INTERNAL_CLIENT_NAME
      : order.project.client?.name ?? "",
    projectName: order.project.name,
    firstItemName: first?.item.name ?? null,
    firstItemQty: first ? inventoryQtyFromDecimal(first.quantity) : 0,
    firstItemUnit: first?.item.unit ?? "",
    itemCount: order._count.lines,
  };
}

function accumulateOpenOrderCounts(
  rows: Array<{ status: TransferOrderStatus; projectId: string }>
): {
  byProject: Map<string, OpenOrderCounts>;
  totals: OpenOrderCounts;
} {
  const byProject = new Map<string, OpenOrderCounts>();
  const totals = emptyOpenCounts();
  for (const row of rows) {
    const pendingInc = row.status === "PENDING_SEND" ? 1 : 0;
    const transitInc =
      row.status === "SENT" || row.status === "NOT_RECEIVED" ? 1 : 0;
    totals.pendingSend += pendingInc;
    totals.inTransit += transitInc;
    const existing = byProject.get(row.projectId) ?? emptyOpenCounts();
    existing.pendingSend += pendingInc;
    existing.inTransit += transitInc;
    byProject.set(row.projectId, existing);
  }
  return { byProject, totals };
}

/** Warehouse home: Internal sites + clients with accessible projects. */
export async function getTransferOrderDirectory(): Promise<TransferOrderDirectory> {
  const session = await requireModule("transferOrders");
  const companyId = session.user.companyId;
  if (!companyId) {
    return {
      clients: [],
      internalSites: [],
      pendingOrders: [],
      totals: { pendingSend: 0, inTransit: 0 },
    };
  }

  const isClientPortal = Boolean(session.user.clientId);
  let ensuredSites: TransferOrderInternalSiteRow[] = [];

  if (!isClientPortal) {
    const ensured = await ensureInternalAttendanceSites(companyId);
    ensuredSites = ensured.sites.map((site) => ({
      ...site,
      pendingSendCount: 0,
      inTransitCount: 0,
    }));
  }

  const projectWhere = await getProjectWhereForUser({
    companyId,
    clientId: session.user.clientId,
    userId: session.user.id,
    username: session.user.username,
  });

  const [clientsRaw, openOrders] = await Promise.all([
    prisma.client.findMany({
      where: {
        companyId,
        active: true,
        ...(session.user.clientId ? { id: session.user.clientId } : {}),
        nameNormalized: {
          not: normalizeClientName(ATTENDANCE_INTERNAL_CLIENT_NAME),
        },
        projects: {
          some: {
            ...projectWhere,
            subCategory: { not: "INTERNAL" },
          },
        },
      },
      include: {
        projects: {
          where: {
            ...projectWhere,
            subCategory: { not: "INTERNAL" },
          },
          select: {
            id: true,
            name: true,
            serviceArea: true,
            subCategory: true,
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.transferOrder.findMany({
      where: {
        companyId,
        status: { in: [...TRANSFER_ORDER_OPEN_STATUSES] },
        project: projectWhere,
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        projectId: true,
        project: {
          select: {
            id: true,
            name: true,
            clientId: true,
            subCategory: true,
            serviceArea: true,
            client: { select: { id: true, name: true } },
          },
        },
        _count: { select: { lines: true } },
        lines: {
          take: 1,
          orderBy: { id: "asc" },
          select: {
            quantity: true,
            item: { select: { name: true, unit: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const { byProject, totals } = accumulateOpenOrderCounts(openOrders);

  const internalSites = ensuredSites
    .map((site) => {
      const counts = byProject.get(site.projectId) ?? emptyOpenCounts();
      return {
        ...site,
        pendingSendCount: counts.pendingSend,
        inTransitCount: counts.inTransit,
      };
    })
    .sort(
      (a, b) =>
        attendanceInternalSortRank(a.name) - attendanceInternalSortRank(b.name) ||
        b.pendingSendCount - a.pendingSendCount ||
        a.name.localeCompare(b.name)
    );

  const clients = clientsRaw
    .map((client): TransferOrderClientRow | null => {
      const commercial = client.projects.filter(
        (project) => !isAttendanceInternalProject(project)
      );
      if (commercial.length === 0) return null;

      let pendingSendCount = 0;
      let inTransitCount = 0;
      for (const project of commercial) {
        const counts = byProject.get(project.id);
        if (!counts) continue;
        pendingSendCount += counts.pendingSend;
        inTransitCount += counts.inTransit;
      }

      return {
        id: client.id,
        name: client.name,
        projectCount: commercial.length,
        pendingSendCount,
        inTransitCount,
      };
    })
    .filter((row): row is TransferOrderClientRow => row != null)
    .sort(
      (a, b) =>
        b.pendingSendCount - a.pendingSendCount ||
        b.inTransitCount - a.inTransitCount ||
        a.name.localeCompare(b.name)
    );

  const pendingOrders = openOrders
    .map(mapPendingTransferOrder)
    .sort(
      (a, b) =>
        transferOrderPendingRank(a.status) - transferOrderPendingRank(b.status) ||
        a.createdAt.getTime() - b.createdAt.getTime()
    );

  return {
    clients,
    internalSites,
    pendingOrders,
    totals: {
      pendingSend: totals.pendingSend,
      inTransit: totals.inTransit,
    },
  };
}

export async function getTransferOrderProjectsForClient(
  clientId: string
): Promise<{
  clientName: string;
  routeClientId: string;
  projects: TransferOrderProjectRow[];
} | null> {
  const session = await requireModule("transferOrders");
  const companyId = session.user.companyId;
  if (!companyId) return null;

  const isInternalRoute = clientId === ATTENDANCE_INTERNAL_ROUTE_CLIENT_ID;

  if (session.user.clientId) {
    if (isInternalRoute || session.user.clientId !== clientId) {
      return null;
    }
  }

  const projectWhere = await getProjectWhereForUser({
    companyId,
    clientId: session.user.clientId,
    userId: session.user.id,
    username: session.user.username,
  });

  if (isInternalRoute) {
    const ensured = await ensureInternalAttendanceSites(companyId);
    const siteIds = ensured.sites.map((site) => site.projectId);

    const [projectsRaw, openOrders] = await Promise.all([
      prisma.project.findMany({
        where: { id: { in: siteIds }, ...projectWhere },
        select: {
          id: true,
          name: true,
          location: true,
          subCategory: true,
          serviceArea: true,
        },
      }),
      prisma.transferOrder.findMany({
        where: {
          companyId,
          status: { in: [...TRANSFER_ORDER_OPEN_STATUSES] },
          projectId: { in: siteIds },
        },
        select: { status: true, projectId: true },
      }),
    ]);

    const { byProject } = accumulateOpenOrderCounts(openOrders);
    const byId = new Map(projectsRaw.map((project) => [project.id, project]));

    const projects = ensured.sites
      .map((site): TransferOrderProjectRow | null => {
        const project = byId.get(site.projectId);
        if (!project) return null;
        const counts = byProject.get(project.id) ?? emptyOpenCounts();
        return {
          id: project.id,
          name: project.name,
          location: project.location,
          subCategory: project.subCategory,
          serviceArea: project.serviceArea,
          pendingSendCount: counts.pendingSend,
          inTransitCount: counts.inTransit,
        };
      })
      .filter((row): row is TransferOrderProjectRow => row != null)
      .sort(
        (a, b) =>
          attendanceInternalSortRank(a.name) -
            attendanceInternalSortRank(b.name) ||
          b.pendingSendCount - a.pendingSendCount ||
          a.name.localeCompare(b.name)
      );

    if (projects.length === 0) return null;

    return {
      clientName: ATTENDANCE_INTERNAL_CLIENT_NAME,
      routeClientId: ATTENDANCE_INTERNAL_ROUTE_CLIENT_ID,
      projects,
    };
  }

  const [client, openOrders] = await Promise.all([
    prisma.client.findFirst({
      where: { id: clientId, companyId, active: true },
      include: {
        projects: {
          where: {
            ...projectWhere,
            subCategory: { not: "INTERNAL" },
          },
          select: {
            id: true,
            name: true,
            location: true,
            subCategory: true,
            serviceArea: true,
          },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        },
      },
    }),
    prisma.transferOrder.findMany({
      where: {
        companyId,
        status: { in: [...TRANSFER_ORDER_OPEN_STATUSES] },
        project: { ...projectWhere, clientId },
      },
      select: { status: true, projectId: true },
    }),
  ]);

  if (!client) return null;

  const { byProject } = accumulateOpenOrderCounts(openOrders);
  const projects = client.projects
    .filter((project) => !isAttendanceInternalProject(project))
    .map((project): TransferOrderProjectRow => {
      const counts = byProject.get(project.id) ?? emptyOpenCounts();
      return {
        id: project.id,
        name: project.name,
        location: project.location,
        subCategory: project.subCategory,
        serviceArea: project.serviceArea,
        pendingSendCount: counts.pendingSend,
        inTransitCount: counts.inTransit,
      };
    })
    .sort(
      (a, b) =>
        b.pendingSendCount - a.pendingSendCount ||
        b.inTransitCount - a.inTransitCount ||
        a.name.localeCompare(b.name)
    );

  return {
    clientName: client.name,
    routeClientId: client.id,
    projects,
  };
}

export type TransferOrderQueueItem = {
  id: string;
  status: TransferOrderStatus;
  notes: string | null;
  createdAt: Date;
  sentAt: Date | null;
  receivedAt: Date | null;
  project: { id: string; name: string };
  requestedByName: string;
  requestedByNo: string | null;
  sentByName: string | null;
  receivedByName: string | null;
  reviewNote: string | null;
  lines: Array<{
    id: string;
    quantity: number;
    item: {
      sku: string;
      name: string;
      unit: string;
      currentStock: number;
    };
  }>;
};

export async function getTransferOrderQueueForProject(
  clientId: string,
  projectId: string
): Promise<{
  clientName: string;
  routeClientId: string;
  project: {
    id: string;
    name: string;
    location: string | null;
    subCategory: ProjectSubCategory;
  };
  orders: TransferOrderQueueItem[];
  stats: { pendingSend: number; inTransit: number; received: number };
} | null> {
  const session = await requireModule("transferOrders");
  const companyId = session.user.companyId;
  if (!companyId) return null;

  if (
    session.user.clientId &&
    clientId !== ATTENDANCE_INTERNAL_ROUTE_CLIENT_ID &&
    session.user.clientId !== clientId
  ) {
    return null;
  }

  const projectWhere = await getProjectWhereForUser({
    companyId,
    clientId: session.user.clientId,
    userId: session.user.id,
    username: session.user.username,
  });

  const project = await prisma.project.findFirst({
    where: { id: projectId, ...projectWhere },
    select: {
      id: true,
      name: true,
      location: true,
      subCategory: true,
      serviceArea: true,
      clientId: true,
      client: { select: { id: true, name: true } },
    },
  });
  if (!project) return null;

  const routeClientId = transferOrderRouteClientId(project);
  if (clientId !== routeClientId) return null;

  const ordersRaw = await prisma.transferOrder.findMany({
    where: { companyId, projectId },
    include: {
      project: { select: { id: true, name: true } },
      sentBy: { select: { name: true, username: true } },
      receivedBy: {
        select: { firstName: true, lastName: true, employeeNo: true },
      },
      materialRequest: {
        select: {
          notes: true,
          reviewNote: true,
          requestedBy: {
            select: {
              firstName: true,
              lastName: true,
              employeeNo: true,
            },
          },
        },
      },
      lines: {
        include: {
          item: {
            select: {
              sku: true,
              name: true,
              unit: true,
              currentStock: true,
            },
          },
        },
      },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
  });

  const orders: TransferOrderQueueItem[] = ordersRaw.map((order) => ({
    id: order.id,
    status: order.status,
    notes: order.notes ?? order.materialRequest.notes,
    createdAt: order.createdAt,
    sentAt: order.sentAt,
    receivedAt: order.receivedAt,
    project: order.project,
    requestedByName: formatEmployeeName(order.materialRequest.requestedBy),
    requestedByNo: order.materialRequest.requestedBy.employeeNo,
    sentByName: order.sentBy?.name || order.sentBy?.username || null,
    receivedByName: order.receivedBy
      ? formatEmployeeName(order.receivedBy)
      : null,
    reviewNote: order.materialRequest.reviewNote,
    lines: order.lines.map((line) => ({
      id: line.id,
      quantity: inventoryQtyFromDecimal(line.quantity),
      item: {
        sku: line.item.sku,
        name: line.item.name,
        unit: line.item.unit,
        currentStock: inventoryQtyFromDecimal(line.item.currentStock),
      },
    })),
  }));

  return {
    clientName:
      project.client?.name ??
      (isAttendanceInternalProject(project)
        ? ATTENDANCE_INTERNAL_CLIENT_NAME
        : "Client"),
    routeClientId,
    project: {
      id: project.id,
      name: project.name,
      location: project.location,
      subCategory: project.subCategory,
    },
    orders,
    stats: {
      pendingSend: orders.filter((o) => o.status === "PENDING_SEND").length,
      inTransit: orders.filter(
        (o) => o.status === "SENT" || o.status === "NOT_RECEIVED"
      ).length,
      received: orders.filter((o) => o.status === "RECEIVED").length,
    },
  };
}

/** Warehouse: mark transfer sent — stock leaves warehouse into in transit. */
export async function markTransferOrderSent(formData: FormData) {
  const locale = await getServerLocale();
  let routeClientId: string | null = null;
  let projectId: string | null = null;
  try {
    const session = await requireModule("transferOrders");
    const company = await requireCompany(locale);
    const id = String(formData.get("id") ?? "").trim();
    if (!id) throw new Error("Transfer order id required.");

    await prisma.$transaction(async (tx) => {
      const order = await tx.transferOrder.findFirst({
        where: { id, companyId: company.id, status: "PENDING_SEND" },
        include: {
          lines: {
            include: { item: { select: { id: true, itemType: true, unit: true } } },
          },
          project: {
            select: {
              id: true,
              status: true,
              clientId: true,
              name: true,
              serviceArea: true,
              subCategory: true,
            },
          },
        },
      });
      if (!order) {
        throw new Error(translate(locale, "pages.transferOrders.notFound"));
      }
      if (
        !["IN_PROGRESS", "WAITING_FOR_APPROVAL", "ON_HOLD"].includes(
          order.project.status
        )
      ) {
        throw new Error(translate(locale, "pages.materialRequests.projectInvalid"));
      }

      projectId = order.projectId;
      routeClientId = transferOrderRouteClientId(order.project);

      const movedAt = new Date();
      for (const line of order.lines) {
        const quantity = inventoryQtyFromDecimal(line.quantity);
        const locked = await lockInventoryItemRow(tx, line.itemId);
        if (!locked || !locked.active) {
          throw new Error(translate(locale, "pages.inventory.itemNotFound"));
        }
        const currentStock = inventoryQtyFromDecimal(locked.currentStock);
        if (currentStock <= 0 || quantity > currentStock) {
          throw new Error(
            translate(locale, "pages.inventory.insufficientStock", {
              available: formatInventoryQty(currentStock),
              unit: locked.unit,
            })
          );
        }

        const isEquipment = isEquipmentItemType(line.item.itemType);
        const unitCost = isEquipment
          ? 0
          : decimalToNumber(locked.avgUnitCost) ??
            decimalToNumber(locked.lastUnitCost) ??
            0;
        const totalCost = isEquipment ? 0 : movementTotalCost(quantity, unitCost);

        const movement = await tx.inventoryMovement.create({
          data: {
            companyId: company.id,
            itemId: line.itemId,
            projectId: order.projectId,
            type: "IN_TRANSIT",
            quantity: toDecimal(-quantity),
            unitCost: toDecimal(unitCost),
            totalCost: toDecimal(totalCost),
            movedAt,
            notes: transferOrderInTransitNote(order.id),
            createdById: session.user.id,
          },
        });

        const stockUpdate = await tx.inventoryItem.updateMany({
          where: {
            id: line.itemId,
            currentStock: { gte: toDecimal(quantity) },
          },
          data: {
            currentStock: toDecimal(
              normalizeInventoryQty(currentStock - quantity)
            ),
          },
        });
        if (stockUpdate.count === 0) {
          throw new Error(
            translate(locale, "pages.inventory.insufficientStock", {
              available: formatInventoryQty(currentStock),
              unit: locked.unit,
            })
          );
        }

        if (isEquipment) {
          try {
            await markAvailableEquipmentAssetsInTransit(
              tx,
              company.id,
              line.itemId,
              order.projectId,
              quantity,
              { transitMovementId: movement.id, movedAt }
            );
            await assertEquipmentInventoryInvariants(tx, company.id, {
              itemIds: [line.itemId],
              projectId: order.projectId,
              movementIds: [],
            });
          } catch (error) {
            if (error instanceof InsufficientEquipmentAssetsError) {
              throw new Error(
                translate(
                  locale,
                  "pages.inventory.insufficientEquipmentAssetsForIssue",
                  {
                    available: String(error.available),
                    requested: String(error.requested),
                  }
                )
              );
            }
            throw error;
          }
        }
      }

      await tx.transferOrder.update({
        where: { id: order.id },
        data: {
          status: "SENT",
          sentAt: movedAt,
          sentById: session.user.id,
        },
      });
    });

    revalidateTransferOrderTree({
      clientId: routeClientId,
      projectId,
    });
    revalidatePath("/inventory");
    revalidatePath("/material-requests");
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.transferOrders.sendFailed")
    );
  }
}

/** Site: confirm transfer received (requester or CICO-checked-in staff). */
export async function markTransferOrderReceived(formData: FormData) {
  const locale = await getServerLocale();
  try {
    // Requesters have materialRequests (not transferOrders). Warehouse has TO.
    const session = await requireSession();
    const permissionUser = toPermissionUser(session);
    if (
      !canAccess(permissionUser, "materialRequests") &&
      !canAccess(permissionUser, "transferOrders")
    ) {
      throw new Error(translate(locale, "pages.transferOrders.receiveDenied"));
    }
    const company = await requireCompany(locale);
    const employee = await requireLinkedEmployee(session.user.id, company.id);
    const id = String(formData.get("id") ?? "").trim();
    if (!id) throw new Error("Transfer order id required.");

    const preview = await prisma.transferOrder.findFirst({
      where: { id, companyId: company.id, status: "SENT" },
      select: {
        id: true,
        projectId: true,
        project: {
          select: {
            clientId: true,
            name: true,
            serviceArea: true,
            subCategory: true,
          },
        },
        materialRequest: { select: { requestedById: true } },
      },
    });
    if (!preview) {
      throw new Error(translate(locale, "pages.transferOrders.notFound"));
    }

    // Allowed to confirm receipt: the original requester, or any materialRequests
    // / transferOrders user currently checked in (CICO) to the destination project.
    const isRequester = preview.materialRequest.requestedById === employee.id;
    if (!isRequester) {
      const open = await findOpenCicoAttendance(employee.id);
      const checkedInProjectId = open?.record?.projectId ?? null;
      if (checkedInProjectId !== preview.projectId) {
        throw new Error(
          translate(locale, "pages.transferOrders.mustBeCheckedInToReceive")
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      const order = await tx.transferOrder.findFirst({
        where: { id, companyId: company.id, status: "SENT" },
        include: {
          lines: {
            include: { item: { select: { id: true, itemType: true } } },
          },
        },
      });
      if (!order) {
        throw new Error(translate(locale, "pages.transferOrders.notFound"));
      }

      const receivedAt = new Date();
      const itemTypesByItemId = new Map(
        order.lines.map((line) => [line.itemId, line.item.itemType])
      );

      try {
        await issueInTransitStockToProject(tx, {
          companyId: company.id,
          orderId: order.id,
          fromProjectId: order.projectId,
          toProjectId: order.projectId,
          userId: session.user.id,
          itemTypesByItemId,
        });
        await assertEquipmentInventoryInvariants(tx, company.id, {
          itemIds: order.lines.map((line) => line.itemId),
          projectId: order.projectId,
        });
      } catch (error) {
        if (error instanceof InsufficientEquipmentAssetsError) {
          throw new Error(
            translate(
              locale,
              "pages.inventory.insufficientEquipmentAssetsForIssue",
              {
                available: String(error.available),
                requested: String(error.requested),
              }
            )
          );
        }
        throw error;
      }

      await tx.transferOrder.update({
        where: { id: order.id },
        data: {
          status: "RECEIVED",
          receivedAt,
          receivedById: employee.id,
        },
      });
    });

    revalidateTransferOrderTree({
      clientId: transferOrderRouteClientId(preview.project),
      projectId: preview.projectId,
    });
    revalidatePath("/material-requests");
    revalidatePath("/inventory");
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.transferOrders.receiveFailed")
    );
  }
}

async function assertCanConfirmSiteTransfer(
  locale: AppLocale,
  companyId: string,
  userId: string,
  order: {
    projectId: string;
    materialRequest: { requestedById: string };
  }
) {
  const employee = await requireLinkedEmployee(userId, companyId);
  const isRequester = order.materialRequest.requestedById === employee.id;
  if (!isRequester) {
    const open = await findOpenCicoAttendance(employee.id);
    const checkedInProjectId = open?.record?.projectId ?? null;
    if (checkedInProjectId !== order.projectId) {
      throw new Error(
        translate(locale, "pages.transferOrders.mustBeCheckedInToReceive")
      );
    }
  }
  return employee;
}

/** Site: shipment did not arrive. Do not expense the project. Opens item return. */
export async function markTransferOrderNotReceived(formData: FormData) {
  const locale = await getServerLocale();
  try {
    const session = await requireSession();
    const permissionUser = toPermissionUser(session);
    if (
      !canAccess(permissionUser, "materialRequests") &&
      !canAccess(permissionUser, "transferOrders")
    ) {
      throw new Error(translate(locale, "pages.transferOrders.receiveDenied"));
    }
    const company = await requireCompany(locale);
    const id = String(formData.get("id") ?? "").trim();
    if (!id) throw new Error("Transfer order id required.");

    const preview = await prisma.transferOrder.findFirst({
      where: { id, companyId: company.id, status: "SENT" },
      select: {
        id: true,
        projectId: true,
        project: {
          select: {
            clientId: true,
            name: true,
            serviceArea: true,
            subCategory: true,
          },
        },
        materialRequest: { select: { requestedById: true } },
      },
    });
    if (!preview) {
      throw new Error(translate(locale, "pages.transferOrders.notFound"));
    }

    await assertCanConfirmSiteTransfer(
      locale,
      company.id,
      session.user.id,
      preview
    );

    await prisma.transferOrder.update({
      where: { id: preview.id },
      data: { status: "NOT_RECEIVED" },
    });

    revalidateTransferOrderTree({
      clientId: transferOrderRouteClientId(preview.project),
      projectId: preview.projectId,
    });
    revalidatePath("/material-requests");
    revalidatePath("/approvals");
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.transferOrders.didNotReceiveFailed")
    );
  }
}

/** Warehouse: complete item return — restore in-transit stock to warehouse. */
export async function completeTransferOrderItemReturn(formData: FormData) {
  const locale = await getServerLocale();
  try {
    const session = await requireModule("transferOrders");
    const company = await requireCompany(locale);
    const id = String(formData.get("id") ?? "").trim();
    if (!id) throw new Error("Transfer order id required.");

    const preview = await prisma.transferOrder.findFirst({
      where: { id, companyId: company.id, status: "NOT_RECEIVED" },
      select: {
        id: true,
        projectId: true,
        project: {
          select: {
            clientId: true,
            name: true,
            serviceArea: true,
            subCategory: true,
          },
        },
      },
    });
    if (!preview) {
      throw new Error(translate(locale, "pages.transferOrders.notFound"));
    }

    await prisma.$transaction(async (tx) => {
      await returnInTransitStockToWarehouse(tx, {
        companyId: company.id,
        orderId: preview.id,
        projectId: preview.projectId,
        userId: session.user.id,
      });
      await tx.transferOrder.update({
        where: { id: preview.id },
        data: { status: "RETURNED" },
      });
    });

    revalidateTransferOrderTree({
      clientId: transferOrderRouteClientId(preview.project),
      projectId: preview.projectId,
    });
    revalidatePath("/material-requests");
    revalidatePath("/inventory");
    revalidatePath("/approvals");
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.transferOrders.itemReturnFailed")
    );
  }
}

/** Warehouse: escalate an unresolved item return to manager Needs Attention. */
export async function escalateTransferOrderNeedsAttention(formData: FormData) {
  const locale = await getServerLocale();
  try {
    const session = await requireModule("transferOrders");
    const company = await requireCompany(locale);
    const id = String(formData.get("id") ?? "").trim();
    if (!id) throw new Error("Transfer order id required.");

    const preview = await prisma.transferOrder.findFirst({
      where: { id, companyId: company.id, status: "NOT_RECEIVED" },
      select: {
        id: true,
        projectId: true,
        project: {
          select: {
            clientId: true,
            name: true,
            serviceArea: true,
            subCategory: true,
          },
        },
      },
    });
    if (!preview) {
      throw new Error(translate(locale, "pages.transferOrders.notFound"));
    }

    await prisma.transferOrder.update({
      where: { id: preview.id },
      data: { status: "NEEDS_ATTENTION" },
    });

    revalidateTransferOrderTree({
      clientId: transferOrderRouteClientId(preview.project),
      projectId: preview.projectId,
    });
    revalidatePath("/material-requests");
    revalidatePath("/approvals");
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.transferOrders.escalateFailed")
    );
  }
}

export type TransferOrderNeedsAttentionRow = TransferOrderQueueItem & {
  clientName: string;
};

export async function getNeedsAttentionTransferOrders(): Promise<
  TransferOrderNeedsAttentionRow[]
> {
  const session = await requireModule("approvals");
  const companyId = session.user.companyId;
  if (!companyId) return [];

  const projectWhere = await getProjectWhereForUser({
    companyId,
    clientId: session.user.clientId,
    userId: session.user.id,
    username: session.user.username,
  });

  const orders = await prisma.transferOrder.findMany({
    where: {
      companyId,
      status: "NEEDS_ATTENTION",
      project: projectWhere,
    },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          client: { select: { name: true } },
        },
      },
      sentBy: { select: { name: true, username: true } },
      receivedBy: {
        select: { firstName: true, lastName: true, employeeNo: true },
      },
      materialRequest: {
        select: {
          notes: true,
          reviewNote: true,
          requestedBy: {
            select: {
              firstName: true,
              lastName: true,
              employeeNo: true,
            },
          },
        },
      },
      lines: {
        include: {
          item: {
            select: {
              sku: true,
              name: true,
              unit: true,
              currentStock: true,
            },
          },
        },
      },
    },
    orderBy: { updatedAt: "asc" },
    take: 100,
  });

  return orders.map((order) => ({
    id: order.id,
    status: order.status,
    notes: order.notes ?? order.materialRequest.notes,
    createdAt: order.createdAt,
    sentAt: order.sentAt,
    receivedAt: order.receivedAt,
    project: order.project,
    requestedByName: formatEmployeeName(order.materialRequest.requestedBy),
    requestedByNo: order.materialRequest.requestedBy.employeeNo,
    sentByName: order.sentBy?.name || order.sentBy?.username || null,
    receivedByName: order.receivedBy
      ? formatEmployeeName(order.receivedBy)
      : null,
    reviewNote: order.materialRequest.reviewNote,
    lines: order.lines.map((line) => ({
      id: line.id,
      quantity: inventoryQtyFromDecimal(line.quantity),
      item: {
        sku: line.item.sku,
        name: line.item.name,
        unit: line.item.unit,
        currentStock: inventoryQtyFromDecimal(line.item.currentStock),
      },
    })),
    clientName: order.project.client?.name ?? ATTENDANCE_INTERNAL_CLIENT_NAME,
  }));
}

export type TransferAssignProjectOption = {
  id: string;
  name: string;
  clientName: string;
};

export async function listProjectsForTransferAssign(): Promise<
  TransferAssignProjectOption[]
> {
  const session = await requireModule("approvals");
  const companyId = session.user.companyId;
  if (!companyId) return [];

  const projectWhere = await getProjectWhereForUser({
    companyId,
    clientId: session.user.clientId,
    userId: session.user.id,
    username: session.user.username,
  });

  const projects = await prisma.project.findMany({
    where: {
      ...projectWhere,
      status: { in: ["IN_PROGRESS", "WAITING_FOR_APPROVAL"] },
    },
    select: {
      id: true,
      name: true,
      client: { select: { name: true } },
    },
    orderBy: [{ name: "asc" }],
    take: 300,
  });

  return projects.map((project) => ({
    id: project.id,
    name: project.name,
    clientName: project.client?.name ?? ATTENDANCE_INTERNAL_CLIENT_NAME,
  }));
}

async function loadNeedsAttentionOrder(
  companyId: string,
  id: string
) {
  return prisma.transferOrder.findFirst({
    where: { id, companyId, status: "NEEDS_ATTENTION" },
    include: {
      lines: {
        include: { item: { select: { id: true, itemType: true } } },
      },
      project: {
        select: {
          id: true,
          clientId: true,
          name: true,
          serviceArea: true,
          subCategory: true,
        },
      },
    },
  });
}

/** Manager: write off in-transit stock. Decision is final. */
export async function resolveTransferOrderWriteOff(formData: FormData) {
  const locale = await getServerLocale();
  try {
    const session = await requireModule("approvals");
    const company = await requireCompany(locale);
    const id = String(formData.get("id") ?? "").trim();
    if (!id) throw new Error("Transfer order id required.");

    const preview = await loadNeedsAttentionOrder(company.id, id);
    if (!preview) {
      throw new Error(translate(locale, "pages.transferOrders.notFound"));
    }

    await prisma.$transaction(async (tx) => {
      await writeOffInTransitStock(tx, {
        companyId: company.id,
        orderId: preview.id,
        projectId: preview.projectId,
        userId: session.user.id,
      });
      await tx.transferOrder.update({
        where: { id: preview.id },
        data: { status: "WRITTEN_OFF" },
      });
    });

    revalidateTransferOrderTree({
      clientId: transferOrderRouteClientId(preview.project),
      projectId: preview.projectId,
    });
    revalidatePath("/material-requests");
    revalidatePath("/inventory");
    revalidatePath("/approvals");
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.transferOrders.writeOffFailed")
    );
  }
}

/** Manager: assign in-transit stock to a project and expense that project. */
export async function resolveTransferOrderAssignToProject(formData: FormData) {
  const locale = await getServerLocale();
  try {
    const session = await requireModule("approvals");
    const company = await requireCompany(locale);
    const id = String(formData.get("id") ?? "").trim();
    const toProjectId = String(formData.get("projectId") ?? "").trim();
    if (!id) throw new Error("Transfer order id required.");
    if (!toProjectId) {
      throw new Error(translate(locale, "pages.transferOrders.projectRequired"));
    }

    const preview = await loadNeedsAttentionOrder(company.id, id);
    if (!preview) {
      throw new Error(translate(locale, "pages.transferOrders.notFound"));
    }

    const projectWhere = await getProjectWhereForUser({
      companyId: company.id,
      clientId: session.user.clientId,
      userId: session.user.id,
      username: session.user.username,
    });
    const destination = await prisma.project.findFirst({
      where: { id: toProjectId, ...projectWhere },
      select: { id: true },
    });
    if (!destination) {
      throw new Error(translate(locale, "pages.transferOrders.projectRequired"));
    }

    const itemTypesByItemId = new Map(
      preview.lines.map((line) => [line.itemId, line.item.itemType])
    );

    await prisma.$transaction(async (tx) => {
      try {
        await issueInTransitStockToProject(tx, {
          companyId: company.id,
          orderId: preview.id,
          fromProjectId: preview.projectId,
          toProjectId: destination.id,
          userId: session.user.id,
          itemTypesByItemId,
        });
        await assertEquipmentInventoryInvariants(tx, company.id, {
          itemIds: preview.lines.map((line) => line.itemId),
          projectId: destination.id,
        });
      } catch (error) {
        if (error instanceof InsufficientEquipmentAssetsError) {
          throw new Error(
            translate(
              locale,
              "pages.inventory.insufficientEquipmentAssetsForIssue",
              {
                available: String(error.available),
                requested: String(error.requested),
              }
            )
          );
        }
        throw error;
      }

      await tx.transferOrder.update({
        where: { id: preview.id },
        data: {
          status: "RECEIVED",
          receivedAt: new Date(),
        },
      });
    });

    revalidateTransferOrderTree({
      clientId: transferOrderRouteClientId(preview.project),
      projectId: preview.projectId,
    });
    revalidatePath("/material-requests");
    revalidatePath("/inventory");
    revalidatePath("/approvals");
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.transferOrders.assignToProjectFailed")
    );
  }
}

/** Manager: return in-transit stock to warehouse. */
export async function resolveTransferOrderAssignToStock(formData: FormData) {
  const locale = await getServerLocale();
  try {
    const session = await requireModule("approvals");
    const company = await requireCompany(locale);
    const id = String(formData.get("id") ?? "").trim();
    if (!id) throw new Error("Transfer order id required.");

    const preview = await loadNeedsAttentionOrder(company.id, id);
    if (!preview) {
      throw new Error(translate(locale, "pages.transferOrders.notFound"));
    }

    await prisma.$transaction(async (tx) => {
      await returnInTransitStockToWarehouse(tx, {
        companyId: company.id,
        orderId: preview.id,
        projectId: preview.projectId,
        userId: session.user.id,
      });
      await tx.transferOrder.update({
        where: { id: preview.id },
        data: { status: "RETURNED" },
      });
    });

    revalidateTransferOrderTree({
      clientId: transferOrderRouteClientId(preview.project),
      projectId: preview.projectId,
    });
    revalidatePath("/material-requests");
    revalidatePath("/inventory");
    revalidatePath("/approvals");
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.transferOrders.assignToStockFailed")
    );
  }
}
