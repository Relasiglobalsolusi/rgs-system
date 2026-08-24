import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import TaxPeriodDocumentsClient from "@/components/billing/TaxPeriodDocumentsClient";
import AppShell from "@/components/layout/AppShell";
import BackLink from "@/components/ui/BackLink";
import SectionCard from "@/components/ui/SectionCard";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatDisplayDate } from "@/lib/format-date";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";
import { canAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  decimalToNumber,
  formatContractPrice,
  formatInvoicePeriodLabel,
} from "@/lib/project-billing";
import { requireFinanceChild, toPermissionUser } from "@/lib/session";
import {
  DEFAULT_INCLUSIVE_PPN_RATE,
  ppnRateFromPercent,
  splitInclusiveVat,
} from "@/lib/vat";

const metaLabelClassName =
  "w-36 shrink-0 px-4 py-2.5 text-left align-top text-xs font-semibold uppercase tracking-[0.12em] text-subtle sm:w-52 sm:px-5";
const metaValueClassName = "px-4 py-2.5 align-top text-text sm:px-5";
const sectionTitleClassName = "text-base font-semibold tracking-tight text-text";

function money(value: number | null | undefined): string {
  return formatContractPrice(value ?? 0);
}

export default async function OutputTaxDetailPage({
  params,
}: {
  params: Promise<{ periodId: string }>;
}) {
  const session = await requireFinanceChild("taxInvoices");
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  const { periodId } = await params;

  if (session.user.clientId || session.user.vendorId) {
    redirect("/billing");
  }

  const period = await prisma.projectInvoicePeriod.findFirst({
    where: { id: periodId, project: { companyId: session.user.companyId } },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          billingMode: true,
          clientId: true,
          client: { select: { id: true, name: true } },
        },
      },
      taxInvoiceDoneBy: { select: { name: true } },
    },
  });

  if (!period) {
    notFound();
  }

  const user = toPermissionUser(session);
  const canManage =
    canAccess(user, "taxInvoices") || canAccess(user, "projects");
  const gross =
    decimalToNumber(period.revisedInvoiceAmount) ??
    decimalToNumber(period.amount) ??
    0;
  const storedRatePercent = decimalToNumber(period.ppnRatePercent);
  const rate =
    storedRatePercent != null && storedRatePercent > 0
      ? ppnRateFromPercent(storedRatePercent)
      : DEFAULT_INCLUSIVE_PPN_RATE;
  const split = splitInclusiveVat(gross, rate);
  const periodLabel = formatInvoicePeriodLabel(period, {
    projectName: period.project.name,
    billingMode: period.project.billingMode,
    locale,
  });
  const taxPath = period.taxInvoiceDocumentPath?.trim() || null;
  const billingHref = period.project.clientId
    ? `/billing/${period.project.clientId}/${period.project.id}`
    : null;
  const sent = Boolean(period.taxInvoiceDoneAt);

  return (
    <AppShell
      title={t("pages.vat.taxDetail")}
    >
      <div className="mb-4">
        <BackLink href="/billing/tax-invoices?view=output">
          {t("pages.vat.backToTax")}
        </BackLink>
      </div>

      <div className="space-y-5">
        <SectionCard className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3.5 sm:px-5">
            <StatusBadge status="info">
              {t("pages.vat.tabs.output")}
            </StatusBadge>
            {sent ? (
              <StatusBadge status="success">
                {t("pages.billing.taxInvoiceSent")}
              </StatusBadge>
            ) : (
              <StatusBadge status="pending">
                {t("pages.billing.taxInvoiceDue")}
              </StatusBadge>
            )}
          </div>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-border">
                <th scope="row" className={metaLabelClassName}>
                  {t("pages.vat.columns.client")}
                </th>
                <td className={`${metaValueClassName} font-medium`}>
                  {period.project.client?.name ?? t("pages.billing.noClient")}
                </td>
              </tr>
              <tr className="border-b border-border">
                <th scope="row" className={metaLabelClassName}>
                  {t("pages.billing.purchaseProject")}
                </th>
                <td className={metaValueClassName}>{period.project.name}</td>
              </tr>
              <tr className="border-b border-border">
                <th scope="row" className={metaLabelClassName}>
                  {t("pages.vat.invoicePeriodFallback")}
                </th>
                <td className={metaValueClassName}>{periodLabel}</td>
              </tr>
              <tr className="border-b border-border">
                <th scope="row" className={metaLabelClassName}>
                  {t("pages.vat.columns.date")}
                </th>
                <td className={metaValueClassName}>
                  {formatDisplayDate(
                    period.taxInvoiceIssuedAt ?? period.dueAt ?? period.periodEnd
                  )}
                </td>
              </tr>
              <tr className="border-b border-border">
                <th scope="row" className={metaLabelClassName}>
                  {t("pages.vat.columns.gross")}
                </th>
                <td className={`${metaValueClassName} tabular-nums`}>
                  {money(split.gross)}
                </td>
              </tr>
              <tr className="border-b border-border">
                <th scope="row" className={metaLabelClassName}>
                  {t("pages.vat.columns.dpp")}
                </th>
                <td className={`${metaValueClassName} tabular-nums`}>
                  {money(split.dpp)}
                </td>
              </tr>
              <tr className="border-b border-border">
                <th scope="row" className={metaLabelClassName}>
                  {t("pages.vat.columns.ppn")}
                </th>
                <td className={`${metaValueClassName} text-base font-semibold tabular-nums`}>
                  {money(split.ppn)}
                </td>
              </tr>
              {period.taxInvoiceDoneBy?.name ? (
                <tr>
                  <th scope="row" className={metaLabelClassName}>
                    {t("pages.billing.completed")}
                  </th>
                  <td className={metaValueClassName}>
                    {period.taxInvoiceDoneBy.name}
                    {period.taxInvoiceDoneAt
                      ? ` · ${formatDisplayDate(period.taxInvoiceDoneAt)}`
                      : ""}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </SectionCard>

        <SectionCard className="p-5 sm:p-6">
          <h3 className={sectionTitleClassName}>
            {t("pages.vat.taxDocuments")}
          </h3>
          <div className="mt-4">
            <TaxPeriodDocumentsClient
              periodId={period.id}
              projectName={period.project.name}
              periodLabel={periodLabel}
              defaultPpnRatePercent={storedRatePercent}
              canUpload={canManage && !taxPath}
              files={[
                {
                  id: "output-tax",
                  title: t("pages.billing.purchaseTaxInvoice"),
                  href: taxPath,
                },
              ]}
            />
          </div>
          {billingHref ? (
            <p className="mt-4 text-sm">
              <Link
                href={billingHref}
                className="font-medium text-primary hover:underline"
              >
                {t("pages.vat.relatedBilling")}
              </Link>
            </p>
          ) : null}
        </SectionCard>
      </div>
    </AppShell>
  );
}
