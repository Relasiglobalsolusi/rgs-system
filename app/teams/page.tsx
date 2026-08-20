import AppShell from "@/components/layout/AppShell";
import TeamAssignmentDirectory, {
  type TeamAssignmentRow,
} from "@/components/teams/TeamAssignmentDirectory";
import { jakartaTodayKey } from "@/lib/operations-team-calendar";
import {
  currentOccupiedProjectName,
  eligibleTeamMemberWhere,
  occupancyWindowsFromLinks,
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
        descriptionKey="pages.teams.assignmentDescription"
      >
        <TeamAssignmentDirectory teams={[]} eligible={[]} canManage={false} />
      </AppShell>
    );
  }

  const today = new Date(`${jakartaTodayKey()}T00:00:00.000Z`);

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
                startDate: true,
                estimatedStartDate: true,
                endDate: true,
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

  const rows: TeamAssignmentRow[] = teams.map((team) => ({
    id: team.id,
    name: team.name,
    kind: team.kind,
    memberCount: team.members.length,
    occupiedProjectName: currentOccupiedProjectName(
      occupancyWindowsFromLinks(team.projectLinks),
      today
    ),
    members: team.members.map((member) => ({
      employeeId: member.employee.id,
      firstName: member.employee.firstName,
      lastName: member.employee.lastName,
      employeeNo: member.employee.employeeNo,
    })),
  }));

  return (
    <AppShell
      titleKey="pages.teams.assignmentTitle"
      descriptionKey="pages.teams.assignmentDescription"
    >
      <TeamAssignmentDirectory
        teams={rows}
        eligible={eligible}
        canManage={canManage}
      />
    </AppShell>
  );
}
