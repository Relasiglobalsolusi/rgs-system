import { redirect } from "next/navigation";
import { ShoppingBag, CircleDollarSign, Wallet, AlertTriangle, Ship } from "lucide-react";

import PurchaseInvoicePeriodControl from "@/components/billing/PurchaseInvoicePeriodControl";
import PurchaseInvoiceTable, {
  type PurchaseInvoiceTableRow,
} from "@/components/billing/PurchaseInvoiceTable";
import PurchaseInvoiceUploadDialog from "@/components/billing/PurchaseInvoiceUploadDialog";
import AppShell from "@/components/layout/AppShell";
import EmptyState from "@/components/ui/EmptyState";
import DirectoryStatCard from "@/components/ui/DirectoryStatCard";
import SectionCard from "@/components/ui/SectionCard";
import { formatDisplayDate } from "@/lib/format-date";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";
import {
  getPurchasePaymentDisplay,
  isPurchaseTaxIncomplete,
} from "@/lib/invoice-period";
import { getPurchaseRecordChips, getPurchaseRecordStatus } from "@/lib/purchase-record-status";
import { canAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  decimalToNumber,
  formatContractPrice,
} from "@/lib/project-billing";
import { requireFinanceChild, toPermissionUser } from "@/lib/session";
import { processScheduledPettyCashPays } from "@/lib/petty-cash";
import { jakartaYearMonth, utcRangeForJakartaDate, utcRangeForJakartaMonth, daysInUtcMonth } from "@/lib/vat";
import { governmentTaxKindLabelKey } from "@/lib/government-tax";

/** AP list view filters for HO Finance. */
const PURCHASE_VIEWS = ["tax", "payments"] as const;
type PurchaseView = (typeof PURCHASE_VIEWS)[number];

function isPurchaseView(value: string): value is PurchaseView {
  return (PURCHASE_VIEWS as readonly string[]).includes(value);
}

type SearchParams = Promise<{
  view?: string;
  year?: string;
  month?: string;
  day?: string;
}>;

export default async function PurchaseInvoicesPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const session = await requireFinanceChild("purchaseInvoices");
  await processScheduledPettyCashPays(prisma, session.user.companyId);
  const locale = await getServerLocale();
  const t = createTranslator(locale);

  if (session.user.clientId) {
    redirect("/billing");
  }

  // Vendor portal access is disabled — vendors do not use the ERP directly.
  if (session.user.vendorId) {
    redirect("/billing");
  }

  const params = searchParams ? await searchParams : {};
  const purchaseView =
    params.view && isPurchaseView(params.view) ? params.view : null;

  const nowYm = jakartaYearMonth();
  const year = Math.max(
    2000,
    Math.min(2100, Number(params.year) || nowYm.year)
  );
  const month = Math.max(
    1,
    Math.min(12, Number(params.month) || nowYm.month)
  );
  const maxDay = daysInUtcMonth(year, month);
  const parsedDay = Number(params.day);
  const day =
    Number.isFinite(parsedDay) && parsedDay >= 1 && parsedDay <= maxDay
      ? parsedDay
      : null;
  const { start, endExclusive } =
    day != null
      ? utcRangeForJakartaDate(year, month, day)
      : utcRangeForJakartaMonth(year, month);

  const user = toPermissionUser(session);
  const canManage =
    canAccess(user, "purchaseInvoices") || canAccess(user, "projects");
  const canUpload = canManage && purchaseView !== "payments";

  const [invoices, vendors, catalogItemsRaw, projectsRaw] = await Promise.all([
    prisma.purchaseInvoice.findMany({
      where: {
        companyId: session.user.companyId,
        // Filter by supplier invoice date (not createdAt).
        invoiceDate: { gte: start, lt: endExclusive },
        reversedAt: null,
        ...(purchaseView
          ? { purpose: { not: "PETTY_CASH" } }
          : {}),
      },
      include: {
        createdBy: { select: { name: true } },
        lines: { select: { quantity: true, unitPrice: true } },
      },
      orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
    }),
    prisma.vendor.findMany({
      where: { companyId: session.user.companyId, active: true },
      select: { id: true, name: true, vendorType: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.inventoryItem.findMany({
      where: { companyId: session.user.companyId, active: true },
      select: {
        id: true,
        name: true,
        sku: true,
        unit: true,
        itemType: true,
        lastUnitCost: true,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.project.findMany({
      where: {
        companyId: session.user.companyId,
        status: { in: ["PLANNED", "IN_PROGRESS", "WAITING_FOR_APPROVAL"] },
        client: { active: true },
      },
      select: {
        id: true,
        name: true,
        client: { select: { name: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);

  const catalogItems = catalogItemsRaw.map((item) => ({
    id: item.id,
    name: item.name,
    sku: item.sku,
    unit: item.unit,
    itemType: item.itemType,
    lastUnitCost: decimalToNumber(item.lastUnitCost),
  }));

  const now = new Date();

  let filtered = invoices;
  if (purchaseView === "tax") {
    filtered = invoices.filter(
      (invoice) =>
        invoice.purchaseCategory !== "GOVERNMENT" &&
        (invoice.includesPpn || Boolean(invoice.taxInvoiceFilePath))
    );
    filtered = [...filtered].sort((a, b) => {
      const aPending = isPurchaseTaxIncomplete(a) ? 0 : 1;
      const bPending = isPurchaseTaxIncomplete(b) ? 0 : 1;
      return aPending - bPending;
    });
  }

  const rows: PurchaseInvoiceTableRow[] = filtered.map((invoice) => {
    const termsDays = invoice.paymentTermsDays ?? 14;
    const payment = getPurchasePaymentDisplay(
      {
        invoiceDate: invoice.invoiceDate,
        paidAt: invoice.paidAt,
        paymentTermsDays: termsDays,
      },
      now
    );
    return {
      id: invoice.id,
      supplierName: invoice.supplierName,
      invoiceRef: invoice.invoiceRef,
      invoiceDateLabel: formatDisplayDate(invoice.invoiceDate),
      amountLabel: formatContractPrice(decimalToNumber(invoice.amount)),
      origin: invoice.origin,
      purchaseCategory: invoice.purchaseCategory,
      governmentTaxKindLabel: invoice.governmentTaxKind
        ? t(governmentTaxKindLabelKey(invoice.governmentTaxKind))
        : null,
      freeOfCharge: invoice.freeOfCharge,
      hasInvoice: invoice.hasInvoice,
      paymentStatus: invoice.freeOfCharge
        ? "paid"
        : payment.key === "no_due"
          ? null
          : payment.key,
      recordStatus: getPurchaseRecordStatus(invoice).key,
      recordChips: getPurchaseRecordChips(invoice).filter(
        (chip) => chip !== "complete"
      ),
    };
  });

  const titleKey =
    purchaseView === "tax"
      ? "pages.billing.purchaseTaxTitle"
      : purchaseView === "payments"
        ? "pages.billing.vendorPaymentsTitle"
        : "pages.billing.purchase";

  const descriptionKey =
    purchaseView === "tax"
      ? "pages.billing.purchaseTaxDesc"
      : purchaseView === "payments"
        ? "pages.billing.hoPaymentsDesc"
        : "pages.billing.purchaseDescription";

  const totalAmount = filtered.reduce(
    (sum, invoice) => sum + (decimalToNumber(invoice.amount) ?? 0),
    0
  );
  const unpaidAmount = filtered.reduce((sum, invoice) => {
    if (invoice.freeOfCharge || invoice.paidAt) return sum;
    return sum + (decimalToNumber(invoice.amount) ?? 0);
  }, 0);
  const overdueCount = rows.filter((row) => row.paymentStatus === "overdue").length;
  const incompleteCount = rows.filter(
    (row) => row.origin === "IMPORT" && (row.recordChips?.length ?? 0) > 0
  ).length;

  return (
    <AppShell titleKey={titleKey} descriptionKey={descriptionKey}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/30 bg-card-tint-emerald text-primary-dark">
              <ShoppingBag className="h-4 w-4" aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold tracking-tight text-text">
                {t(titleKey)}
              </h2>
              <p className="mt-0.5 text-sm text-subtle">{t(descriptionKey)}</p>
            </div>
          </div>
          <p className="mt-2 text-xs font-medium tabular-nums text-muted">
            {t("pages.billing.purchaseCount", { count: rows.length })}
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <PurchaseInvoicePeriodControl
            year={year}
            month={month}
            day={day}
            view={purchaseView}
          />
          {canUpload ? (
            <PurchaseInvoiceUploadDialog
              vendors={vendors}
              catalogItems={catalogItems}
              projects={projectsRaw.map((project) => ({
                id: project.id,
                name: project.name,
                clientName: project.client?.name ?? null,
              }))}
            />
          ) : null}
        </div>
      </div>

      {purchaseView ? null : (
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DirectoryStatCard
            compact
            title={t("pages.billing.purchaseCardTotal")}
            value={formatContractPrice(totalAmount)}
            subtitle={t("pages.billing.purchaseCount", { count: rows.length })}
            icon={<CircleDollarSign size={18} />}
            accent="primary"
          />
          <DirectoryStatCard
            compact
            title={t("pages.billing.purchaseCardUnpaid")}
            value={formatContractPrice(unpaidAmount)}
            subtitle={t("pages.billing.purchaseCardUnpaidHint")}
            icon={<Wallet size={18} />}
            accent="warning"
          />
          <DirectoryStatCard
            compact
            title={t("pages.billing.purchaseCardOverdue")}
            value={overdueCount}
            subtitle={t("pages.billing.purchaseCardOverdueHint")}
            icon={<AlertTriangle size={18} />}
            accent={overdueCount > 0 ? "danger" : "muted"}
          />
          <DirectoryStatCard
            compact
            title={t("pages.billing.purchaseCardIncompleteImport")}
            value={incompleteCount}
            subtitle={t("pages.billing.purchaseCardIncompleteImportHint")}
            icon={<Ship size={18} />}
            accent={incompleteCount > 0 ? "info" : "muted"}
          />
        </div>
      )}

      {rows.length === 0 ? (
        <SectionCard className="p-5 sm:p-6">
          <EmptyState
            titleKey="pages.billing.purchaseEmptyPeriod"
            descriptionKey="pages.billing.purchaseEmptyPeriodDesc"
          />
        </SectionCard>
      ) : (
        <PurchaseInvoiceTable rows={rows} />
      )}
    </AppShell>
  );
}
