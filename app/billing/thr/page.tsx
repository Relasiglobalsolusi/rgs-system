import { redirect } from "next/navigation";

import { generateThrForYear, syncThrOnPageLoad } from "@/app/billing/thr/actions";
import { financeToolbarActionClass } from "@/components/billing/finance-toolbar";
import ThrGenerateButton from "@/components/billing/ThrGenerateButton";
import ThrMarkPaidButton from "@/components/billing/ThrMarkPaidButton";
import ThrYearControl from "@/components/billing/ThrYearControl";
import AppShell from "@/components/layout/AppShell";
import PageIntro from "@/components/i18n/PageIntro";
import DirectoryStatCard from "@/components/ui/DirectoryStatCard";
import EmptyState from "@/components/ui/EmptyState";
import SectionCard from "@/components/ui/SectionCard";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  getIdulFitriDate,
  isWithinThrGenerateWindow,
  resolveThrTargetYear,
  THR_GENERATE_LEAD_DAYS,
} from "@/lib/employee-thr";
import { formatDisplayDate } from "@/lib/format-date";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";
import { prisma } from "@/lib/prisma";
import {
  isClientPortalUser,
  isVendorPortalUser,
} from "@/lib/project-access";
import { decimalToNumber, formatContractPrice } from "@/lib/project-billing";
import { requireFinanceChild, toPermissionUser } from "@/lib/session";

type SearchParams = Promise<{ year?: string }>;

export default async function ThrPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireFinanceChild("thr");
  const user = toPermissionUser(session);
  if (isClientPortalUser(user) || isVendorPortalUser(user)) {
    redirect("/billing");
  }

  const locale = await getServerLocale();
  const t = createTranslator(locale);

  await syncThrOnPageLoad();

  const params = await searchParams;
  const requestedYear = Number(params.year);
  const targetYear = Number.isFinite(requestedYear)
    ? Math.max(2000, Math.min(2100, Math.round(requestedYear)))
    : resolveThrTargetYear() ?? new Date().getUTCFullYear();
  const hariRaya = getIdulFitriDate(targetYear);
  const inThrWindow = hariRaya ? isWithinThrGenerateWindow(hariRaya) : false;

  const payments = await prisma.thrPayment.findMany({
    where: {
      companyId: session.user.companyId,
      year: targetYear,
    },
    include: {
      employee: {
        select: {
          employeeNo: true,
          firstName: true,
          lastName: true,
          status: true,
        },
      },
    },
    orderBy: [{ employee: { employeeNo: "asc" } }],
  });

  const totalAmount = payments.reduce(
    (sum, row) => sum + (decimalToNumber(row.amount) ?? 0),
    0
  );

  return (
    <AppShell titleKey="pages.thr.title">
      <div className="mb-5 space-y-4">
        <PageIntro
          titleKey="pages.thr.directoryTitle"
          descriptionKey="pages.thr.directoryDesc"
        />
        <div className="flex justify-end">
          <ThrYearControl
            year={targetYear}
            action={
              <a
                href={`/api/billing/thr-report?year=${targetYear}`}
                className={financeToolbarActionClass}
              >
                {t("pages.thr.downloadReport")}
              </a>
            }
          />
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <DirectoryStatCard
          compact
          title={t("pages.thr.targetYear")}
          value={targetYear}
          accent="info"
        />
        <DirectoryStatCard
          compact
          title={t("pages.thr.hariRayaDate")}
          value={hariRaya ? formatDisplayDate(hariRaya, undefined, locale) : "—"}
          accent="primary"
        />
        <DirectoryStatCard
          compact
          title={t("pages.thr.totalAmount")}
          value={formatContractPrice(totalAmount)}
          accent={totalAmount > 0 ? "success" : "muted"}
        />
      </div>

      <SectionCard>
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-text">
            {t("pages.thr.paymentsTitle")}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {t("pages.thr.paymentsDesc", { year: String(targetYear) })}
          </p>
        </div>

        {payments.length === 0 ? (
          <EmptyState
            title={t("pages.thr.emptyTitle")}
            description={t("pages.thr.emptyDesc")}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">
                    {t("pages.thr.columns.employee")}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t("pages.thr.columns.tenure")}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t("pages.thr.columns.basePay")}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t("pages.thr.columns.amount")}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t("pages.thr.columns.status")}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t("pages.thr.columns.actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {payments.map((row) => {
                  const statusLabel =
                    row.status === "PAID"
                      ? t("pages.thr.statusPaid")
                      : row.status === "DRAFT"
                        ? t("pages.thr.statusDraft")
                        : t("pages.thr.statusGenerated");
                  return (
                    <tr key={row.id} className="border-b border-border/70">
                      <td className="px-3 py-3">
                        <p className="font-medium text-text">
                          {row.employee.firstName} {row.employee.lastName}
                        </p>
                        <p className="font-mono text-xs text-muted">
                          {row.employee.employeeNo}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-muted">
                        {t("pages.thr.tenureMonths", {
                          count: String(row.tenureMonths),
                        })}
                      </td>
                      <td className="px-3 py-3 text-muted">
                        {formatContractPrice(
                          decimalToNumber(row.basePaySnapshot)
                        )}
                      </td>
                      <td className="px-3 py-3 font-medium text-text">
                        {formatContractPrice(decimalToNumber(row.amount))}
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge
                          status={row.status === "PAID" ? "active" : "warning"}
                          compact
                        >
                          {statusLabel}
                        </StatusBadge>
                      </td>
                      <td className="px-3 py-3">
                        {row.status !== "PAID" ? (
                          <ThrMarkPaidButton
                            id={row.id}
                            label={t("pages.thr.markPaid")}
                            pendingLabel={t("common.actions.saving")}
                            errorLabel={t("pages.thr.markPaidFailed")}
                          />
                        ) : (
                          <span className="text-xs text-muted">
                            {row.paidAt
                              ? formatDisplayDate(row.paidAt, undefined, locale)
                              : "—"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 space-y-3 border-t border-border pt-5">
          {inThrWindow ? (
            <ThrGenerateButton
              year={targetYear}
              label={t("pages.thr.generateForYear", {
                year: String(targetYear),
              })}
              pendingLabel={t("pages.thr.generating")}
              successLabel={t("pages.thr.generateSuccess")}
              errorLabel={t("pages.thr.generateFailed")}
              action={generateThrForYear}
            />
          ) : null}
          <p className="text-sm text-muted">
            {t("pages.thr.generateOutsideWindow", {
              days: String(THR_GENERATE_LEAD_DAYS),
            })}
          </p>
        </div>
      </SectionCard>
    </AppShell>
  );
}
