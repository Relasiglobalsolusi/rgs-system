import type { ProjectStaffEmployee } from "@/components/projects/ProjectStaffPicker";
import type { PermissionUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { jakartaTodayAsUtcDateOnly } from "@/lib/leave-employment-status";
import { canAssignSiteCover } from "@/lib/om-approval";
import { mapProjectTeamOption } from "@/lib/operations-teams";
import { isBackupAssignmentOccupyingProject } from "@/lib/petty-cash";
import { decimalToNumber } from "@/lib/project-billing";
import {
  canManageProjects,
  getProjectWhereForUser,
} from "@/lib/project-access";
import {
  isProjectOpenForSiteWork,
  PROJECT_SITE_WORK_STATUSES,
} from "@/lib/project-status";
import { MAX_PROJECT_SHIFTS, syncProjectShifts } from "@/lib/project-shifts";
import {
  ATTENDANCE_INTERNAL_CLIENT_NAME,
  isAttendanceInternalProject,
} from "@/lib/attendance-internal-sites";
import { normalizeClientName } from "@/lib/client-login-id";
import {
  annotateStaffPickerConflicts,
  assignableProjectCrewOrWhere,
  crewOptionsForSubCategory,
  findEmployeesOnOtherOpenProjects,
  partTimeRosterWhere,
  releaseExpiredBackupCrew,
} from "@/lib/workforce-crew";
import {
  SHIFTS_INTERNAL_ROUTE_CLIENT_ID,
  shiftsLiveAssignmentWhere,
  shiftsProjectHref,
  shiftsRouteClientId,
  type ShiftsClientRow,
  type ShiftsDirectory,
  type ShiftsProjectRow,
} from "@/lib/shifts-directory";

type SessionScope = {
  companyId: string;
  userId: string;
  username?: string | null;
  clientId?: string | null;
};

const siteWorkSelect = {
  id: true,
  name: true,
  location: true,
  subCategory: true,
  serviceArea: true,
} as const;

async function projectScope(session: SessionScope) {
  return getProjectWhereForUser({
    companyId: session.companyId,
    userId: session.userId,
    username: session.username,
    clientId: session.clientId,
  });
}

function siteWorkWhere(scope: Awaited<ReturnType<typeof projectScope>>) {
  return {
    status: { in: [...PROJECT_SITE_WORK_STATUSES] },
    ...scope,
  };
}

function staffCountInclude(today: Date) {
  return {
    assignments: {
      where: shiftsLiveAssignmentWhere(today),
      select: { id: true },
    },
  };
}

function toProjectRow(project: {
  id: string;
  name: string;
  location: string | null;
  subCategory: ShiftsProjectRow["subCategory"];
  serviceArea: string;
  assignments: { id: string }[];
}): ShiftsProjectRow {
  return {
    id: project.id,
    name: project.name,
    location: project.location,
    subCategory: project.subCategory,
    serviceArea: project.serviceArea,
    staffCount: project.assignments.length,
  };
}

export async function getShiftsDirectory(
  session: SessionScope
): Promise<ShiftsDirectory> {
  const scope = await projectScope(session);
  const today = jakartaTodayAsUtcDateOnly();
  const where = siteWorkWhere(scope);

  const [clientsRaw, internalRaw] = await Promise.all([
    prisma.client.findMany({
      where: {
        companyId: session.companyId,
        active: true,
        ...(session.clientId ? { id: session.clientId } : {}),
        nameNormalized: {
          not: normalizeClientName(ATTENDANCE_INTERNAL_CLIENT_NAME),
        },
        projects: {
          some: {
            ...where,
            subCategory: { not: "INTERNAL" },
          },
        },
      },
      include: {
        projects: {
          where: {
            ...where,
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
    session.clientId
      ? Promise.resolve([])
      : prisma.project.findMany({
          where,
          select: {
            ...siteWorkSelect,
            clientId: true,
          },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        }),
  ]);

  const clients: ShiftsClientRow[] = clientsRaw
    .map((client) => {
      const commercial = client.projects.filter(
        (project) => !isAttendanceInternalProject(project)
      );
      return {
        id: client.id,
        name: client.name,
        projectCount: commercial.length,
      };
    })
    .filter((client) => client.projectCount > 0);

  const internalProjects = internalRaw.filter((project) =>
    isAttendanceInternalProject(project)
  );

  return {
    clients,
    internal:
      internalProjects.length > 0
        ? {
            projectCount: internalProjects.length,
            siteNames: internalProjects.map((project) => project.name),
          }
        : null,
  };
}

export async function getShiftsProjectsForClient(
  session: SessionScope,
  clientId: string
): Promise<{
  clientName: string;
  routeClientId: string;
  isInternal: boolean;
  projects: ShiftsProjectRow[];
} | null> {
  if (session.clientId && session.clientId !== clientId) {
    return null;
  }

  const scope = await projectScope(session);
  const today = jakartaTodayAsUtcDateOnly();
  const where = siteWorkWhere(scope);
  const isInternal = clientId === SHIFTS_INTERNAL_ROUTE_CLIENT_ID;

  if (isInternal) {
    if (session.clientId) return null;

    const projectsRaw = await prisma.project.findMany({
      where,
      select: {
        ...siteWorkSelect,
        clientId: true,
        ...staffCountInclude(today),
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    const projects = projectsRaw
      .filter((project) => isAttendanceInternalProject(project))
      .map(toProjectRow);

    if (projects.length === 0) return null;

    return {
      clientName: ATTENDANCE_INTERNAL_CLIENT_NAME,
      routeClientId: SHIFTS_INTERNAL_ROUTE_CLIENT_ID,
      isInternal: true,
      projects,
    };
  }

  const client = await prisma.client.findFirst({
    where: {
      id: clientId,
      companyId: session.companyId,
      active: true,
    },
    include: {
      projects: {
        where: {
          ...where,
          subCategory: { not: "INTERNAL" },
        },
        select: {
          ...siteWorkSelect,
          ...staffCountInclude(today),
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
    },
  });

  if (!client) return null;

  const projects = client.projects
    .filter((project) => !isAttendanceInternalProject(project))
    .map(toProjectRow);

  return {
    clientName: client.name,
    routeClientId: client.id,
    isInternal: false,
    projects,
  };
}

export async function resolveShiftsProjectHref(
  session: SessionScope,
  projectId: string
): Promise<string | null> {
  const scope = await projectScope(session);
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      ...siteWorkWhere(scope),
    },
    select: {
      id: true,
      clientId: true,
      name: true,
      serviceArea: true,
      subCategory: true,
    },
  });
  if (!project) return null;
  return shiftsProjectHref({
    clientId: project.clientId,
    projectId: project.id,
    name: project.name,
    serviceArea: project.serviceArea,
    subCategory: project.subCategory,
  });
}

export type ShiftsBoardData = {
  routeClientId: string;
  clientName: string;
  isInternal: boolean;
  canManage: boolean;
  canAssignCover: boolean;
  siteOpen: boolean;
  project: {
    id: string;
    name: string;
    location: string | null;
    clientName: string | null;
    subCategory: ShiftsProjectRow["subCategory"];
    areaCatalogId: string | null;
    serviceArea: string;
    assignedTeamIds: string[];
  };
  projectShifts: Array<{
    id: string;
    number: number;
    startTime: string;
    endTime: string;
  }>;
  canAddShift: boolean;
  assignments: Array<{
    id: string;
    shiftId: string | null;
    shiftStart: string | null;
    shiftEnd: string | null;
    employee: {
      id: string;
      employeeNo: string;
      firstName: string;
      lastName: string;
      employmentType: "FULL_TIME" | "PART_TIME";
    };
  }>;
  backups: Array<{
    id: string;
    employeeId: string;
    backupStartDate: Date | null;
    backupEndDate: Date | null;
    dailyRate: number | null;
    employee: {
      firstName: string;
      lastName: string;
      employeeNo: string;
    };
    shift: {
      number: number;
      startTime: string;
      endTime: string;
    } | null;
    coveredEmployee: {
      firstName: string;
      lastName: string;
    } | null;
  }>;
  doubleShifts: Array<{
    id: string;
    employeeId: string;
    date: Date;
    coveringShift: {
      number: number;
      startTime: string;
      endTime: string;
    } | null;
    coveredEmployee: {
      firstName: string;
      lastName: string;
    } | null;
  }>;
  staffEmployees: ProjectStaffEmployee[];
  teamOptions: ReturnType<typeof mapProjectTeamOption>[];
  assignedEmployeeIds: string[];
  regularCoverEmployees: Array<{
    id: string;
    firstName: string;
    lastName: string;
    employeeNo: string;
    shiftId: string | null;
    shiftNumber: number | null;
    shiftStart: string | null;
    shiftEnd: string | null;
  }>;
  backupEmployees: Array<{
    id: string;
    firstName: string;
    lastName: string;
    employeeNo: string;
  }>;
};

export async function getShiftsBoardData(
  session: SessionScope & { permissionUser: PermissionUser },
  clientId: string,
  projectId: string
): Promise<ShiftsBoardData | null> {
  if (session.clientId && session.clientId !== clientId) {
    return null;
  }

  const scope = await projectScope(session);
  const isInternalRoute = clientId === SHIFTS_INTERNAL_ROUTE_CLIENT_ID;

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      status: { in: [...PROJECT_SITE_WORK_STATUSES] },
      ...scope,
    },
    select: {
      id: true,
      name: true,
      location: true,
      shiftCount: true,
      status: true,
      subCategory: true,
      serviceArea: true,
      companyId: true,
      clientId: true,
      client: { select: { name: true } },
      operationsTeamLinks: { select: { teamId: true } },
      areaCatalogId: true,
    },
  });

  if (!project) return null;

  const routeClientId = shiftsRouteClientId(project);
  if (routeClientId !== clientId) return null;
  if (isInternalRoute && !isAttendanceInternalProject(project)) return null;
  if (!isInternalRoute && isAttendanceInternalProject(project)) return null;

  await syncProjectShifts(prisma, project.id, project.shiftCount || 1);
  await releaseExpiredBackupCrew(prisma as never, project.companyId);

  const canManage = canManageProjects(session.permissionUser);
  const canAssignCover = await canAssignSiteCover({
    userId: session.userId,
    username: session.username,
    permissionUser: session.permissionUser,
    projectServiceArea: project.serviceArea,
    projectId: project.id,
  });
  const siteOpen = isProjectOpenForSiteWork(project.status);

  const [projectShifts, assignments, operationsTeams, staffPool] =
    await Promise.all([
      prisma.projectShift.findMany({
        where: { projectId: project.id },
        select: {
          id: true,
          number: true,
          startTime: true,
          endTime: true,
        },
        orderBy: { number: "asc" },
      }),
      prisma.projectAssignment.findMany({
        where: {
          projectId: project.id,
          employee: {
            status: { in: ["ACTIVE", "ON_LEAVE", "LEAVE_PENDING"] },
          },
        },
        select: {
          id: true,
          employeeId: true,
          shiftId: true,
          shiftStart: true,
          shiftEnd: true,
          isBackup: true,
          backupStartDate: true,
          backupEndDate: true,
          dailyRate: true,
          shift: {
            select: { number: true, startTime: true, endTime: true },
          },
          coveredEmployee: {
            select: { firstName: true, lastName: true },
          },
          employee: {
            select: {
              id: true,
              employeeNo: true,
              firstName: true,
              lastName: true,
              employmentType: true,
              status: true,
            },
          },
        },
        orderBy: [
          { employee: { firstName: "asc" } },
          { employee: { lastName: "asc" } },
        ],
      }),
      canManage
        ? prisma.operationsTeam.findMany({
            where: { companyId: project.companyId },
            include: {
              serviceAreaCatalog: { select: { systemArea: true } },
              members: {
                include: {
                  employee: {
                    select: { firstName: true, lastName: true },
                  },
                },
              },
            },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          })
        : Promise.resolve([]),
      canManage
        ? prisma.employee.findMany({
            where: {
              companyId: project.companyId,
              status: "ACTIVE",
              OR: assignableProjectCrewOrWhere(project.companyId, {
                ...crewOptionsForSubCategory(project.subCategory),
                includeAssignedToProjectId: project.id,
              }),
            },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeNo: true,
              category: { select: { name: true, prefix: true, slug: true } },
            },
            orderBy: [
              { employmentType: "asc" },
              { category: { sortOrder: "asc" } },
              { firstName: "asc" },
            ],
          })
        : Promise.resolve([]),
    ]);

  const regularAssignments = assignments.filter((row) => !row.isBackup);
  const backupAssignments = assignments.filter(
    (row) => row.isBackup && isBackupAssignmentOccupyingProject(row)
  );
  const assignedEmployeeIds = assignments.map((row) => row.employeeId);
  const liveFrom = jakartaTodayAsUtcDateOnly();

  const [backupEmployees, doubleShifts, staffConflicts] = await Promise.all([
    canAssignCover && siteOpen
      ? prisma.employee.findMany({
          where: {
            ...partTimeRosterWhere(project.companyId),
            ...(assignedEmployeeIds.length > 0
              ? { id: { notIn: assignedEmployeeIds } }
              : {}),
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNo: true,
          },
          orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        })
      : Promise.resolve([]),
    prisma.doubleShiftAssignment.findMany({
      where: { projectId: project.id, date: { gte: liveFrom } },
      select: {
        id: true,
        employeeId: true,
        date: true,
        coveringShift: {
          select: { number: true, startTime: true, endTime: true },
        },
        coveredEmployee: {
          select: { firstName: true, lastName: true },
        },
      },
      orderBy: { date: "asc" },
    }),
    canManage && staffPool.length > 0
      ? findEmployeesOnOtherOpenProjects(
          prisma,
          project.companyId,
          staffPool.map((employee) => employee.id),
          project.id
        )
      : Promise.resolve([]),
  ]);

  return {
    routeClientId,
    clientName: isInternalRoute
      ? ATTENDANCE_INTERNAL_CLIENT_NAME
      : (project.client?.name ?? ""),
    isInternal: isInternalRoute,
    canManage,
    canAssignCover: canAssignCover && siteOpen,
    siteOpen,
    project: {
      id: project.id,
      name: project.name,
      location: project.location,
      clientName: project.client?.name ?? null,
      subCategory: project.subCategory,
      areaCatalogId: project.areaCatalogId,
      serviceArea: project.serviceArea,
      assignedTeamIds: project.operationsTeamLinks.map((link) => link.teamId),
    },
    projectShifts,
    canAddShift: projectShifts.length < MAX_PROJECT_SHIFTS,
    assignments: regularAssignments.map((row) => ({
      id: row.id,
      shiftId: row.shiftId,
      shiftStart: row.shiftStart,
      shiftEnd: row.shiftEnd,
      employee: row.employee,
    })),
    backups: backupAssignments.map((row) => ({
      id: row.id,
      employeeId: row.employeeId,
      backupStartDate: row.backupStartDate,
      backupEndDate: row.backupEndDate,
      dailyRate: decimalToNumber(row.dailyRate),
      employee: row.employee,
      shift: row.shift,
      coveredEmployee: row.coveredEmployee,
    })),
    doubleShifts,
    staffEmployees: annotateStaffPickerConflicts(staffPool, staffConflicts),
    teamOptions: operationsTeams.map(mapProjectTeamOption),
    assignedEmployeeIds: regularAssignments.map((row) => row.employeeId),
    regularCoverEmployees: regularAssignments
      .filter(
        (assignment) =>
          assignment.employee.employmentType === "FULL_TIME" &&
          assignment.employee.status === "ACTIVE"
      )
      .map((assignment) => ({
        id: assignment.employee.id,
        firstName: assignment.employee.firstName,
        lastName: assignment.employee.lastName,
        employeeNo: assignment.employee.employeeNo,
        shiftId: assignment.shiftId,
        shiftNumber: assignment.shift?.number ?? null,
        shiftStart: assignment.shift?.startTime ?? assignment.shiftStart,
        shiftEnd: assignment.shift?.endTime ?? assignment.shiftEnd,
      })),
    backupEmployees,
  };
}
