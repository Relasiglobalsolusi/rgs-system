import type { Prisma } from "@prisma/client";

import type { AppLocale } from "@/lib/i18n/locale";
import { assertVisitCrewAvailable } from "@/lib/project-visit-crew";
import type { PlannedProjectVisit } from "@/lib/project-visits";

type VisitSyncDb = Prisma.TransactionClient;

/** Save uninvoiced visit windows and clash-check assigned crew. Invoiced visits stay locked. */
export async function syncUninvoicedProjectVisits(
  db: VisitSyncDb,
  opts: {
    companyId: string;
    projectId: string;
    visits: PlannedProjectVisit[];
    locale: AppLocale;
  }
) {
  const existing = await db.projectVisit.findMany({
    where: { projectId: opts.projectId },
    include: {
      assignments: {
        select: {
          employeeId: true,
          teamId: true,
          team: { select: { members: { select: { employeeId: true } } } },
        },
      },
    },
    orderBy: { visitIndex: "asc" },
  });

  const byIndex = new Map(existing.map((row) => [row.visitIndex, row]));
  const keepIndexes = new Set(opts.visits.map((visit) => visit.visitIndex));

  for (const visit of opts.visits) {
    const row = byIndex.get(visit.visitIndex);
    if (row?.invoicePeriodId) continue;

    const assignment = row?.assignments[0];
    if (assignment) {
      await assertVisitCrewAvailable(db, {
        companyId: opts.companyId,
        visitId: row.id,
        start: visit.startDate,
        end: visit.endDate,
        employeeId: assignment.employeeId,
        teamId: assignment.teamId,
        teamMemberIds: assignment.team?.members.map((member) => member.employeeId),
        locale: opts.locale,
      });
    }

    if (row) {
      await db.projectVisit.update({
        where: { id: row.id },
        data: {
          startDate: visit.startDate,
          endDate: visit.endDate,
          amount: visit.amount,
        },
      });
    } else {
      await db.projectVisit.create({
        data: {
          projectId: opts.projectId,
          visitIndex: visit.visitIndex,
          startDate: visit.startDate,
          endDate: visit.endDate,
          amount: visit.amount,
        },
      });
    }
  }

  const staleIds = existing
    .filter(
      (row) => !row.invoicePeriodId && !keepIndexes.has(row.visitIndex)
    )
    .map((row) => row.id);
  if (staleIds.length > 0) {
    await db.projectVisit.deleteMany({ where: { id: { in: staleIds } } });
  }
}
