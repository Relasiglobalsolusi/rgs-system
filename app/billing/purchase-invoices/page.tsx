import { redirect } from "next/navigation";
import { ShoppingBag } from "lucide-react";

import PurchaseInvoiceTable, {
  type PurchaseInvoiceTableRow,
} from "@/components/billing/PurchaseInvoiceTable";
import PurchaseInvoiceUploadDialog from "@/components/billing/PurchaseInvoiceUploadDialog";
import AppShell from "@/components/layout/AppShell";
import EmptyState from "@/components/ui/EmptyState";
import SectionCard from "@/components/ui/SectionCard";
import { formatDisplayDate } from "@/lib/format-date";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";
import {
  dueAtFromPaymentTerms,
  isCashPaymentTerms,
} from "@/lib/invoice-period";
import { canAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  decimalToNumber,
  formatContractPrice,
} from "@/lib/project-billing";
import { requireFinanceChild, toPermissionUser } from "@/lib/session";

/** AP list view filters for HO Finance. */
const PURCHASE_VIEWS = ["tax", "payments"] as const;
type PurchaseView = (typeof PURCHASE_VIEWS)[number];

function isPurchaseView(value: string): value is PurchaseView {
  return (PURCHASE_VIEWS as readonly string[]).includes(value);
}

type SearchParams = Promise<{ view?: string }>;

export default async function PurchaseInvoicesPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const session = await requireFinanceChild("purchaseInvoices");
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

  const user = toPermissionUser(session);
  const canManage =
    canAccess(user, "invoicing") || canAccess(user, "projects");
  const canUpload = canManage && purchaseView !== "payments";

  const [invoices, vendors, catalogItemsRaw] = await Promise.all([
    prisma.purchaseInvoice.findMany({
      where: {
        companyId: session.user.companyId,
      },
      include: {
        createdBy: { select: { name: true } },
        vendor: { select: { paymentTermsDays: true } },
      },
      orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
    }),
    prisma.vendor.findMany({
      where: { companyId: session.user.companyId, active: true },
      select: { id: true, name: true, paymentTermsDays: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.inventoryItem.findMany({
      where: { companyId: session.user.companyId, active: true },
      select: {
        id: true,
        name: true,
        sku: true,
        unit: true,
        lastUnitCost: true,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);

  const catalogItems = catalogItemsRaw.map((item) => ({
    id: item.id,
    name: item.name,
    sku: item.sku,
    unit: item.unit,
    lastUnitCost: decimalToNumber(item.lastUnitCost),
  }));

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  let filtered = invoices;
  if (purchaseView === "tax") {
    filtered = invoices.filter(
      (invoice) => invoice.includesPpn || Boolean(invoice.taxInvoiceFilePath)
    );
  }

  const showPaymentStatus = purchaseView === "payments";

  const rows: PurchaseInvoiceTableRow[] = filtered.map((invoice) => {
    const termsDays = invoice.vendor?.paymentTermsDays ?? null;
    const dueAt =
      termsDays != null
        ? dueAtFromPaymentTerms(invoice.invoiceDate, termsDays)
        : null;
    const isOverdue = dueAt != null && dueAt.getTime() < today.getTime();

    return {
      id: invoice.id,
      supplierName: invoice.supplierName,
      invoiceRef: invoice.invoiceRef,
      invoiceDateLabel: formatDisplayDate(invoice.invoiceDate),
      paymentTermsLabel:
        termsDays == null
          ? null
          : isCashPaymentTerms(termsDays)
            ? t("common.paymentTerms.cashShort")
            : t("common.paymentTerms.netShort", { days: termsDays }),
      dueDateLabel: dueAt
        ? formatDisplayDate(dueAt, { timeZone: "UTC" })
        : null,
      amountLabel: formatContractPrice(decimalToNumber(invoice.amount)),
      includesPpn: invoice.includesPpn,
      notes: invoice.notes,
      filePath: invoice.filePath,
      taxInvoiceFilePath: invoice.taxInvoiceFilePath,
      uploadedBy: invoice.createdBy?.name ?? null,
      uploadedAtLabel: formatDisplayDate(invoice.createdAt),
      paymentStatus: dueAt == null ? null : isOverdue ? "overdue" : "open",
      showPaymentStatus,
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

  return (
    <AppShell titleKey={titleKey} descriptionKey={descriptionKey}>
      <SectionCard>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/30 bg-card-tint-emerald text-primary-dark">
                <ShoppingBag className="h-4 w-4" aria-hidden />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-text">
                  {t(titleKey)}
                </h2>
              </div>
            </div>
            <p className="mt-2 text-sm text-muted">{t(descriptionKey)}</p>
            <p className="mt-1 text-xs text-subtle">
              {t("pages.billing.purchaseCount", { count: rows.length })}
            </p>
          </div>

          {canUpload ? (
            <PurchaseInvoiceUploadDialog
              vendors={vendors}
              catalogItems={catalogItems}
            />
          ) : null}
        </div>

        {rows.length === 0 ? (
          <EmptyState
            titleKey="pages.billing.purchaseEmpty"
            descriptionKey="pages.billing.purchaseEmptyDesc"
          />
        ) : (
          <PurchaseInvoiceTable
            rows={rows}
            canManage={canUpload}
            readOnlyPayment={purchaseView === "payments"}
          />
        )}
      </SectionCard>
    </AppShell>
  );
}
