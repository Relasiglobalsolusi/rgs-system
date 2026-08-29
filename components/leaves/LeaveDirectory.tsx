"use client";

import { useMemo, useState } from "react";
import { CalendarDays, CircleCheck, Clock, HeartPulse } from "lucide-react";

import LeaveDialog from "@/components/leaves/LeaveDialog";
import LeaveRequestTable, {
  type LeaveRequestRow,
} from "@/components/leaves/LeaveRequestTable";
import DirectoryFilterTab from "@/components/ui/DirectoryFilterTab";
import DirectoryStatCard from "@/components/ui/DirectoryStatCard";
import DirectoryStatGrid from "@/components/ui/DirectoryStatGrid";
import EmptyState from "@/components/ui/EmptyState";
import SectionCard from "@/components/ui/SectionCard";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

type TypeFilter = "all" | "PERMISSION" | "SICK";
type StatusFilter = "all" | "PENDING" | "APPROVED";

type Props = {
  data: LeaveRequestRow[];
  showEmployee: boolean;
  canSubmit: boolean;
};

function matchesStatus(row: LeaveRequestRow, statusFilter: StatusFilter) {
  return statusFilter === "all" || row.status === statusFilter;
}

export default function LeaveDirectory({
  data,
  showEmployee,
  canSubmit,
}: Props) {
  const { t } = useT();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const permissionAll = useMemo(
    () => data.filter((row) => row.type === "PERMISSION"),
    [data]
  );
  const sickAll = useMemo(
    () => data.filter((row) => row.type === "SICK"),
    [data]
  );
  const pendingCount = useMemo(
    () => data.filter((row) => row.status === "PENDING").length,
    [data]
  );
  const approvedCount = useMemo(
    () => data.filter((row) => row.status === "APPROVED").length,
    [data]
  );

  const permissionRows = useMemo(
    () => permissionAll.filter((row) => matchesStatus(row, statusFilter)),
    [permissionAll, statusFilter]
  );
  const sickRows = useMemo(
    () => sickAll.filter((row) => matchesStatus(row, statusFilter)),
    [sickAll, statusFilter]
  );

  const showPermission = typeFilter === "all" || typeFilter === "PERMISSION";
  const showSick = typeFilter === "all" || typeFilter === "SICK";
  const isFiltered = typeFilter !== "all" || statusFilter !== "all";

  function toggleType(next: Exclude<TypeFilter, "all">) {
    setTypeFilter((current) => (current === next ? "all" : next));
  }

  function toggleStatus(next: Exclude<StatusFilter, "all">) {
    setStatusFilter((current) => (current === next ? "all" : next));
  }

  function emptyTitle(kind: "PERMISSION" | "SICK") {
    if (isFiltered) return t("pages.leaves.emptyFilteredTitle");
    return kind === "SICK"
      ? t("pages.leaves.emptySickTitle")
      : t("pages.leaves.emptyPermissionTitle");
  }

  function emptyDescription(kind: "PERMISSION" | "SICK") {
    if (isFiltered) return t("pages.leaves.emptyFilteredDescription");
    if (kind === "SICK") {
      return canSubmit
        ? t("pages.leaves.emptySickDescriptionEmployee")
        : t("pages.leaves.emptySickDescriptionManager");
    }
    return canSubmit
      ? t("pages.leaves.emptyPermissionDescriptionEmployee")
      : t("pages.leaves.emptyPermissionDescriptionManager");
  }

  return (
    <div className="space-y-6">
      <DirectoryStatGrid gapClassName="gap-2.5">
        <DirectoryStatCard
          compact
          title={t("pages.leaves.stats.permissionTitle")}
          value={permissionAll.length}
          subtitle={t("pages.leaves.stats.permissionSubtitle")}
          icon={<CalendarDays size={15} />}
          accent="success"
          selected={typeFilter === "PERMISSION"}
          onClick={() => toggleType("PERMISSION")}
        />
        <DirectoryStatCard
          compact
          title={t("pages.leaves.stats.sickTitle")}
          value={sickAll.length}
          subtitle={t("pages.leaves.stats.sickSubtitle")}
          icon={<HeartPulse size={15} />}
          accent="warning"
          selected={typeFilter === "SICK"}
          onClick={() => toggleType("SICK")}
        />
        <DirectoryStatCard
          compact
          title={t("pages.leaves.stats.pendingTitle")}
          value={pendingCount}
          subtitle={t("pages.leaves.stats.pendingSubtitle")}
          icon={<Clock size={15} />}
          accent="warning"
          selected={statusFilter === "PENDING"}
          onClick={() => toggleStatus("PENDING")}
        />
        <DirectoryStatCard
          compact
          title={t("pages.leaves.stats.approvedTitle")}
          value={approvedCount}
          subtitle={t("pages.leaves.stats.approvedSubtitle")}
          icon={<CircleCheck size={15} />}
          accent="success"
          selected={statusFilter === "APPROVED"}
          onClick={() => toggleStatus("APPROVED")}
        />
      </DirectoryStatGrid>

      <div className="flex flex-wrap items-center gap-2">
        <DirectoryFilterTab
          size="sm"
          active={typeFilter === "all"}
          count={data.length}
          onClick={() => setTypeFilter("all")}
        >
          {t("pages.leaves.filterAll")}
        </DirectoryFilterTab>
        <DirectoryFilterTab
          size="sm"
          active={typeFilter === "PERMISSION"}
          count={permissionAll.length}
          onClick={() => toggleType("PERMISSION")}
        >
          {t("pages.leaves.permissionSection")}
        </DirectoryFilterTab>
        <DirectoryFilterTab
          size="sm"
          active={typeFilter === "SICK"}
          count={sickAll.length}
          onClick={() => toggleType("SICK")}
        >
          {t("pages.leaves.sickSection")}
        </DirectoryFilterTab>
        {canSubmit ? (
          <div className="w-full sm:ml-auto sm:w-auto">
            <LeaveDialog />
          </div>
        ) : null}
      </div>

      <div className="space-y-6">
        {showPermission ? (
          <LeaveTypeSection
            kind="PERMISSION"
            title={t("pages.leaves.permissionSection")}
            description={t("pages.leaves.permissionSectionDesc")}
            countLabel={t("pages.leaves.requestCount", {
              count: permissionRows.length,
            })}
            emptyTitle={emptyTitle("PERMISSION")}
            emptyDescription={emptyDescription("PERMISSION")}
            rows={permissionRows}
            showEmployee={showEmployee}
          />
        ) : null}

        {showSick ? (
          <LeaveTypeSection
            kind="SICK"
            title={t("pages.leaves.sickSection")}
            description={t("pages.leaves.sickSectionDesc")}
            countLabel={t("pages.leaves.requestCount", {
              count: sickRows.length,
            })}
            emptyTitle={emptyTitle("SICK")}
            emptyDescription={emptyDescription("SICK")}
            rows={sickRows}
            showEmployee={showEmployee}
          />
        ) : null}
      </div>
    </div>
  );
}

function LeaveTypeSection({
  kind,
  title,
  description,
  countLabel,
  emptyTitle,
  emptyDescription,
  rows,
  showEmployee,
}: {
  kind: "PERMISSION" | "SICK";
  title: string;
  description: string;
  countLabel: string;
  emptyTitle: string;
  emptyDescription: string;
  rows: LeaveRequestRow[];
  showEmployee: boolean;
}) {
  const isSick = kind === "SICK";
  const Icon = isSick ? HeartPulse : CalendarDays;

  return (
    <SectionCard
      id={isSick ? "leave-sick" : "leave-permission"}
      className={cn(
        "p-5 sm:p-6",
        isSick ? "border-warning/25" : "border-primary/25"
      )}
    >
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-elevated",
              isSick ? "text-warning" : "text-primary"
            )}
          >
            <Icon size={18} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-text">{title}</h2>
            <p className="mt-1 text-sm text-subtle">{description}</p>
          </div>
        </div>
        <p className="text-sm tabular-nums text-muted">{countLabel}</p>
      </div>

      {rows.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <LeaveRequestTable
          data={rows}
          showEmployee={showEmployee}
          hideType
        />
      )}
    </SectionCard>
  );
}
