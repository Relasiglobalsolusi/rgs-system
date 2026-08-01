import AppShell from "@/components/layout/AppShell";
import ShiftsDirectory from "@/components/shifts/ShiftsDirectory";
import { createTranslator } from "@/lib/i18n/translate";
import { getServerLocale } from "@/lib/i18n/locale";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";

export default async function ShiftsPage() {
  const session = await requireModule("shifts");
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  const companyId = session.user.companyId;

  const assignments = companyId
    ? await prisma.projectAssignment.findMany({
        where: {
          project: {
            companyId,
            status: { in: ["PLANNED", "IN_PROGRESS"] },
          },
          employee: {
            status: { in: ["ACTIVE", "ON_LEAVE"] },
          },
        },
        select: {
          id: true,
          shiftStart: true,
          shiftEnd: true,
          employee: {
            select: {
              id: true,
              employeeNo: true,
              firstName: true,
              lastName: true,
              employmentType: true,
            },
          },
          project: {
            select: {
              id: true,
              name: true,
              status: true,
              client: { select: { name: true } },
            },
          },
        },
        orderBy: [
          { project: { name: "asc" } },
          { employee: { firstName: "asc" } },
          { employee: { lastName: "asc" } },
        ],
      })
    : [];

  return (
    <AppShell
      title={t("pages.shifts.title")}
      description={t("pages.shifts.description")}
    >
      <ShiftsDirectory assignments={assignments} />
    </AppShell>
  );
}
