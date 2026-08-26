"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UsersRound } from "lucide-react";

import {
  createOperationsTeam,
  updateOperationsTeam,
} from "@/app/teams/actions";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  EmployeeSecondaryButton,
  employeeDialogFieldClass,
  employeeDialogFormClass,
  employeeDialogLabelClass,
  employeeInputClass,
  employeeSelectTriggerClass,
} from "@/components/employees/employee-dialog-ui";
import { Dialog } from "@/components/ui/dialog";
import { showRejectionFromError } from "@/components/ui/rejection-notice";
import { useT } from "@/lib/i18n/use-t";
import type { TeamEquipmentOption } from "@/components/teams/TeamEquipmentDialog";
import type { EligibleEmployeeRow } from "@/components/teams/TeamMembersDialog";
import DirectoryFilterTab from "@/components/ui/DirectoryFilterTab";
import DirectorySearchInput, {
  matchesDirectorySearch,
} from "@/components/ui/DirectorySearchInput";
import { localizeDepartmentLabel } from "@/lib/i18n/labels";
import { catalogDisplayName } from "@/lib/project-service-catalog";
import { DEFAULT_WORKFORCE_DEPARTMENTS } from "@/lib/positions";

export type TeamTypeOption = {
  id: string;
  nameEn: string;
  nameId: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalog: TeamTypeOption[];
  eligible?: EligibleEmployeeRow[];
  equipmentAssets?: TeamEquipmentOption[];
  team?: {
    id: string;
    name: string;
    serviceAreaCatalogId: string | null;
  } | null;
};

export default function TeamFormDialog({
  open,
  onOpenChange,
  catalog,
  eligible = [],
  equipmentAssets = [],
  team,
}: Props) {
  const { t, locale } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const defaultTypeId = team?.serviceAreaCatalogId || catalog[0]?.id || "";
  const [name, setName] = useState(team?.name ?? "");
  const [serviceAreaCatalogId, setServiceAreaCatalogId] = useState(defaultTypeId);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [assetIds, setAssetIds] = useState<string[]>([]);
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [equipmentQuery, setEquipmentQuery] = useState("");
  const isEdit = Boolean(team);

  const departmentOptions = useMemo(() => {
    const bySlug = new Map<string, { slug: string; name: string }>();
    for (const item of DEFAULT_WORKFORCE_DEPARTMENTS) {
      bySlug.set(item.slug, { slug: item.slug, name: item.name });
    }
    for (const employee of eligible) {
      const slug = employee.categorySlug?.trim();
      if (!slug) continue;
      if (!bySlug.has(slug)) {
        bySlug.set(slug, {
          slug,
          name: employee.categoryName?.trim() || slug,
        });
      }
    }
    return [...bySlug.values()];
  }, [eligible]);

  const visibleEmployees = useMemo(() => {
    const departmentFiltered =
      departmentFilter === "all"
        ? eligible
        : eligible.filter((employee) => employee.categorySlug === departmentFilter);
    const trimmed = employeeQuery.trim();
    if (!trimmed) return departmentFiltered;
    return departmentFiltered.filter((employee) =>
      matchesDirectorySearch(
        trimmed,
        employee.firstName,
        employee.lastName,
        employee.employeeNo
      )
    );
  }, [departmentFilter, eligible, employeeQuery]);

  const visibleEquipment = useMemo(() => {
    const trimmed = equipmentQuery.trim();
    if (!trimmed) return equipmentAssets;
    return equipmentAssets.filter((asset) =>
      matchesDirectorySearch(trimmed, asset.assetCode, asset.itemName)
    );
  }, [equipmentAssets, equipmentQuery]);

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (next) {
      setName(team?.name ?? "");
      setServiceAreaCatalogId(
        team?.serviceAreaCatalogId || catalog[0]?.id || ""
      );
      setMemberIds([]);
      setAssetIds([]);
      setDepartmentFilter("all");
      setEmployeeQuery("");
      setEquipmentQuery("");
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData();
    formData.set("name", name);
    formData.set("serviceAreaCatalogId", serviceAreaCatalogId);
    for (const id of memberIds) formData.append("employeeIds", id);
    for (const id of assetIds) formData.append("assetIds", id);
    if (team) formData.set("teamId", team.id);
    startTransition(async () => {
      try {
        if (isEdit) {
          await updateOperationsTeam(formData);
        } else {
          await createOperationsTeam(formData);
        }
        router.refresh();
        onOpenChange(false);
      } catch (error) {
        showRejectionFromError(
          error,
          isEdit ? t("pages.teams.updateFailed") : t("pages.teams.createFailed")
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <EmployeeDialogShell
        icon={UsersRound}
        title={isEdit ? t("pages.teams.editTeam") : t("pages.teams.addTeam")}
        description={t("pages.teams.assignmentDescription")}
        maxWidth={isEdit ? "sm" : "lg"}
        footer={
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-end">
            <EmployeeSecondaryButton
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              {t("common.actions.cancel")}
            </EmployeeSecondaryButton>
            <EmployeePrimaryButton
              form="team-form"
              disabled={pending || catalog.length === 0}
            >
              {pending
                ? t("common.actions.saving")
                : isEdit
                  ? t("common.actions.save")
                  : t("pages.teams.addTeam")}
            </EmployeePrimaryButton>
          </div>
        }
      >
        <form id="team-form" className={employeeDialogFormClass} onSubmit={handleSubmit}>
          <div className={employeeDialogFieldClass}>
            <label className={employeeDialogLabelClass} htmlFor="team-name">
              {t("pages.teams.name")}
            </label>
            <input
              id="team-name"
              className={employeeInputClass}
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              disabled={pending}
            />
          </div>
          <div className={employeeDialogFieldClass}>
            <label className={employeeDialogLabelClass} htmlFor="team-kind">
              {t("pages.teams.kind")}
            </label>
            <select
              id="team-kind"
              className={employeeSelectTriggerClass}
              value={serviceAreaCatalogId}
              onChange={(event) => setServiceAreaCatalogId(event.target.value)}
              disabled={pending || catalog.length === 0}
              required
            >
              {catalog.map((area) => (
                <option key={area.id} value={area.id}>
                  {catalogDisplayName(area, locale)}
                </option>
              ))}
            </select>
          </div>
          {!isEdit ? (
            <>
              <div className={employeeDialogFieldClass}>
                <p className={employeeDialogLabelClass}>
                  {t("pages.teams.assignMembersOnCreate")}
                </p>
                <div
                  className="flex flex-wrap items-center gap-2"
                  role="group"
                  aria-label={t("common.labels.department")}
                >
                  <DirectoryFilterTab
                    size="sm"
                    active={departmentFilter === "all"}
                    count={eligible.length}
                    onClick={() => setDepartmentFilter("all")}
                  >
                    {t("pages.teams.filterAll")}
                  </DirectoryFilterTab>
                  {departmentOptions.map((category) => (
                    <DirectoryFilterTab
                      key={category.slug}
                      size="sm"
                      active={departmentFilter === category.slug}
                      count={
                        eligible.filter(
                          (employee) => employee.categorySlug === category.slug
                        ).length
                      }
                      onClick={() => setDepartmentFilter(category.slug)}
                    >
                      {localizeDepartmentLabel(category.slug, category.name)}
                    </DirectoryFilterTab>
                  ))}
                </div>
                <DirectorySearchInput
                  value={employeeQuery}
                  onChange={setEmployeeQuery}
                  placeholder={t("pages.teams.searchEmployees")}
                />
                <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-border p-3">
                  {visibleEmployees.length === 0 ? (
                    <p className="text-xs text-subtle">
                      {t("pages.teams.noEligibleMembers")}
                    </p>
                  ) : (
                    visibleEmployees.map((employee) => {
                      const checked = memberIds.includes(employee.id);
                      return (
                        <label
                          key={employee.id}
                          className="flex items-center gap-2 text-sm text-text"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={pending}
                            onChange={(event) => {
                              setMemberIds((current) =>
                                event.target.checked
                                  ? [...current, employee.id]
                                  : current.filter((id) => id !== employee.id)
                              );
                            }}
                          />
                          <span>
                            {employee.firstName} {employee.lastName} ·{" "}
                            {employee.employeeNo}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
              <div className={employeeDialogFieldClass}>
                <p className={employeeDialogLabelClass}>
                  {t("pages.teams.assignEquipmentOnCreate")}
                </p>
                <DirectorySearchInput
                  value={equipmentQuery}
                  onChange={setEquipmentQuery}
                  placeholder={t("pages.teams.searchEquipment")}
                />
                <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-border p-3">
                  {visibleEquipment.length === 0 ? (
                    <p className="text-xs text-subtle">
                      {t("pages.teams.noEquipment")}
                    </p>
                  ) : (
                    visibleEquipment.map((asset) => {
                      const checked = assetIds.includes(asset.id);
                      return (
                        <label
                          key={asset.id}
                          className="flex items-center gap-2 text-sm text-text"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={pending}
                            onChange={(event) => {
                              setAssetIds((current) =>
                                event.target.checked
                                  ? [...current, asset.id]
                                  : current.filter((id) => id !== asset.id)
                              );
                            }}
                          />
                          <span>
                            {asset.assetCode} · {asset.itemName}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          ) : null}
        </form>
      </EmployeeDialogShell>
    </Dialog>
  );
}
