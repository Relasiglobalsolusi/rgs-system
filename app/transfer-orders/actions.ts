"use server";

import { revalidatePath } from "next/cache";
import type { ProjectSubCategory, TransferOrderStatus } from "@prisma/client";

import { findOpenCicoAttendance } from "@/lib/cico-attendance";
import {
  InsufficientEquipmentAssetsError,
  assertEquipmentInventoryInvariants,
  assignAvailableEquipmentAssetsToProject,
  isEquipmentItemType,
} from "@/lib/equipment-asset";
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
  type TransferOrderProjectRow,
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
    const transitInc = row.status === "SENT" ? 1 : 0;
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
      select: { status: true, projectId: true },
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

  return {
    clients,
    internalSites,
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
      inTransit: orders.filter((o) => o.status === "SENT").length,
      received: orders.filter((o) => o.status === "RECEIVED").length,
    },
  };
}

/** Warehouse: mark transfer sent and issue stock to the project. */
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
            type: "ISSUE_TO_PROJECT",
            quantity: toDecimal(-quantity),
            unitCost: toDecimal(unitCost),
            totalCost: toDecimal(totalCost),
            movedAt,
            notes: `Transfer order ${order.id}`,
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
            await assignAvailableEquipmentAssetsToProject(
              tx,
              company.id,
              line.itemId,
              order.projectId,
              quantity,
              { issueMovementId: movement.id, assignedAt: movedAt }
            );
            await assertEquipmentInventoryInvariants(tx, company.id, {
              itemIds: [line.itemId],
              projectId: order.projectId,
              movementIds: [movement.id],
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

    const order = await prisma.transferOrder.findFirst({
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
    if (!order) {
      throw new Error(translate(locale, "pages.transferOrders.notFound"));
    }

    // Allowed to confirm receipt: the original requester, or any materialRequests
    // / transferOrders user currently checked in (CICO) to the destination project.
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

    await prisma.transferOrder.update({
      where: { id: order.id },
      data: {
        status: "RECEIVED",
        receivedAt: new Date(),
        receivedById: employee.id,
      },
    });

    revalidateTransferOrderTree({
      clientId: transferOrderRouteClientId(order.project),
      projectId: order.projectId,
    });
    revalidatePath("/material-requests");
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.transferOrders.receiveFailed")
    );
  }
}
