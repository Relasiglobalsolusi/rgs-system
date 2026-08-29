import { notFound } from "next/navigation";

import { getShiftsBoardData } from "@/app/shifts/data";
import AppShell from "@/components/layout/AppShell";
import ProjectAssignBackupChip from "@/components/projects/ProjectAssignBackupChip";
import ProjectAssignDoubleShiftChip from "@/components/projects/ProjectAssignDoubleShiftChip";
import ShiftsAddShiftChip from "@/components/shifts/ShiftsAddShiftChip";
import ShiftsAssignStaffChip from "@/components/shifts/ShiftsAssignStaffChip";
import ShiftsBreadcrumbs from "@/components/shifts/ShiftsBreadcrumbs";
import ShiftsDirectory from "@/components/shifts/ShiftsDirectory";
import { createTranslator } from "@/lib/i18n/translate";
import { getServerLocale } from "@/lib/i18n/locale";
import { requireModule, toPermissionUser } from "@/lib/session";
import { shiftsClientHref } from "@/lib/shifts-directory";

type Props = {
  params: Promise<{ clientId: string; projectId: string }>;
};

export default async function ShiftsProjectPage({ params }: Props) {
  const session = await requireModule("shifts");
  const permissionUser = toPermissionUser(session);
  const { clientId, projectId } = await params;
  const locale = await getServerLocale();
  const t = createTranslator(locale);

  if (!session.user.companyId) notFound();

  const board = await getShiftsBoardData(
    {
      companyId: session.user.companyId,
      userId: session.user.id,
      username: session.user.username,
      clientId: session.user.clientId,
      permissionUser,
    },
    clientId,
    projectId
  );

  const clientLabel = board?.isInternal
    ? t("pages.shifts.internalSection")
    : (board?.clientName ?? "");

  if (!board) {
    return (
      <AppShell
        title={t("pages.shifts.title")}
      >
        <ShiftsBreadcrumbs
          items={[
            { labelKey: "pages.shifts.title", href: "/shifts" },
            {
              label: t("pages.shifts.clientsSection"),
              href: shiftsClientHref(clientId),
            },
            { label: t("pages.shifts.projectNotFoundTitle") },
          ]}
        />
        <ShiftsDirectory
          project={null}
          shifts={[]}
          assignments={[]}
          projectMissing
        />
      </AppShell>
    );
  }

  return (
    <AppShell
      title={board.project.name}
    >
      <ShiftsBreadcrumbs
        items={[
          { labelKey: "pages.shifts.title", href: "/shifts" },
          { label: clientLabel, href: shiftsClientHref(board.routeClientId) },
          { label: board.project.name },
        ]}
      />
      <ShiftsDirectory
        project={{
          id: board.project.id,
          name: board.project.name,
          clientName: board.project.clientName,
        }}
        shifts={board.projectShifts}
        assignments={board.assignments}
        backups={board.backups}
        doubleShifts={board.doubleShifts}
        canAssignCover={board.canAssignCover}
        canEditShifts={board.canEditShifts}
        usesNamedShifts={board.usesNamedShifts}
        toolbar={
          <>
            {board.canAddShift ? (
              <ShiftsAddShiftChip
                projectId={board.project.id}
                nextNumber={board.projectShifts.length + 1}
                existingShifts={board.projectShifts}
              />
            ) : null}
            {board.canEditShifts ? (
              <ShiftsAssignStaffChip
                projectId={board.project.id}
                subCategory={board.project.subCategory}
                areaCatalogId={board.project.areaCatalogId}
                serviceArea={board.project.serviceArea}
                employees={board.staffEmployees}
                teams={board.teamOptions}
                assignedEmployeeIds={board.assignedEmployeeIds}
                assignedTeamIds={board.project.assignedTeamIds}
              />
            ) : null}
            {board.canAssignCover ? (
              <>
                {board.usesNamedShifts ? (
                  <ProjectAssignDoubleShiftChip
                    projectId={board.project.id}
                    employees={board.regularCoverEmployees}
                  />
                ) : null}
                <ProjectAssignBackupChip
                  projectId={board.project.id}
                  employees={board.backupEmployees}
                  coverEmployees={board.regularCoverEmployees}
                />
              </>
            ) : null}
          </>
        }
      />
    </AppShell>
  );
}
