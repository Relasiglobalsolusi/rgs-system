import Link from "next/link";
import { redirect } from "next/navigation";
import { InvoicePeriodStatus, type Prisma } from "@prisma/client";

import HoRevisionReviewPanel from "@/components/billing/HoRevisionReviewPanel";
import ClientBillingReviewActions from "@/components/billing/ClientBillingReviewActions";
import AppShell from "@/components/layout/AppShell";
import EmptyState from "@/components/ui/EmptyState";
import SectionCard from "@/components/ui/SectionCard";
import StatusBadge from "@/components/ui/StatusBadge";
import { buttonVariants } from "@/components/ui/button";
import {
  APPROVED_REVIEW_STATUSES,
  CLIENT_PENDING_REVIEW_STATUSES,
  HO_REVISED_QUEUE_STATUSES,
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

const POST_REVIEW_PERIOD_STATUSES: InvoicePeriodStatus[] = [
  InvoicePeriodStatus.AWAITING_PAYMENT,
  InvoicePeriodStatus.PENDING_VERIFICATION,
  InvoicePeriodStatus.PAID,
  InvoicePeriodStatus.OVERDUE,
];

type SearchParams = Promise<{ tab?: string }>;

export default async function ReconciliationPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireFinanceChild("reconciliation");
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  const params = await searchParams;

  // Vendor portal has its own Finance tree — keep them out.
  if (session.user.vendorId) {
    redirect("/billing/purchase-invoices");
  }

  const portalClientId = session.user.clientId ?? null;
  const isClient = Boolean(portalClientId);

  // Client portal: only their pending reviews. HO: Approved + Revised tabs.
  const tab = isClient
    ? "pending"
    : params.tab === "revised"
      ? "revised"
      : "approved";

  const companyId = session.user.companyId;
  const projectWhere = await getProjectWhereForUser({
    companyId,
    clientId: session.user.clientId,
    userId: session.user.id,
    username: session.user.username,
  });

  const periodInclude = {
    project: {
      select: {
        id: true,
        name: true,
        clientId: true,
        client: { select: { id: true, name: true } },
      },
    },
  } satisfies Prisma.ProjectInvoicePeriodInclude;

  const approvedWhere: Prisma.ProjectInvoicePeriodWhereInput = {
    project: { ...projectWhere },
    OR: [
      {
        status: InvoicePeriodStatus.AWAITING_CLIENT_REVIEW,
        clientReviewStatus: { in: [...CLIENT_PENDING_REVIEW_STATUSES] },
      },
      {
        clientReviewStatus: { in: [...APPROVED_REVIEW_STATUSES] },
        status: { in: POST_REVIEW_PERIOD_STATUSES },
      },
    ],
  };

  const revisedWhere: Prisma.ProjectInvoicePeriodWhereInput = {
    project: { ...projectWhere },
    status: InvoicePeriodStatus.AWAITING_CLIENT_REVIEW,
    clientReviewStatus: { in: [...HO_REVISED_QUEUE_STATUSES] },
  };

  const pendingClientWhere: Prisma.ProjectInvoicePeriodWhereInput = {
    project: { companyId, clientId: portalClientId! },
    status: InvoicePeriodStatus.AWAITING_CLIENT_REVIEW,
    clientReviewStatus: { in: [...CLIENT_PENDING_REVIEW_STATUSES] },
  };

  const [approvedRows, revisedRows, pendingClientRows] = await Promise.all([
    isClient
      ? Promise.resolve([])
      : prisma.projectInvoicePeriod.findMany({
          where: approvedWhere,
          include: periodInclude,
          orderBy: [{ reviewSentToClientAt: "desc" }, { updatedAt: "desc" }],
          take: 80,
        }),
    isClient
      ? Promise.resolve([])
      : prisma.projectInvoicePeriod.findMany({
          where: revisedWhere,
          include: periodInclude,
          orderBy: [{ clientReviewedAt: "desc" }, { updatedAt: "desc" }],
          take: 80,
        }),
    isClient
      ? prisma.projectInvoicePeriod.findMany({
          where: pendingClientWhere,
          include: periodInclude,
          orderBy: [{ reviewSentToClientAt: "desc" }],
          take: 50,
        })
      : Promise.resolve([]),
  ]);

  const rows = isClient
    ? pendingClientRows
    : tab === "revised"
      ? revisedRows
      : approvedRows;
  const nowMs = Date.now();

  return (
    <AppShell
      title={t("pages.reconciliation.title")}
      description={t("pages.reconciliation.description")}
    >
      <div className="space-y-6">
        {!isClient ? (
          <div className="flex flex-wrap gap-2">
            <Link
              href="/billing/reconciliation?tab=approved"
              className={cn(
                buttonVariants({
                  variant: tab === "approved" ? "default" : "outline",
                  size: "sm",
                })
              )}
            >
              {t("pages.reconciliation.tabApproved")} ({approvedRows.length})
            </Link>
            <Link
              href="/billing/reconciliation?tab=revised"
              className={cn(
                buttonVariants({
                  variant: tab === "revised" ? "default" : "outline",
                  size: "sm",
                })
              )}
            >
              {t("pages.reconciliation.tabRevised")} ({revisedRows.length})
            </Link>
          </div>
        ) : null}

        <SectionCard>
          <h2 className="text-lg font-semibold text-text">
            {isClient
              ? t("pages.reconciliation.clientPendingTitle")
              : tab === "revised"
                ? t("pages.reconciliation.tabRevised")
                : t("pages.reconciliation.tabApproved")}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {isClient
              ? t("pages.reconciliation.clientPendingHelp")
              : tab === "revised"
                ? t("pages.reconciliation.revisedHelp")
                : t("pages.reconciliation.approvedHelp")}
          </p>

          <div className="mt-5">
            {rows.length === 0 ? (
              <EmptyState
                title={t("pages.reconciliation.emptyTitle")}
                description={t("pages.reconciliation.emptyDescription")}
              />
            ) : (
              <ul className="space-y-4">
                {rows.map((period) => {
                  const amount =
                    decimalToNumber(period.revisedInvoiceAmount) ??
                    decimalToNumber(period.amount);
                  const billingHref = period.project.clientId
                    ? `/billing/${period.project.clientId}/${period.project.id}`
                    : "/billing";
                  const awaitingClient = isAwaitingClientAction(
                    period.clientReviewStatus
                  );
                  const isRevised =
                    period.clientReviewStatus === "CLIENT_REVISED";
                  const silentMs = 2 * 24 * 60 * 60 * 1000;
                  const sentAt = period.reviewSentToClientAt?.getTime() ?? 0;
                  const silentTwoDays =
                    !isClient &&
                    awaitingClient &&
                    sentAt > 0 &&
                    nowMs - sentAt >= silentMs;

                  return (
                    <li
                      key={period.id}
                      className={cn(
                        "rounded-2xl border bg-card p-4 shadow-[0_12px_28px_-20px_rgba(0,0,0,0.72)]",
                        awaitingClient
                          ? "border-warning/40 bg-card-tint-amber/30"
                          : "border-primary/30 bg-card-tint-emerald/25"
                      )}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-text">
                            {period.project.name}
                          </p>
                          <p className="text-sm text-muted">
                            {period.project.client?.name ?? "—"} ·{" "}
                            {period.label ?? t("pages.billing.columns.period")}
                          </p>
                          <p className="mt-1 text-xs text-subtle">
                            {localizeClientReviewKind(
                              period.clientReviewKind,
                              locale
                            )}{" "}
                            ·{" "}
                            {period.periodStart
                              ? formatDisplayDate(period.periodStart, {
                                  timeZone: "UTC",
                                })
                              : "—"}{" "}
                            –{" "}
                            {period.periodEnd
                              ? formatDisplayDate(period.periodEnd, {
                                  timeZone: "UTC",
                                })
                              : "—"}
                            {amount != null
                              ? ` · ${formatContractPrice(amount)}`
                              : ""}
                          </p>
                          {silentTwoDays ? (
                            <p className="mt-2 text-xs font-medium text-amber-200">
                              {t("pages.reconciliation.silentTwoDaysBadge")}
                              <span className="mt-0.5 block font-normal text-subtle">
                                {t("pages.reconciliation.silentTwoDaysHelp")}
                              </span>
                            </p>
                          ) : null}
                        </div>
                        <div className="flex justify-start sm:justify-center sm:px-3">
                          <StatusBadge
                            status={
                              isRevised
                                ? "warning"
                                : awaitingClient
                                  ? "pending"
                                  : "active"
                            }
                            compact
                            lines={
                              localizeClientReviewChipLines(
                                period.clientReviewStatus,
                                locale
                              ) ?? undefined
                            }
                          >
                            {localizeClientReviewStatus(
                              period.clientReviewStatus,
                              locale
                            )}
                          </StatusBadge>
                        </div>
                        <div className="flex min-w-[9.75rem] flex-col items-stretch gap-2 sm:items-end">
                          <Link
                            href={billingHref}
                            className={cn(
                              buttonVariants({
                                variant: "default",
                                size: "sm",
                              }),
                              "w-full justify-center sm:w-[9.75rem]"
                            )}
                          >
                            {t("pages.reconciliation.openBilling")}
                          </Link>
                          {period.reviewReportPdfPath ? (
                            <a
                              href={period.reviewReportPdfPath}
                              target="_blank"
                              rel="noreferrer"
                              className={cn(
                                buttonVariants({
                                  variant: "info",
                                  size: "sm",
                                }),
                                "w-full justify-center sm:w-[9.75rem]"
                              )}
                            >
                              {t("pages.reconciliation.viewReport")}
                            </a>
                          ) : null}
                        </div>
                      </div>

                      {isClient && awaitingClient ? (
                        <div className="mt-4">
                          <ClientBillingReviewActions
                            periodId={period.id}
                            reviewReportPdfPath={period.reviewReportPdfPath}
                            hoReviewNote={period.hoReviewNote}
                            hoReviewProofPath={period.hoReviewProofPath}
                            showHoRejection={
                              period.clientReviewStatus ===
                              "HO_REJECTED_REVISION"
                            }
                          />
                        </div>
                      ) : null}

                      {!isClient && isRevised ? (
                        <div className="mt-4">
                          <HoRevisionReviewPanel
                            periodId={period.id}
                            clientRevisionNote={period.clientRevisionNote}
                            clientRevisionProofPath={
                              period.clientRevisionProofPath
                            }
                            suggestedAmount={amount}
                          />
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
