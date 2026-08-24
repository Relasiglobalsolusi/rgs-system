/**
 * Demo pending Transfer Orders for the Transfer Orders home-page cards.
 *
 * Open statuses match `TRANSFER_ORDER_OPEN_STATUSES` in
 * `lib/transfer-order-directory.ts`: PENDING_SEND (approved, waiting send)
 * and SENT (in transit, waiting receive).
 *
 * Prefers live demo sites (Ftl Kebon Sirih, Lotte, Wong Hang, Twin Period Tower)
 * and falls back to `seed-demo-all-modules` project ids.
 *
 * Idempotent by stable ids (`demo-pending-to-*`). Does not overwrite owner `vicko`.
 *
 * Usage: npx tsx prisma/seed-demo-pending-transfer-orders.ts
 */
import {
  MaterialRequestStatus,
  PrismaClient,
  TransferOrderStatus,
} from "@prisma/client";

import { toDecimal } from "../lib/inventory";

type Db = PrismaClient;

type ItemPick = { id: string; name: string; itemType: string; unit: string };

type ProjectPick = {
  id: string;
  name: string;
  clientId: string | null;
  client: { id: string; name: string } | null;
};

type LineSpec = { itemNames: string[]; itemType?: string; quantity: number };

type OrderSpec = {
  key: string;
  hints: string[];
  fallbackProjectId: string;
  status: TransferOrderStatus;
  notes: string;
  createdAt: Date;
  sentAt: Date | null;
  lines: LineSpec[];
};

function utcDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

const ORDER_SPECS: OrderSpec[] = [
  {
    key: "ftl",
    hints: ["Ftl Kebon Sirih", "Kebon Sirih"],
    fallbackProjectId: "project-demo-mod-gc-contract",
    status: TransferOrderStatus.PENDING_SEND,
    notes: "Approved — waiting warehouse send (lobby mop + chemical top-up)",
    createdAt: utcDate(2026, 8, 18),
    sentAt: null,
    lines: [
      { itemNames: ["Mop"], itemType: "Consumable", quantity: 6 },
      { itemNames: ["Eventual"], itemType: "Chemical", quantity: 2 },
      { itemNames: ["Demo Microfiber Cloth"], itemType: "Consumable", quantity: 24 },
    ],
  },
  {
    key: "lotte",
    hints: ["Lotte Loc 1", "Lotte"],
    fallbackProjectId: "project-demo-mod-facade-contract",
    status: TransferOrderStatus.SENT,
    notes: "Sent from warehouse — waiting site receive",
    createdAt: utcDate(2026, 8, 17),
    sentAt: utcDate(2026, 8, 19),
    lines: [
      { itemNames: ["Revontulet GR"], itemType: "Chemical", quantity: 3 },
      { itemNames: ["Demo Floor Cleaner 20L"], itemType: "Chemical", quantity: 2 },
    ],
  },
  {
    key: "wong",
    hints: ["Wong Hang"],
    fallbackProjectId: "project-demo-mod-gc-onetime",
    status: TransferOrderStatus.PENDING_SEND,
    notes: "Approved — sweeper plus chemical for first visit",
    createdAt: utcDate(2026, 8, 19),
    sentAt: null,
    lines: [
      { itemNames: ["Floor Sweeper"], itemType: "Equipment", quantity: 1 },
      { itemNames: ["Revontulet MR"], itemType: "Chemical", quantity: 2 },
      { itemNames: ["Mop"], itemType: "Consumable", quantity: 4 },
    ],
  },
  {
    key: "twin",
    hints: ["Demo — Twin Period Tower", "Twin Period Tower", "Twin Period"],
    fallbackProjectId: "project-demo-mod-period-rows",
    status: TransferOrderStatus.SENT,
    notes: "Weekly consumable restock — in transit",
    createdAt: utcDate(2026, 8, 16),
    sentAt: utcDate(2026, 8, 18),
    lines: [
      { itemNames: ["Demo Microfiber Cloth"], itemType: "Consumable", quantity: 16 },
      { itemNames: ["Demo Floor Cleaner 20L"], itemType: "Chemical", quantity: 1 },
    ],
  },
];

async function findProject(
  prisma: Db,
  companyId: string,
  spec: OrderSpec
): Promise<ProjectPick | null> {
  for (const hint of spec.hints) {
    const match = await prisma.project.findFirst({
      where: {
        companyId,
        clientId: { not: null },
        subCategory: { not: "INTERNAL" },
        name: { contains: hint, mode: "insensitive" },
      },
      select: {
        id: true,
        name: true,
        clientId: true,
        client: { select: { id: true, name: true } },
      },
    });
    if (match) return match;
  }

  return prisma.project.findFirst({
    where: { id: spec.fallbackProjectId, companyId },
    select: {
      id: true,
      name: true,
      clientId: true,
      client: { select: { id: true, name: true } },
    },
  });
}

async function findItem(
  prisma: Db,
  companyId: string,
  spec: LineSpec
): Promise<ItemPick | null> {
  for (const name of spec.itemNames) {
    const exact = await prisma.inventoryItem.findFirst({
      where: {
        companyId,
        active: true,
        deletedAt: null,
        name: { equals: name, mode: "insensitive" },
      },
      select: { id: true, name: true, itemType: true, unit: true },
    });
    if (exact) return exact;
  }

  if (spec.itemType) {
    return prisma.inventoryItem.findFirst({
      where: {
        companyId,
        active: true,
        deletedAt: null,
        itemType: spec.itemType,
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, itemType: true, unit: true },
    });
  }

  return null;
}

async function resolveRequesterIds(prisma: Db, companyId: string) {
  const preferredNos = ["OPR-001", "OPR-002", "OPR-018", "OPR-011"];
  const ids: string[] = [];
  for (const employeeNo of preferredNos) {
    const row = await prisma.employee.findFirst({
      where: { companyId, employeeNo, status: "ACTIVE" },
      select: { id: true },
    });
    if (row) ids.push(row.id);
  }
  if (ids.length > 0) return ids;

  const fallback = await prisma.employee.findFirst({
    where: {
      companyId,
      status: "ACTIVE",
      NOT: { user: { is: { username: "vicko" } } },
    },
    select: { id: true },
  });
  if (!fallback) {
    throw new Error("No active employee found to request materials.");
  }
  return [fallback.id];
}

export async function seedDemoPendingTransferOrders(db?: PrismaClient) {
  const ownsClient = !db;
  const prisma = db ?? new PrismaClient();

  try {
    const company =
      (await prisma.company.findUnique({ where: { id: "rgs-company" } })) ??
      (await prisma.company.findFirst({ orderBy: { createdAt: "asc" } }));
    if (!company) {
      throw new Error("No company found. Run npm run db:seed first.");
    }

    const reviewer =
      (await prisma.user.findFirst({
        where: { companyId: company.id, username: "manager" },
        select: { id: true },
      })) ??
      (await prisma.user.findFirst({
        where: { companyId: company.id, username: "warehouse" },
        select: { id: true },
      }));
    const sender =
      (await prisma.user.findFirst({
        where: { companyId: company.id, username: "warehouse" },
        select: { id: true },
      })) ?? reviewer;

    const requesterIds = await resolveRequesterIds(prisma, company.id);
    const created: Array<{
      client: string;
      site: string;
      status: TransferOrderStatus;
      items: string;
    }> = [];

    for (const [index, spec] of ORDER_SPECS.entries()) {
      const project = await findProject(prisma, company.id, spec);
      if (!project || !project.clientId) {
        console.log(`Skip ${spec.key}: project not found.`);
        continue;
      }

      const resolvedLines: Array<{ item: ItemPick; quantity: number }> = [];
      for (const line of spec.lines) {
        const item = await findItem(prisma, company.id, line);
        if (!item) {
          console.log(`Skip line on ${spec.key}: no item for ${line.itemNames.join("/")}.`);
          continue;
        }
        resolvedLines.push({ item, quantity: line.quantity });
      }
      if (resolvedLines.length === 0) {
        console.log(`Skip ${spec.key}: no inventory items resolved.`);
        continue;
      }

      const mrId = `demo-pending-to-mr-${spec.key}`;
      const toId = `demo-pending-to-${spec.key}`;
      const requestedById = requesterIds[index % requesterIds.length];
      const isSent = spec.status === TransferOrderStatus.SENT;

      const mr = await prisma.materialRequest.upsert({
        where: { id: mrId },
        update: {
          projectId: project.id,
          status: MaterialRequestStatus.APPROVED,
          notes: spec.notes,
          requestedById,
          reviewedById: reviewer?.id ?? null,
          reviewedAt: spec.createdAt,
        },
        create: {
          id: mrId,
          companyId: company.id,
          projectId: project.id,
          requestedById,
          status: MaterialRequestStatus.APPROVED,
          notes: spec.notes,
          reviewedById: reviewer?.id ?? null,
          reviewedAt: spec.createdAt,
          createdAt: spec.createdAt,
        },
      });

      if (
        (await prisma.materialRequestLine.count({
          where: { materialRequestId: mr.id },
        })) === 0
      ) {
        await prisma.materialRequestLine.createMany({
          data: resolvedLines.map((line) => ({
            materialRequestId: mr.id,
            itemId: line.item.id,
            quantity: toDecimal(line.quantity),
          })),
        });
      }

      await prisma.transferOrder.upsert({
        where: { id: toId },
        update: {
          projectId: project.id,
          materialRequestId: mr.id,
          status: spec.status,
          notes: spec.notes,
          sentAt: isSent ? spec.sentAt : null,
          sentById: isSent ? sender?.id ?? null : null,
          receivedAt: null,
          receivedById: null,
          createdAt: spec.createdAt,
        },
        create: {
          id: toId,
          companyId: company.id,
          projectId: project.id,
          materialRequestId: mr.id,
          status: spec.status,
          notes: spec.notes,
          sentAt: isSent ? spec.sentAt : null,
          sentById: isSent ? sender?.id ?? null : null,
          createdAt: spec.createdAt,
        },
      });

      if (
        (await prisma.transferOrderLine.count({
          where: { transferOrderId: toId },
        })) === 0
      ) {
        await prisma.transferOrderLine.createMany({
          data: resolvedLines.map((line) => ({
            transferOrderId: toId,
            itemId: line.item.id,
            quantity: toDecimal(line.quantity),
          })),
        });
      }

      created.push({
        client: project.client?.name ?? "Client",
        site: project.name,
        status: spec.status,
        items: resolvedLines
          .map((line) => `${line.quantity} ${line.item.unit} ${line.item.name}`)
          .join(", "),
      });
    }

    const clients = new Set(created.map((row) => row.client));
    const sites = new Set(created.map((row) => row.site));
    console.log("Demo pending Transfer Orders ready for /transfer-orders cards.");
    console.log(`  TOs: ${created.length}  •  clients: ${clients.size}  •  sites: ${sites.size}`);
    for (const row of created) {
      console.log(`  • ${row.status}  ${row.client} / ${row.site}`);
      console.log(`      ${row.items}`);
    }
    console.log("Re-run: npx tsx prisma/seed-demo-pending-transfer-orders.ts");
  } finally {
    if (ownsClient) {
      await prisma.$disconnect();
    }
  }
}

const isDirectRun =
  typeof process.argv[1] === "string" &&
  process.argv[1]
    .replace(/\\/g, "/")
    .endsWith("prisma/seed-demo-pending-transfer-orders.ts");

if (isDirectRun) {
  seedDemoPendingTransferOrders().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
