import { notFound, redirect } from "next/navigation";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireModule, toPermissionUser } from "@/lib/session";
import {
  taxInvoiceCompletedWhere,
  taxInvoicePendingWhere,
} from "@/lib/billing";
import { formatDisplayDate } from "@/lib/format-date";
import {
  decimalToNumber,
  formatContractPrice,
  formatInvoicePeriodLabel,
  formatProjectTitle,
} from "@/lib/project-billing";
import { getInvoicePaymentDisplay } from "@/lib/invoice-period";
import { canAccess } from "@/lib/permissions";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";

import AppShell from "@/components/layout/AppShell";
import TaxInvoiceTable, {
  type TaxInvoiceTableRow,
} from "@/components/billing/TaxInvoiceTable";
import DirectoryFilterTab from "@/components/ui/DirectoryFilterTab";
import EmptyState from "@/components/ui/EmptyState";
import SectionCard from "@/components/ui/SectionCard";

const TAX_INVOICE_VIEWS = ["pending", "completed"] as const;
type TaxInvoiceView = (typeof TAX_INVOICE_VIEWS)[number];
const NO_CLIENT_ID = "__no_client__";

function isTaxInvoiceView(value: string): value is TaxInvoiceView {
  return (TAX_INVOICE_VIEWS as readonly string[]).includes(value);
}

type SearchParams = Promise<{ view?: string }>;

export default async function TaxInvoiceClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: SearchParams;
}) {
  const session = await requireModule("invoicing");
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  if (session.user.clientId) {
    redirect("/billing");
  }

  const { clientId } = await params;
  const query = await searchParams;
  const view: TaxInvoiceView =
    query.view && isTaxInvoiceView(query.view) ? query.view : "pending";
  const isPending = view === "pending";

  const user = toPermissionUser(session);
  const canManage =
    canAccess(user, "invoicing") || canAccess(user, "projects");

  const isNoClient = clientId === NO_CLIENT_ID;
  let clientName = t("pages.billing.noClient");

  if (!isNoClient) {
    const client = await prisma.client.findFirst({
      where: { id: clientId, companyId: session.user.companyId },
      select: { id: true, name: true },
    });
    if (!client) notFound();
    clientName = client.name;
  }

  const clientFilter: Prisma.ProjectWhereInput = isNoClient
    ? { clientId: null }
    : { clientId };

  const where: Prisma.ProjectInvoicePeriodWhereInput = {
    project: {
      companyId: session.user.companyId,
      ...clientFilter,
    },
    ...(isPending ? taxInvoicePendingWhere() : taxInvoiceCompletedWhere()),
  };

  const periods = await prisma.projectInvoicePeriod.findMany({
    where,
    include: {
      project: {
        select: {
          id: true,
          name: true,
          location: true,
          clientId: true,
          billingMode: true,
          client: { select: { id: true, name: true, paymentTermsDays: true } },
        },
      },
      taxInvoiceDoneBy: {
        select: { name: true },
      },
    },
    orderBy: isPending
      ? [{ submittedAt: "desc" }, { createdAt: "desc" }]
      : [{ taxInvoiceDoneAt: "desc" }],
  });

  if (isNoClient && periods.length === 0) {
    notFound();
  }

  const now = new Date();
  const filterPills = [
    {
      key: "pending",
      label: t("pages.billing.pending"),
      href: `/billing/tax-invoices/${clientId}`,
    },
    {
      key: "completed",
      label: t("pages.billing.completedTab"),
      href: `/billing/tax-invoices/${clientId}?view=completed`,
    },
  ] as const;

  const rows: TaxInvoiceTableRow[] = periods.map((period) => {
    const project = period.project;
    const displayTitle = formatProjectTitle(project.name, period, locale);
    const periodLabel = formatInvoicePeriodLabel(period, {
      projectName: project.name,
      billingMode: project.billingMode,
      locale,
    });
    const amountLabel = formatContractPrice(decimalToNumber(period.amount));
    const paymentDisplay = getInvoicePaymentDisplay(
      {
        ...period,
        paymentTermsDays: project.client?.paymentTermsDays,
      },
      now
    );
    const billingHref = project.clientId
      ? `/billing/${project.clientId}/${project.id}`
      : null;
    const submittedLabel = period.submittedAt
      ? formatDisplayDate(period.submittedAt)
      : "—";
    const sentLabel = period.taxInvoiceDoneAt
      ? formatDisplayDate(period.taxInvoiceDoneAt)
      : null;
    const subtitleParts =
      displayTitle !== project.name
        ? [clientName]
        : [periodLabel, clientName];

    return {
      id: period.id,
      displayTitle,
      subtitle: subtitleParts.filter(Boolean).join(" · "),
      secondary: isPending
        ? `${t("pages.billing.issuedOn", { date: submittedLabel })}${
            amountLabel !== "—" ? ` · ${amountLabel}` : ""
          }`
        : `${t("pages.billing.sentOn", { date: sentLabel ?? "—" })}${
            period.taxInvoiceDoneBy?.name
              ? ` · ${period.taxInvoiceDoneBy.name}`
              : ""
          }`,
      amountLabel,
      billingHref,
      periodLabel,
      paymentKey: paymentDisplay.key,
      isPending,
    };
  });

  return (
    <AppShell
      title={clientName}
      descriptionKey="pages.billing.taxInvoiceClientDesc"
    >
      <SectionCard>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-text">
              {t("pages.billing.ppnKeluaran")}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {isPending
                ? t("pages.billing.invoiceCountAwaiting", {
                    count: rows.length,
                  })
                : t("pages.billing.invoiceCountAcknowledged", {
                    count: rows.length,
                  })}
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

        {rows.length === 0 ? (
          <EmptyState
            titleKey={
              isPending
                ? "pages.billing.noTaxPending"
                : "pages.billing.noTaxCompleted"
            }
            descriptionKey={
              isPending
                ? "pages.billing.noTaxPendingDesc"
                : "pages.billing.noTaxCompletedDesc"
            }
          />
        ) : (
          <TaxInvoiceTable
            rows={rows}
            canManage={canManage}
            isPending={isPending}
          />
        )}
      </SectionCard>
    </AppShell>
  );
}
