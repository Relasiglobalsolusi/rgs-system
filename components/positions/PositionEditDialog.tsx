"use client";

import { useState, useTransition } from "react";
import { BriefcaseBusiness } from "lucide-react";
import { updatePosition } from "@/app/positions/actions";
import PositionDeleteDialog from "@/components/positions/PositionDeleteDialog";
import PositionModuleAccessFields from "@/components/positions/PositionModuleAccessFields";
import PositionSystemGuideButton from "@/components/positions/PositionSystemGuideButton";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  employeeDialogFieldClass,
  employeeDialogFormClass,
  employeeInputClass,
} from "@/components/employees/employee-dialog-ui";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { showRejectionFromError } from "@/components/ui/rejection-notice";
import { localizeDepartmentLabel } from "@/lib/i18n/labels";
import { useT } from "@/lib/i18n/use-t";
import {
  getEmployeeModuleOverrides,
  type ModuleAccessFlags,
} from "@/lib/permissions";
import { titleCaseWords } from "@/lib/text-case";

export type PositionRow = {
  id: string;
  categoryId: string;
  slug?: string | null;
  name: string;
  description: string | null;
  active: boolean;
  sortOrder: number;
  defaultModuleAccess?: unknown;
  category: {
    name: string;
    prefix: string;
    slug?: string | null;
    sortOrder?: number;
  };
  _count: { employees: number };
};

function positionDefaultModuleAccess(
  position: PositionRow
): ModuleAccessFlags {
  return getEmployeeModuleOverrides({
    jobPosition: {
      slug: position.slug,
      name: position.name,
      defaultModuleAccess: position.defaultModuleAccess,
    },
  });
}

export default function PositionEditDialog({
  position,
  otherPositions,
  open,
  onOpenChange,
  onUpdated,
}: {
  position: PositionRow;
  otherPositions: PositionRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
}) {
  const { t, locale } = useT();
  const [active, setActive] = useState(position.active);
  const [moduleAccess, setModuleAccess] = useState<ModuleAccessFlags>(
    () => positionDefaultModuleAccess(position)
  );
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const departmentLabel = `${titleCaseWords(
    localizeDepartmentLabel(
      position.category.slug,
      position.category.name,
      locale
    )
  )} (${position.category.prefix.toUpperCase()})`;

  function submit(formData: FormData) {
    formData.set("active", String(active));
    startTransition(async () => {
      try {
        await updatePosition(position.id, formData);
        onOpenChange(false);
        onUpdated?.();
      } catch (error) {
        showRejectionFromError(
          error,
          t("pages.employees.positionDialog.updateFailed")
        );
      }
    });
  }

  const employeeCountKey =
    position._count.employees === 1
      ? "pages.employees.positionDialog.employeeCountOne"
      : "pages.employees.positionDialog.employeeCountOther";

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          onOpenChange(nextOpen);
          if (nextOpen) {
            setActive(position.active);
            setModuleAccess(positionDefaultModuleAccess(position));
          }
        }}
        disablePointerDismissal
      >
        <EmployeeDialogShell
          icon={BriefcaseBusiness}
          title={t("pages.employees.positionDialog.editTitle")}
          description={departmentLabel}
          maxWidth="lg"
          footer={
            <div className="flex w-full flex-col gap-3">
              <EmployeePrimaryButton
                type="button"
                variant="danger"
                disabled={pending}
                onClick={() => setDeleteOpen(true)}
              >
                {t("common.actions.delete")}
              </EmployeePrimaryButton>
              <EmployeePrimaryButton form="edit-position-form" disabled={pending}>
                {pending
                  ? t("common.actions.saving")
                  : t("common.actions.saveChanges")}
              </EmployeePrimaryButton>
            </div>
          }
        >
          <form id="edit-position-form" action={submit}>
            <div className={employeeDialogFormClass}>
              <div className={employeeDialogFieldClass}>
                <label className="text-sm font-medium text-muted">
                  {t("pages.employees.positionDialog.positionName")}
                </label>
                <Input
                  name="name"
                  defaultValue={position.name}
                  required
                  className={employeeInputClass}
                />
              </div>
              <div className={employeeDialogFieldClass}>
                <label className="text-sm font-medium text-muted">
                  {t("common.labels.description")}
                </label>
                <Input
                  name="description"
                  defaultValue={position.description ?? ""}
                  className={employeeInputClass}
                />
              </div>
              <label className="flex items-center gap-3 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(event) => setActive(event.target.checked)}
                />
                {t("pages.employees.positionDialog.availableForNew")}
              </label>
              <p className="text-xs text-subtle">
                {t(employeeCountKey, { count: position._count.employees })}
              </p>
              <PositionModuleAccessFields
                value={moduleAccess}
                onChange={setModuleAccess}
                disabled={pending}
                headerAction={
                  <PositionSystemGuideButton
                    formId="edit-position-form"
                    fallbackName={position.name}
                    departmentLabel={departmentLabel}
                    moduleAccess={moduleAccess}
                    disabled={pending}
                  />
                }
              />
            </div>
          </form>
        </EmployeeDialogShell>
      </Dialog>
      <PositionDeleteDialog
        position={position}
        otherPositions={otherPositions}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={onUpdated}
      />
    </>
  );
}
