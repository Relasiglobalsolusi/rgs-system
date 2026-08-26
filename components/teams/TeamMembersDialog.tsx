"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";

import {
  addOperationsTeamMember,
  removeOperationsTeamMember,
} from "@/app/teams/actions";
import {
  EmployeeDialogShell,
  employeeDialogFieldClass,
  employeeDialogFormClass,
  employeeDialogLabelClass,
  employeeSelectTriggerClass,
} from "@/components/employees/employee-dialog-ui";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import DirectoryFilterTab from "@/components/ui/DirectoryFilterTab";
import DirectorySearchInput, {
  matchesDirectorySearch,
} from "@/components/ui/DirectorySearchInput";
import { showRejectionFromError } from "@/components/ui/rejection-notice";
import { localizeDepartmentLabel } from "@/lib/i18n/labels";
import { useT } from "@/lib/i18n/use-t";
import { DEFAULT_WORKFORCE_DEPARTMENTS } from "@/lib/positions";

export type TeamMemberRow = {
  employeeId: string;
  firstName: string;
  lastName: string;
  employeeNo: string;
};

export type EligibleEmployeeRow = {
  id: string;
  firstName: string;
  lastName: string;
  employeeNo: string;
  categoryId: string | null;
  categorySlug: string | null;
  categoryName: string | null;
};

const ALL_DEPARTMENTS = "all";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  teamName: string;
  members: TeamMemberRow[];
  eligible: EligibleEmployeeRow[];
};

function employeeLabel(employee: EligibleEmployeeRow) {
  return `${employee.firstName} ${employee.lastName} · ${employee.employeeNo}`;
}

export default function TeamMembersDialog({
  open,
  onOpenChange,
  teamId,
  teamName,
  members,
  eligible,
}: Props) {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [employeeId, setEmployeeId] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState(ALL_DEPARTMENTS);
  const [query, setQuery] = useState("");

  const departmentOptions = useMemo(() => {
    const bySlug = new Map<
      string,
      { id: string; slug: string; name: string }
    >();
    for (const item of DEFAULT_WORKFORCE_DEPARTMENTS) {
      bySlug.set(item.slug, { id: item.slug, slug: item.slug, name: item.name });
    }
    for (const employee of eligible) {
      const slug = employee.categorySlug?.trim();
      if (!slug) continue;
      if (!bySlug.has(slug)) {
        bySlug.set(slug, {
          id: slug,
          slug,
          name: employee.categoryName?.trim() || slug,
        });
      }
    }
    const defaults = DEFAULT_WORKFORCE_DEPARTMENTS.map((item) =>
      bySlug.get(item.slug)
    ).filter((item): item is { id: string; slug: string; name: string } =>
      Boolean(item)
    );
    const extras = [...bySlug.values()]
      .filter(
        (item) =>
          !DEFAULT_WORKFORCE_DEPARTMENTS.some((dept) => dept.slug === item.slug)
      )
      .sort((a, b) => a.name.localeCompare(b.name, "en"));
    return [...defaults, ...extras];
  }, [eligible]);

  const departmentFiltered = useMemo(() => {
    if (departmentFilter === ALL_DEPARTMENTS) return eligible;
    return eligible.filter(
      (employee) => employee.categorySlug === departmentFilter
    );
  }, [departmentFilter, eligible]);

  const visible = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return departmentFiltered;
    return departmentFiltered.filter((employee) =>
      matchesDirectorySearch(
        trimmed,
        employee.firstName,
        employee.lastName,
        employee.employeeNo
      )
    );
  }, [departmentFiltered, query]);

  function handleAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!employeeId) return;
    const formData = new FormData();
    formData.set("teamId", teamId);
    formData.set("employeeId", employeeId);
    startTransition(async () => {
      try {
        await addOperationsTeamMember(formData);
        setEmployeeId("");
        router.refresh();
      } catch (error) {
        showRejectionFromError(error, t("pages.teams.addMemberFailed"));
      }
    });
  }

  function handleRemove(id: string) {
    const formData = new FormData();
    formData.set("teamId", teamId);
    formData.set("employeeId", id);
    startTransition(async () => {
      try {
        await removeOperationsTeamMember(formData);
        router.refresh();
      } catch (error) {
        showRejectionFromError(error, t("pages.teams.removeMemberFailed"));
      }
    });
  }

  const emptyMessage =
    eligible.length === 0
      ? t("pages.teams.emptyEligible")
      : departmentFiltered.length === 0
        ? t("pages.teams.emptyEligibleFiltered")
        : t("pages.teams.emptyEligibleSearch");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <EmployeeDialogShell
        icon={Users}
        title={t("pages.teams.members")}
        description={teamName}
        maxWidth="md"
        footer={
          <div className="flex justify-end">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t("common.actions.done")}
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          <form className={employeeDialogFormClass} onSubmit={handleAdd}>
            <div className={employeeDialogFieldClass}>
              <label className={employeeDialogLabelClass} htmlFor="team-add-member">
                {t("pages.teams.addMember")}
              </label>
              <div
                className="flex flex-wrap items-center gap-2"
                role="group"
                aria-label={t("common.labels.department")}
              >
                <DirectoryFilterTab
                  size="sm"
                  active={departmentFilter === ALL_DEPARTMENTS}
                  count={eligible.length}
                  onClick={() => {
                    setDepartmentFilter(ALL_DEPARTMENTS);
                    setEmployeeId("");
                  }}
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
                    onClick={() => {
                      setDepartmentFilter(category.slug);
                      setEmployeeId("");
                    }}
                  >
                    {localizeDepartmentLabel(category.slug, category.name)}
                  </DirectoryFilterTab>
                ))}
              </div>
              <DirectorySearchInput
                value={query}
                onChange={(value) => {
                  setQuery(value);
                  setEmployeeId("");
                }}
                placeholder={t("pages.teams.searchEmployees")}
                className="max-w-none"
              />
              {visible.length === 0 ? (
                <p className="text-sm text-muted">{emptyMessage}</p>
              ) : (
                <div className="flex gap-2">
                  <select
                    id="team-add-member"
                    className={employeeSelectTriggerClass}
                    value={employeeId}
                    onChange={(event) => setEmployeeId(event.target.value)}
                    disabled={pending}
                  >
                    <option value="">{t("common.actions.select")}</option>
                    {visible.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employeeLabel(employee)}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="submit"
                    variant="successBadge"
                    size="badgeFlex"
                    disabled={pending || !employeeId}
                  >
                    {t("common.actions.add")}
                  </Button>
                </div>
              )}
            </div>
          </form>

          {members.length === 0 ? (
            <p className="text-sm text-muted">{t("pages.teams.emptyMembers")}</p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {members.map((member) => (
                <li
                  key={member.employeeId}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-text">
                      {member.firstName} {member.lastName}
                    </p>
                    <p className="font-mono text-xs text-muted">{member.employeeNo}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => handleRemove(member.employeeId)}
                  >
                    {t("common.actions.remove")}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </EmployeeDialogShell>
    </Dialog>
  );
}
