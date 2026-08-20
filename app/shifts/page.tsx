import Link from "next/link";
import { ArrowLeft, FolderKanban } from "lucide-react";

import AppShell from "@/components/layout/AppShell";
import ProjectAssignBackupChip from "@/components/projects/ProjectAssignBackupChip";
import ProjectAssignDoubleShiftChip from "@/components/projects/ProjectAssignDoubleShiftChip";
import ShiftsAddShiftChip from "@/components/shifts/ShiftsAddShiftChip";
import ShiftsAssignStaffChip from "@/components/shifts/ShiftsAssignStaffChip";
import ShiftsDirectory from "@/components/shifts/ShiftsDirectory";
import ShiftsProjectPicker from "@/components/shifts/ShiftsProjectPicker";
import { buttonVariants } from "@/components/ui/button";
import { createTranslator } from "@/lib/i18n/translate";
import { getServerLocale } from "@/lib/i18n/locale";
import { prisma } from "@/lib/prisma";
import { requireModule, toPermissionUser } from "@/lib/session";
import { canAssignSiteCover } from "@/lib/om-approval";
import { jakartaTodayAsUtcDateOnly } from "@/lib/leave-employment-status";
import {
  isBackupAssignmentOccupyingProject,
} from "@/lib/petty-cash";
import {
  canManageProjects,
  getProjectWhereForUser,
} from "@/lib/project-access";
import {
  isProjectOpenForSiteWork,
  PROJECT_SITE_WORK_STATUSES,
} from "@/lib/project-status";
import { decimalToNumber } from "@/lib/project-billing";
import { MAX_PROJECT_SHIFTS, syncProjectShifts } from "@/lib/project-shifts";
import {
  annotateStaffPickerConflicts,
  assignableProjectCrewOrWhere,
  crewOptionsForSubCategory,
  findEmployeesOnOtherOpenProjects,
  partTimeRosterWhere,
  releaseExpiredBackupCrew,
} from "@/lib/workforce-crew";
import { cn } from "@/lib/utils";

export default async function ShiftsPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const session = await requireModule("shifts");
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  const permissionUser = toPermissionUser(session);
  const companyId = session.user.companyId;
  const { projectId: projectIdRaw } = await searchParams;
  const projectId = projectIdRaw?.trim() || null;
  const canManage = canManageProjects(permissionUser);

  if (!companyId) {
    return (
      <AppShell
        title={t("pages.shifts.title")}
        description={t("pages.shifts.description")}
      >
        <ShiftsProjectPicker projects={[]} />
      </AppShell>
    );
  }

  const projectScope = await getProjectWhereForUser({
    companyId,
    userId: session.user.id,
    username: session.user.username,
    clientId: session.user.clientId,
  });

  if (projectId) {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        status: { in: [...PROJECT_SITE_WORK_STATUSES] },
        ...projectScope,
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
        client: { select: { name: true } },
        operationsTeamLinks: { select: { teamId: true } },
      },
    });

    if (!project) {
      return (
        <AppShell
          title={t("pages.shifts.title")}
          description={t("pages.shifts.description")}
        >
          <div className="mb-4">
            <Link
              href="/shifts"
              className={cn(
                buttonVariants({ variant: "infoBadge", size: "badge" }),
                "inline-flex gap-1.5"
              )}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t("pages.shifts.backToProjects")}
            </Link>
          </div>
          <ShiftsDirectory
            project={null}
            shifts={[]}
            assignments={[]}
            projectMissing
          />
        </AppShell>
      );
    }

    await syncProjectShifts(prisma, project.id, project.shiftCount || 1);
    await releaseExpiredBackupCrew(prisma as never, project.companyId);

    const canAssignCover = await canAssignSiteCover({
      userId: session.user.id,
      username: session.user.username,
      permissionUser,
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
              where: {
                companyId: project.companyId,
                kind:
                  project.subCategory === "FACADE_CLEANING"
                    ? "FACADE_CLEANING"
                    : "GENERAL_CLEANING",
              },
              include: {
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

    const staffEmployees = annotateStaffPickerConflicts(
      staffPool,
      staffConflicts
    );
    const regularCoverEmployees = regularAssignments
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
      }));
    const teamOptions = operationsTeams.map((team) => ({
      id: team.id,
      name: team.name,
      kind: team.kind,
      memberIds: team.members.map((member) => member.employeeId),
      memberNames: team.members.map(
        (member) => `${member.employee.firstName} ${member.employee.lastName}`
      ),
    }));

    return (
      <AppShell
        title={t("pages.shifts.title")}
        description={t("pages.shifts.description")}
      >
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Link
            href="/shifts"
            className={cn(
              buttonVariants({ variant: "infoBadge", size: "badge" }),
              "inline-flex gap-1.5"
            )}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t("pages.shifts.backToProjects")}
          </Link>
          <div className="flex min-w-0 items-start gap-2">
            <FolderKanban className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <div className="font-semibold text-text">{project.name}</div>
              <div className="text-sm text-muted">
                {[project.client?.name, project.location]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </div>
            </div>
          </div>
        </div>
        <ShiftsDirectory
          project={{
            id: project.id,
            name: project.name,
            clientName: project.client?.name ?? null,
          }}
          shifts={projectShifts}
          assignments={regularAssignments.map((row) => ({
            id: row.id,
            shiftId: row.shiftId,
            shiftStart: row.shiftStart,
            shiftEnd: row.shiftEnd,
            employee: row.employee,
          }))}
          backups={backupAssignments.map((row) => ({
            id: row.id,
            employeeId: row.employeeId,
            backupStartDate: row.backupStartDate,
            backupEndDate: row.backupEndDate,
            dailyRate: decimalToNumber(row.dailyRate),
            employee: row.employee,
            shift: row.shift,
            coveredEmployee: row.coveredEmployee,
          }))}
          doubleShifts={doubleShifts}
          canAssignCover={canAssignCover && siteOpen}
          toolbar={
            <>
              {projectShifts.length < MAX_PROJECT_SHIFTS ? (
                <ShiftsAddShiftChip
                  projectId={project.id}
                  nextNumber={projectShifts.length + 1}
                />
              ) : null}
              {canManage ? (
                <ShiftsAssignStaffChip
                  projectId={project.id}
                  subCategory={project.subCategory}
                  employees={staffEmployees}
                  teams={teamOptions}
                  assignedEmployeeIds={regularAssignments.map(
                    (row) => row.employeeId
                  )}
                  assignedTeamIds={project.operationsTeamLinks.map(
                    (link) => link.teamId
                  )}
                />
              ) : null}
              {canAssignCover && siteOpen ? (
                <>
                  <ProjectAssignDoubleShiftChip
                    projectId={project.id}
                    employees={regularCoverEmployees}
                  />
                  <ProjectAssignBackupChip
                    projectId={project.id}
                    employees={backupEmployees}
                    coverEmployees={regularCoverEmployees}
                  />
                </>
              ) : null}
            </>
          }
        />
      </AppShell>
    );
  }

  const projects = await prisma.project.findMany({
    where: {
      status: { in: [...PROJECT_SITE_WORK_STATUSES] },
      ...projectScope,
    },
    select: {
      id: true,
      name: true,
      location: true,
      client: { select: { name: true } },
      assignments: {
        where: {
          employee: { status: { in: ["ACTIVE", "ON_LEAVE", "LEAVE_PENDING"] } },
          OR: [
            { isBackup: false },
            { isBackup: true, backupEndDate: { gte: jakartaTodayAsUtcDateOnly() } },
          ],
        },
        select: { id: true },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return (
    <AppShell
      title={t("pages.shifts.title")}
      description={t("pages.shifts.description")}
    >
      <ShiftsProjectPicker
        projects={projects.map((project) => ({
          id: project.id,
          name: project.name,
          location: project.location,
          clientName: project.client?.name ?? null,
          staffCount: project.assignments.length,
        }))}
      />
    </AppShell>
  );
}
