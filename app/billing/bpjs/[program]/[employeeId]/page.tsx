import { notFound, redirect } from "next/navigation";

import BillingBreadcrumbs from "@/components/billing/BillingBreadcrumbs";
import AppShell from "@/components/layout/AppShell";
import SectionCard from "@/components/ui/SectionCard";
import DirectoryStatCard from "@/components/ui/DirectoryStatCard";
import {
  currentBpjsPeriod,
  getBpjsFinanceEmployeeDetail,
  parseBpjsFinanceProgramKey,
} from "@/lib/bpjs-finance";
import { formatDisplayDate } from "@/lib/format-date";
import { formatHiredAtLabel, formatTenure } from "@/lib/format-tenure";
import { getServerLocale } from "@/lib/i18n/locale";
import type { MessageKey } from "@/lib/i18n/messages";
import { createTranslator } from "@/lib/i18n/translate";
import { formatContractPrice } from "@/lib/project-billing";
import { requireFinanceChild } from "@/lib/session";

const LINE_KEYS: Record<string, MessageKey> = {
  kesehatan: "pages.bpjs.lineKesehatan",
  jht: "pages.bpjs.lineJht",
  jp: "pages.bpjs.lineJp",
  jkk: "pages.bpjs.lineJkk",
  jkm: "pages.bpjs.lineJkm",
};

type SearchParams = Promise<{ year?: string; month?: string }>;

export default async function BpjsEmployeeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ program: string; employeeId: string }>;
  searchParams: SearchParams;
}) {
  const session = await requireFinanceChild("bpjs");
  if (session.user.clientId || session.user.vendorId) {
    redirect("/billing");
  }

  const { program: programParam, employeeId } = await params;
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

  const detail = await getBpjsFinanceEmployeeDetail(
    session.user.companyId,
    year,
    month,
    programKey,
    employeeId
  );
  if (!detail) notFound();

  const programTitle =
    programKey === "kesehatan"
      ? t("pages.bpjs.kesehatan")
      : t("pages.bpjs.ketenagakerjaan");
  const employee = detail.employee;
  const periodLabel = new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
  const dueDateLabel = formatDisplayDate(
    detail.dueDate,
    { timeZone: "Asia/Jakarta" },
    locale
  );

  return (
    <AppShell
      title={employee.name}
    >
      <BillingBreadcrumbs
        items={[
          {
            label: programTitle,
            href: `/billing/bpjs/${programKey}?year=${year}&month=${month}`,
          },
          { label: employee.name },
        ]}
      />

      <div className="mb-5">
        <h2 className="text-base font-semibold tracking-tight text-text">
          {employee.name}
        </h2>
        <p className="mt-1 text-sm text-subtle">
          {employee.employeeNo}
          {" · "}
          {programTitle}
          {" · "}
          {periodLabel}
          {" · "}
          {t("pages.bpjs.dueDateHint", { date: dueDateLabel })}
        </p>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <DirectoryStatCard
          compact
          title={t("pages.bpjs.columns.employeeShare")}
          value={formatContractPrice(employee.employeeShare)}
          accent={employee.employeeShare > 0 ? "info" : "muted"}
        />
        <DirectoryStatCard
          compact
          title={t("pages.bpjs.columns.companyShare")}
          value={formatContractPrice(employee.companyShare)}
          accent={employee.companyShare > 0 ? "info" : "muted"}
        />
        <DirectoryStatCard
          compact
          title={t("pages.bpjs.columns.total")}
          value={formatContractPrice(employee.total)}
        />
      </div>

      <SectionCard className="mb-5 p-5 sm:p-6">
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-subtle">{t("pages.bpjs.hiredAt")}</dt>
            <dd className="mt-0.5 text-text">
              {formatHiredAtLabel(employee.hiredAt, locale) || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-subtle">{t("pages.bpjs.tenure")}</dt>
            <dd className="mt-0.5 text-text">
              {formatTenure(employee.hiredAt, new Date(), locale) || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-subtle">{t("pages.bpjs.basePay")}</dt>
            <dd className="mt-0.5 tabular-nums text-text">
              {formatContractPrice(employee.basePay)}
            </dd>
          </div>
        </dl>
      </SectionCard>

      <SectionCard className="p-5 sm:p-6">
        <h3 className="text-lg font-semibold text-text">
          {t("pages.bpjs.componentsTitle")}
        </h3>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">
                  {t("pages.bpjs.program")}
                </th>
                <th className="px-3 py-2 font-medium">
                  {t("pages.bpjs.wageBase")}
                </th>
                <th className="px-3 py-2 font-medium">
                  {t("pages.bpjs.columns.employeeShare")}
                </th>
                <th className="px-3 py-2 font-medium">
                  {t("pages.bpjs.columns.companyShare")}
                </th>
                <th className="px-3 py-2 font-medium">
                  {t("pages.bpjs.columns.total")}
                </th>
              </tr>
            </thead>
            <tbody>
              {employee.components.map((line) => (
                <tr
                  key={line.key}
                  className="border-b border-border/70 last:border-0"
                >
                  <td className="px-3 py-3 text-text">
                    {t(LINE_KEYS[line.key] ?? "pages.bpjs.lineKesehatan")}
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    {formatContractPrice(line.wageBase)}
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    {formatContractPrice(line.employeeAmount)}
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    {formatContractPrice(line.companyAmount)}
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    {formatContractPrice(
                      line.employeeAmount + line.companyAmount
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </AppShell>
  );
}
