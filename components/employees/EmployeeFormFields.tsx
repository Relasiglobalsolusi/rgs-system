"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import EmployeeFinancesFields, {
  type EmployeeFinanceDefaults,
} from "@/components/employees/EmployeeFinancesFields";
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
  initialPlacementForDepartment,
} from "@/lib/placement";
import { localizeDepartmentLabel } from "@/lib/i18n/labels";
import {
  defaultSecurityDepositRequired,
  isInHouseCleaningStaffPosition,
  isAreaManagerPosition,
  isOperationsManagerPosition,
  isWarehouseStaffPosition,
} from "@/lib/positions";
import {
  OM_APPROVAL_AREA_ORDER,
} from "@/lib/service-area";
import type { ServiceArea } from "@prisma/client";
import { todayDateInput } from "@/lib/project-contract";
import { defaultPortalAccessRequested } from "@/lib/workforce-login";
import { useT } from "@/lib/i18n/use-t";
import DirectorySearchInput, {
  matchesDirectorySearch,
} from "@/components/ui/DirectorySearchInput";

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
  omApprovalAreas?: ServiceArea[];
  managedProjectIds?: string[];
  status?: "ACTIVE" | "ON_LEAVE" | "LEAVE_PENDING";
} & EmployeeFinanceDefaults;

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
  clientName?: string | null;
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
  status?: "ACTIVE" | "ON_LEAVE" | "LEAVE_PENDING";
  onStatusChange?: (value: "ACTIVE" | "ON_LEAVE" | "LEAVE_PENDING") => void;
  previewEmployeeNo?: string;
  defaults?: EmployeeFormDefaults;
  projects?: ProjectOption[];
  onFormValuesChange?: () => void;
  /** Shared terms only — names and bank details go on bulk lines. */
  sharedTermsOnly?: boolean;
  /** Lock Full Time / Part Time when opened from a scoped bulk button. */
  lockEmploymentType?: boolean;
  /** Prefix form field names (e.g. `line.0.`) for bulk create. */
  namePrefix?: string;
  /** Prefix element ids so multiple forms can sit on one page. */
  idPrefix?: string;
};

function formatRosterStatusLabel(
  status: "ACTIVE" | "ON_LEAVE" | "LEAVE_PENDING",
  t: ReturnType<typeof useT>["t"]
) {
  if (status === "ON_LEAVE") return t("pages.employees.onLeave");
  if (status === "LEAVE_PENDING") return t("pages.employees.leavePending");
  return t("pages.employees.active");
}

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
  status = "ACTIVE",
  onStatusChange,
  previewEmployeeNo,
  defaults,
  projects = [],
  onFormValuesChange,
  sharedTermsOnly = false,
  lockEmploymentType = false,
  namePrefix = "",
  idPrefix = "",
}: Props) {
  const { t, locale } = useT();
  const nameOf = (field: string) =>
    namePrefix ? `${namePrefix}${field}` : field;
  const idOf = (id: string) => (idPrefix ? `${idPrefix}${id}` : id);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [createPortalLogin, setCreatePortalLogin] = useState<YesNoChoice>(
    defaults?.portalAccessRequested ? "Yes" : "No"
  );
  const [omApprovalAreas, setOmApprovalAreas] = useState<ServiceArea[]>(
    () => defaults?.omApprovalAreas ?? ["CLEANING"]
  );
  const [managedProjectIds, setManagedProjectIds] = useState<string[]>(
    () => defaults?.managedProjectIds ?? []
  );
  const [projectSearch, setProjectSearch] = useState("");

  const selectedPosition = useMemo(
    () => positions.find((position) => position.id === positionId),
    [positions, positionId]
  );
  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === categoryId),
    [categories, categoryId]
  );
  const showOmApprovalAreas = isOperationsManagerPosition({
    slug: selectedPosition?.slug,
    name: selectedPosition?.name,
  });
  const showAreaProjects = isAreaManagerPosition({
    slug: selectedPosition?.slug,
    name: selectedPosition?.name,
  });
  const visibleProjects = useMemo(() => {
    if (!showAreaProjects) return [];
    return projects.filter((project) =>
      matchesDirectorySearch(
        projectSearch,
        project.name,
        project.clientName,
        project.location
      )
    );
  }, [projects, projectSearch, showAreaProjects]);
  const isInHouseCleaning = isInHouseCleaningStaffPosition({
    slug: selectedPosition?.slug,
    name: selectedPosition?.name,
  });
  const isWarehouseStaff = isWarehouseStaffPosition({
    slug: selectedPosition?.slug,
    name: selectedPosition?.name,
  });

  useEffect(() => {
    if (mode !== "create") return;
    const placement = initialPlacementForDepartment({
      categorySlug: selectedCategory?.slug,
      categoryPrefix: selectedCategory?.prefix,
    });
    const portalYes = defaultPortalAccessRequested({
      placement,
      categorySlug: selectedCategory?.slug,
      jobPosition: selectedPosition
        ? { slug: selectedPosition.slug, name: selectedPosition.name }
        : null,
    });
    setCreatePortalLogin(portalYes ? "Yes" : "No");
  }, [mode, selectedCategory, selectedPosition]);

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
          <input type="hidden" name={nameOf("categoryId")} value={categoryId} />
        </div>

        <div className={employeeDialogFieldClass}>
          <label className="text-sm font-medium text-text">
            {t("pages.employees.form.employeeNumber")}
          </label>
          <p className="text-xs text-muted">
            {sharedTermsOnly
              ? t("pages.employees.form.employeeNoBulkPreview")
              : mode === "create"
                ? t("pages.employees.form.employeeNoPreview")
                : categoryChanged
                  ? t("pages.employees.form.employeeNoReassign")
                  : t("pages.employees.form.employeeNoLocked")}
          </p>
          <Input
            name={nameOf("employeeNo")}
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
        {sharedTermsOnly ? null : (
          <>
        <Input
          name={nameOf("firstName")}
          placeholder={t("pages.employees.form.firstName")}
          defaultValue={defaults?.firstName}
          required
          className={employeeInputClass}
        />
        <Input
          name={nameOf("lastName")}
          placeholder={t("pages.employees.form.lastName")}
          defaultValue={defaults?.lastName}
          required
          className={employeeInputClass}
        />
          </>
        )}

        <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
          <label
            htmlFor={idOf("employee-position")}
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
              id={idOf("employee-position")}
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
          <input type="hidden" name={nameOf("positionId")} value={positionId} />
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
              {OM_APPROVAL_AREA_ORDER.map((area) => {
                const checked = omApprovalAreas.includes(area);
                const areaLabelKey =
                  area === "CLEANING"
                    ? "pages.projects.serviceAreaCleaning"
                    : area === "PARKING"
                      ? "pages.projects.serviceAreaParking"
                      : area === "SECURITY"
                        ? "pages.projects.serviceAreaSecurity"
                        : "pages.projects.serviceAreaHeadOffice";
                return (
                  <label
                    key={area}
                    className="inline-flex items-center gap-2 text-sm text-text"
                  >
                    <input
                      type="checkbox"
                      name={nameOf("omApprovalAreas")}
                      value={area}
                      checked={checked}
                      onChange={() => {
                        setOmApprovalAreas((prev) => {
                          if (prev.includes(area)) {
                            return prev.filter((item) => item !== area);
                          }
                          return OM_APPROVAL_AREA_ORDER.filter(
                            (item) => item === area || prev.includes(item)
                          );
                        });
                        onFormValuesChange?.();
                      }}
                      className="size-4 rounded border-border"
                    />
                    {t(areaLabelKey)}
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}

        {showAreaProjects ? (
          <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
            <label className="text-sm font-medium text-text">
              {t("pages.employees.form.areaProjects")}
            </label>
            <p className="text-xs text-muted">
              {t("pages.employees.form.areaProjectsHint")}
            </p>
            {managedProjectIds.map((projectId) => (
              <input
                key={projectId}
                type="hidden"
                name={nameOf("areaManagedProjectIds")}
                value={projectId}
              />
            ))}
            {projects.length > 0 ? (
              <div
                className="mt-2 space-y-2"
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.preventDefault();
                }}
              >
                <DirectorySearchInput
                  value={projectSearch}
                  onChange={setProjectSearch}
                  placeholder={t("pages.employees.form.areaProjectsSearch")}
                  className="max-w-none"
                />
                <p className="text-xs text-subtle">
                  {t("pages.employees.form.areaProjectsSelected", {
                    count: managedProjectIds.length,
                  })}
                </p>
              </div>
            ) : null}
            <div className="mt-2 max-h-56 space-y-2 overflow-y-auto rounded-xl border border-border bg-elevated p-3">
              {projects.length === 0 ? (
                <p className="text-sm text-subtle">
                  {t("pages.employees.form.areaProjectsEmpty")}
                </p>
              ) : visibleProjects.length === 0 ? (
                <p className="text-sm text-subtle">
                  {t("pages.employees.form.areaProjectsNoneMatch", {
                    query: projectSearch.trim(),
                  })}
                </p>
              ) : (
                visibleProjects.map((project) => {
                  const checked = managedProjectIds.includes(project.id);
                  return (
                    <label
                      key={project.id}
                      className="flex items-start gap-2 text-sm text-text"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setManagedProjectIds((prev) =>
                            prev.includes(project.id)
                              ? prev.filter((id) => id !== project.id)
                              : [...prev, project.id]
                          );
                          onFormValuesChange?.();
                        }}
                        className="mt-0.5 size-4 rounded border-border"
                      />
                      <span className="min-w-0">
                        <span className="font-medium">{project.name}</span>
                        {project.clientName ? (
                          <span className="block text-xs text-subtle">
                            {project.clientName}
                            {project.location ? ` · ${project.location}` : ""}
                          </span>
                        ) : project.location ? (
                          <span className="block text-xs text-subtle">
                            {project.location}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  );
                })
              )}
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
            disabled={lockEmploymentType}
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
          <input type="hidden" name={nameOf("employmentType")} value={employmentType} />
          {lockEmploymentType ? (
            <p className="text-xs text-muted">
              {t("pages.employees.form.employmentTypeBulkLocked", {
                type: formatEmploymentTypeLabel(employmentType, locale),
              })}
            </p>
          ) : null}
        </div>

        {isInHouseCleaning ? (
          <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
            <p className="text-xs text-muted">
              {t("pages.employees.form.inHouseCleaningAssignHint")}
            </p>
          </div>
        ) : null}

        {mode === "edit" ? (
          <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
            <label className="text-sm font-medium text-text">
              {t("pages.employees.form.status")}
            </label>
            <p className="text-xs text-muted">
              {status === "ON_LEAVE"
                ? t("pages.employees.form.statusOnLeaveHint")
                : status === "LEAVE_PENDING"
                  ? t("pages.employees.form.statusLeavePendingHint")
                  : t("pages.employees.form.statusActiveHint")}
            </p>
            <div className="flex h-11 items-center rounded-xl border border-border bg-elevated px-3 text-sm font-medium text-text">
              {formatRosterStatusLabel(status, t)}
            </div>
          </div>
        ) : null}

        <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
          <label
            htmlFor={idOf("employee-hired-at")}
            className="text-sm font-medium text-text"
          >
            {t("pages.employees.form.startDate")}
          </label>
          <p className="text-xs text-muted">
            {t("pages.employees.form.startDateHint")}
          </p>
          <Input
            id={idOf("employee-hired-at")}
            name={nameOf("hiredAt")}
            type="date"
            defaultValue={
              formatDateForInput(defaults?.hiredAt) ||
              (mode === "create" ? todayDateInput() : "")
            }
            className={employeeInputClass}
          />
        </div>

        {sharedTermsOnly ? null : (
          <>
        <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
          <label
            htmlFor={idOf("employee-email")}
            className="text-sm font-medium text-text"
          >
            {t("pages.employees.form.contactEmail")}
          </label>
          <Input
            id={idOf("employee-email")}
            name={nameOf("email")}
            placeholder="contact@company.co.id"
            type="email"
            defaultValue={defaults?.email ?? ""}
            className={employeeInputClass}
          />
        </div>
        <PhoneInput
          name={nameOf("phone")}
          defaultValue={defaults?.phone ?? ""}
          onValueChange={() => onFormValuesChange?.()}
          inputClassName={employeeInputClass}
          selectClassName={cn(employeeSelectTriggerClass, "w-[5.5rem] px-3")}
        />
          </>
        )}

        <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
          <label className="text-sm font-medium text-text">
            {t("pages.employees.form.portalLogin")}
          </label>
          <YesNoChoiceCards
            id={idOf("createPortalLogin")}
            value={createPortalLogin}
            onChange={(value) => {
              setCreatePortalLogin(value);
              onFormValuesChange?.();
            }}
          />
          <input type="hidden" name={nameOf("createPortalLogin")} value={createPortalLogin} />
          {isWarehouseStaff ? (
            <p className="text-xs text-muted">
              {t("pages.employees.form.warehouseStaffPortalHint")}
            </p>
          ) : null}
        </div>
      </div>

      <EmployeeFinancesFields
        defaults={defaults}
        positionSuggestsDeposit={defaultSecurityDepositRequired(
          selectedPosition
            ? { slug: selectedPosition.slug, name: selectedPosition.name }
            : null
        )}
        onFormValuesChange={onFormValuesChange}
        includeBankFields={!sharedTermsOnly}
        namePrefix={namePrefix}
        idPrefix={idPrefix}
      />

      {sharedTermsOnly ? null : (
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
          name={nameOf("idDocument")}
          type="file"
          accept="image/*,.pdf"
          className="sr-only"
        />
      </div>
      )}
    </div>
  );
}
