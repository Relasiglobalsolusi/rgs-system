"use client";

import { useMemo, useState, useTransition } from "react";

import { updateAssignmentShift } from "@/app/shifts/actions";
import DirectorySearchInput, {
  matchesDirectorySearch,
} from "@/components/ui/DirectorySearchInput";
import EmptyState from "@/components/ui/EmptyState";
import SectionCard from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/button";
import { showRejectionFromError } from "@/components/ui/rejection-notice";
import { useT } from "@/lib/i18n/use-t";
import { formatEmploymentTypeLabel } from "@/lib/placement";
import { cn } from "@/lib/utils";
import type { EmploymentType } from "@prisma/client";

export type ShiftAssignmentRow = {
  id: string;
  shiftStart: string | null;
  shiftEnd: string | null;
  employee: {
    id: string;
    employeeNo: string;
    firstName: string;
    lastName: string;
    employmentType: EmploymentType;
  };
  project: {
    id: string;
    name: string;
    status: string;
    client: { name: string } | null;
  };
};

type Props = {
  assignments: ShiftAssignmentRow[];
};

function ShiftRowForm({ row }: { row: ShiftAssignmentRow }) {
  const { t, locale } = useT();
  const [pending, startTransition] = useTransition();
  const [start, setStart] = useState(row.shiftStart ?? "");
  const [end, setEnd] = useState(row.shiftEnd ?? "");

  const dirty =
    (start || "") !== (row.shiftStart ?? "") ||
    (end || "") !== (row.shiftEnd ?? "");

  function save() {
    const formData = new FormData();
    formData.set("shiftStart", start);
    formData.set("shiftEnd", end);
    startTransition(async () => {
      try {
        await updateAssignmentShift(row.id, formData);
      } catch (error) {
        showRejectionFromError(error, t("pages.shifts.saveFailed"));
      }
    });
  }

  function clear() {
    setStart("");
    setEnd("");
    const formData = new FormData();
    formData.set("shiftStart", "");
    formData.set("shiftEnd", "");
    startTransition(async () => {
      try {
        await updateAssignmentShift(row.id, formData);
      } catch (error) {
        showRejectionFromError(error, t("pages.shifts.saveFailed"));
      }
    });
  }

  const name = `${row.employee.firstName} ${row.employee.lastName}`.trim();

  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-3 py-3 align-middle">
        <div className="font-medium text-text">{name}</div>
        <div className="text-xs text-muted">{row.employee.employeeNo}</div>
      </td>
      <td className="px-3 py-3 align-middle text-sm text-muted">
        {formatEmploymentTypeLabel(row.employee.employmentType, locale)}
      </td>
      <td className="px-3 py-3 align-middle">
        <div className="text-sm text-text">{row.project.name}</div>
        <div className="text-xs text-muted">
          {row.project.client?.name ?? "—"}
        </div>
      </td>
      <td className="px-3 py-3 align-middle">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="time"
            value={start}
            onChange={(event) => setStart(event.target.value)}
            className="h-9 rounded-lg border border-border bg-elevated px-2 text-sm text-text"
            aria-label={t("pages.shifts.shiftStart")}
          />
          <span className="text-muted">–</span>
          <input
            type="time"
            value={end}
            onChange={(event) => setEnd(event.target.value)}
            className="h-9 rounded-lg border border-border bg-elevated px-2 text-sm text-text"
            aria-label={t("pages.shifts.shiftEnd")}
          />
        </div>
      </td>
      <td className="px-3 py-3 align-middle">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="badge"
            variant="successBadge"
            disabled={pending || !dirty}
            onClick={save}
          >
            {pending ? t("pages.shifts.saving") : t("pages.shifts.save")}
          </Button>
          {row.shiftStart || row.shiftEnd || start || end ? (
            <Button
              type="button"
              size="badge"
              variant="ghost"
              disabled={pending}
              onClick={clear}
            >
              {t("pages.shifts.clear")}
            </Button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

export default function ShiftsDirectory({ assignments }: Props) {
  const { t } = useT();
  const [query, setQuery] = useState("");

  const visible = useMemo(
    () =>
      assignments.filter((row) =>
        matchesDirectorySearch(
          query,
          `${row.employee.firstName} ${row.employee.lastName}`,
          row.employee.employeeNo,
          row.project.name,
          row.project.client?.name
        )
      ),
    [assignments, query]
  );

  return (
    <>
      <div className="mb-3">
        <DirectorySearchInput
          value={query}
          onChange={setQuery}
          placeholder={t("pages.shifts.searchPlaceholder")}
          className="min-w-[12rem] w-auto max-w-none flex-1"
        />
      </div>

      {visible.length === 0 ? (
        <SectionCard>
          <EmptyState
            title={
              query.trim()
                ? t("pages.shifts.emptySearch", { query: query.trim() })
                : t("pages.shifts.emptyTitle")
            }
            description={
              query.trim()
                ? t("pages.shifts.emptySearchDesc")
                : t("pages.shifts.emptyDescription")
            }
          />
        </SectionCard>
      ) : (
        <SectionCard className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-elevated/60 text-xs uppercase tracking-wide text-muted">
                  <th className="px-3 py-2.5 font-semibold">
                    {t("pages.shifts.columns.employee")}
                  </th>
                  <th className="px-3 py-2.5 font-semibold">
                    {t("pages.shifts.columns.employmentType")}
                  </th>
                  <th className="px-3 py-2.5 font-semibold">
                    {t("pages.shifts.columns.project")}
                  </th>
                  <th className="px-3 py-2.5 font-semibold">
                    {t("pages.shifts.columns.shift")}
                  </th>
                  <th
                    className={cn(
                      "px-3 py-2.5 font-semibold",
                      "w-[1%] whitespace-nowrap"
                    )}
                  >
                    {t("pages.shifts.columns.actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <ShiftRowForm key={row.id} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </>
  );
}
