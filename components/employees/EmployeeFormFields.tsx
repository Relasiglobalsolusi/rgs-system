"use client";

import { useMemo, useRef, useState } from "react";
import { Upload } from "lucide-react";
import type { EmploymentType } from "@prisma/client";

import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/PhoneInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import YesNoChoiceCards, { type YesNoChoice } from "@/components/ui/YesNoChoiceCards";
import {
  employeeDialogFieldClass,
  employeeDialogFormClass,
  employeeDialogGridClass,
  employeeInputClass,
  employeeSelectTriggerClass,
} from "@/components/employees/employee-dialog-ui";
import { cn } from "@/lib/utils";
import { formatDateForInput } from "@/lib/format-tenure";
import {
  formatEmploymentTypeLabel,
  formatPlacementLabel,
} from "@/lib/placement";
import { localizeDepartmentLabel } from "@/lib/i18n/labels";
import { isOperationsManagerPosition } from "@/lib/positions";
import {
  SERVICE_AREA_ORDER,
  type ServiceAreaValue,
} from "@/lib/service-area";
import { todayDateInput } from "@/lib/project-contract";
import { useT } from "@/lib/i18n/use-t";

export type EmployeeFormDefaults = {
  employeeNo?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  categoryId?: string | null;
  positionId?: string | null;
  employmentType?: "FULL_TIME" | "PART_TIME";
  placement?: "AVAILABLE" | "ON_PROJECT" | "HEAD_OFFICE" | "FIELD";
  portalAccessRequested?: boolean;
  idDocumentUrl?: string | null;
  hiredAt?: Date | string | null;
  omApprovalAreas?: ServiceAreaValue[];
};

export type EmployeeCategoryOption = {
  id: string;
  slug?: string | null;
  name: string;
  prefix: string;
  active: boolean;
  sortOrder: number;
};

export type PositionOption = {
  id: string;
  categoryId: string;
  slug?: string | null;
  name: string;
  description: string | null;
  active: boolean;
  sortOrder: number;
};

export type ProjectOption = {
  id: string;
  name: string;
  location: string | null;
  status: string;
};

type Props = {
  mode: "create" | "edit";
  categories: EmployeeCategoryOption[];
  positions: PositionOption[];
  categoryId: string;
  onCategoryIdChange: (value: string) => void;
  positionId: string;
  onPositionIdChange: (value: string) => void;
  employmentType: "FULL_TIME" | "PART_TIME";
  onEmploymentTypeChange: (value: "FULL_TIME" | "PART_TIME") => void;
  previewEmployeeNo?: string;
  defaults?: EmployeeFormDefaults;
  onFormValuesChange?: () => void;
};

function isSelectableCategory(category: EmployeeCategoryOption): boolean {
  return (
    category.active &&
    category.slug?.toLowerCase() !== "una" &&
    category.slug?.toLowerCase() !== "finance" &&
    category.prefix.toUpperCase() !== "UNA" &&
    category.prefix.toUpperCase() !== "FIN"
  );
}

function formatDepartmentLabel(
  category: EmployeeCategoryOption,
  locale: "en" | "id"
): string {
  const name = localizeDepartmentLabel(category.slug, category.name, locale);
  return `${name} (${category.prefix})`;
}

export default function EmployeeFormFields({
  mode,
  categories,
  positions,
  categoryId,
  onCategoryIdChange,
  positionId,
  onPositionIdChange,
  employmentType,
  onEmploymentTypeChange,
  previewEmployeeNo,
  defaults,
  onFormValuesChange,
}: Props) {
  const { t, locale } = useT();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [createPortalLogin, setCreatePortalLogin] = useState<YesNoChoice>(
    defaults?.portalAccessRequested ? "Yes" : "No"
  );
  const [omApprovalAreas, setOmApprovalAreas] = useState<ServiceAreaValue[]>(
    () => defaults?.omApprovalAreas ?? ["CLEANING"]
  );

  const selectedPosition = useMemo(
    () => positions.find((position) => position.id === positionId),
    [positions, positionId]
  );
  const showOmApprovalAreas = isOperationsManagerPosition({
    slug: selectedPosition?.slug,
    name: selectedPosition?.name,
  });

  const selectableCategories = useMemo(() => {
    const active = categories.filter(isSelectableCategory);
    const currentId = mode === "edit" ? defaults?.categoryId : categoryId;
    if (!currentId) return active;

    const current = categories.find((category) => category.id === currentId);
    if (current && !active.some((category) => category.id === current.id)) {
      return [...active, current].sort(
        (left, right) =>
          left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)
      );
    }
    return active;
  }, [categories, categoryId, defaults?.categoryId, mode]);

  const categoryById = useMemo(() => {
    const map = new Map<string, EmployeeCategoryOption>();
    for (const category of categories) {
      map.set(category.id, category);
    }
    for (const category of selectableCategories) {
      map.set(category.id, category);
    }
    return map;
  }, [categories, selectableCategories]);

  const availablePositions = useMemo(() => {
    const active = positions.filter(
      (position) => position.active && position.categoryId === categoryId
    );
    const currentId = mode === "edit" ? defaults?.positionId : positionId;
    if (!currentId || !categoryId) return active;

    const current = positions.find((position) => position.id === currentId);
    if (
      current &&
      current.categoryId === categoryId &&
      !active.some((position) => position.id === current.id)
    ) {
      return [...active, current].sort(
        (left, right) =>
          left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)
      );
    }
    return active;
  }, [positions, categoryId, defaults?.positionId, mode, positionId]);

  const categoryChanged = mode === "edit" && categoryId !== (defaults?.categoryId ?? "");
  const employeeNoValue =
    mode === "create"
      ? previewEmployeeNo ?? ""
      : categoryChanged
        ? previewEmployeeNo ?? defaults?.employeeNo ?? ""
        : defaults?.employeeNo ?? "";

  const placementLabel = formatPlacementLabel(
    defaults?.placement ?? "AVAILABLE",
    locale
  );

  return (
    <div className={employeeDialogFormClass}>
      <div className="space-y-4 rounded-xl border border-border bg-inset p-4">
        <div className={employeeDialogFieldClass}>
          <label className="text-sm font-medium text-text">
            {t("pages.employees.form.department")}
          </label>
          <p className="text-xs text-muted">
            {t("pages.employees.form.departmentControlsHint")}
          </p>
          <Select
            value={categoryId}
            onValueChange={(value) => {
              onCategoryIdChange(value ?? "");
              onPositionIdChange("");
            }}
          >
            <SelectTrigger className={employeeSelectTriggerClass}>
              <SelectValue placeholder={t("pages.employees.form.selectDepartment")}>
                {(value) => {
                  if (!value) return null;
                  const category = categoryById.get(value);
                  return category ? formatDepartmentLabel(category, locale) : null;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {selectableCategories.map((category) => {
                const label = formatDepartmentLabel(category, locale);
                return (
                  <SelectItem key={category.id} value={category.id} label={label}>
                    {label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <input type="hidden" name="categoryId" value={categoryId} />
        </div>

        <div className={employeeDialogFieldClass}>
          <label className="text-sm font-medium text-text">
            {t("pages.employees.form.employeeNumber")}
          </label>
          <p className="text-xs text-muted">
            {mode === "create"
              ? t("pages.employees.form.employeeNoPreview")
              : categoryChanged
                ? t("pages.employees.form.employeeNoReassign")
                : t("pages.employees.form.employeeNoLocked")}
          </p>
          <Input
            name="employeeNo"
            value={employeeNoValue}
            readOnly
            placeholder={
              mode === "create" ? t("pages.employees.form.selectDeptFirst") : ""
            }
            className={cn(employeeInputClass, "text-primary-dark")}
          />
        </div>

        <div className={employeeDialogFieldClass}>
          <label className="text-sm font-medium text-text">
            {t("pages.employees.form.placement")}
          </label>
          <p className="text-xs text-muted">
            {t("pages.employees.form.placementHint")}
          </p>
          <div className="rounded-xl border border-border bg-elevated px-4 py-3 text-sm text-muted">
            {t("pages.employees.form.placementManaged", { label: placementLabel })}
          </div>
        </div>
      </div>

      <div className={employeeDialogGridClass}>
        <Input
          name="firstName"
          placeholder={t("pages.employees.form.firstName")}
          defaultValue={defaults?.firstName}
          required
          className={employeeInputClass}
        />
        <Input
          name="lastName"
          placeholder={t("pages.employees.form.lastName")}
          defaultValue={defaults?.lastName}
          required
          className={employeeInputClass}
        />

        <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
          <label
            htmlFor="employee-position"
            className="text-sm font-medium text-text"
          >
            {t("pages.employees.form.position")}
          </label>
          <p className="text-xs text-muted">
            {t("pages.employees.form.positionHint")}
          </p>
          <Select
            value={positionId}
            onValueChange={(value) => onPositionIdChange(value ?? "")}
            disabled={!categoryId}
          >
            <SelectTrigger
              id="employee-position"
              className={employeeSelectTriggerClass}
            >
              <SelectValue
                placeholder={
                  categoryId
                    ? t("pages.employees.form.selectPosition")
                    : t("pages.employees.form.selectDeptFirst")
                }
              >
                {(value) => {
                  if (!value) return null;
                  const position = positions.find((item) => item.id === value);
                  return position?.name ?? null;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {availablePositions.map((position) => (
                <SelectItem
                  key={position.id}
                  value={position.id}
                  label={position.name}
                >
                  {position.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input type="hidden" name="positionId" value={positionId} />
        </div>

        {showOmApprovalAreas ? (
          <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
            <label className="text-sm font-medium text-text">
              {t("pages.employees.form.approvalAreas")}
            </label>
            <p className="text-xs text-muted">
              {t("pages.employees.form.approvalAreasHint")}
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              {SERVICE_AREA_ORDER.map((area) => {
                const checked = omApprovalAreas.includes(area);
                return (
                  <label
                    key={area}
                    className="inline-flex items-center gap-2 text-sm text-text"
                  >
                    <input
                      type="checkbox"
                      name="omApprovalAreas"
                      value={area}
                      checked={checked}
                      onChange={() => {
                        setOmApprovalAreas((prev) => {
                          if (prev.includes(area)) {
                            return prev.filter((item) => item !== area);
                          }
                          return SERVICE_AREA_ORDER.filter(
                            (item) => item === area || prev.includes(item)
                          );
                        });
                        onFormValuesChange?.();
                      }}
                      className="size-4 rounded border-border"
                    />
                    {area === "CLEANING"
                      ? t("pages.projects.serviceAreaCleaning")
                      : area === "PARKING"
                        ? t("pages.projects.serviceAreaParking")
                        : t("pages.projects.serviceAreaSecurity")}
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
          <label className="text-sm font-medium text-text">
            {t("pages.employees.form.employmentType")}
          </label>
          <Select
            value={employmentType}
            onValueChange={(value) =>
              onEmploymentTypeChange(value as "FULL_TIME" | "PART_TIME")
            }
          >
            <SelectTrigger className={employeeSelectTriggerClass}>
              <SelectValue
                placeholder={t("pages.employees.form.selectEmploymentType")}
              >
                {(value) =>
                  value
                    ? formatEmploymentTypeLabel(value as EmploymentType, locale)
                    : null
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                value="FULL_TIME"
                label={formatEmploymentTypeLabel("FULL_TIME", locale)}
              >
                {formatEmploymentTypeLabel("FULL_TIME", locale)}
              </SelectItem>
              <SelectItem
                value="PART_TIME"
                label={formatEmploymentTypeLabel("PART_TIME", locale)}
              >
                {formatEmploymentTypeLabel("PART_TIME", locale)}
              </SelectItem>
            </SelectContent>
          </Select>
          <input type="hidden" name="employmentType" value={employmentType} />
        </div>

        <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
          <label
            htmlFor="employee-hired-at"
            className="text-sm font-medium text-text"
          >
            {t("pages.employees.form.startDate")}
          </label>
          <p className="text-xs text-muted">
            {t("pages.employees.form.startDateHint")}
          </p>
          <Input
            id="employee-hired-at"
            name="hiredAt"
            type="date"
            defaultValue={
              formatDateForInput(defaults?.hiredAt) ||
              (mode === "create" ? todayDateInput() : "")
            }
            className={employeeInputClass}
          />
        </div>

        <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
          <label
            htmlFor="employee-email"
            className="text-sm font-medium text-text"
          >
            {t("pages.employees.form.contactEmail")}
          </label>
          <Input
            id="employee-email"
            name="email"
            placeholder="contact@company.co.id"
            type="email"
            defaultValue={defaults?.email ?? ""}
            className={employeeInputClass}
          />
        </div>
        <PhoneInput
          name="phone"
          defaultValue={defaults?.phone ?? ""}
          onValueChange={() => onFormValuesChange?.()}
          inputClassName={employeeInputClass}
          selectClassName={cn(employeeSelectTriggerClass, "w-[5.5rem] px-3")}
        />

        <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
          <label className="text-sm font-medium text-text">
            {t("pages.employees.form.portalLogin")}
          </label>
          <YesNoChoiceCards
            id="createPortalLogin"
            value={createPortalLogin}
            onChange={(value) => {
              setCreatePortalLogin(value);
              onFormValuesChange?.();
            }}
          />
          <input type="hidden" name="createPortalLogin" value={createPortalLogin} />
        </div>
      </div>

      <div>
        {defaults?.idDocumentUrl ? (
          <p className="mb-2 text-xs text-muted">
            {t("pages.employees.form.idDocumentCurrent")}{" "}
            <a
              href={defaults.idDocumentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-dark hover:text-accent-teal"
            >
              {t("pages.employees.form.idDocumentView")}
            </a>
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex h-11 w-full items-center gap-3 rounded-xl border border-dashed border-border bg-elevated px-4 text-left text-sm text-muted transition hover:border-accent-cyan/40 hover:text-text"
        >
          <Upload className="h-4 w-4 shrink-0 text-muted" />
          <span>
            {defaults?.idDocumentUrl
              ? t("pages.employees.form.idDocumentReplace")
              : t("pages.employees.form.idDocumentUpload")}
          </span>
        </button>
        <input
          ref={fileInputRef}
          name="idDocument"
          type="file"
          accept="image/*,.pdf"
          className="sr-only"
        />
      </div>
    </div>
  );
}
