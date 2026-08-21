import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, Landmark, ShoppingBag, Wallet } from "lucide-react";

import SettlementsApMarkPaidButton from "@/components/billing/SettlementsApMarkPaidButton";
import AppShell from "@/components/layout/AppShell";
import DirectoryStatCard from "@/components/ui/DirectoryStatCard";
import EmptyState from "@/components/ui/EmptyState";
import SectionCard from "@/components/ui/SectionCard";
import StatusBadge from "@/components/ui/StatusBadge";
import { buttonVariants } from "@/components/ui/button";
import { UNPAID_INVOICE_STATUSES } from "@/lib/billing";
import { formatDisplayDate } from "@/lib/format-date";
import { getServerLocale } from "@/lib/i18n/locale";
import { localizeBillingStatus } from "@/lib/i18n/labels";
import { createTranslator } from "@/lib/i18n/translate";
import {
  getInvoicePaymentDisplay,
  getPurchasePaymentDisplay,
  isCashPaymentTerms,
} from "@/lib/invoice-period";
import { canAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  decimalToNumber,
  formatContractPrice,
} from "@/lib/project-billing";
import { requireFinanceChild, toPermissionUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export default async function SettlementsPage() {
  const session = await requireFinanceChild("vendorPayments");
  const locale = await getServerLocale();
  const t = createTranslator(locale);

  // Vendor portal settlement lives on their purchase payments view.
  if (session.user.vendorId) {
    redirect("/billing/purchase-invoices?view=payments");
  }

  const portalClientId = session.user.clientId ?? null;
  const permissionUser = toPermissionUser(session);
  const canMarkApPaid =
    !portalClientId &&
    (canAccess(permissionUser, "vendorPayments") ||
      canAccess(permissionUser, "projects"));
  const now = new Date();

  const [arPeriods, apInvoices] = await Promise.all([
    prisma.projectInvoicePeriod.findMany({
      where: {
        project: {
          companyId: session.user.companyId,
          ...(portalClientId ? { clientId: portalClientId } : {}),
        },
        status: { in: [...UNPAID_INVOICE_STATUSES] },
      },
      select: {
        id: true,
        status: true,
        amount: true,
        revisedInvoiceAmount: true,
        dueAt: true,
        submittedAt: true,
        paidAt: true,
        project: {
          select: {
            id: true,
            name: true,
            clientId: true,
            paymentTermsDays: true,
            client: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: [{ dueAt: "asc" }, { submittedAt: "desc" }],
      take: 50,
    }),
    // HO only — open AP (unpaid). Paid purchases leave this queue.
    portalClientId
      ? Promise.resolve([])
      : prisma.purchaseInvoice.findMany({
          where: {
            companyId: session.user.companyId,
            paidAt: null,
            reversedAt: null,
            freeOfCharge: false,
          },
          orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
          take: 80,
        }),
  ]);

  const arRows = arPeriods.map((period) => {
    const client = period.project.client;
    const display = getInvoicePaymentDisplay(
      {
        ...period,
        paymentTermsDays: period.project.paymentTermsDays,
      },
      now
    );
    const clientId = period.project.clientId ?? client?.id;
    const href =
      clientId != null
        ? `/billing/${clientId}/${period.project.id}`
        : "/billing";

    const amount =
      decimalToNumber(period.revisedInvoiceAmount) ??
      decimalToNumber(period.amount);
    return {
      id: period.id,
      label: period.project.name,
      clientName: client?.name ?? t("pages.billing.noClient"),
      amountLabel:
        amount != null ? formatContractPrice(amount) : "—",
      dueLabel: display.dueAt
        ? formatDisplayDate(display.dueAt)
        : "—",
      statusKey: display.key,
      isLate: display.isLate,
      href,
    };
  });

  const apRows = apInvoices
    .map((invoice) => {
      const termsDays = invoice.paymentTermsDays ?? 14;
      const payment = getPurchasePaymentDisplay(
        {
          invoiceDate: invoice.invoiceDate,
          paidAt: invoice.paidAt,
          paymentTermsDays: termsDays,
        },
        now
      );
      if (payment.dueAt == null) return null;
      return {
        id: invoice.id,
        supplierName: invoice.supplierName,
        invoiceRef: invoice.invoiceRef,
        amountLabel: formatContractPrice(decimalToNumber(invoice.amount)),
        dueLabel: formatDisplayDate(payment.dueAt, { timeZone: "UTC" }),
        termsLabel: isCashPaymentTerms(termsDays)
          ? t("common.paymentTerms.cashShort")
          : t("common.paymentTerms.netShort", { days: termsDays }),
        isOverdue: payment.isOverdue,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null)
    .sort((a, b) => {
      if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
      return a.dueLabel.localeCompare(b.dueLabel);
    })
    .slice(0, 50);

  const arTotal = arPeriods.reduce((sum, period) => {
    return (
      sum +
      (decimalToNumber(period.revisedInvoiceAmount) ??
        decimalToNumber(period.amount) ??
        0)
    );
  }, 0);
  const arOverdue = arRows.filter((row) => row.isLate).length;
  const apTotal = apInvoices.reduce(
    (sum, invoice) => sum + (decimalToNumber(invoice.amount) ?? 0),
    0
  );
  const apOverdue = apRows.filter((row) => row.isOverdue).length;

  return (
    <AppShell
      titleKey="pages.billing.settlementsTitle"
      descriptionKey="pages.billing.settlementsDesc"
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DirectoryStatCard
            compact
            title={t("pages.billing.settlementsCardAr")}
            value={formatContractPrice(arTotal)}
            subtitle={t("pages.billing.settlementsArCount", {
              count: arRows.length,
            })}
            icon={<Wallet size={18} />}
            accent="success"
          />
          <DirectoryStatCard
            compact
            title={t("pages.billing.settlementsCardArOverdue")}
            value={arOverdue}
            subtitle={t("pages.billing.settlementsCardArOverdueHint")}
            icon={<FileText size={18} />}
            accent={arOverdue > 0 ? "danger" : "muted"}
          />
          <DirectoryStatCard
            compact
            title={t("pages.billing.settlementsCardAp")}
            value={formatContractPrice(apTotal)}
            subtitle={t("pages.billing.settlementsApCount", {
              count: apRows.length,
            })}
            icon={<Landmark size={18} />}
            accent="warning"
          />
          <DirectoryStatCard
            compact
            title={t("pages.billing.settlementsCardApOverdue")}
            value={apOverdue}
            subtitle={t("pages.billing.settlementsCardApOverdueHint")}
            icon={<ShoppingBag size={18} />}
            accent={apOverdue > 0 ? "danger" : "muted"}
          />
        </div>
        <SectionCard>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/30 bg-card-tint-emerald text-primary-dark">
                  <Wallet className="h-4 w-4" aria-hidden />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-text">
                    {t("pages.billing.settlementsCollections")}
                  </h2>
                </div>
              </div>
              <p className="mt-2 text-sm text-muted">
                {t("pages.billing.settlementsCollectionsDesc")}
              </p>
              <p className="mt-1 text-xs text-subtle">
                {t("pages.billing.settlementsArCount", {
                  count: arRows.length,
                })}
              </p>
            </div>
            <Link
              href="/billing"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <FileText className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              {t("pages.billing.settlementsOpenBilling")}
            </Link>
          </div>

          {arRows.length === 0 ? (
            <EmptyState
              titleKey="pages.billing.settlementsArEmpty"
              descriptionKey="pages.billing.settlementsArEmptyDesc"
            />
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {arRows.map((row) => (
                <li key={row.id}>
                  <Link
                    href={row.href}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition hover:bg-elevated"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-text">{row.label}</p>
                      <p className="mt-0.5 text-sm text-subtle">
                        {row.clientName}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-sm tabular-nums text-muted">
                        {row.dueLabel}
                      </p>
                      <p className="text-sm font-medium tabular-nums text-text">
                        {row.amountLabel}
                      </p>
                      <StatusBadge
                        status={row.isLate ? "danger" : "warning"}
                        compact
                      >
                        {localizeBillingStatus(row.statusKey, locale)}
                      </StatusBadge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {!portalClientId ? (
          <SectionCard>
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/30 bg-card-tint-emerald text-primary-dark">
                    <ShoppingBag className="h-4 w-4" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-text">
                      {t("pages.billing.settlementsPayables")}
                    </h2>
                  </div>
                </div>
                <p className="mt-2 text-sm text-muted">
                  {t("pages.billing.settlementsPayablesDesc")}
                </p>
                <p className="mt-1 text-xs text-subtle">
                  {t("pages.billing.settlementsApCount", {
                    count: apRows.length,
                  })}
                </p>
              </div>
              <Link
                href="/billing/purchase-invoices"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" })
                )}
              >
                <ShoppingBag className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                {t("pages.billing.settlementsOpenPurchases")}
              </Link>
            </div>

            {apRows.length === 0 ? (
              <EmptyState
                titleKey="pages.billing.settlementsApEmpty"
                descriptionKey="pages.billing.settlementsApEmptyDesc"
              />
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border">
                {apRows.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-text">{row.supplierName}</p>
                      <p className="mt-0.5 text-sm text-subtle">
                        {row.invoiceRef}
                        {row.termsLabel ? ` · ${row.termsLabel}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-sm tabular-nums text-muted">
                        {row.dueLabel}
                      </p>
                      <p className="text-sm font-medium tabular-nums text-text">
                        {row.amountLabel}
                      </p>
                      <StatusBadge
                        status={row.isOverdue ? "danger" : "info"}
                        compact
                      >
                        {row.isOverdue
                          ? t("pages.billing.vendorStatusOverdue")
                          : t("pages.billing.vendorStatusOpen")}
                      </StatusBadge>
                      {canMarkApPaid ? (
                        <SettlementsApMarkPaidButton
                          purchaseInvoiceId={row.id}
                          supplierName={row.supplierName}
                          invoiceRef={row.invoiceRef}
                        />
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        ) : null}
      </div>
    </AppShell>
  );
}
