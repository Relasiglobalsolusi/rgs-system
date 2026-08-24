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
import type { ProjectTeamOption } from "@/components/projects/ProjectTeamPicker";
import DataTable, {
  type DataTableColumn,
} from "@/components/ui/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import { STATUS_COLUMN_WIDTH } from "@/components/ui/trash-action-buttons";
import { formatDisplayDate } from "@/lib/format-date";
import {
  localizeBillingChipLines,
  localizeSubCategory,
  localizeSubCategoryChipLines,
  localizeWorkflowChipLines,
  localizeWorkflowStatus,
} from "@/lib/i18n/labels";
import type { AppLocale } from "@/lib/i18n/locale";
import { useT } from "@/lib/i18n/use-t";
import { isInternalProjectSubCategory } from "@/lib/project-subcategory";
import {
  isDirectoryPeriodRow,
  type ProjectDirectoryRowKind,
} from "@/lib/project-directory-rows";
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
  | "pending-approval"
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
  areaCatalogId?: string | null;
  areaCatalog?: {
    id: string;
    nameEn: string;
    nameId: string;
    systemArea: string;
  } | null;
  subcategoryCatalog?: {
    id: string;
    nameEn: string;
    nameId: string;
    isSystem: boolean;
    billingKind: "CONTRACT" | "ONE_TIME";
  } | null;
  billingMode?: BillingMode;
  requiresTaxInvoice?: boolean;
  clientId: string | null;
  assignments: { employeeId: string }[];
  operationsTeamLinks?: { teamId: string }[];
  client?: { name: string } | null;
  invoicePeriods: ProjectTablePeriod[];
  _count: { assignments: number; progressReports: number };
};

export type ProjectTableRow = {
  key: string;
  project: ProjectTableProject;
  rowKind: ProjectDirectoryRowKind;
  displayTitle: string;
  /** Period dates for Pending Approval / Payment Due queues (line 2). */
  periodLine: string | null;
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
  /** G3: non-regular In Progress project can be submitted for client approval. */
  canSubmitForApproval: boolean;
  canMoveToPlanning: boolean;
  /** True when Back to Planning is hidden solely due to open invoice collection. */
  moveBackBlockedByCollection: boolean;
  canMarkPaid: boolean;
  billingHref: string | null;
  detailHref: string;
  /** Catalog or localized type name (keeps Regular / General / Internal truthful). */
  typeLabel?: string;
};

function chipLinesFromLabel(
  label: string | null | undefined
): readonly [string, string] | null {
  const parts = label?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length < 2) return null;
  return [parts[0], parts.slice(1).join(" ")];
}

type Props = {
  rows: ProjectTableRow[];
  filterView: ProjectTableFilterView;
  canManage: boolean;
  /** Finance module — show Open Billing on Payment Due even without project manage. */
  canOpenBilling?: boolean;
  emptyMessage?: string;
  /** Active staff for Move to In Progress assignment picker. */
  employees?: ProjectStaffEmployee[];
  teams?: ProjectTeamOption[];
};

function isPaymentDueRow(row: ProjectTableRow): boolean {
  return row.rowKind === "payment-due";
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
  canOpenBilling = false,
  emptyMessage,
  employees = [],
  teams = [],
}: Props) {
  const { t, locale } = useT();
  const resolvedEmptyMessage = emptyMessage ?? t("pages.projects.emptyShow");
  const router = useRouter();
  const [, startTransition] = useTransition();

  /** Internal section has no directory workflow chips — hide empty Actions. */
  const isInternalTable =
    rows.length > 0 &&
    rows.every((row) =>
      isInternalProjectSubCategory(row.project.subCategory)
    );
  /**
   * Workflow chips only — Edit / Delete / downloads are on the detail page.
   * Completed has no directory workflow chips.
   * Internal: no Finish / Approval / Back to Planning — omit the column.
   * Payment Due: also show actions column when Finance can open billing.
   */
  const showActions =
    !isInternalTable &&
    filterView !== "completed" &&
    (canManage || (filterView === "payment-due" && canOpenBilling));
  /** Payment Due: due date sits between Status and Actions. */
  const showPaymentDueColumn = filterView === "payment-due";
  /** Completed Projects: when payment was received (latest period paidAt). */
  const showPaidColumn = filterView === "completed";
  /** Period queues expand one project into multiple rows — skip DnD there. */
  const reorderable =
    canManage &&
    filterView !== "payment-due" &&
    filterView !== "pending-approval" &&
    !rows.some((row) => isDirectoryPeriodRow(row.rowKind));

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
    // Internal: four equal columns (~25% of free width after reorder gutter).
    const internalEqual = isInternalTable
      ? ({ width: "25%", share: 1, className: "min-w-0" } as const)
      : null;

    const cols: DataTableColumn<ProjectTableRow>[] = [
      {
        key: "project",
        title: t("pages.projects.columns.project"),
        width: internalEqual?.width ?? "16rem",
        share: internalEqual?.share ?? 2.25,
        className: internalEqual?.className ?? "min-w-[16rem]",
        render: (row) => {
          const isInternal = isInternalProjectSubCategory(
            row.project.subCategory
          );
          const isPeriodRow = isDirectoryPeriodRow(row.rowKind);
          if (isInternal && !isPeriodRow) {
            return (
              <div className="min-w-0 text-left">
                <p className="font-semibold text-text">{row.displayTitle}</p>
              </div>
            );
          }
          if (isPeriodRow) {
            const address =
              row.location?.trim() || t("pages.projects.noLocation");
            return (
              <div className="min-w-0 text-left">
                <p className="font-semibold text-text">{row.displayTitle}</p>
                {row.periodLine ? (
                  <p className="mt-0.5 text-sm text-muted">{row.periodLine}</p>
                ) : null}
                <p className="mt-0.5 max-w-md truncate text-sm text-subtle">
                  {address}
                </p>
                <p className="mt-1 text-xs font-medium text-accent-teal">
                  {t("pages.projects.periodPage.openHint")}
                </p>
              </div>
            );
          }
          const locationDistinct =
            row.location?.trim() &&
            row.location.trim().toLowerCase() !==
              row.displayTitle.trim().toLowerCase()
              ? row.location.trim()
              : null;
          const subtitle = [locationDistinct, row.clientName]
            .filter(Boolean)
            .join(" · ");
          return (
            <div className="min-w-0 text-left">
              <p className="font-semibold text-text">{row.displayTitle}</p>
              <p className="mt-0.5 max-w-md truncate text-sm text-subtle">
                {subtitle || t("pages.projects.noLocation")}
              </p>
            </div>
          );
        },
      },
      {
        key: "timeline",
        title: t("pages.projects.timeline"),
        width: isInternalTable ? "10rem" : internalEqual?.width ?? "11rem",
        share: isInternalTable ? 0 : internalEqual?.share ?? 1,
        className: isInternalTable
          ? "min-w-[10rem] overflow-visible whitespace-nowrap"
          : internalEqual?.className ?? "min-w-[11rem]",
        render: (row) => {
          const showOpsCounts =
            !isPlanningProjectStatus(row.project.status) &&
            !isDirectoryPeriodRow(row.rowKind);
          return (
            <div className="text-left">
              <p className="whitespace-nowrap text-muted">{row.timeline}</p>
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
        share: isInternalTable ? 0 : 1,
        cellAlign: "center",
        className: "min-w-[10rem] overflow-visible whitespace-nowrap",
        render: (row) => {
          const typeLines =
            localizeSubCategoryChipLines(row.project.subCategory, locale) ??
            chipLinesFromLabel(row.typeLabel);
          return (
            <StatusBadge
              status="success"
              compact
              lines={typeLines ?? undefined}
              className="!w-[7.5rem] !min-w-[7.5rem] !max-w-[7.5rem]"
            >
              {typeLines
                ? undefined
                : (row.typeLabel ??
                  localizeSubCategory(row.project.subCategory, locale))}
            </StatusBadge>
          );
        },
      },
      {
        key: "status",
        title: t("pages.projects.columns.status"),
        width: STATUS_COLUMN_WIDTH,
        share: isInternalTable ? 0 : 1,
        cellAlign: "center",
        className: "min-w-[10rem] overflow-visible whitespace-nowrap",
        render: (row) => {
          const paymentDue = isPaymentDueRow(row);
          const englishLabel = getProjectWorkflowStatusLabel({
            status:
              row.rowKind === "in-progress" ? "IN_PROGRESS" : row.project.status,
            paymentDue,
            pendingApproval: row.rowKind === "pending-approval",
          });
          const label = localizeWorkflowStatus(
            {
              status:
                row.rowKind === "in-progress"
                  ? "IN_PROGRESS"
                  : row.project.status,
              paymentDue,
              pendingApproval: row.rowKind === "pending-approval",
            },
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
        cellAlign: "center",
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
        cellAlign: "center",
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
        cellAlign: "center",
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
              canOpenBilling={canOpenBilling}
              canStart={row.canStart}
              canMoveToPlanning={row.canMoveToPlanning}
              moveBackBlockedByCollection={row.moveBackBlockedByCollection}
              canFinish={row.canFinish}
              canSubmitForApproval={row.canSubmitForApproval}
              canMarkPaid={row.canMarkPaid}
              paymentStage={row.paymentStage}
              billingHref={row.billingHref}
              displayName={row.displayTitle}
              regularBillingAction={row.regularBillingAction ?? null}
              reconcileTarget={row.reconcileTarget ?? null}
              employees={employees}
              teams={teams}
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
    isInternalTable,
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
