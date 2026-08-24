import { redirect } from "next/navigation";

import {
  syncPettyCashOnPageLoad,
} from "@/app/billing/petty-cash/actions";
import PettyCashSpendDialog from "@/components/billing/PettyCashSpendDialog";
import AppShell from "@/components/layout/AppShell";
import EmptyState from "@/components/ui/EmptyState";
import FinanceRecordRow, {
  financeListStatusChipClassName,
  financeRecordListClassName,
} from "@/components/ui/FinanceRecordRow";
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


function statusTone(status: string): "success" | "warning" | "danger" | "info" {
  if (status === "POSTED") return "success";
  if (status === "VOIDED") return "danger";
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
        <div className={financeRecordListClassName}>
          {entries.map((entry) => (
            <FinanceRecordRow
              key={entry.id}
              title={
                <>
                  <h3 className="text-left text-sm font-semibold leading-snug tracking-tight text-text">
                    {entry.description}
                  </h3>
                  <p className="mt-1 truncate text-xs leading-none text-subtle">
                    {formatDisplayDate(entry.entryDate, { timeZone: "UTC" })}
                    {entry.employee ? (
                      <>
                        <span className="mx-1.5 text-border-strong" aria-hidden>
                          ·
                        </span>
                        {formatEmployeeName(entry.employee)}
                      </>
                    ) : null}
                    {entry.project ? (
                      <>
                        <span className="mx-1.5 text-border-strong" aria-hidden>
                          ·
                        </span>
                        {entry.project.name}
                      </>
                    ) : null}
                  </p>
                  {entry.proofPath ? (
                    <a
                      href={entry.proofPath}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-xs font-medium text-primary-dark underline-offset-2 hover:underline"
                    >
                      {t("pages.pettyCash.viewProof")}
                    </a>
                  ) : null}
                </>
              }
              status={
                <StatusBadge
                  status={statusTone(entry.status)}
                  className={financeListStatusChipClassName}
                >
                  <span className="flex h-full w-full items-center justify-center text-center leading-none">
                    {localizeKnownKey(
                      `pages.pettyCash.status.${entry.status}`,
                      locale
                    )}
                  </span>
                </StatusBadge>
              }
              amount={`${entry.kind === "TOP_UP" ? "+" : "−"}${formatContractPrice(decimalToNumber(entry.amount))}`}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}
