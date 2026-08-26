import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import HoRevisionReviewPanel from "@/components/billing/HoRevisionReviewPanel";
import ClientBillingReviewActions from "@/components/billing/ClientBillingReviewActions";
import AppShell from "@/components/layout/AppShell";
import BillingBreadcrumbs from "@/components/billing/BillingBreadcrumbs";
import SectionCard from "@/components/ui/SectionCard";
import StatusBadge from "@/components/ui/StatusBadge";
import { buttonVariants } from "@/components/ui/button";
import {
  isAwaitingClientAction,
} from "@/lib/client-billing-review";
import { formatDisplayDate } from "@/lib/format-date";
import {
  localizeClientReviewChipLines,
  localizeClientReviewKind,
  localizeClientReviewStatus,
} from "@/lib/i18n/labels";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";
import { prisma } from "@/lib/prisma";
import {
  decimalToNumber,
  formatContractPrice,
} from "@/lib/project-billing";
import { getProjectWhereForUser } from "@/lib/project-access";
import { requireFinanceChild } from "@/lib/session";
import { cn } from "@/lib/utils";
import { loadPeriodReviewAmounts } from "@/lib/review-amount-fields";

type Props = {
  params: Promise<{ periodId: string }>;
};

export default async function ReconciliationDetailPage({ params }: Props) {
  const session = await requireFinanceChild("reconciliation");
  if (session.user.vendorId) {
    redirect("/billing/purchase-invoices");
  }

  const { periodId } = await params;
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  const isClient = Boolean(session.user.clientId);

  const projectWhere = await getProjectWhereForUser({
    companyId: session.user.companyId,
    clientId: session.user.clientId,
    userId: session.user.id,
    username: session.user.username,
  });

  const period = await prisma.projectInvoicePeriod.findFirst({
    where: { id: periodId, project: projectWhere },
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
  });
  if (!period) notFound();

  const amount =
    decimalToNumber(period.revisedInvoiceAmount) ??
    decimalToNumber(period.amount);
  const { clientRequestedAmount, hoProposedAmount } =
    await loadPeriodReviewAmounts(period.id);
  const billingHref = period.project.clientId
    ? `/billing/${period.project.clientId}/${period.project.id}`
    : "/billing";
  const awaitingClient = isAwaitingClientAction(period.clientReviewStatus);
  const isRevised = period.clientReviewStatus === "CLIENT_REVISED";

  return (
    <AppShell title={t("pages.reconciliation.detailTitle")}>
      <BillingBreadcrumbs
        items={[
          {
            label: t("pages.reconciliation.title"),
            href: "/billing/reconciliation",
          },
          { label: period.project.name },
        ]}
      />
      <SectionCard className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-text">
              {period.project.name}
            </h1>
            <p className="text-sm text-muted">
              {period.project.client?.name ?? "—"} ·{" "}
              {period.label ?? t("pages.billing.columns.period")}
            </p>
            <p className="mt-1 text-xs text-subtle">
              {localizeClientReviewKind(period.clientReviewKind, locale)} ·{" "}
              {period.periodStart
                ? formatDisplayDate(period.periodStart, { timeZone: "UTC" })
                : "—"}{" "}
              –{" "}
              {period.periodEnd
                ? formatDisplayDate(period.periodEnd, { timeZone: "UTC" })
                : "—"}
              {amount != null ? ` · ${formatContractPrice(amount)}` : ""}
            </p>
          </div>
          <StatusBadge
            status={isRevised ? "warning" : awaitingClient ? "pending" : "active"}
            compact
            lines={
              localizeClientReviewChipLines(period.clientReviewStatus, locale) ??
              undefined
            }
          >
            {localizeClientReviewStatus(period.clientReviewStatus, locale)}
          </StatusBadge>
        </div>

        {isRevised ? (
          <div className="rounded-xl border border-warning/40 bg-card-tint-amber/20 p-4">
            <h2 className="text-sm font-semibold text-text">
              {t("pages.reconciliation.revisionReason")}
            </h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-text">
              {period.clientRevisionNote?.trim() ||
                t("pages.reconciliation.noRevisionNote")}
            </p>
            {clientRequestedAmount != null ? (
              <p className="mt-3 text-sm text-text">
                <span className="text-xs font-medium text-muted">
                  {t("pages.reconciliation.revisedRequestedAmount")}
                </span>
                <span className="mt-0.5 block font-semibold tabular-nums">
                  {formatContractPrice(clientRequestedAmount)}
                </span>
              </p>
            ) : null}
            {period.clientRevisionProofPath ? (
              <a
                href={period.clientRevisionProofPath}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex text-sm font-medium text-primary"
              >
                {t("pages.reconciliation.revisionProof")}
              </a>
            ) : null}
          </div>
        ) : null}

        {period.compileNote?.trim() ? (
          <p className="text-sm text-subtle">{period.compileNote}</p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Link
            href={billingHref}
            className={cn(buttonVariants({ variant: "default", size: "sm" }))}
          >
            {t("pages.reconciliation.openBilling")}
          </Link>
          {period.reviewReportPdfPath ? (
            <a
              href={period.reviewReportPdfPath}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ variant: "info", size: "sm" }))}
            >
              {t("pages.reconciliation.viewReport")}
            </a>
          ) : null}
        </div>

        {isClient && awaitingClient ? (
          <ClientBillingReviewActions
            periodId={period.id}
            reviewReportPdfPath={period.reviewReportPdfPath}
            hoReviewNote={period.hoReviewNote}
            hoReviewProofPath={period.hoReviewProofPath}
            showHoRejection={period.clientReviewStatus === "HO_REJECTED_REVISION"}
            hoProposedAmount={hoProposedAmount}
          />
        ) : null}

        {!isClient && isRevised ? (
          <HoRevisionReviewPanel
            periodId={period.id}
            clientRevisionNote={period.clientRevisionNote}
            clientRevisionProofPath={period.clientRevisionProofPath}
            suggestedAmount={clientRequestedAmount ?? amount}
            clientRequestedAmount={clientRequestedAmount}
          />
        ) : null}
      </SectionCard>
    </AppShell>
  );
}
