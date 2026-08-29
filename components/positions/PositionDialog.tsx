"use client";

import { useMemo, useState, useTransition } from "react";
import { BriefcaseBusiness } from "lucide-react";
import { createPosition } from "@/app/positions/actions";
import type { EmployeeCategoryOption } from "@/components/employees/EmployeeFormFields";
import PositionModuleAccessFields from "@/components/positions/PositionModuleAccessFields";
import PositionSystemGuideButton from "@/components/positions/PositionSystemGuideButton";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  employeeDialogFieldClass,
  employeeDialogFormClass,
  employeeInputClass,
  employeeSelectTriggerClass,
} from "@/components/employees/employee-dialog-ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { showRejectionFromError } from "@/components/ui/rejection-notice";
import { localizeDepartmentLabel } from "@/lib/i18n/labels";
import { useT } from "@/lib/i18n/use-t";
import {
  getEmployeeModuleOverrides,
  type ModuleAccessFlags,
} from "@/lib/permissions";
import { titleCaseWords } from "@/lib/text-case";

export default function PositionDialog({
  categories,
  defaultCategoryId,
  onCreated,
}: {
  categories: EmployeeCategoryOption[];
  defaultCategoryId?: string;
  onCreated?: () => void;
}) {
  const { t, locale } = useT();
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [moduleAccess, setModuleAccess] = useState<ModuleAccessFlags>(
    () => getEmployeeModuleOverrides()
  );
  const [pending, startTransition] = useTransition();

  const selectableCategories = useMemo(
    () =>
      categories.filter(
        (category) =>
          category.active &&
          category.slug?.toLowerCase() !== "una" &&
          category.slug?.toLowerCase() !== "finance" &&
          category.prefix.toUpperCase() !== "UNA" &&
          category.prefix.toUpperCase() !== "FIN"
      ),
    [categories]
  );

  function resolvedDefaultCategoryId() {
    if (
      defaultCategoryId &&
      selectableCategories.some((category) => category.id === defaultCategoryId)
    ) {
      return defaultCategoryId;
    }
    return "";
  }

  function formatDepartmentLabel(category: EmployeeCategoryOption): string {
    const name = localizeDepartmentLabel(category.slug, category.name, locale);
    return `${titleCaseWords(name)} (${category.prefix.toUpperCase()})`;
  }

  // Same pattern as ProgressDialog / CicoActions: Base UI Select.Value shows the
  // raw value unless Root `items` maps id → label, and SelectValue renders the label.
  const departmentSelectItems = selectableCategories.map((category) => ({
    value: category.id,
    label: formatDepartmentLabel(category),
  }));
  const selectedCategory = selectableCategories.find(
    (category) => category.id === categoryId
  );

  function submit(formData: FormData) {
    formData.set("categoryId", categoryId);
    startTransition(async () => {
      try {
        await createPosition(formData);
        setOpen(false);
        setCategoryId(resolvedDefaultCategoryId());
        setModuleAccess(getEmployeeModuleOverrides());
        onCreated?.();
      } catch (error) {
        showRejectionFromError(
          error,
          t("pages.employees.positionDialog.createFailed")
        );
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setCategoryId(resolvedDefaultCategoryId());
          setModuleAccess(getEmployeeModuleOverrides());
        }
      }}
      disablePointerDismissal
    >
      <DialogTrigger asChild>
        <Button variant="successBadge" size="badge">
          {t("pages.employees.addPosition")}
        </Button>
      </DialogTrigger>
      <EmployeeDialogShell
        icon={BriefcaseBusiness}
        title={t("pages.employees.positionDialog.createTitle")}
        description={t("pages.employees.positionDialog.createDescription")}
        maxWidth="lg"
        footer={
          <EmployeePrimaryButton
            form="create-position-form"
            disabled={pending || !categoryId}
          >
            {pending
              ? t("pages.employees.positionDialog.creating")
              : t("pages.employees.positionDialog.createButton")}
          </EmployeePrimaryButton>
        }
      >
        <form id="create-position-form" action={submit}>
          <div className={employeeDialogFormClass}>
            <div className={employeeDialogFieldClass}>
              <label className="text-sm font-medium text-muted">
                {t("common.labels.department")}
              </label>
              <Select
                value={categoryId}
                onValueChange={(value) => setCategoryId(value ?? "")}
                items={departmentSelectItems}
              >
                <SelectTrigger className={employeeSelectTriggerClass}>
                  <SelectValue
                    placeholder={t(
                      "pages.employees.positionDialog.selectDepartment"
                    )}
                  >
                    {(value) => {
                      if (!value) return null;
                      const category = selectableCategories.find(
                        (item) => item.id === value
                      );
                      return category
                        ? formatDepartmentLabel(category)
                        : String(value);
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {selectableCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {formatDepartmentLabel(category)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className={employeeDialogFieldClass}>
              <label className="text-sm font-medium text-muted">
                {t("pages.employees.positionDialog.positionName")}
              </label>
              <Input name="name" required className={employeeInputClass} />
            </div>
            <div className={employeeDialogFieldClass}>
              <label className="text-sm font-medium text-muted">
                {t("common.labels.description")}
              </label>
              <Input name="description" className={employeeInputClass} />
            </div>
            <PositionModuleAccessFields
              value={moduleAccess}
              onChange={setModuleAccess}
              disabled={pending}
              headerAction={
                <PositionSystemGuideButton
                  formId="create-position-form"
                  fallbackName=""
                  departmentLabel={
                    selectedCategory
                      ? formatDepartmentLabel(selectedCategory)
                      : ""
                  }
                  moduleAccess={moduleAccess}
                  disabled={pending}
                />
              }
            />
          </div>
        </form>
      </EmployeeDialogShell>
    </Dialog>
  );
}
