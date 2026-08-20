import { Coins } from "lucide-react";
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
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";
import { getPettyCashTotals, processScheduledPettyCashPays } from "@/lib/petty-cash";
import { prisma } from "@/lib/prisma";
import { decimalToNumber, formatContractPrice } from "@/lib/project-billing";
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

  const [totals, entries, projects] = await Promise.all([
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
      },
      select: {
        id: true,
        name: true,
        client: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

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
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/30 bg-card-tint-emerald text-primary-dark">
              <Coins className="h-4 w-4" aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold tracking-tight text-text">
                {t("pages.pettyCash.directoryTitle")}
              </h2>
              <p className="mt-0.5 text-sm text-subtle">
                {t("pages.pettyCash.directoryDesc")}
              </p>
            </div>
          </div>
        </div>
        <PettyCashSpendDialog
          projects={projects.map((project) => ({
            id: project.id,
            name: project.name,
            clientName: project.client?.name ?? null,
          }))}
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
                      {t(`pages.pettyCash.kind.${entry.kind}`)}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-3 text-text">
                    <p>{entry.description}</p>
                    {entry.project ? (
                      <p className="mt-0.5 text-xs text-muted">
                        {entry.project.name}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {t(`pages.pettyCash.status.${entry.status}`)}
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
