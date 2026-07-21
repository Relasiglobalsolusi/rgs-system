"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import type {
  BillingMode,
  BillingPeriodBasis,
  ProjectStatus,
} from "@prisma/client";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  largeStackedChipLabelClassName,
  StackedChipLabel,
} from "@/components/ui/StatusBadge";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/use-t";
import type { ProjectSubCategory } from "@/lib/project-subcategory";
import type { ProjectStaffEmployee } from "@/components/projects/ProjectStaffPicker";
import { detailActionBarButtonClassName } from "@/components/projects/detail-action-bar";
import ProjectEditDialog from "@/components/projects/ProjectEditDialog";
import ProjectDeleteDialog from "@/components/projects/ProjectDeleteDialog";
import ProjectExtendContractButton from "@/components/projects/ProjectExtendContractButton";
import ProjectFinishButton from "@/components/projects/ProjectFinishButton";
import ProjectStartButton, {
  ProjectReturnToPlanningBlockedChip,
  ProjectReturnToPlanningButton,
} from "@/components/projects/ProjectStartButton";

type ClientOption = {
  id: string;
  name: string;
  npwp: string | null;
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
  serviceArea?: "CLEANING" | "PARKING" | "SECURITY";
  billingMode: BillingMode;
  billingPeriodBasis?: BillingPeriodBasis | null;
  requiresTaxInvoice: boolean;
  clientId: string | null;
  status: ProjectStatus | string;
  assignments: { employeeId: string }[];
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
  canMoveBackToPlanning: boolean;
  moveBackBlockedByCollection: boolean;
  billingHref: string;
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
  clients: ClientOption[];
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
  clients,
  children,
}: Props) {
  const { t } = useT();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const showBilling = canManage && !inPlanning;
  const showEdit = canManage;
  const showEndContract = canEndContract;
  const showDelete = canDelete || Boolean(deleteBlockedReason);
  const deleteBlocked = Boolean(deleteBlockedReason);
  const showStart = canManage && showMoveToInProgress;
  const showReturn = canManage && canMoveBackToPlanning;
  const showReturnBlocked = canManage && moveBackBlockedByCollection;

  const showWorkflow = showStart || showReturn || showReturnBlocked;
  const showSecondary = showBilling || showEdit;
  const hasTopActions = showWorkflow || showSecondary;
  const showExtendContract = canManage && showEndContract && Boolean(endDate);
  const hasBottomActions =
    showDelete || showEndContract || showExtendContract;

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
                  estimatedStartDate={estimatedStartDate}
                  estimatedDurationDays={estimatedDurationDays}
                  startDate={startDate}
                  endDate={endDate}
                  employees={employees}
                  assignedEmployeeIds={editProject.assignments.map(
                    (assignment) => assignment.employeeId
                  )}
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
              {showBilling ? (
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
            {showEndContract ? (
              <ProjectFinishButton
                projectId={projectId}
                projectName={projectName}
                isRegularContract
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
          clients={clients}
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
