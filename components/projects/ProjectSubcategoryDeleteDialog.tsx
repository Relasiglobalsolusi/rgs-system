"use client";

import { showRejectionFromError } from "@/components/ui/rejection-notice";
import { useTransition } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";

import { deleteProjectSubcategory } from "@/app/projects/catalog-actions";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  EmployeeSecondaryButton,
} from "@/components/employees/employee-dialog-ui";
import { Dialog } from "@/components/ui/dialog";
import { useT } from "@/lib/i18n/use-t";
import {
  catalogDisplayName,
  type ProjectCatalogSubcategoryDTO,
} from "@/lib/project-service-catalog";

export default function ProjectSubcategoryDeleteDialog({
  subcategory,
  open,
  onOpenChange,
  onDeleted,
}: {
  subcategory: ProjectCatalogSubcategoryDTO;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}) {
  const { t, locale } = useT();
  const [pending, startTransition] = useTransition();
  const usage = subcategory.projectCount;
  const inUse = usage > 0;

  function remove() {
    if (inUse) return;
    startTransition(async () => {
      try {
        await deleteProjectSubcategory(subcategory.id);
        onOpenChange(false);
        onDeleted?.();
      } catch (error) {
        showRejectionFromError(
          error,
          t("pages.projects.catalogDeleteSubFailed")
        );
      }
    });
  }

  const usageKey =
    usage === 1
      ? "pages.projects.catalogSubInUseOne"
      : "pages.projects.catalogSubInUseOther";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <EmployeeDialogShell
        icon={Trash2}
        title={t("pages.projects.catalogDeleteSubTitle")}
        description={
          inUse
            ? t("pages.projects.catalogDeleteSubDescInUse")
            : t("pages.projects.catalogDeleteSubDescEmpty")
        }
        maxWidth="md"
        footer={
          <div className="flex w-full flex-col gap-3">
            <EmployeePrimaryButton
              type="button"
              variant="danger"
              disabled={pending || inUse}
              onClick={remove}
            >
              {pending
                ? t("common.actions.deleting")
                : t("pages.projects.catalogDeleteSubConfirm")}
            </EmployeePrimaryButton>
            <EmployeeSecondaryButton onClick={() => onOpenChange(false)}>
              {t("common.actions.close")}
            </EmployeeSecondaryButton>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-elevated px-4 py-4">
            <p className="text-sm font-medium text-text">
              {catalogDisplayName(subcategory, locale)}
            </p>
          </div>
          {inUse ? (
            <div className="flex gap-3 rounded-xl border border-amber-500/25 bg-card-tint-amber p-4 text-sm text-text">
              <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
              {t(usageKey, { count: usage })}
            </div>
          ) : null}
        </div>
      </EmployeeDialogShell>
    </Dialog>
  );
}
