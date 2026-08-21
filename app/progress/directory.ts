import {
  ATTENDANCE_INTERNAL_CLIENT_NAME,
  isAttendanceInternalProject,
} from "@/lib/attendance-internal-sites";
import { normalizeClientName } from "@/lib/client-login-id";
import { prisma } from "@/lib/prisma";
import { getProjectWhereForUser } from "@/lib/project-access";
import { PROJECT_SITE_WORK_STATUSES } from "@/lib/project-status";
import { PROGRESS_ELIGIBLE_PROJECT_SUB_CATEGORIES } from "@/lib/project-subcategory";
import {
  PROGRESS_INTERNAL_ROUTE_CLIENT_ID,
  type ProgressDirectory,
  type ProgressProjectRow,
} from "@/lib/progress-directory";
import { requireModule } from "@/lib/session";

export {
  PROGRESS_INTERNAL_ROUTE_CLIENT_ID,
  progressRouteClientId,
  type ProgressClientRow,
  type ProgressDirectory,
  type ProgressInternalSummary,
  type ProgressProjectRow,
} from "@/lib/progress-directory";

function progressProjectWhere(
  projectWhere: Awaited<ReturnType<typeof getProjectWhereForUser>>
) {
  return {
    ...projectWhere,
    status: { in: [...PROJECT_SITE_WORK_STATUSES] },
    subCategory: { in: [...PROGRESS_ELIGIBLE_PROJECT_SUB_CATEGORIES] },
  };
}

export async function getProgressDirectory(): Promise<ProgressDirectory> {
  const session = await requireModule("progress");
  const companyId = session.user.companyId;
  if (!companyId) return { clients: [], internal: null };

  const isClientPortal = Boolean(session.user.clientId);
  const projectWhere = await getProjectWhereForUser({
    companyId,
    clientId: session.user.clientId,
    userId: session.user.id,
    username: session.user.username,
  });
  const where = progressProjectWhere(projectWhere);

  const [clientsRaw, internalRaw] = await Promise.all([
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
          select: { id: true, name: true, serviceArea: true, subCategory: true },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    isClientPortal
      ? Promise.resolve([])
      : prisma.project.findMany({
          where,
          select: {
            id: true,
            name: true,
            clientId: true,
            serviceArea: true,
            subCategory: true,
          },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        }),
  ]);

  const internalProjects = internalRaw.filter((project) =>
    isAttendanceInternalProject(project)
  );

  return {
    internal:
      internalProjects.length > 0
        ? {
            projectCount: internalProjects.length,
            siteNames: internalProjects.map((project) => project.name),
          }
        : null,
    clients: clientsRaw
      .map((client) => {
        const projects = client.projects.filter(
          (project) => !isAttendanceInternalProject(project)
        );
        return {
          id: client.id,
          name: client.name,
          shortCode: client.shortCode,
          projectNames: projects.map((project) => project.name),
          projectCount: projects.length,
        };
      })
      .filter((client) => client.projectCount > 0),
  };
}

export async function getProgressProjectsForClient(clientId: string): Promise<{
  clientName: string;
  isInternal: boolean;
  routeClientId: string;
  projects: ProgressProjectRow[];
} | null> {
  const session = await requireModule("progress");
  if (session.user.clientId && session.user.clientId !== clientId) {
    return null;
  }

  const projectWhere = await getProjectWhereForUser({
    companyId: session.user.companyId,
    clientId: session.user.clientId,
    userId: session.user.id,
    username: session.user.username,
  });
  const where = progressProjectWhere(projectWhere);
  const isInternal = clientId === PROGRESS_INTERNAL_ROUTE_CLIENT_ID;

  if (isInternal) {
    if (session.user.clientId) return null;
    const projects = await prisma.project.findMany({
      where,
      select: {
        id: true,
        name: true,
        location: true,
        serviceArea: true,
        subCategory: true,
        _count: { select: { progressReports: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    const internal = projects.filter((project) =>
      isAttendanceInternalProject(project)
    );
    return {
      clientName: "Internal",
      isInternal: true,
      routeClientId: PROGRESS_INTERNAL_ROUTE_CLIENT_ID,
      projects: internal.map((project) => ({
        id: project.id,
        name: project.name,
        location: project.location,
        subCategory: project.subCategory,
        reportCount: project._count.progressReports,
      })),
    };
  }

  const client = await prisma.client.findFirst({
    where: {
      id: clientId,
      companyId: session.user.companyId,
      active: true,
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
          location: true,
          subCategory: true,
          _count: { select: { progressReports: true } },
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
    },
  });
  if (!client) return null;

  return {
    clientName: client.name,
    isInternal: false,
    routeClientId: client.id,
    projects: client.projects.map((project) => ({
      id: project.id,
      name: project.name,
      location: project.location,
      subCategory: project.subCategory,
      reportCount: project._count.progressReports,
    })),
  };
}
