import type { Prisma } from "@prisma/client";

import { OPEN_PROJECT_ASSIGNMENT_STATUSES } from "@/lib/employee-projects";
import { formatDisplayDate } from "@/lib/format-date";
import type { AppLocale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";
import { toUtcDateOnly } from "@/lib/invoice-period";
import { jakartaTodayAsUtcDateOnly } from "@/lib/leave-employment-status";
import { occupyingProjectAssignmentWhere } from "@/lib/petty-cash";
import { teamMatchesProjectServiceArea } from "@/lib/operations-team-kind";
import {
  occupancyRangeOverlapsVisit,
  visitDateRangesOverlap,
} from "@/lib/project-visits";
import {
  markEmployeesOnProject,
  stampEmployeeDepositSourceProject,
  releaseEmployeesFromProject,
} from "@/lib/workforce-crew";

const OPEN_VISIT_CREW_STATUSES = [
  "PLANNED",
  "IN_PROGRESS",
  "WAITING_FOR_APPROVAL",
  "ON_HOLD",
] as const;

export type VisitCrewConflict = {
  projectId: string;
  projectName: string;
  start: Date;
  end: Date;
};

export type VisitCrewBusyMaps = {
  employees: Map<string, VisitCrewConflict>;
  teams: Map<string, VisitCrewConflict>;
};

type VisitCrewDb = Pick<
  Prisma.TransactionClient,
  | "projectVisitAssignment"
  | "projectAssignment"
  | "operationsTeamProject"
  | "operationsTeam"
  | "employee"
  | "projectVisit"
  | "project"
>;

function localeTag(locale: AppLocale) {
  return locale === "id" ? "id-ID" : "en-GB";
}

export function formatVisitDateRange(
  start: Date,
  end: Date,
  locale: AppLocale
): string {
  const tag = localeTag(locale);
  const startLabel = formatDisplayDate(start, undefined, tag);
  const endLabel = formatDisplayDate(end, undefined, tag);
  if (startLabel === endLabel) return startLabel;
  return `${startLabel} – ${endLabel}`;
}

export function visitCrewConflictLabel(
  conflict: VisitCrewConflict,
  locale: AppLocale
): string {
  return translate(locale, "pages.projects.visitCrewBusyOn", {
    projectName: conflict.projectName,
    dates: formatVisitDateRange(conflict.start, conflict.end, locale),
  });
}

function occupyTodayStatuses(): readonly string[] {
  return ["IN_PROGRESS", "ON_HOLD"];
}

export function visitOccupiesToday(opts: {
  startDate: Date;
  endDate: Date;
  projectStatus: string;
  today?: Date;
}): boolean {
  if (!occupyTodayStatuses().includes(opts.projectStatus)) return false;
  const today = toUtcDateOnly(opts.today ?? jakartaTodayAsUtcDateOnly());
  return visitDateRangesOverlap(opts.startDate, opts.endDate, today, today);
}

function rememberConflict(
  map: Map<string, VisitCrewConflict>,
  id: string,
  conflict: VisitCrewConflict
) {
  if (!id || map.has(id)) return;
  map.set(id, conflict);
}

async function loadVisitCrewBusyMaps(
  db: VisitCrewDb,
  companyId: string,
  window: { start: Date; end: Date },
  excludeVisitId?: string
): Promise<VisitCrewBusyMaps> {
  const employees = new Map<string, VisitCrewConflict>();
  const teams = new Map<string, VisitCrewConflict>();

  const visitRows = await db.projectVisitAssignment.findMany({
    where: {
      ...(excludeVisitId ? { visitId: { not: excludeVisitId } } : {}),
      visit: {
        project: {
          companyId,
          status: { in: [...OPEN_VISIT_CREW_STATUSES] },
        },
      },
    },
    select: {
      employeeId: true,
      teamId: true,
      team: {
        select: {
          id: true,
          members: { select: { employeeId: true } },
        },
      },
      visit: {
        select: {
          startDate: true,
          endDate: true,
          projectId: true,
          project: { select: { name: true } },
        },
      },
    },
  });

  for (const row of visitRows) {
    if (
      !visitDateRangesOverlap(
        row.visit.startDate,
        row.visit.endDate,
        window.start,
        window.end
      )
    ) {
      continue;
    }
    const conflict: VisitCrewConflict = {
      projectId: row.visit.projectId,
      projectName: row.visit.project.name,
      start: row.visit.startDate,
      end: row.visit.endDate,
    };
    if (row.employeeId) {
      rememberConflict(employees, row.employeeId, conflict);
    }
    if (row.teamId) {
      rememberConflict(teams, row.teamId, conflict);
      for (const member of row.team?.members ?? []) {
        rememberConflict(employees, member.employeeId, conflict);
      }
    }
  }

  const assignmentRows = await db.projectAssignment.findMany({
    where: {
      AND: [occupyingProjectAssignmentWhere()],
      project: {
        companyId,
        status: { in: [...OPEN_PROJECT_ASSIGNMENT_STATUSES] },
        billingMode: { not: "MULTI_VISIT" },
      },
    },
    select: {
      employeeId: true,
      project: {
        select: {
          id: true,
          name: true,
          startDate: true,
          estimatedStartDate: true,
          endDate: true,
        },
      },
    },
  });

  for (const row of assignmentRows) {
    const start = row.project.startDate ?? row.project.estimatedStartDate;
    if (
      !occupancyRangeOverlapsVisit(
        start,
        row.project.endDate,
        window.start,
        window.end
      )
    ) {
      continue;
    }
    rememberConflict(employees, row.employeeId, {
      projectId: row.project.id,
      projectName: row.project.name,
      start: start ?? window.start,
      end: row.project.endDate ?? window.end,
    });
  }

  const teamLinks = await db.operationsTeamProject.findMany({
    where: {
      project: {
        companyId,
        status: { in: [...OPEN_VISIT_CREW_STATUSES] },
        billingMode: { not: "MULTI_VISIT" },
      },
    },
    select: {
      teamId: true,
      team: {
        select: {
          members: { select: { employeeId: true } },
        },
      },
      project: {
        select: {
          id: true,
          name: true,
          startDate: true,
          estimatedStartDate: true,
          endDate: true,
        },
      },
    },
  });

  for (const link of teamLinks) {
    const start = link.project.startDate ?? link.project.estimatedStartDate;
    if (
      !occupancyRangeOverlapsVisit(
        start,
        link.project.endDate,
        window.start,
        window.end
      )
    ) {
      continue;
    }
    const conflict: VisitCrewConflict = {
      projectId: link.project.id,
      projectName: link.project.name,
      start: start ?? window.start,
      end: link.project.endDate ?? window.end,
    };
    rememberConflict(teams, link.teamId, conflict);
    for (const member of link.team.members) {
      rememberConflict(employees, member.employeeId, conflict);
    }
  }

  return { employees, teams };
}

export async function visitCrewBusyMapsForWindow(
  db: VisitCrewDb,
  companyId: string,
  window: { start: Date; end: Date },
  excludeVisitId?: string
): Promise<VisitCrewBusyMaps> {
  return loadVisitCrewBusyMaps(db, companyId, window, excludeVisitId);
}

export async function assertVisitCrewAvailable(
  db: VisitCrewDb,
  opts: {
    companyId: string;
    visitId: string;
    start: Date;
    end: Date;
    employeeId?: string | null;
    teamId?: string | null;
    teamMemberIds?: string[];
    locale: AppLocale;
  }
) {
  const busy = await loadVisitCrewBusyMaps(
    db,
    opts.companyId,
    { start: opts.start, end: opts.end },
    opts.visitId
  );

  if (opts.employeeId) {
    const conflict = busy.employees.get(opts.employeeId);
    if (conflict) {
      throw new Error(visitCrewConflictLabel(conflict, opts.locale));
    }
  }

  if (opts.teamId) {
    const teamConflict = busy.teams.get(opts.teamId);
    if (teamConflict) {
      throw new Error(visitCrewConflictLabel(teamConflict, opts.locale));
    }
    for (const memberId of opts.teamMemberIds ?? []) {
      const memberConflict = busy.employees.get(memberId);
      if (memberConflict) {
        throw new Error(visitCrewConflictLabel(memberConflict, opts.locale));
      }
    }
  }
}

function visitEmployeeIds(assignment: {
  employeeId: string | null;
  team: { members: Array<{ employeeId: string }> } | null;
}): string[] {
  if (assignment.employeeId) return [assignment.employeeId];
  return (assignment.team?.members ?? []).map((member) => member.employeeId);
}

async function syncTeamProjectLink(
  db: Prisma.TransactionClient,
  projectId: string,
  teamId: string,
  shouldLink: boolean
) {
  const existing = await db.operationsTeamProject.findUnique({
    where: { teamId_projectId: { teamId, projectId } },
    select: { id: true },
  });
  if (shouldLink && !existing) {
    await db.operationsTeamProject.create({
      data: { teamId, projectId },
    });
  }
  if (!shouldLink && existing) {
    await db.operationsTeamProject.delete({
      where: { teamId_projectId: { teamId, projectId } },
    });
  }
}

/**
 * Keep ProjectAssignment / placement / team-on-job links in sync with
 * visit windows that cover today. Future visits stay booked without
 * placing people On Project yet.
 */
export async function syncVisitCrewOccupancy(
  db: Prisma.TransactionClient,
  opts: {
    companyId: string;
    projectId?: string;
  }
) {
  const today = jakartaTodayAsUtcDateOnly();
  const visits = await db.projectVisit.findMany({
    where: {
      ...(opts.projectId ? { projectId: opts.projectId } : {}),
      project: {
        companyId: opts.companyId,
        billingMode: "MULTI_VISIT",
        status: { in: [...OPEN_VISIT_CREW_STATUSES] },
      },
    },
    select: {
      id: true,
      projectId: true,
      startDate: true,
      endDate: true,
      project: {
        select: {
          id: true,
          status: true,
          subCategory: true,
        },
      },
      assignments: {
        select: {
          employeeId: true,
          teamId: true,
          team: {
            select: {
              members: { select: { employeeId: true } },
            },
          },
        },
      },
    },
  });

  const projectIds = [...new Set(visits.map((visit) => visit.projectId))];
  if (projectIds.length === 0) return;

  const liveEmployeeIdsByProject = new Map<string, Set<string>>();
  const bookedTeamIdsByProject = new Map<string, Set<string>>();

  for (const visit of visits) {
    const assignment = visit.assignments[0];
    if (!assignment) continue;

    const bookedTeams =
      bookedTeamIdsByProject.get(visit.projectId) ?? new Set<string>();
    if (assignment.teamId) bookedTeams.add(assignment.teamId);
    bookedTeamIdsByProject.set(visit.projectId, bookedTeams);

    if (
      !visitOccupiesToday({
        startDate: visit.startDate,
        endDate: visit.endDate,
        projectStatus: visit.project.status,
        today,
      })
    ) {
      continue;
    }

    const employeeIds = visitEmployeeIds(assignment);
    const liveEmployees =
      liveEmployeeIdsByProject.get(visit.projectId) ?? new Set<string>();
    for (const employeeId of employeeIds) liveEmployees.add(employeeId);
    liveEmployeeIdsByProject.set(visit.projectId, liveEmployees);
  }

  for (const projectId of projectIds) {
    const liveIds = [...(liveEmployeeIdsByProject.get(projectId) ?? [])];
    const bookedTeams = [...(bookedTeamIdsByProject.get(projectId) ?? [])];
    const project = visits.find((visit) => visit.projectId === projectId)?.project;
    if (!project) continue;

    const currentAssignments = await db.projectAssignment.findMany({
      where: { projectId, isBackup: false },
      select: { employeeId: true },
    });
    const currentIds = currentAssignments.map((row) => row.employeeId);
    const liveSet = new Set(liveIds);
    const staleIds = currentIds.filter((employeeId) => !liveSet.has(employeeId));
    if (staleIds.length > 0) {
      await releaseEmployeesFromProject(db, projectId, staleIds);
    }

    const missingIds = liveIds.filter((employeeId) => !currentIds.includes(employeeId));
    if (missingIds.length > 0) {
      await db.projectAssignment.createMany({
        data: missingIds.map((employeeId) => ({
          projectId,
          employeeId,
        })),
        skipDuplicates: true,
      });
      await markEmployeesOnProject(db, missingIds, opts.companyId);
      await stampEmployeeDepositSourceProject(db, missingIds, {
        id: projectId,
        subCategory: project.subCategory,
      });
    }

    const existingTeamLinks = await db.operationsTeamProject.findMany({
      where: { projectId },
      select: { teamId: true },
    });
    const bookedTeamSet = new Set(bookedTeams);
    for (const link of existingTeamLinks) {
      await syncTeamProjectLink(
        db,
        projectId,
        link.teamId,
        bookedTeamSet.has(link.teamId)
      );
    }
    for (const teamId of bookedTeams) {
      await syncTeamProjectLink(db, projectId, teamId, true);
    }
  }
}

export async function replaceProjectVisitAssignment(
  db: Prisma.TransactionClient,
  opts: {
    companyId: string;
    visitId: string;
    employeeId?: string | null;
    teamId?: string | null;
    locale: AppLocale;
  }
) {
  const employeeId = opts.employeeId?.trim() || null;
  const teamId = opts.teamId?.trim() || null;
  if (employeeId && teamId) {
    throw new Error(translate(opts.locale, "pages.projects.visitCrewXor"));
  }
  if (!employeeId && !teamId) {
    throw new Error(translate(opts.locale, "pages.projects.visitCrewNeedChoice"));
  }

  const visit = await db.projectVisit.findFirst({
    where: {
      id: opts.visitId,
      project: { companyId: opts.companyId },
    },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      projectId: true,
      project: {
        select: {
          id: true,
          companyId: true,
          status: true,
          billingMode: true,
          subCategory: true,
          serviceArea: true,
          areaCatalogId: true,
        },
      },
    },
  });
  if (!visit || visit.project.billingMode !== "MULTI_VISIT") {
    throw new Error(translate(opts.locale, "pages.projects.visitCrewNotFound"));
  }

  let teamMemberIds: string[] = [];
  if (teamId) {
    const team = await db.operationsTeam.findFirst({
      where: { id: teamId, companyId: opts.companyId },
      select: {
        id: true,
        kind: true,
        serviceAreaCatalogId: true,
        serviceAreaCatalog: { select: { systemArea: true } },
        members: { select: { employeeId: true } },
      },
    });
    if (!team) {
      throw new Error(translate(opts.locale, "pages.projects.visitCrewTeamMissing"));
    }
    if (
      !teamMatchesProjectServiceArea(
        {
          serviceAreaCatalogId: team.serviceAreaCatalogId,
          catalogSystemArea: team.serviceAreaCatalog?.systemArea ?? null,
          kind: team.kind,
        },
        {
          areaCatalogId: visit.project.areaCatalogId,
          serviceArea: visit.project.serviceArea,
          subCategory: visit.project.subCategory,
        }
      )
    ) {
      throw new Error(translate(opts.locale, "pages.projects.visitCrewTeamWrongType"));
    }
    teamMemberIds = team.members.map((member) => member.employeeId);
  }

  if (employeeId) {
    const employee = await db.employee.findFirst({
      where: {
        id: employeeId,
        companyId: opts.companyId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        operationsTeamMembership: { select: { teamId: true } },
      },
    });
    if (!employee) {
      throw new Error(translate(opts.locale, "pages.projects.visitCrewEmployeeMissing"));
    }
    if (employee.operationsTeamMembership) {
      throw new Error(
        translate(opts.locale, "pages.projects.visitCrewEmployeeOnTeam")
      );
    }
  }

  await assertVisitCrewAvailable(db, {
    companyId: opts.companyId,
    visitId: visit.id,
    start: visit.startDate,
    end: visit.endDate,
    employeeId,
    teamId,
    teamMemberIds,
    locale: opts.locale,
  });

  await db.projectVisitAssignment.upsert({
    where: { visitId: visit.id },
    create: {
      visitId: visit.id,
      employeeId,
      teamId,
    },
    update: {
      employeeId,
      teamId,
    },
  });

  await syncVisitCrewOccupancy(db, {
    companyId: opts.companyId,
    projectId: visit.projectId,
  });
}

export async function clearProjectVisitAssignmentRow(
  db: Prisma.TransactionClient,
  opts: {
    companyId: string;
    visitId: string;
    locale: AppLocale;
  }
) {
  const visit = await db.projectVisit.findFirst({
    where: {
      id: opts.visitId,
      project: { companyId: opts.companyId },
    },
    select: {
      id: true,
      projectId: true,
      project: { select: { billingMode: true } },
    },
  });
  if (!visit || visit.project.billingMode !== "MULTI_VISIT") {
    throw new Error(translate(opts.locale, "pages.projects.visitCrewNotFound"));
  }

  await db.projectVisitAssignment.deleteMany({
    where: { visitId: visit.id },
  });
  await syncVisitCrewOccupancy(db, {
    companyId: opts.companyId,
    projectId: visit.projectId,
  });
}

