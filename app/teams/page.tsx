import AppShell from "@/components/layout/AppShell";
import TeamAssignmentDirectory, {
  type TeamAssignmentRow,
} from "@/components/teams/TeamAssignmentDirectory";
import { jakartaTodayKey } from "@/lib/operations-team-calendar";
import { ensureTeamServiceAreas } from "@/lib/operations-team-catalog";
import {
  currentOccupiedProjectName,
  eligibleTeamMemberWhere,
  occupancyWindowsForTeam,
  OPEN_TEAM_PROJECT_STATUSES,
} from "@/lib/operations-teams";
import { prisma } from "@/lib/prisma";
import { canManageTeams } from "@/lib/project-access";
import { requireModule, toPermissionUser } from "@/lib/session";

export default async function TeamsAssignmentPage() {
  const session = await requireModule("teams");
  const canManage = canManageTeams(toPermissionUser(session));
  const companyId = session.user.companyId;

  if (!companyId) {
    return (
      <AppShell
        titleKey="pages.teams.assignmentTitle"
      >
        <TeamAssignmentDirectory
          teams={[]}
          catalog={[]}
          eligible={[]}
          canManage={false}
        />
      </AppShell>
    );
  }

  const today = new Date(`${jakartaTodayKey()}T00:00:00.000Z`);
  const catalog = await ensureTeamServiceAreas(companyId);

  const [teams, eligible] = await Promise.all([
    prisma.operationsTeam.findMany({
      where: { companyId },
      include: {
        members: {
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeNo: true,
              },
            },
          },
          orderBy: { assignedAt: "asc" },
        },
        projectLinks: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
                status: true,
                billingMode: true,
                startDate: true,
                estimatedStartDate: true,
                endDate: true,
              },
            },
          },
        },
        visitAssignments: {
          select: {
            visit: {
              select: {
                startDate: true,
                endDate: true,
                project: {
                  select: {
                    id: true,
                    name: true,
                    status: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.employee.findMany({
      where: eligibleTeamMemberWhere(companyId),
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeNo: true,
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
  ]);

  const rows: TeamAssignmentRow[] = teams.map((team) => {
    const occupiedProjectName = currentOccupiedProjectName(
      occupancyWindowsForTeam({
        projectLinks: team.projectLinks,
        visitAssignments: team.visitAssignments,
      }),
      today
    );
    const linkedToOpenJob =
      team.projectLinks.some((link) =>
        (OPEN_TEAM_PROJECT_STATUSES as readonly string[]).includes(
          link.project.status
        )
      ) ||
      team.visitAssignments.some((row) =>
        (OPEN_TEAM_PROJECT_STATUSES as readonly string[]).includes(
          row.visit.project.status
        )
      );
    return {
      id: team.id,
      name: team.name,
      kind: team.kind as TeamAssignmentRow["kind"],
      serviceAreaCatalogId: team.serviceAreaCatalogId,
      memberCount: team.members.length,
      occupiedProjectName,
      isOnJob: Boolean(occupiedProjectName) || linkedToOpenJob,
      members: team.members.map((member) => ({
        employeeId: member.employee.id,
        firstName: member.employee.firstName,
        lastName: member.employee.lastName,
        employeeNo: member.employee.employeeNo,
      })),
    };
  });

  return (
    <AppShell
      titleKey="pages.teams.assignmentTitle"
    >
      <TeamAssignmentDirectory
        teams={rows}
        catalog={catalog.map((area) => ({
          id: area.id,
          nameEn: area.nameEn,
          nameId: area.nameId,
        }))}
        eligible={eligible}
        canManage={canManage}
      />
    </AppShell>
  );
}
