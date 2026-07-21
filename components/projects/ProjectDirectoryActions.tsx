"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import type { BillingMode, ProjectSubCategory } from "@prisma/client";

import ReconcilePeriodDialog from "@/components/billing/ReconcilePeriodDialog";
import DirectoryCardActions from "@/components/ui/DirectoryCardActions";
import { Button, buttonVariants } from "@/components/ui/button";
import { ACTIONS_SINGLE_CHIP_COLUMN_WIDTH } from "@/components/ui/trash-action-buttons";
import { isContractSubCategory } from "@/lib/project-contract";
import { useProjectLifecycleActions } from "@/components/projects/ProjectFinishButton";
import ProjectStartButton, {
  ProjectReturnToPlanningBlockedChip,
  ProjectReturnToPlanningButton,
} from "@/components/projects/ProjectStartButton";
import type { ProjectStaffEmployee } from "@/components/projects/ProjectStaffPicker";
import ProjectMarkPaidButton from "@/components/projects/ProjectMarkPaidButton";

/** Due cycle target for directory Reconcile (Keep / Adjust + OM+). */
export type DirectoryReconcileTarget = {
  periodId: string;
  periodLabel: string;
  suggestedAmount: number | null;
};

type InvoicePeriodForActions = {
  id: string;
  label?: string | null;
  milestonePercent?: number | null;
  invoicePdfPath?: string | null;
  reconciledAt?: string | Date | null;
};

type ProjectForActions = {
  id: string;
  name: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  locationRadiusMeters: number | null;
  estimatedStartDate?: Date | null;
  estimatedDurationDays?: number | null;
  startDate: Date | null;
  endDate: Date | null;
  progress: number;
  status: string;
  subCategory: ProjectSubCategory;
  billingMode?: BillingMode;
  clientId: string | null;
  assignments: { employeeId: string }[];
  client?: { name: string } | null;
  invoicePeriods: InvoicePeriodForActions[];
  _count: { progressReports: number };
};

type PaymentStage = {
  kind: "awaiting_payment" | "awaiting_invoice" | string;
  unpaidPeriodId?: string | null;
} | null;

type FilterView =
  | "planning"
  | "in-progress"
  | "payment-due"
  | "completed"
  | undefined;

/** Primary billing chip for Regular Cleaning In Progress. */
export type RegularBillingAction = "reconcile" | null;

type Props = {
  project: ProjectForActions;
  filterView: FilterView;
  canManage: boolean;
  canStart: boolean;
  canMoveToPlanning: boolean;
  /** True when Back to Planning is blocked due to open invoice collection. */
  moveBackBlockedByCollection?: boolean;
  canFinish: boolean;
  canMarkPaid: boolean;
  paymentStage: PaymentStage;
  billingHref: string | null;
  /** Title shown in confirm dialogs (may include milestone suffix). */
  displayName?: string;
  /** Regular Cleaning only: Reconcile → Submit invoice stage. */
  regularBillingAction?: RegularBillingAction;
  /** When reconcile chip is shown — opens Keep/Adjust dialog (not Keep-only). */
  reconcileTarget?: DirectoryReconcileTarget | null;
  /** Active staff for Move to In Progress assignment picker. */
  employees?: ProjectStaffEmployee[];
};

/** Stack dual workflow chips vertically — equal chip boxes, no overlap. */
const workflowChipStackClassName =
  "flex w-full max-w-full min-w-0 flex-col items-center justify-center gap-2";

/**
 * Actions column floor — chips stack vertically (single chip width), not
 * side-by-side, so narrow viewports stay aligned without horizontal spill.
 */
export const PROJECT_ACTIONS_COLUMN_WIDTH = ACTIONS_SINGLE_CHIP_COLUMN_WIDTH;

function returnToPlanningChip(opts: {
  canMoveToPlanning: boolean;
  moveBackBlockedByCollection: boolean;
  projectId: string;
  projectName: string;
}): ReactNode {
  if (opts.canMoveToPlanning) {
    return (
      <ProjectReturnToPlanningButton
        projectId={opts.projectId}
        projectName={opts.projectName}
        size="badge"
      />
    );
  }
  if (opts.moveBackBlockedByCollection) {
    return <ProjectReturnToPlanningBlockedChip size="badge" />;
  }
  return null;
}

export default function ProjectDirectoryActions({
  project,
  filterView,
  canManage,
  canStart,
  canMoveToPlanning,
  moveBackBlockedByCollection = false,
  canFinish,
  canMarkPaid,
  paymentStage,
  billingHref,
  displayName,
  regularBillingAction = null,
  reconcileTarget = null,
  employees = [],
}: Props) {
  const confirmName = displayName ?? project.name;
  const isRegularContract = isContractSubCategory(project.subCategory);
  const { pending, endOrFinish } = useProjectLifecycleActions({
    projectId: project.id,
    projectName: confirmName,
    isRegularContract,
  });

  const showAwaitingInvoiceLink =
    canManage &&
    filterView === "payment-due" &&
    paymentStage?.kind === "awaiting_invoice" &&
    Boolean(billingHref);

  // Edit / Delete / invoice downloads live on the detail page (row click).
  if (filterView === "completed" || !canManage) {
    return null;
  }

  const planningChip = returnToPlanningChip({
    canMoveToPlanning,
    moveBackBlockedByCollection,
    projectId: project.id,
    projectName: confirmName,
  });

  let workflowPrimary: ReactNode = null;

  if (canStart) {
    workflowPrimary = (
      <ProjectStartButton
        projectId={project.id}
        projectName={confirmName}
        subCategory={project.subCategory}
        estimatedStartDate={project.estimatedStartDate}
        estimatedDurationDays={project.estimatedDurationDays}
        startDate={project.startDate}
        endDate={project.endDate}
        employees={employees}
        assignedEmployeeIds={project.assignments.map(
          (assignment) => assignment.employeeId
        )}
        size="badge"
      />
    );
  } else if (canFinish && isRegularContract) {
    // End Contract lives on the project detail page only.
    // After reconcile, invoice waits on client Approve (Finance → Reconciliation).
    const billingChip =
      regularBillingAction === "reconcile" && reconcileTarget ? (
        <ReconcilePeriodDialog
          periodId={reconcileTarget.periodId}
          periodLabel={reconcileTarget.periodLabel}
          suggestedAmount={reconcileTarget.suggestedAmount}
          disabled={pending}
        />
      ) : null;

    if (billingChip || planningChip) {
      workflowPrimary = (
        <span className={workflowChipStackClassName}>
          {planningChip}
          {billingChip}
        </span>
      );
    }
  } else if (canFinish) {
    workflowPrimary = (
      <span className={workflowChipStackClassName}>
        {planningChip}
        <Button
          variant="successBadge"
          size="badge"
          disabled={pending}
          onClick={endOrFinish}
        >
          {pending ? "Finishing…" : "Finish"}
        </Button>
      </span>
    );
  } else if (planningChip) {
    workflowPrimary = planningChip;
  } else if (canMarkPaid && paymentStage?.unpaidPeriodId) {
    workflowPrimary = (
      <ProjectMarkPaidButton
        periodId={paymentStage.unpaidPeriodId}
        projectName={confirmName}
        movesToHistoryWhenFullyPaid={project.status === "COMPLETED"}
        mode={
          paymentStage.kind === "verifying" ? "verify" : "receive"
        }
        size="badge"
      />
    );
  } else if (showAwaitingInvoiceLink && billingHref) {
    workflowPrimary = (
      <Link
        href={billingHref}
        className={buttonVariants({ variant: "warningBadge", size: "badge" })}
      >
        Billing
      </Link>
    );
  }

  if (!workflowPrimary) {
    return null;
  }

  return (
    <div className="mx-auto flex w-full max-w-full min-w-0 flex-col items-center justify-center gap-2 pt-0.5 pb-1.5">
      <DirectoryCardActions
        primary={workflowPrimary}
        className="w-full max-w-full min-w-0 flex-col flex-wrap whitespace-normal"
      />
    </div>
  );
}
