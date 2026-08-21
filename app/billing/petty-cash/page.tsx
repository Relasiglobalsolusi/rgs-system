import { redirect } from "next/navigation";

import {
  syncPettyCashOnPageLoad,
} from "@/app/billing/petty-cash/actions";
import PettyCashSpendDialog from "@/components/billing/PettyCashSpendDialog";
import AppShell from "@/components/layout/AppShell";
import EmptyState from "@/components/ui/EmptyState";
import SectionCard from "@/components/ui/SectionCard";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatDisplayDate } from "@/lib/format-date";
import { localizeKnownKey } from "@/lib/i18n/labels";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";
import { getPettyCashTotals, processScheduledPettyCashPays } from "@/lib/petty-cash";
import { prisma } from "@/lib/prisma";
import { decimalToNumber, formatContractPrice } from "@/lib/project-billing";
import { formatEmployeeName } from "@/lib/employee-user-link";
import { getOmServiceAreaListFilter } from "@/lib/om-approval";
import { isAreaManagerOrAbovePosition } from "@/lib/positions";
import { requirePettyCashAccess } from "@/lib/session";
import { jakartaYearMonth, utcRangeForJakartaMonth } from "@/lib/vat";
import { cn } from "@/lib/utils";

function kindTone(kind: string): "active" | "warning" | "info" {
  if (kind === "TOP_UP") return "active";
  if (kind === "PART_TIME_PAY") return "info";
  return "warning";
}

export default async function PettyCashPage() {
  const session = await requirePettyCashAccess();
  if (session.user.clientId || session.user.vendorId) {
    redirect("/dashboard");
  }

  await syncPettyCashOnPageLoad();
  await processScheduledPettyCashPays(prisma, session.user.companyId);

  const locale = await getServerLocale();
  const t = createTranslator(locale);
  const now = jakartaYearMonth();
  const { start, endExclusive } = utcRangeForJakartaMonth(now.year, now.month);

  const projectScope = await getOmServiceAreaListFilter({
    userId: session.user.id,
    username: session.user.username,
    clientId: session.user.clientId,
  });

  const [totals, entries, projects, attributionEmployees] = await Promise.all([
    getPettyCashTotals(prisma, session.user.companyId, start, endExclusive),
    prisma.pettyCashEntry.findMany({
      where: { companyId: session.user.companyId },
      include: {
        project: { select: { name: true } },
        employee: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
      take: 200,
    }),
    prisma.project.findMany({
      where: {
        companyId: session.user.companyId,
        status: { in: ["PLANNED", "IN_PROGRESS", "WAITING_FOR_APPROVAL"] },
        OR: [
          projectScope ?? {},
          { subCategory: "INTERNAL", serviceArea: "HEAD_OFFICE" },
        ],
      },
      select: {
        id: true,
        name: true,
        client: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.employee.findMany({
      where: {
        companyId: session.user.companyId,
        archivedFromDirectory: false,
        status: { in: ["ACTIVE", "ON_LEAVE"] },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        jobPosition: { select: { slug: true, name: true } },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
  ]);

  const billForEmployees = attributionEmployees
    .filter(
      (employee) =>
        employee.jobPosition != null &&
        isAreaManagerOrAbovePosition(employee.jobPosition)
    )
    .map((employee) => ({
      id: employee.id,
      name: formatEmployeeName(employee),
    }));

  const cards = [
    {
      key: "balance",
      label: t("pages.pettyCash.currentBalance"),
      value: totals.balance,
      warn: totals.balance < 0,
    },
    {
      key: "lifetimeIn",
      label: t("pages.pettyCash.lifetimeIn"),
      value: totals.lifetimeIn,
    },
    {
      key: "monthIn",
      label: t("pages.pettyCash.monthIn"),
      value: totals.monthIn,
    },
    {
      key: "lifetimeOut",
      label: t("pages.pettyCash.lifetimeOut"),
      value: totals.lifetimeOut,
    },
    {
      key: "monthOut",
      label: t("pages.pettyCash.monthOut"),
      value: totals.monthOut,
    },
  ];

  return (
    <AppShell
      titleKey="pages.pettyCash.title"
      descriptionKey="pages.pettyCash.description"
    >
      <div className="mb-5 flex flex-wrap items-end justify-end gap-3">
        <PettyCashSpendDialog
          projects={projects.map((project) => ({
            id: project.id,
            name: project.name,
            clientName: project.client?.name ?? null,
          }))}
          billForEmployees={billForEmployees}
        />
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => (
          <SectionCard key={card.key} className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {card.label}
            </p>
            <p
              className={cn(
                "mt-2 text-lg font-semibold tabular-nums",
                card.warn ? "text-danger" : "text-text"
              )}
            >
              {formatContractPrice(card.value)}
            </p>
          </SectionCard>
        ))}
      </div>

      {totals.balance < 0 ? (
        <p className="mb-4 text-sm text-danger">
          {t("pages.pettyCash.negativeWarning")}
        </p>
      ) : null}
      {totals.upcomingOut > 0 ? (
        <p className="mb-4 text-sm text-muted">
          {t("pages.pettyCash.upcoming", {
            amount: formatContractPrice(totals.upcomingOut),
          })}
        </p>
      ) : null}

      {entries.length === 0 ? (
        <SectionCard className="p-5 sm:p-6">
          <EmptyState
            titleKey="pages.pettyCash.emptyTitle"
            descriptionKey="pages.pettyCash.emptyDesc"
          />
        </SectionCard>
      ) : (
        <SectionCard className="overflow-x-auto p-0">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border bg-strip text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">
                  {t("pages.pettyCash.columns.date")}
                </th>
                <th className="px-4 py-3 font-semibold">
                  {t("pages.pettyCash.columns.kind")}
                </th>
                <th className="px-4 py-3 font-semibold">
                  {t("pages.pettyCash.columns.description")}
                </th>
                <th className="px-4 py-3 font-semibold">
                  {t("pages.pettyCash.columns.status")}
                </th>
                <th className="px-4 py-3 font-semibold text-right">
                  {t("pages.pettyCash.columns.amount")}
                </th>
                <th className="px-4 py-3 font-semibold">
                  {t("pages.pettyCash.columns.proof")}
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 tabular-nums text-text">
                    {formatDisplayDate(entry.entryDate, { timeZone: "UTC" })}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={kindTone(entry.kind)}>
                      {localizeKnownKey(
                        `pages.pettyCash.kind.${entry.kind}`,
                        locale
                      )}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-3 text-text">
                    <p>{entry.description}</p>
                    {entry.employee ? (
                      <p className="mt-0.5 text-xs text-muted">
                        {t("pages.pettyCash.billIsFor")}:{" "}
                        {formatEmployeeName(entry.employee)}
                      </p>
                    ) : null}
                    {entry.project ? (
                      <p className="mt-0.5 text-xs text-muted">
                        {entry.project.name}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {localizeKnownKey(
                      `pages.pettyCash.status.${entry.status}`,
                      locale
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-text">
                    {entry.kind === "TOP_UP" ? "+" : "−"}
                    {formatContractPrice(decimalToNumber(entry.amount))}
                  </td>
                  <td className="px-4 py-3">
                    {entry.proofPath ? (
                      <a
                        href={entry.proofPath}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium text-primary-dark underline-offset-2 hover:underline"
                      >
                        {t("pages.pettyCash.viewProof")}
                      </a>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      )}
    </AppShell>
  );
}
