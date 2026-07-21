/**
 * One-off: list and delete Project History entries
 * (COMPLETED + all invoice periods PAID).
 * Does NOT touch Payment Due or active projects.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const historyWhere = {
  status: "COMPLETED" as const,
  AND: [
    { invoicePeriods: { some: { status: "PAID" as const } } },
    {
      invoicePeriods: {
        none: {
          status: {
            in: [
              "AWAITING_PAYMENT" as const,
              "OVERDUE" as const,
              "COMPILING" as const,
            ],
          },
        },
      },
    },
  ],
};

const paymentDueWhere = {
  status: { not: "CANCELLED" as const },
  OR: [
    {
      invoicePeriods: {
        some: {
          status: {
            in: ["AWAITING_PAYMENT" as const, "OVERDUE" as const],
          },
        },
      },
    },
    {
      status: "COMPLETED" as const,
      NOT: {
        AND: [
          { invoicePeriods: { some: { status: "PAID" as const } } },
          {
            invoicePeriods: {
              none: {
                status: {
                  in: [
                    "AWAITING_PAYMENT" as const,
                    "OVERDUE" as const,
                    "COMPILING" as const,
                  ],
                },
              },
            },
          },
        ],
      },
    },
  ],
};

async function main() {
  const mode = process.argv[2] ?? "list";

  const history = await prisma.project.findMany({
    where: historyWhere,
    select: {
      id: true,
      name: true,
      status: true,
      client: { select: { name: true } },
      _count: {
        select: {
          invoicePeriods: true,
          assignments: true,
          progressReports: true,
          dailyProgress: true,
          attendances: true,
          progressWarningAcks: true,
        },
      },
      invoicePeriods: {
        select: { id: true, status: true, label: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const paymentDue = await prisma.project.findMany({
    where: paymentDueWhere,
    select: { id: true, name: true, status: true },
    orderBy: { name: "asc" },
  });

  const active = await prisma.project.findMany({
    where: { status: { not: "COMPLETED" } },
    select: { id: true, name: true, status: true },
    orderBy: { name: "asc" },
  });

  console.log("=== Project History (to clear) ===");
  console.log(`count: ${history.length}`);
  for (const p of history) {
    console.log(
      `- ${p.name} (${p.id}) client=${p.client?.name ?? "—"} invoices=${p._count.invoicePeriods} attendances=${p._count.attendances} reports=${p._count.progressReports}`
    );
  }

  console.log("\n=== Payment Due (leave intact) ===");
  console.log(`count: ${paymentDue.length}`);
  for (const p of paymentDue) {
    console.log(`- ${p.name} (${p.status})`);
  }

  console.log("\n=== Active / non-COMPLETED (leave intact) ===");
  console.log(`count: ${active.length}`);
  for (const p of active) {
    console.log(`- ${p.name} (${p.status})`);
  }

  if (mode !== "delete") {
    console.log("\n(list only — pass 'delete' to remove history projects)");
    return;
  }

  if (history.length === 0) {
    console.log("\nNothing to delete.");
    return;
  }

  const ids = history.map((p) => p.id);

  const result = await prisma.$transaction(async (tx) => {
    // Attendance.projectId has no onDelete Cascade — null it out first.
    const attendances = await tx.attendance.updateMany({
      where: { projectId: { in: ids } },
      data: { projectId: null },
    });

    const deleted = await tx.project.deleteMany({
      where: { id: { in: ids } },
    });

    return { attendancesDetached: attendances.count, projectsDeleted: deleted.count };
  });

  const remainingHistory = await prisma.project.count({ where: historyWhere });
  const remainingPaymentDue = await prisma.project.count({
    where: paymentDueWhere,
  });
  const remainingActive = await prisma.project.count({
    where: { status: { not: "COMPLETED" } },
  });

  console.log("\n=== Delete result ===");
  console.log(JSON.stringify(result, null, 2));
  console.log(
    `remaining history=${remainingHistory} paymentDue=${remainingPaymentDue} active=${remainingActive}`
  );
  console.log(
    "cleared names:",
    history.map((p) => p.name).join(", ")
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
