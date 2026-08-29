"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import type {
  BillingMode,
  BillingPeriodBasis,
  ProjectStatus,
} from "@prisma/client";
import type { CommercialTaxKind } from "@/lib/commercial-tax";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  largeStackedChipLabelClassName,
  StackedChipLabel,
} from "@/components/ui/StatusBadge";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/use-t";
import type { ProjectSubCategory } from "@/lib/project-subcategory";
import type { ProjectServiceAreaValue } from "@/lib/service-area";
import type { ProjectShiftWindow } from "@/lib/project-shifts";
import type { ProjectStaffEmployee } from "@/components/projects/ProjectStaffPicker";
import { detailActionBarButtonClassName } from "@/components/projects/detail-action-bar";
import ProjectEditDialog from "@/components/projects/ProjectEditDialog";
import ProjectDeleteDialog from "@/components/projects/ProjectDeleteDialog";
import ProjectExtendContractButton from "@/components/projects/ProjectExtendContractButton";
import ProjectFinishButton from "@/components/projects/ProjectFinishButton";
import ProjectRedoJobButton from "@/components/projects/ProjectRedoJobButton";
import ProjectRenewContractButton from "@/components/projects/ProjectRenewContractButton";
import type { ProjectTeamOption } from "@/components/projects/ProjectTeamPicker";
import type { CompanyBankAccountOption } from "@/lib/company-bank-accounts";
import type { ProjectCatalogAreaDTO } from "@/lib/project-service-catalog";
import {
  isExtendableContractSubCategory,
  isRedoJobSubCategory,
} from "@/lib/project-contract";
import ProjectStartButton, {
  ProjectReturnToPlanningBlockedChip,
  ProjectReturnToPlanningButton,
} from "@/components/projects/ProjectStartButton";
import ProjectSubmitForApprovalButton from "@/components/projects/ProjectSubmitForApprovalButton";

type ClientOption = {
  id: string;
  name: string;
  npwp: string | null;
  paymentTermsDays?: number | null;
};

type EditProject = {
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
  subCategory: ProjectSubCategory;
  serviceArea?: ProjectServiceAreaValue | "OTHER";
  areaCatalogId?: string | null;
  subcategoryCatalogId?: string | null;
  billingMode: BillingMode;
  billingPeriodBasis?: BillingPeriodBasis | null;
  billingCycleStartDay?: number | null;
  billingCycleEndDay?: number | null;
  requiresTaxInvoice: boolean;
  chargedTaxKind?: CommercialTaxKind | null;
  isGovernmentContract?: boolean;
  isDemo?: boolean;
  isComplimentary?: boolean;
  pphRatePercent?: number | null;
  otherTaxName?: string | null;
  contractPrice?: number | null;
  setupCost?: number | null;
  profitSharePercent?: number | null;
  monthlyClientFee?: number | null;
  memberParkingUnitFee?: number | null;
  memberParkingUnitCount?: number | null;
  parkingTaxPercent?: number | null;
  serviceFeePercent?: number | null;
  paymentTermsDays?: number | null;
  bankAccountId?: string | null;
  payrollCutoffStartDay?: number | null;
  payrollCutoffEndDay?: number | null;
  payrollTaxPercent?: number | null;
  clientId: string | null;
  status: ProjectStatus | string;
  shiftCount?: number;
  shifts?: ProjectShiftWindow[];
  assignments: { employeeId: string }[];
  operationsTeamLinks?: { teamId: string }[];
};

type DeleteProject = {
  id: string;
  name: string;
  clientName: string | null;
  invoiceCount: number;
  reportCount: number;
};

type Props = {
  canManage: boolean;
  canDelete: boolean;
  /** When set, Delete is shown disabled with this tooltip (e.g. In Progress). */
  deleteBlockedReason?: string | null;
  canEndContract: boolean;
  inPlanning: boolean;
  showMoveToInProgress: boolean;
  showSubmitForApproval?: boolean;
  canMoveBackToPlanning: boolean;
  moveBackBlockedByCollection: boolean;
  billingHref: string | null;
  projectId: string;
  projectName: string;
  subCategory: ProjectSubCategory;
  estimatedStartDate: Date | null;
  estimatedDurationDays?: number | null;
  startDate: Date | null;
  endDate: Date | null;
  editProject: EditProject;
  deleteProject: DeleteProject;
  /** List URL to return to after delete (e.g. planning / in-progress). */
  deleteRedirectHref?: string;
  employees: ProjectStaffEmployee[];
  teams?: ProjectTeamOption[];
  assignedTeamIds?: string[];
  clients: ClientOption[];
  catalog?: ProjectCatalogAreaDTO[];
  bankAccounts?: CompanyBankAccountOption[];
  hasPortalAccess?: boolean;
  /** Page body between the top action bar and bottom Delete / End Contract. */
  children: ReactNode;
};

export default function ProjectDetailActionBar({
  canManage,
  canDelete,
  deleteBlockedReason = null,
  canEndContract,
  inPlanning,
  showMoveToInProgress,
  showSubmitForApproval = false,
  canMoveBackToPlanning,
  moveBackBlockedByCollection,
  billingHref,
  projectId,
  projectName,
  subCategory,
  estimatedStartDate,
  estimatedDurationDays,
  startDate,
  endDate,
  editProject,
  deleteProject,
  deleteRedirectHref,
  employees,
  teams = [],
  assignedTeamIds = [],
  clients,
  catalog = [],
  bankAccounts = [],
  hasPortalAccess = true,
  children,
}: Props) {
  const { t } = useT();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const showBilling = canManage && !inPlanning && Boolean(billingHref);
  const showEdit = canManage && editProject.status !== "COMPLETED";
  const showEndContract = canEndContract;
  const showDelete = canDelete || Boolean(deleteBlockedReason);
  const deleteBlocked = Boolean(deleteBlockedReason);
  const showStart = canManage && showMoveToInProgress;
  const showSubmit = canManage && showSubmitForApproval;
  const showReturn = canManage && canMoveBackToPlanning;
  const showReturnBlocked = canManage && moveBackBlockedByCollection;

  const showWorkflow = showStart || showSubmit || showReturn || showReturnBlocked;
  const showSecondary = showBilling || showEdit;
  const hasTopActions = showWorkflow || showSecondary;
  // Contract extension history is Regular Cleaning only (period-based contracts).
  const showExtendContract =
    canManage &&
    showEndContract &&
    Boolean(endDate) &&
    isExtendableContractSubCategory(subCategory);
  const showRenewContract =
    canManage &&
    editProject.status === "COMPLETED" &&
    isExtendableContractSubCategory(subCategory);
  const showRedoJob =
    canManage &&
    editProject.status === "COMPLETED" &&
    isRedoJobSubCategory(subCategory);
  const hasBottomActions =
    showDelete ||
    showEndContract ||
    showExtendContract ||
    showRenewContract ||
    showRedoJob;

  return (
    <>
      {hasTopActions ? (
        <div className="mb-5 flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          {showWorkflow ? (
            <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-1 sm:pr-2">
              {showStart ? (
                <ProjectStartButton
                  projectId={projectId}
                  projectName={projectName}
                  subCategory={subCategory}
                  areaCatalogId={editProject.areaCatalogId}
                  serviceArea={editProject.serviceArea}
                  estimatedStartDate={estimatedStartDate}
                  estimatedDurationDays={estimatedDurationDays}
                  startDate={startDate}
                  endDate={endDate}
                  employees={employees}
                  teams={teams}
                  assignedEmployeeIds={editProject.assignments.map(
                    (assignment) => assignment.employeeId
                  )}
                  assignedTeamIds={assignedTeamIds}
                  billingMode={editProject.billingMode}
                  size="bar"
                />
              ) : null}
              {showSubmit ? (
                <ProjectSubmitForApprovalButton
                  projectId={projectId}
                  projectName={projectName}
                  hasPortalAccess={hasPortalAccess}
                  size="bar"
                />
              ) : null}
              {showReturn ? (
                <ProjectReturnToPlanningButton
                  projectId={projectId}
                  projectName={projectName}
                  size="bar"
                />
              ) : null}
              {showReturnBlocked ? (
                <ProjectReturnToPlanningBlockedChip size="bar" />
              ) : null}
            </div>
          ) : null}
          {showSecondary ? (
            <div
              className={cn(
                "flex w-full flex-col gap-3 sm:ml-auto sm:w-auto sm:shrink-0 sm:flex-row sm:items-center sm:justify-end sm:[&>*]:w-auto sm:[&>*]:min-w-[11rem]",
                showWorkflow &&
                  "border-t border-border/70 pt-3 sm:border-t-0 sm:pt-0"
              )}
            >
              {showBilling && billingHref ? (
                <Link
                  href={billingHref}
                  className={cn(
                    buttonVariants({
                      variant: "successBadge",
                      size: "lg",
                    }),
                    detailActionBarButtonClassName,
                    "whitespace-normal"
                  )}
                  aria-label={t("pages.projects.manageBilling")}
                >
                  <StackedChipLabel
                    lines={[
                      t("pages.projects.manageBillingChip1"),
                      t("pages.projects.manageBillingChip2"),
                    ]}
                    className={largeStackedChipLabelClassName}
                  />
                </Link>
              ) : null}
              {showEdit ? (
                <Button
                  type="button"
                  variant="infoBadge"
                  size="lg"
                  className={detailActionBarButtonClassName}
                  onClick={() => setEditOpen(true)}
                >
                  {t("common.actions.edit")}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {children}

      {hasBottomActions ? (
        <div className="mt-8 border-t border-border pt-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-subtle">
            {t("pages.projects.detail.projectControls")}
          </p>
          <div className="flex w-full flex-col gap-3">
            {showDelete ? (
              deleteBlocked ? (
                <div className="flex w-full flex-col gap-1.5">
                  <span
                    className="block w-full"
                    title={deleteBlockedReason ?? undefined}
                  >
                    <Button
                      type="button"
                      variant="destructiveBadge"
                      size="lg"
                      className={cn(
                        detailActionBarButtonClassName,
                        "pointer-events-none opacity-50"
                      )}
                      aria-disabled="true"
                      tabIndex={-1}
                    >
                      {t("common.actions.delete")}
                    </Button>
                  </span>
                  {deleteBlockedReason ? (
                    <p className="text-xs leading-5 text-subtle">
                      {deleteBlockedReason}
                    </p>
                  ) : null}
                </div>
              ) : (
                <Button
                  type="button"
                  variant="destructiveBadge"
                  size="lg"
                  className={detailActionBarButtonClassName}
                  onClick={() => setDeleteOpen(true)}
                >
                  {t("common.actions.delete")}
                </Button>
              )
            ) : null}
            {showExtendContract ? (
              <ProjectExtendContractButton
                projectId={projectId}
                currentEndDate={endDate}
                size="bar"
              />
            ) : null}
            {showRenewContract ? (
              <ProjectRenewContractButton projectId={projectId} size="bar" />
            ) : null}
            {showRedoJob ? (
              <ProjectRedoJobButton
                projectId={projectId}
                subCategory={subCategory}
                areaCatalogId={editProject.areaCatalogId}
                serviceArea={editProject.serviceArea}
                employees={employees}
                teams={teams}
                billingMode={editProject.billingMode}
                size="bar"
              />
            ) : null}
            {showEndContract ? (
              <ProjectFinishButton
                projectId={projectId}
                projectName={projectName}
                isRegularContract
                requiresLastDay={subCategory !== "PARKING"}
                requiresLastMonth={subCategory === "PARKING"}
                plannedEndDate={endDate}
                mode="end-only"
                size="bar"
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {showEdit ? (
        <ProjectEditDialog
          project={editProject}
          employees={employees}
          teams={teams}
          assignedTeamIds={assignedTeamIds}
          clients={clients}
          catalog={catalog}
          bankAccounts={bankAccounts}
          showTrigger={false}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      ) : null}
      {showDelete && !deleteBlocked ? (
        <ProjectDeleteDialog
          context="active"
          project={deleteProject}
          redirectHref={deleteRedirectHref}
          showTrigger={false}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
        />
      ) : null}
    </>
  );
}
