import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import TaxPeriodDocumentsClient from "@/components/billing/TaxPeriodDocumentsClient";
import AppShell from "@/components/layout/AppShell";
import BackLink from "@/components/ui/BackLink";
import { PageDocumentActions } from "@/components/ui/PageDocumentActions";
import {
  metaLabelWideClassName as metaLabelClassName,
  metaValueClassName,
} from "@/components/ui/meta-facts";
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
  commercialTaxIncludesIncomeTax,
  commercialTaxIncludesVat,
} from "@/lib/commercial-tax";
import { formatTaxInvoiceSerial } from "@/lib/tax-invoice-serial";
import { parseTaxReportView } from "@/lib/tax-report-view";
import {
  DEFAULT_INCLUSIVE_PPN_RATE,
  ppnRateFromPercent,
  splitInclusiveVat,
} from "@/lib/vat";

const sectionTitleClassName = "text-base font-semibold tracking-tight text-text";

function money(value: number | null | undefined): string {
  return formatContractPrice(value ?? 0);
}

export default async function OutputTaxDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ periodId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const session = await requireFinanceChild("taxInvoices");
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  const { periodId } = await params;
  const query = await searchParams;
  const backView = parseTaxReportView(query.from, "output");

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
          chargedTaxKind: true,
          isGovernmentContract: true,
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
  const showWithholdingSlip = commercialTaxIncludesIncomeTax(
    period.project.chargedTaxKind
  );
  const showVatInvoice =
    commercialTaxIncludesVat(period.project.chargedTaxKind) ||
    period.taxInvoiceRequired ||
    Boolean(taxPath);
  const withholdingPath = period.withholdingSlipPath?.trim() || null;
  const billingHref = period.project.clientId
    ? `/billing/${period.project.clientId}/${period.project.id}`
    : null;
  const sent = Boolean(period.taxInvoiceDoneAt);
  const taxFiles = [
    ...(showVatInvoice
      ? [
          {
            id: "output-tax",
            title: t("pages.billing.taxInvoiceDocument"),
            href: taxPath,
          },
        ]
      : []),
    ...(showWithholdingSlip || withholdingPath
      ? [
          {
            id: "withholding-slip",
            title: t("pages.billing.withholdingSlip"),
            hint: t("pages.billing.withholdingSlipHint"),
            href: withholdingPath,
          },
        ]
      : []),
  ];
  const readyDocuments = taxFiles.flatMap((file) =>
    file.href
      ? [
          {
            href: file.href,
            label: file.title,
            icon: "download" as const,
          },
        ]
      : []
  );

  return (
    <AppShell
      title={t("pages.vat.taxDetail")}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <BackLink href={`/billing/tax-invoices?view=${backView}`}>
          {t("pages.vat.backToTax")}
        </BackLink>
        <PageDocumentActions documents={readyDocuments} />
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
          <div className="min-w-0 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-border">
                <th scope="row" className={metaLabelClassName}>
                  {t("pages.vat.columns.client")}
                </th>
                <td className={`${metaValueClassName} font-medium`}>
                  {period.project.client?.name ?? t("pages.billing.noClient")}
                  {period.project.isGovernmentContract ? (
                    <span className="mt-1 block text-xs font-medium text-muted">
                      {t("pages.vat.governmentClient")}
                    </span>
                  ) : null}
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
              {showVatInvoice || period.taxInvoiceSerial ? (
                <tr className="border-b border-border">
                  <th scope="row" className={metaLabelClassName}>
                    {t("pages.vat.columns.taxInvoiceNumber")}
                  </th>
                  <td className={`${metaValueClassName} tabular-nums`}>
                    {period.taxInvoiceSerial
                      ? formatTaxInvoiceSerial(period.taxInvoiceSerial)
                      : "—"}
                  </td>
                </tr>
              ) : null}
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
          </div>
        </SectionCard>

        {period.project.isGovernmentContract ? (
          <SectionCard className="p-5 sm:p-6">
            <h3 className={sectionTitleClassName}>
              {t("pages.vat.governmentPaidDirectlyTitle")}
            </h3>
            <p className="mt-2 text-sm text-muted">
              {t("pages.vat.governmentPaidDirectly")}
            </p>
          </SectionCard>
        ) : null}

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
              canUpload={canManage}
              showWithholdingSlip={
                showWithholdingSlip && !withholdingPath
              }
              files={taxFiles}
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
