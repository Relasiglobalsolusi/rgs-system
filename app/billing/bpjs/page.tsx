import { redirect } from "next/navigation";

import BpjsPaidTable from "@/components/billing/BpjsPaidTable";
import BpjsPeriodControl from "@/components/billing/BpjsPeriodControl";
import BpjsProgramTable from "@/components/billing/BpjsProgramTable";
import AppShell from "@/components/layout/AppShell";
import PageIntro from "@/components/i18n/PageIntro";
import EmptyState from "@/components/ui/EmptyState";
import SectionCard from "@/components/ui/SectionCard";
import DirectoryStatCard from "@/components/ui/DirectoryStatCard";
import { financeToolbarActionClass } from "@/components/billing/finance-toolbar";
import {
  currentBpjsPeriod,
  getBpjsFinancePeriod,
} from "@/lib/bpjs-finance";
import { formatDisplayDate } from "@/lib/format-date";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";
import { formatContractPrice } from "@/lib/project-billing";
import { requireFinanceChild } from "@/lib/session";

type SearchParams = Promise<{ year?: string; month?: string }>;

export default async function BpjsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireFinanceChild("bpjs");
  if (session.user.clientId || session.user.vendorId) {
    redirect("/billing");
  }

  const locale = await getServerLocale();
  const t = createTranslator(locale);
  const params = await searchParams;
  const current = currentBpjsPeriod();
  const year = Math.max(
    2000,
    Math.min(2100, Number(params.year) || current.year)
  );
  const month = Math.max(
    1,
    Math.min(12, Number(params.month) || current.month)
  );

  const snapshot = await getBpjsFinancePeriod(
    session.user.companyId,
    year,
    month
  );
  const dueDateLabel = formatDisplayDate(snapshot.dueDate, {
    timeZone: "Asia/Jakarta",
  }, locale);
  const enrolledCount = snapshot.lines.reduce(
    (sum, line) => sum + line.employeeCount,
    0
  );
  const hasEnrollment = snapshot.lines.some((line) => line.employeeCount > 0);
  const hasActivity =
    hasEnrollment || snapshot.alreadyPaid > 0 || snapshot.remittances.length > 0;

  return (
    <AppShell
      titleKey="pages.bpjs.title"
    >
      <div className="mb-5 space-y-4">
        <PageIntro
          titleKey="pages.bpjs.title"
          descriptionKey="pages.bpjs.description"
        />
        <div className="flex justify-end">
          <BpjsPeriodControl
            year={year}
            month={month}
            action={
              <a
                href={`/api/billing/bpjs-report?year=${year}&month=${month}`}
                className={financeToolbarActionClass}
              >
                {t("pages.bpjs.downloadReport")}
              </a>
            }
          />
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <DirectoryStatCard
          compact
          title={t("pages.bpjs.alreadyPaid")}
          value={formatContractPrice(snapshot.alreadyPaid)}
          accent={snapshot.alreadyPaid > 0 ? "info" : "muted"}
        />
        <DirectoryStatCard
          compact
          title={t("pages.bpjs.stillToPay")}
          value={formatContractPrice(snapshot.dueThisPeriod)}
          subtitle={t("pages.bpjs.dueDateHint", { date: dueDateLabel })}
          accent={snapshot.dueThisPeriod > 0 ? "warning" : "muted"}
        />
        <DirectoryStatCard
          compact
          title={t("pages.bpjs.overdue")}
          value={formatContractPrice(snapshot.overdueAmount)}
          subtitle={
            snapshot.overdue
              ? t("pages.bpjs.overdueHint")
              : t("pages.bpjs.notOverdueHint")
          }
          accent={snapshot.overdueAmount > 0 ? "danger" : "muted"}
        />
      </div>

      <p className="mb-5 text-sm text-muted">
        {t("pages.bpjs.enrolled", { count: String(enrolledCount) })}
        {" · "}
        {t("pages.bpjs.payInExpensesHint")}
      </p>

      {!hasActivity ? (
        <SectionCard className="p-5 sm:p-6">
          <EmptyState
            titleKey="pages.bpjs.emptyTitle"
            descriptionKey="pages.bpjs.emptyDesc"
          />
        </SectionCard>
      ) : (
        <div className="space-y-5">
          <BpjsProgramTable
            year={year}
            month={month}
            dueDateLabel={dueDateLabel}
            lines={snapshot.lines}
          />

          <BpjsPaidTable rows={snapshot.remittances} showProgram />
        </div>
      )}
    </AppShell>
  );
}
