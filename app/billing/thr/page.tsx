import { HandCoins } from "lucide-react";
import { redirect } from "next/navigation";

import { generateThrForYear, syncThrOnPageLoad } from "@/app/billing/thr/actions";
import ThrGenerateButton from "@/components/billing/ThrGenerateButton";
import ThrMarkPaidButton from "@/components/billing/ThrMarkPaidButton";
import AppShell from "@/components/layout/AppShell";
import PageIntro from "@/components/i18n/PageIntro";
import EmptyState from "@/components/ui/EmptyState";
import SectionCard from "@/components/ui/SectionCard";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  getIdulFitriDate,
  listKnownIdulFitriYears,
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
import { requireModule, toPermissionUser } from "@/lib/session";

export default async function ThrPage() {
  const session = await requireModule("invoicing");
  const user = toPermissionUser(session);
  if (isClientPortalUser(user) || isVendorPortalUser(user)) {
    redirect("/billing");
  }

  const locale = await getServerLocale();
  const t = createTranslator(locale);

  await syncThrOnPageLoad();

  const targetYear = resolveThrTargetYear() ?? new Date().getUTCFullYear();
  const hariRaya = getIdulFitriDate(targetYear);
  const years = listKnownIdulFitriYears().filter((year) => year >= targetYear - 1);

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
    <AppShell
      titleKey="pages.thr.title"
      descriptionKey="pages.thr.description"
    >
      <PageIntro
        titleKey="pages.thr.directoryTitle"
        descriptionKey="pages.thr.directoryDesc"
      />

      <div className="space-y-6">
        <SectionCard>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/30 bg-card-tint-emerald text-primary-dark">
                  <HandCoins className="h-4 w-4" aria-hidden />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-text">
                    {t("pages.thr.summaryTitle")}
                  </h2>
                </div>
              </div>
              <p className="mt-2 text-sm text-muted">
                {t("pages.thr.summaryDesc", {
                  days: String(THR_GENERATE_LEAD_DAYS),
                })}
              </p>
            </div>
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
          </div>

          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted">{t("pages.thr.targetYear")}</p>
              <p className="font-medium text-text">{targetYear}</p>
            </div>
            <div>
              <p className="text-xs text-muted">{t("pages.thr.hariRayaDate")}</p>
              <p className="font-medium text-text">
                {hariRaya ? formatDisplayDate(hariRaya, undefined, locale) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">{t("pages.thr.totalAmount")}</p>
              <p className="font-medium text-text">
                {formatContractPrice(totalAmount)}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted">
            {t("pages.thr.calendarNote", { years: years.join(", ") })}
          </p>
        </SectionCard>

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
                    <th className="px-3 py-2 font-medium">
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
        </SectionCard>
      </div>
    </AppShell>
  );
}
