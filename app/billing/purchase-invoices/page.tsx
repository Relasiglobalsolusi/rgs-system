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
import { requireModule, toPermissionUser } from "@/lib/session";

/** Shared AP list filters for HO Finance children and vendor portal views. */
const PURCHASE_VIEWS = ["tax", "uploads", "payments"] as const;
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
  const session = await requireModule("invoicing");
  const locale = await getServerLocale();
  const t = createTranslator(locale);

  if (session.user.clientId) {
    redirect("/billing");
  }

  const portalVendorId = session.user.vendorId ?? null;
  const params = searchParams ? await searchParams : {};
  const purchaseView =
    params.view && isPurchaseView(params.view) ? params.view : null;

  const user = toPermissionUser(session);
  const canManage =
    canAccess(user, "invoicing") || canAccess(user, "projects");
  // Payment/settlement is read-only for vendors; HO may still upload elsewhere.
  const canUpload = canManage && purchaseView !== "payments";

  const [invoices, vendors] = await Promise.all([
    prisma.purchaseInvoice.findMany({
      where: {
        companyId: session.user.companyId,
        ...(portalVendorId ? { vendorId: portalVendorId } : {}),
      },
      include: {
        createdBy: { select: { name: true } },
        vendor: { select: { paymentTermsDays: true } },
      },
      orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
    }),
    portalVendorId
      ? prisma.vendor.findMany({
          where: {
            id: portalVendorId,
            companyId: session.user.companyId,
            active: true,
          },
          select: { id: true, name: true, paymentTermsDays: true },
        })
      : prisma.vendor.findMany({
          where: { companyId: session.user.companyId, active: true },
          select: { id: true, name: true, paymentTermsDays: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        }),
  ]);

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  let filtered = invoices;
  if (purchaseView === "tax") {
    filtered = invoices.filter(
      (invoice) => invoice.includesPpn || Boolean(invoice.taxInvoiceFilePath)
    );
  }

  const showUploadStatus =
    purchaseView === "uploads" || Boolean(portalVendorId);
  const showPaymentStatus =
    purchaseView === "payments" || Boolean(portalVendorId);

  const rows: PurchaseInvoiceTableRow[] = filtered.map((invoice) => {
    const termsDays = invoice.vendor?.paymentTermsDays ?? null;
    const dueAt =
      termsDays != null
        ? dueAtFromPaymentTerms(invoice.invoiceDate, termsDays)
        : null;
    const isOverdue = dueAt != null && dueAt.getTime() < today.getTime();
    const taxStatus = invoice.taxInvoiceFilePath
      ? "uploaded"
      : invoice.includesPpn
        ? "missing"
        : "not_required";

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
      taxStatus,
      paymentStatus: dueAt == null ? null : isOverdue ? "overdue" : "open",
      showUploadStatus,
      showPaymentStatus,
    };
  });

  const titleKey =
    purchaseView === "tax"
      ? portalVendorId
        ? "pages.billing.vendorTaxTitle"
        : "pages.billing.purchaseTaxTitle"
      : purchaseView === "uploads"
        ? "pages.billing.vendorUploadsTitle"
        : purchaseView === "payments"
          ? "pages.billing.vendorPaymentsTitle"
          : portalVendorId
            ? "pages.billing.vendorInvoicesTitle"
            : "pages.billing.purchase";

  const descriptionKey =
    purchaseView === "tax"
      ? portalVendorId
        ? "pages.billing.vendorTaxDesc"
        : "pages.billing.purchaseTaxDesc"
      : purchaseView === "uploads"
        ? portalVendorId
          ? "pages.billing.vendorUploadsDesc"
          : "pages.billing.hoUploadsDesc"
        : purchaseView === "payments"
          ? portalVendorId
            ? "pages.billing.vendorPaymentsDesc"
            : "pages.billing.hoPaymentsDesc"
          : portalVendorId
            ? "pages.billing.vendorInvoicesDesc"
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
              lockToVendor={Boolean(portalVendorId)}
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
