import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { AlertTriangle, FileCheck2, FileInput, FileOutput } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import {
  taxInvoiceCompletedWhere,
  taxInvoicePendingWhere,
} from "@/lib/billing";
import { getInvoicePaymentDisplay } from "@/lib/invoice-period";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";

import AppShell from "@/components/layout/AppShell";
import TaxInvoiceClientDirectory, {
  type TaxInvoiceClientRow,
} from "@/components/billing/TaxInvoiceClientDirectory";
import DirectoryFilterTab from "@/components/ui/DirectoryFilterTab";
import EmptyState from "@/components/ui/EmptyState";
import SectionCard from "@/components/ui/SectionCard";
import StatusBadge from "@/components/ui/StatusBadge";
import { buttonVariants } from "@/components/ui/button";
import { formatDisplayDate } from "@/lib/format-date";
import { cn } from "@/lib/utils";

const TAX_INVOICE_VIEWS = ["pending", "completed"] as const;
type TaxInvoiceView = (typeof TAX_INVOICE_VIEWS)[number];

function isTaxInvoiceView(value: string): value is TaxInvoiceView {
  return (TAX_INVOICE_VIEWS as readonly string[]).includes(value);
}

type SearchParams = Promise<{ view?: string }>;

type ClientBucket = {
  id: string;
  name: string;
  pendingCount: number;
  overdueCount: number;
  completedCount: number;
  invoiceCount: number;
};

export default async function TaxInvoicesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireModule("invoicing");
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  if (session.user.clientId) {
    redirect("/billing");
  }
  // Vendor portal: PPN masukan upload lives on their Finance tax view.
  if (session.user.vendorId) {
    redirect("/billing/purchase-invoices?view=tax");
  }

  const params = await searchParams;
  const view: TaxInvoiceView =
    params.view && isTaxInvoiceView(params.view) ? params.view : "pending";
  const isPending = view === "pending";

  const where: Prisma.ProjectInvoicePeriodWhereInput = {
    project: { companyId: session.user.companyId },
    ...(isPending ? taxInvoicePendingWhere() : taxInvoiceCompletedWhere()),
  };

  const [periods, masukanPurchases, noTaxIdPeriods] = await Promise.all([
    prisma.projectInvoicePeriod.findMany({
      where,
      include: {
        project: {
          select: {
            id: true,
            name: true,
            clientId: true,
            client: {
              select: { id: true, name: true, paymentTermsDays: true, npwp: true },
            },
          },
        },
      },
      orderBy: isPending
        ? [{ submittedAt: "desc" }, { createdAt: "desc" }]
        : [{ taxInvoiceDoneAt: "desc" }],
    }),
    prisma.purchaseInvoice.findMany({
      where: {
        companyId: session.user.companyId,
        OR: [{ includesPpn: true }, { taxInvoiceFilePath: { not: null } }],
      },
      orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
      take: 40,
      select: {
        id: true,
        supplierName: true,
        invoiceRef: true,
        invoiceDate: true,
        includesPpn: true,
        taxInvoiceFilePath: true,
        amount: true,
      },
    }),
    // Summary: paid AR invoices for clients with no NPWP (no faktur expected).
    prisma.projectInvoicePeriod.findMany({
      where: {
        status: "PAID",
        taxInvoiceRequired: false,
        project: {
          companyId: session.user.companyId,
          OR: [
            { client: { npwp: null } },
            { client: { npwp: "" } },
            { clientId: null },
          ],
        },
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            clientId: true,
            client: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ paidAt: "desc" }],
      take: 40,
    }),
  ]);

  const now = new Date();
  const filterPills = [
    {
      key: "pending",
      label: t("pages.billing.pending"),
      href: "/billing/tax-invoices",
    },
    {
      key: "completed",
      label: t("pages.billing.completedTab"),
      href: "/billing/tax-invoices?view=completed",
    },
  ] as const;

  const buckets = new Map<string, ClientBucket>();

  for (const period of periods) {
    const project = period.project;
    const clientId = project.clientId ?? project.client?.id ?? "__no_client__";
    const clientName = project.client?.name ?? t("pages.billing.noClient");
    const paymentDisplay = getInvoicePaymentDisplay(
      {
        ...period,
        paymentTermsDays: project.client?.paymentTermsDays,
      },
      now
    );

    const existing = buckets.get(clientId);
    const isOverduePending =
      isPending &&
      (paymentDisplay.key === "LATE" || period.status === "OVERDUE");

    if (existing) {
      existing.invoiceCount += 1;
      if (isPending) {
        existing.pendingCount += 1;
        if (isOverduePending) existing.overdueCount += 1;
      } else {
        existing.completedCount += 1;
      }
    } else {
      buckets.set(clientId, {
        id: clientId,
        name: clientName,
        pendingCount: isPending ? 1 : 0,
        overdueCount: isOverduePending ? 1 : 0,
        completedCount: isPending ? 0 : 1,
        invoiceCount: 1,
      });
    }
  }

  const clientRows: TaxInvoiceClientRow[] = Array.from(buckets.values()).sort(
    (a, b) => {
      if (b.overdueCount !== a.overdueCount) {
        return b.overdueCount - a.overdueCount;
      }
      if (b.pendingCount !== a.pendingCount) {
        return b.pendingCount - a.pendingCount;
      }
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    }
  );

  const totalPendingInvoices = isPending
    ? periods.length
    : clientRows.reduce((sum, row) => sum + row.pendingCount, 0);
  const clientsNeedingAttention = clientRows.filter(
    (row) => row.pendingCount > 0 || row.overdueCount > 0
  ).length;

  return (
    <AppShell
      titleKey="pages.billing.taxInvoice"
      descriptionKey="pages.billing.taxInvoiceDescription"
    >
      {isPending && periods.length > 0 ? (
        <SectionCard className="mb-5 border-amber-500/30 bg-card-tint-amber">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-amber-100">
                {t("pages.billing.taxActionRequiredTitle", {
                  count: periods.length,
                })}
              </p>
              <p className="mt-1 text-sm text-muted">
                {t("pages.billing.taxActionRequiredDesc")}
              </p>
            </div>
            <FileCheck2 className="hidden h-8 w-8 shrink-0 text-amber-400/50 sm:block" />
          </div>
        </SectionCard>
      ) : null}

      {isPending && noTaxIdPeriods.length > 0 ? (
        <SectionCard className="mb-5">
          <h3 className="text-base font-semibold text-text">
            {t("pages.reconciliation.noTaxIdTitle")}
          </h3>
          <p className="mt-1 text-sm text-muted">
            {t("pages.reconciliation.noTaxIdHelp")}
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {noTaxIdPeriods.map((period) => (
              <li
                key={period.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
              >
                <span className="text-text">
                  {period.project.name}
                  <span className="text-subtle">
                    {" "}
                    · {period.project.client?.name ?? t("pages.billing.noClient")}
                    {period.label ? ` · ${period.label}` : ""}
                  </span>
                </span>
                {period.project.clientId ? (
                  <Link
                    href={`/billing/${period.project.clientId}/${period.project.id}`}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" })
                    )}
                  >
                    {t("pages.reconciliation.openBilling")}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      <div className="space-y-6">
        <SectionCard>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/30 bg-card-tint-emerald text-primary-dark">
                  <FileOutput className="h-4 w-4" aria-hidden />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-text">
                    {t("pages.billing.ppnKeluaran")}
                  </h2>
                </div>
              </div>
              <p className="mt-2 text-sm text-muted">
                {t("pages.billing.ppnKeluaranDesc")}
              </p>
              <p className="mt-1 text-xs text-subtle">
                {isPending
                  ? t("pages.billing.taxClientsNeedingAttention", {
                      count: clientsNeedingAttention,
                    })
                  : t("pages.billing.invoiceCountAcknowledged", {
                      count: periods.length,
                    })}
                {isPending && totalPendingInvoices > 0
                  ? ` · ${t("pages.billing.invoiceCountAwaiting", {
                      count: totalPendingInvoices,
                    })}`
                  : null}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {filterPills.map((pill) => (
                <DirectoryFilterTab
                  key={pill.key}
                  href={pill.href}
                  active={pill.key === view}
                >
                  {pill.label}
                </DirectoryFilterTab>
              ))}
            </div>
          </div>

          <TaxInvoiceClientDirectory
            clients={clientRows}
            isPending={isPending}
            emptyTitleKey={
              isPending
                ? "pages.billing.noTaxPending"
                : "pages.billing.noTaxCompleted"
            }
            emptyDescriptionKey={
              isPending
                ? "pages.billing.noTaxPendingDesc"
                : "pages.billing.noTaxCompletedDesc"
            }
          />
        </SectionCard>

        <SectionCard>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-elevated text-muted">
                  <FileInput className="h-4 w-4" aria-hidden />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-text">
                    {t("pages.billing.ppnMasukan")}
                  </h2>
                </div>
              </div>
              <p className="mt-2 text-sm text-muted">
                {t("pages.billing.ppnMasukanDesc")}
              </p>
              <p className="mt-1 text-xs text-subtle">
                {t("pages.billing.purchaseCount", {
                  count: masukanPurchases.length,
                })}
              </p>
            </div>
            <Link
              href="/billing/purchase-invoices?view=tax"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              {t("pages.billing.ppnMasukanOpenPurchase")}
            </Link>
          </div>

          {masukanPurchases.length === 0 ? (
            <EmptyState
              titleKey="pages.billing.ppnMasukanEmpty"
              descriptionKey="pages.billing.ppnMasukanEmptyDesc"
            />
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {masukanPurchases.map((invoice) => {
                const taxReady = Boolean(invoice.taxInvoiceFilePath);
                return (
                  <li
                    key={invoice.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-text">
                        {invoice.supplierName}
                      </p>
                      <p className="mt-0.5 text-sm text-subtle">
                        {invoice.invoiceRef}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-sm tabular-nums text-muted">
                        {formatDisplayDate(invoice.invoiceDate)}
                      </p>
                      <StatusBadge
                        status={taxReady ? "success" : "warning"}
                        compact
                      >
                        {taxReady
                          ? t("pages.billing.vendorStatusTaxUploaded")
                          : t("pages.billing.vendorStatusTaxMissing")}
                      </StatusBadge>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </div>
    </AppShell>
  );
}
