import type { Prisma } from "@prisma/client";

import { OPEN_PROJECT_ASSIGNMENT_STATUSES } from "@/lib/employee-projects";
import { toUtcDateOnly } from "@/lib/invoice-period";
import {
  assertEmployeesNotOnOtherProject,
  markEmployeesOnProject,
  releaseEmployeesFromProject,
} from "@/lib/workforce-crew";
import {
  OPERATIONS_TEAM_KINDS,
  isOperationsTeamKind,
  legacyKindForCatalogArea,
  operationsTeamKindForSubCategory,
  teamKindMatchesProjectSubCategory,
  teamMatchesProjectServiceArea,
  type OperationsTeamKindValue,
} from "@/lib/operations-team-kind";

export {
  OPERATIONS_TEAM_KINDS,
  isOperationsTeamKind,
  legacyKindForCatalogArea,
  operationsTeamKindForSubCategory,
  teamKindMatchesProjectSubCategory,
  teamMatchesProjectServiceArea,
};
export type { OperationsTeamKindValue };

export const OPEN_TEAM_PROJECT_STATUSES = [
  "PLANNED",
  "IN_PROGRESS",
  "WAITING_FOR_APPROVAL",
] as const;

export function eligibleTeamMemberWhere(
  companyId: string
): Prisma.EmployeeWhereInput {
  return {
    companyId,
    status: "ACTIVE",
    employmentType: "FULL_TIME",
    category: { active: true, slug: "operations" },
    jobPosition: {
      active: true,
      slug: { in: ["cleaning-staff", "gc-staff"] },
    },
    operationsTeamMembership: null,
  };
}

export type TeamOccupancyWindow = {
  projectId: string;
  projectName: string;
  start: Date | null;
  end: Date | null;
  status: string;
};

export function occupancyWindowsFromLinks(
  links: Array<{
    project: {
      id: string;
      name: string;
      status: string;
      billingMode?: string | null;
      startDate: Date | null;
      estimatedStartDate: Date | null;
      endDate: Date | null;
    };
  }>
): TeamOccupancyWindow[] {
  return links
    .filter((link) =>
      (OPEN_TEAM_PROJECT_STATUSES as readonly string[]).includes(
        link.project.status
      )
    )
    .filter((link) => link.project.billingMode !== "MULTI_VISIT")
    .map((link) => ({
      projectId: link.project.id,
      projectName: link.project.name,
      start: link.project.startDate ?? link.project.estimatedStartDate,
      end: link.project.endDate,
      status: link.project.status,
    }));
}

export function occupancyWindowsFromVisitAssignments(
  assignments: Array<{
    visit: {
      startDate: Date;
      endDate: Date;
      project: {
        id: string;
        name: string;
        status: string;
      };
    };
  }>
): TeamOccupancyWindow[] {
  return assignments
    .filter((row) =>
      (OPEN_TEAM_PROJECT_STATUSES as readonly string[]).includes(
        row.visit.project.status
      )
    )
    .map((row) => ({
      projectId: row.visit.project.id,
      projectName: row.visit.project.name,
      start: row.visit.startDate,
      end: row.visit.endDate,
      status: row.visit.project.status,
    }));
}

export function occupancyWindowsForTeam(opts: {
  projectLinks: Array<{
    project: {
      id: string;
      name: string;
      status: string;
      billingMode?: string | null;
      startDate: Date | null;
      estimatedStartDate: Date | null;
      endDate: Date | null;
    };
  }>;
  visitAssignments?: Array<{
    visit: {
      startDate: Date;
      endDate: Date;
      project: {
        id: string;
        name: string;
        status: string;
      };
    };
  }>;
}): TeamOccupancyWindow[] {
  return [
    ...occupancyWindowsFromLinks(opts.projectLinks),
    ...occupancyWindowsFromVisitAssignments(opts.visitAssignments ?? []),
  ];
}

export function currentOccupiedProjectName(
  windows: TeamOccupancyWindow[],
  today: Date
): string | null {
  const todayUtc = toUtcDateOnly(today);
  for (const window of windows) {
    if (window.status === "IN_PROGRESS" && !window.start && !window.end) {
      return window.projectName;
    }
    const start = window.start ? toUtcDateOnly(window.start) : null;
    const end = window.end ? toUtcDateOnly(window.end) : null;
    if (start && todayUtc < start) continue;
    if (end && todayUtc > end) continue;
    if (start || end || window.status === "IN_PROGRESS") {
      return window.projectName;
    }
  }
  return null;
}

export function windowCoversDay(
  window: TeamOccupancyWindow,
  day: Date
): boolean {
  const dayUtc = toUtcDateOnly(day);
  const start = window.start ? toUtcDateOnly(window.start) : null;
  const end = window.end ? toUtcDateOnly(window.end) : null;
  if (!start && !end) {
    const today = toUtcDateOnly(new Date());
    return window.status === "IN_PROGRESS" && dayUtc.getTime() === today.getTime();
  }
  if (start && dayUtc < start) return false;
  if (end && dayUtc > end) return false;
  return true;
}

type TeamSyncDb = Prisma.TransactionClient;

export async function syncTeamMemberOntoOpenJobs(
  db: TeamSyncDb,
  companyId: string,
  teamId: string,
  employeeId: string
) {
  const links = await db.operationsTeamProject.findMany({
    where: {
      teamId,
      project: {
        companyId,
        status: { in: [...OPEN_PROJECT_ASSIGNMENT_STATUSES] },
      },
    },
    select: {
      projectId: true,
      project: { select: { billingMode: true } },
    },
  });

  const { visitOccupiesToday } = await import("@/lib/project-visit-crew");
  const { jakartaTodayAsUtcDateOnly } = await import(
    "@/lib/leave-employment-status"
  );
  const today = jakartaTodayAsUtcDateOnly();

  for (const link of links) {
    if (link.project.billingMode === "MULTI_VISIT") {
      const liveVisit = await db.projectVisit.findFirst({
        where: {
          projectId: link.projectId,
          assignments: { some: { teamId } },
        },
        select: {
          startDate: true,
          endDate: true,
          project: { select: { status: true } },
        },
      });
      const occupies = liveVisit
        ? visitOccupiesToday({
            startDate: liveVisit.startDate,
            endDate: liveVisit.endDate,
            projectStatus: liveVisit.project.status,
            today,
          })
        : false;
      if (!occupies) continue;
    }
    await assertEmployeesNotOnOtherProject(db, companyId, [employeeId], {
      excludeProjectId: link.projectId,
    });
    await db.projectAssignment.upsert({
      where: {
        projectId_employeeId: {
          projectId: link.projectId,
          employeeId,
        },
      },
      create: { projectId: link.projectId, employeeId },
      update: {},
    });
    await markEmployeesOnProject(db, [employeeId], companyId);
  }
}

export async function releaseTeamMemberFromOpenJobs(
  db: TeamSyncDb,
  teamId: string,
  employeeId: string
) {
  const links = await db.operationsTeamProject.findMany({
    where: { teamId },
    select: { projectId: true },
  });
  for (const link of links) {
    await releaseEmployeesFromProject(db, link.projectId, [employeeId]);
  }
}

export function mapProjectTeamOption(team: {
  id: string;
  name: string;
  kind: string | null;
  serviceAreaCatalogId?: string | null;
  serviceAreaCatalog?: { systemArea: string } | null;
  members: Array<{
    employeeId: string;
    employee: { firstName: string; lastName: string };
  }>;
}) {
  return {
    id: team.id,
    name: team.name,
    kind: team.kind ?? "",
    serviceAreaCatalogId: team.serviceAreaCatalogId ?? null,
    catalogSystemArea: team.serviceAreaCatalog?.systemArea ?? null,
    memberIds: team.members.map((member) => member.employeeId),
    memberNames: team.members.map(
      (member) => `${member.employee.firstName} ${member.employee.lastName}`
    ),
  };
}

export function parseTeamIdsFromForm(formData: FormData): string[] {
  return [
    ...new Set(formData.getAll("teamIds").map((value) => String(value).trim()).filter(Boolean)),
  ];
}

export async function applyOperationsTeamAssignments(
  db: TeamSyncDb,
  opts: {
    companyId: string;
    projectId: string;
    subCategory: string;
    areaCatalogId?: string | null;
    serviceArea?: string | null;
    teamIds: string[];
    extraEmployeeIds: string[];
  }
): Promise<string[]> {
  const nextTeamIds = [...new Set(opts.teamIds.filter(Boolean))];
  const teams =
    nextTeamIds.length > 0
      ? await db.operationsTeam.findMany({
          where: { id: { in: nextTeamIds }, companyId: opts.companyId },
          include: {
            members: { select: { employeeId: true } },
            serviceAreaCatalog: { select: { id: true, systemArea: true } },
          },
        })
      : [];
  if (teams.length !== nextTeamIds.length) {
    throw new Error("One or more teams were not found.");
  }
  for (const team of teams) {
    if (
      !teamMatchesProjectServiceArea(
        {
          serviceAreaCatalogId: team.serviceAreaCatalogId,
          catalogSystemArea: team.serviceAreaCatalog?.systemArea ?? null,
          kind: team.kind,
        },
        {
          areaCatalogId: opts.areaCatalogId,
          serviceArea: opts.serviceArea,
          subCategory: opts.subCategory,
        }
      )
    ) {
      throw new Error("That team cannot be assigned to this job type.");
    }
  }

  const previous = await db.operationsTeamProject.findMany({
    where: { projectId: opts.projectId },
    include: {
      team: { include: { members: { select: { employeeId: true } } } },
    },
  });
  const nextSet = new Set(nextTeamIds);
  const previousSet = new Set(previous.map((row) => row.teamId));

  for (const link of previous) {
    if (nextSet.has(link.teamId)) continue;
    const memberIds = link.team.members.map((member) => member.employeeId);
    if (memberIds.length > 0) {
      await releaseEmployeesFromProject(db, opts.projectId, memberIds);
    }
    await db.operationsTeamProject.delete({
      where: {
        teamId_projectId: {
          teamId: link.teamId,
          projectId: opts.projectId,
        },
      },
    });
  }

  const teamMemberIds = new Set<string>();
  for (const team of teams) {
    for (const member of team.members) {
      teamMemberIds.add(member.employeeId);
    }
    if (!previousSet.has(team.id)) {
      await db.operationsTeamProject.create({
        data: { teamId: team.id, projectId: opts.projectId },
      });
    }
  }

  const extras = [...new Set(opts.extraEmployeeIds.filter(Boolean))].filter(
    (id) => !teamMemberIds.has(id)
  );
  return [...teamMemberIds, ...extras];
}
