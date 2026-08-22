import { notFound, redirect } from "next/navigation";

import BillingBreadcrumbs from "@/components/billing/BillingBreadcrumbs";
import BpjsEmployeeTable from "@/components/billing/BpjsEmployeeTable";
import BpjsPaidTable from "@/components/billing/BpjsPaidTable";
import AppShell from "@/components/layout/AppShell";
import DirectoryStatCard from "@/components/ui/DirectoryStatCard";
import {
  currentBpjsPeriod,
  getBpjsFinanceProgramDetail,
  parseBpjsFinanceProgramKey,
} from "@/lib/bpjs-finance";
import { formatDisplayDate } from "@/lib/format-date";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";
import { formatContractPrice } from "@/lib/project-billing";
import { requireFinanceChild } from "@/lib/session";

type SearchParams = Promise<{ year?: string; month?: string }>;

export default async function BpjsProgramDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ program: string }>;
  searchParams: SearchParams;
}) {
  const session = await requireFinanceChild("bpjs");
  if (session.user.clientId || session.user.vendorId) {
    redirect("/billing");
  }

  const { program: programParam } = await params;
  const programKey = parseBpjsFinanceProgramKey(programParam);
  if (!programKey) notFound();

  const locale = await getServerLocale();
  const t = createTranslator(locale);
  const query = await searchParams;
  const current = currentBpjsPeriod();
  const year = Math.max(
    2000,
    Math.min(2100, Number(query.year) || current.year)
  );
  const month = Math.max(
    1,
    Math.min(12, Number(query.month) || current.month)
  );

  const detail = await getBpjsFinanceProgramDetail(
    session.user.companyId,
    year,
    month,
    programKey
  );
  const title =
    programKey === "kesehatan"
      ? t("pages.bpjs.kesehatan")
      : t("pages.bpjs.ketenagakerjaan");
  const dueDateLabel = formatDisplayDate(
    detail.dueDate,
    { timeZone: "Asia/Jakarta" },
    locale
  );
  const periodLabel = new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(Date.UTC(year, month - 1, 1)));

  return (
    <AppShell title={title} descriptionKey="pages.bpjs.detailDescription">
      <BillingBreadcrumbs
        items={[
          {
            label: t("pages.bpjs.backToBpjs"),
            href: `/billing/bpjs?year=${year}&month=${month}`,
          },
          { label: title },
        ]}
      />

      <div className="mb-5">
        <h2 className="text-base font-semibold tracking-tight text-text">
          {title}
        </h2>
        <p className="mt-1 text-sm text-subtle">
          {periodLabel}
          {" · "}
          {t("pages.bpjs.enrolled", {
            count: String(detail.employees.length),
          })}
          {" · "}
          {t("pages.bpjs.dueDateHint", { date: dueDateLabel })}
        </p>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <DirectoryStatCard
          compact
          title={t("pages.bpjs.alreadyPaid")}
          value={formatContractPrice(detail.line.alreadyPaid)}
          accent={detail.line.alreadyPaid > 0 ? "info" : "muted"}
        />
        <DirectoryStatCard
          compact
          title={t("pages.bpjs.columns.companyShare")}
          value={formatContractPrice(detail.line.companyDue)}
          accent={detail.line.companyDue > 0 ? "info" : "muted"}
        />
        <DirectoryStatCard
          compact
          title={t("pages.bpjs.stillToPay")}
          value={formatContractPrice(detail.line.remaining)}
          accent={detail.line.remaining > 0 ? "warning" : "muted"}
        />
      </div>

      <p className="mb-5 text-sm text-muted">
        {t("pages.bpjs.payInExpensesHint")}
      </p>

      <div className="space-y-5">
        <BpjsEmployeeTable
          rows={detail.employees}
          showComponents={programKey === "ketenagakerjaan"}
          programKey={programKey}
          year={year}
          month={month}
        />

        <BpjsPaidTable rows={detail.remittances} />
      </div>
    </AppShell>
  );
}
