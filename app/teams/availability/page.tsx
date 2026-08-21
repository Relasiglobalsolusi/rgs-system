import AppShell from "@/components/layout/AppShell";
import TeamAvailabilityBoard, {
  type TeamAvailabilityRow,
} from "@/components/teams/TeamAvailabilityBoard";
import { localizeOperationsTeamKind } from "@/lib/i18n/labels";
import { getServerLocale } from "@/lib/i18n/locale";
import {
  daysInMonth,
  jakartaTodayKey,
  parseYearMonth,
} from "@/lib/operations-team-calendar";
import { ensureTeamServiceAreas } from "@/lib/operations-team-catalog";
import {
  currentOccupiedProjectName,
  occupancyWindowsFromLinks,
  windowCoversDay,
} from "@/lib/operations-teams";
import { catalogDisplayName } from "@/lib/project-service-catalog";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";

export default async function TeamAvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await requireModule("teams");
  const { month: monthRaw } = await searchParams;
  const { year, month } = parseYearMonth(monthRaw);
  const locale = await getServerLocale();
  const monthLabel = new Intl.DateTimeFormat(
    locale === "id" ? "id-ID" : "en-GB",
    { month: "long", year: "numeric", timeZone: "UTC" }
  ).format(new Date(Date.UTC(year, month - 1, 1)));
  const companyId = session.user.companyId;
  const today = new Date(`${jakartaTodayKey()}T00:00:00.000Z`);
  const days = daysInMonth(year, month);

  const catalog = companyId ? await ensureTeamServiceAreas(companyId) : [];
  const teams = companyId
    ? await prisma.operationsTeam.findMany({
        where: { companyId },
        include: {
          serviceAreaCatalog: {
            select: { id: true, nameEn: true, nameId: true },
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
      })
    : [];

  const rows: TeamAvailabilityRow[] = teams.map((team) => {
    const windows = occupancyWindowsFromLinks(team.projectLinks);
    const catalogArea =
      team.serviceAreaCatalog ??
      catalog.find((area) => area.id === team.serviceAreaCatalogId) ??
      null;
    return {
      id: team.id,
      name: team.name,
      typeLabel: catalogArea
        ? catalogDisplayName(catalogArea, locale)
        : localizeOperationsTeamKind(team.kind, locale),
      occupiedProjectName: currentOccupiedProjectName(windows, today),
      occupiedDayKeys: days
        .filter((day) => windows.some((window) => windowCoversDay(window, day.date)))
        .map((day) => day.key),
    };
  });

  return (
    <AppShell
      titleKey="pages.teams.availabilityTitle"
      descriptionKey="pages.teams.availabilityDescription"
    >
      <TeamAvailabilityBoard
        year={year}
        month={month}
        monthLabel={monthLabel}
        teams={rows}
      />
    </AppShell>
  );
}
