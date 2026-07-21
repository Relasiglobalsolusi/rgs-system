"use client";

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BillingMode, ProjectSubCategory } from "@prisma/client";
import { toast } from "sonner";

import { reorderProjects } from "@/app/projects/actions";
import CompletedProjectPeriods from "@/components/projects/CompletedProjectPeriods";
import ProjectDirectoryActions, {
  PROJECT_ACTIONS_COLUMN_WIDTH,
  type DirectoryReconcileTarget,
} from "@/components/projects/ProjectDirectoryActions";
import type { ProjectStaffEmployee } from "@/components/projects/ProjectStaffPicker";
import DataTable, {
  type DataTableColumn,
} from "@/components/ui/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import { STATUS_COLUMN_WIDTH } from "@/components/ui/trash-action-buttons";
import { formatDisplayDate } from "@/lib/format-date";
import {
  localizeBillingChipLines,
  localizeSubCategory,
  localizeWorkflowChipLines,
  localizeWorkflowStatus,
} from "@/lib/i18n/labels";
import type { AppLocale } from "@/lib/i18n/locale";
import { useT } from "@/lib/i18n/use-t";
import {
  getProjectWorkflowStatusLabel,
  isPlanningProjectStatus,
  projectWorkflowStatusBadge,
} from "@/lib/project-status";

export type ProjectTablePaymentStage = {
  kind: "awaiting_payment" | "awaiting_invoice" | string;
  unpaidPeriodId?: string | null;
  dueAt?: Date | null;
  isLate?: boolean;
  daysOverdue?: number | null;
} | null;

export type ProjectTableFilterView =
  | "planning"
  | "in-progress"
  | "payment-due"
  | "completed"
  | undefined;

export type ProjectTablePeriod = {
  id: string;
  status: string;
  dueAt: Date | string | null;
  submittedAt?: Date | string | null;
  /** When this period was marked PAID (payment received / verified). */
  paidAt?: Date | string | null;
  periodStart?: Date | string | null;
  periodEnd?: Date | string | null;
  label?: string | null;
  milestonePercent?: number | null;
  invoicePdfPath?: string | null;
  reconciledAt?: Date | string | null;
  amount?: number | string | { toString(): string } | null;
  taxInvoiceRequired?: boolean;
  taxInvoiceDoneAt?: Date | string | null;
  taxInvoiceDocumentPath?: string | null;
};

export type ProjectTableProject = {
  id: string;
  name: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  locationRadiusMeters: number | null;
  estimatedStartDate?: Date | null;
  startDate: Date | null;
  endDate: Date | null;
  progress: number;
  status: string;
  subCategory: ProjectSubCategory;
  billingMode?: BillingMode;
  requiresTaxInvoice?: boolean;
  clientId: string | null;
  assignments: { employeeId: string }[];
  client?: { name: string } | null;
  invoicePeriods: ProjectTablePeriod[];
  _count: { assignments: number; progressReports: number };
};

export type ProjectTableRow = {
  key: string;
  project: ProjectTableProject;
  displayTitle: string;
  timeline: string;
  location: string | null;
  clientName: string | null;
  dueLabel: string | null;
  stageLabel: string | null;
  paymentStage: ProjectTablePaymentStage;
  invoiceCycleDue: boolean;
  /** Regular Cleaning In Progress: open Keep/Adjust reconcile dialog. */
  regularBillingAction?: "reconcile" | null;
  /** Due cycle for directory Reconcile Keep/Adjust dialog. */
  reconcileTarget?: DirectoryReconcileTarget | null;
  canStart: boolean;
  canFinish: boolean;
  canMoveToPlanning: boolean;
  /** True when Back to Planning is hidden solely due to open invoice collection. */
  moveBackBlockedByCollection: boolean;
  canMarkPaid: boolean;
  billingHref: string | null;
  detailHref: string;
};

type Props = {
  rows: ProjectTableRow[];
  filterView: ProjectTableFilterView;
  canManage: boolean;
  emptyMessage?: string;
  /** Active staff for Move to In Progress assignment picker. */
  employees?: ProjectStaffEmployee[];
};

function isPaymentDueRow(
  row: ProjectTableRow,
  filterView: ProjectTableFilterView
): boolean {
  if (filterView === "payment-due") return true;
  if (row.paymentStage) return true;
  if (row.invoiceCycleDue) return true;
  return false;
}

/**
 * Meta chip under / beside the Payment Due workflow badge.
 * Long labels use `lines` so typography matches the stacked PEMBAYARAN chip
 * (stackedChipLabelClassName), not single-line text-sm children.
 */
function paymentDueMetaContent(
  row: ProjectTableRow,
  t: (key: string, params?: Record<string, string | number>) => string,
  locale: AppLocale
): {
  status: "info" | "warning";
  lines?: readonly [string, string];
  text?: string;
} | null {
  if (!row.paymentStage) {
    if (row.invoiceCycleDue) {
      return {
        status: "warning",
        lines: localizeBillingChipLines("invoiceDue", locale),
      };
    }
    if (row.stageLabel) {
      return { status: "warning", text: row.stageLabel };
    }
    return null;
  }

  if (row.paymentStage.isLate) {
    const overdue =
      row.paymentStage.daysOverdue != null
        ? ` · ${row.paymentStage.daysOverdue}d`
        : "";
    // Keep "Late · 3d" as one line when days are present; otherwise stack.
    if (overdue) {
      return {
        status: "warning",
        text: `${t("pages.projects.late")}${overdue}`,
      };
    }
    return {
      status: "warning",
      lines: localizeBillingChipLines("latePayment", locale),
    };
  }

  if (row.paymentStage.kind === "awaiting_invoice") {
    return {
      status: "info",
      lines: localizeBillingChipLines("awaitingInvoice", locale),
    };
  }

  if (row.paymentStage.kind === "verifying") {
    return {
      status: "warning",
      lines: localizeBillingChipLines("verifyingPayment", locale),
    };
  }

  if (row.paymentStage.dueAt != null) {
    return {
      status: "warning",
      text: formatDisplayDate(row.paymentStage.dueAt, { timeZone: "UTC" }),
    };
  }

  return {
    status: "warning",
    lines: localizeBillingChipLines("awaitingPayment", locale),
  };
}

function PaymentDueMetaChip({
  row,
  className,
  t,
  locale,
}: {
  row: ProjectTableRow;
  className?: string;
  t: (key: string, params?: Record<string, string | number>) => string;
  locale: AppLocale;
}) {
  const meta = paymentDueMetaContent(row, t, locale);
  if (!meta) return null;

  // Prefer stacked lines (same metrics as PEMBAYARAN); text only for dates / late+days.
  if (meta.lines) {
    return (
      <StatusBadge
        status={meta.status}
        compact
        className={className}
        lines={meta.lines}
      />
    );
  }

  return (
    <StatusBadge status={meta.status} compact className={className}>
      {meta.text}
    </StatusBadge>
  );
}

/**
 * Latest payment received across invoice periods.
 * For multi-period (milestone / monthly) projects this is the final collection date.
 */
function latestPaidAt(
  periods: ProjectTablePeriod[]
): Date | string | null {
  let latestMs = Number.NEGATIVE_INFINITY;
  let latest: Date | string | null = null;
  for (const period of periods) {
    if (period.paidAt == null) continue;
    const ms =
      period.paidAt instanceof Date
        ? period.paidAt.getTime()
        : new Date(period.paidAt).getTime();
    if (Number.isNaN(ms) || ms < latestMs) continue;
    latestMs = ms;
    latest = period.paidAt;
  }
  return latest;
}

function PaidDateChip({ value }: { value: Date | string | null }) {
  if (value == null) {
    return <span className="text-subtle">—</span>;
  }

  return (
    <StatusBadge status="success" compact>
      {formatDisplayDate(value)}
    </StatusBadge>
  );
}

export default function ProjectTable({
  rows,
  filterView,
  canManage,
  emptyMessage,
  employees = [],
}: Props) {
  const { t, locale } = useT();
  const resolvedEmptyMessage = emptyMessage ?? t("pages.projects.emptyShow");
  const router = useRouter();
  const [, startTransition] = useTransition();

  /**
   * Workflow chips only — Edit / Delete / downloads are on the detail page.
   * Completed has no directory workflow chips.
   */
  const showActions = canManage && filterView !== "completed";
  /** Payment Due: due date sits between Status and Actions. */
  const showPaymentDueColumn = filterView === "payment-due";
  /** Completed Projects: when payment was received (latest period paidAt). */
  const showPaidColumn = filterView === "completed";
  /** Payment-due expands one project into multiple period rows — skip DnD there. */
  const reorderable = canManage && filterView !== "payment-due";

  function handleReorder(orderedIds: string[]) {
    if (!reorderable) return;
    startTransition(async () => {
      try {
        await reorderProjects(orderedIds);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t("pages.projects.reorderFailed")
        );
        router.refresh();
      }
    });
  }

  const columns = useMemo(() => {
    const cols: DataTableColumn<ProjectTableRow>[] = [
      {
        key: "project",
        title: t("pages.projects.columns.project"),
        width: "16rem",
        share: 2.25,
        className: "min-w-[16rem]",
        render: (row) => (
          <div className="min-w-0 text-left">
            <p className="font-semibold text-text">{row.displayTitle}</p>
            <p className="mt-0.5 max-w-md truncate text-sm text-subtle">
              {[row.location, row.clientName].filter(Boolean).join(" · ") ||
                t("pages.projects.noLocation")}
            </p>
          </div>
        ),
      },
      {
        key: "timeline",
        title: t("pages.projects.timeline"),
        width: "11rem",
        share: 1,
        className: "min-w-[11rem]",
        render: (row) => {
          // Planning: no progress reports / staff assignment yet — hide counts.
          const showOpsCounts = !isPlanningProjectStatus(row.project.status);
          return (
            <div className="min-w-0 text-left">
              <p className="text-muted">{row.timeline}</p>
              {showOpsCounts ? (
                canManage ? (
                  <p className="mt-0.5 text-sm text-subtle">
                    {row.project._count.assignments}{" "}
                    {t("pages.projects.assigned")} ·{" "}
                    {row.project._count.progressReports}{" "}
                    {row.project._count.progressReports === 1
                      ? t("pages.projects.reportOne")
                      : t("pages.projects.reportOther")}
                  </p>
                ) : (
                  <p className="mt-0.5 text-sm text-subtle">
                    {row.project._count.progressReports}{" "}
                    {row.project._count.progressReports === 1
                      ? t("pages.projects.reportOne")
                      : t("pages.projects.reportOther")}
                  </p>
                )
              ) : null}
            </div>
          );
        },
      },
      {
        key: "cleaningType",
        title: t("pages.projects.cleaningType"),
        width: STATUS_COLUMN_WIDTH,
        share: 1,
        align: "center",
        className: "min-w-[10rem] overflow-visible whitespace-nowrap",
        render: (row) => (
          <StatusBadge status="success" compact>
            {localizeSubCategory(row.project.subCategory, locale)}
          </StatusBadge>
        ),
      },
      {
        key: "status",
        title: t("pages.projects.columns.status"),
        width: STATUS_COLUMN_WIDTH,
        share: 1,
        align: "center",
        className: "min-w-[10rem] overflow-visible whitespace-nowrap",
        render: (row) => {
          const paymentDue = isPaymentDueRow(row, filterView);
          const englishLabel = getProjectWorkflowStatusLabel({
            status: row.project.status,
            paymentDue,
          });
          const label = localizeWorkflowStatus(
            { status: row.project.status, paymentDue },
            locale
          );
          const lines = localizeWorkflowChipLines(englishLabel, locale);
          /** On Payment Due view the date lives in its own middle column. */
          const showMetaUnderStatus =
            paymentDue &&
            !showPaymentDueColumn &&
            paymentDueMetaContent(row, t, locale) != null;

          return (
            <div className="inline-flex shrink-0 flex-col items-center gap-1">
              <StatusBadge
                status={projectWorkflowStatusBadge(englishLabel)}
                compact
                lines={lines ?? undefined}
              >
                {lines ? undefined : label}
              </StatusBadge>
              {showMetaUnderStatus ? (
                <PaymentDueMetaChip row={row} t={t} locale={locale} />
              ) : null}
            </div>
          );
        },
      },
    ];

    if (showPaymentDueColumn) {
      cols.push({
        key: "due",
        title: t("pages.projects.due"),
        width: "10rem",
        share: 1,
        align: "center",
        className: "min-w-[9rem] overflow-visible whitespace-nowrap",
        render: (row) => (
          <div className="flex w-full items-center justify-center">
            <PaymentDueMetaChip row={row} t={t} locale={locale} />
          </div>
        ),
      });
    }

    if (showPaidColumn) {
      cols.push({
        key: "paid",
        title: t("pages.projects.paid"),
        width: "10rem",
        share: 1,
        align: "center",
        className: "min-w-[9rem] overflow-visible whitespace-nowrap",
        render: (row) => (
          <div className="flex w-full items-center justify-center">
            <PaidDateChip value={latestPaidAt(row.project.invoicePeriods)} />
          </div>
        ),
      });
      cols.push({
        key: "periods",
        title: t("pages.reconciliation.completedPeriodsTitle"),
        width: "18rem",
        share: 2,
        className: "min-w-[14rem]",
        render: (row) => {
          const clientHasNpwp = Boolean(
            (row.project.client as { npwp?: string | null } | null | undefined)
              ?.npwp?.trim()
          );
          const issued = row.project.invoicePeriods.filter((p) =>
            [
              "AWAITING_PAYMENT",
              "PENDING_VERIFICATION",
              "PAID",
              "OVERDUE",
            ].includes(p.status)
          );
          return (
            <div
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <CompletedProjectPeriods
                periods={issued.map((p) => ({
                  id: p.id,
                  label: p.label ?? null,
                  periodStart: p.periodStart ?? "",
                  periodEnd: p.periodEnd ?? "",
                  status: p.status,
                  amount: p.amount ?? null,
                  invoicePdfPath: p.invoicePdfPath ?? null,
                  submittedAt: p.submittedAt ?? null,
                  taxInvoiceRequired: Boolean(p.taxInvoiceRequired),
                  taxInvoiceDoneAt: p.taxInvoiceDoneAt ?? null,
                  taxInvoiceDocumentPath: p.taxInvoiceDocumentPath ?? null,
                  clientHasNpwp,
                }))}
              />
            </div>
          );
        },
      });
    }

    if (showActions) {
      cols.push({
        key: "actions",
        title: t("common.labels.actions"),
        width: PROJECT_ACTIONS_COLUMN_WIDTH,
        share: 1,
        align: "center",
        className: "min-w-0 max-w-full overflow-hidden",
        render: (row) => (
          <div
            className="flex w-full min-w-0 max-w-full flex-col items-center justify-center"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <ProjectDirectoryActions
              project={row.project}
              filterView={filterView}
              canManage={canManage}
              canStart={row.canStart}
              canMoveToPlanning={row.canMoveToPlanning}
              moveBackBlockedByCollection={row.moveBackBlockedByCollection}
              canFinish={row.canFinish}
              canMarkPaid={row.canMarkPaid}
              paymentStage={row.paymentStage}
              billingHref={row.billingHref}
              displayName={row.displayTitle}
              regularBillingAction={row.regularBillingAction ?? null}
              reconcileTarget={row.reconcileTarget ?? null}
              employees={employees}
            />
          </div>
        ),
      });
    }

    return cols;
  }, [
    canManage,
    employees,
    filterView,
    locale,
    showActions,
    showPaidColumn,
    showPaymentDueColumn,
    t,
  ]);

  if (rows.length === 0) {
    return null;
  }

  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowKey={(row) => (reorderable ? row.project.id : row.key)}
      onRowClick={(row) => router.push(row.detailHref)}
      reorderable={reorderable}
      onReorder={reorderable ? handleReorder : undefined}
      emptyMessage={resolvedEmptyMessage}
    />
  );
}
