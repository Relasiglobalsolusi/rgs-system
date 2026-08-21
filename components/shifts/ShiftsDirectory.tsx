"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";

import {
  assignEmployeeShift,
  updateProjectShiftWindow,
} from "@/app/shifts/actions";
import ProjectUnassignBackupButton from "@/components/projects/ProjectUnassignBackupButton";
import ProjectUnassignDoubleShiftButton from "@/components/projects/ProjectUnassignDoubleShiftButton";
import ShiftsRemoveShiftChip from "@/components/shifts/ShiftsRemoveShiftChip";
import DirectorySearchInput, {
  matchesDirectorySearch,
} from "@/components/ui/DirectorySearchInput";
import EmptyState from "@/components/ui/EmptyState";
import SectionCard from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/button";
import { showRejectionFromError } from "@/components/ui/rejection-notice";
import {
  employeeSelectTriggerClass,
} from "@/components/employees/employee-dialog-ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useT } from "@/lib/i18n/use-t";
import { formatDateInput } from "@/lib/invoice-period";
import { formatContractPrice } from "@/lib/project-billing";
import {
  findProjectShiftClash,
  formatProjectShiftLabel,
  MIN_PROJECT_SHIFTS,
} from "@/lib/project-shifts";
import { formatEmploymentTypeLabel } from "@/lib/placement";
import { cn } from "@/lib/utils";
import type { EmploymentType } from "@prisma/client";

function toInputDate(value: Date | string) {
  return formatDateInput(value instanceof Date ? value : new Date(value));
}

export type ShiftWindowRow = {
  id: string;
  number: number;
  startTime: string;
  endTime: string;
};

export type ShiftAssignmentRow = {
  id: string;
  shiftId: string | null;
  shiftStart: string | null;
  shiftEnd: string | null;
  employee: {
    id: string;
    employeeNo: string;
    firstName: string;
    lastName: string;
    employmentType: EmploymentType;
  };
};

export type ShiftBackupRow = {
  id: string;
  employeeId: string;
  backupStartDate: Date | string | null;
  backupEndDate: Date | string | null;
  dailyRate: number | null;
  employee: {
    firstName: string;
    lastName: string;
    employeeNo: string;
  };
  shift: {
    number: number;
    startTime: string;
    endTime: string;
  } | null;
  coveredEmployee: {
    firstName: string;
    lastName: string;
  } | null;
};

export type ShiftDoubleRow = {
  id: string;
  employeeId: string;
  date: Date | string;
  coveringShift: {
    number: number;
    startTime: string;
    endTime: string;
  } | null;
  coveredEmployee: {
    firstName: string;
    lastName: string;
  } | null;
};

type Props = {
  project: {
    id: string;
    name: string;
    clientName: string | null;
  } | null;
  shifts: ShiftWindowRow[];
  assignments: ShiftAssignmentRow[];
  backups?: ShiftBackupRow[];
  doubleShifts?: ShiftDoubleRow[];
  toolbar?: ReactNode;
  canAssignCover?: boolean;
  projectMissing?: boolean;
};

function ShiftWindowForm({
  row,
  shifts,
  canRemove,
}: {
  row: ShiftWindowRow;
  shifts: ShiftWindowRow[];
  canRemove: boolean;
}) {
  const { t } = useT();
  const [pending, startTransition] = useTransition();
  const [start, setStart] = useState(row.startTime);
  const [end, setEnd] = useState(row.endTime);
  const dirty = start !== row.startTime || end !== row.endTime;

  function save() {
    const clash = findProjectShiftClash(
      shifts.map((shift) =>
        shift.id === row.id
          ? { number: shift.number, startTime: start, endTime: end }
          : {
              number: shift.number,
              startTime: shift.startTime,
              endTime: shift.endTime,
            }
      )
    );
    if (clash) {
      showRejectionFromError(
        t("pages.shifts.shiftClash", {
          aNumber: clash.a.number,
          aStart: clash.a.startTime,
          aEnd: clash.a.endTime,
          bNumber: clash.b.number,
          bStart: clash.b.startTime,
          bEnd: clash.b.endTime,
        }),
        t("pages.shifts.saveFailed")
      );
      return;
    }
    const formData = new FormData();
    formData.set("startTime", start);
    formData.set("endTime", end);
    startTransition(async () => {
      try {
        await updateProjectShiftWindow(row.id, formData);
      } catch (error) {
        showRejectionFromError(error, t("pages.shifts.saveFailed"));
      }
    });
  }

  return (
    <tr className="border-b border-border last:border-0">
      <td className="w-1/3 px-3 py-3 text-left align-middle font-medium text-text">
        {formatProjectShiftLabel({ number: row.number })}
      </td>
      <td className="w-1/3 px-3 py-3 text-left align-middle">
        <div className="flex flex-wrap items-center justify-start gap-2">
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
      <td className="w-1/3 px-3 py-3 text-center align-middle">
        <div className="flex flex-col items-center justify-center gap-2">
          <Button
            type="button"
            size="badge"
            variant="successBadge"
            disabled={pending || !dirty}
            onClick={save}
          >
            {pending ? t("pages.shifts.saving") : t("pages.shifts.save")}
          </Button>
          {canRemove ? (
            <ShiftsRemoveShiftChip
              shiftId={row.id}
              number={row.number}
              startTime={row.startTime}
              endTime={row.endTime}
            />
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function StaffShiftForm({
  row,
  shifts,
  doubleShifts,
  canAssignCover,
}: {
  row: ShiftAssignmentRow;
  shifts: ShiftWindowRow[];
  doubleShifts: ShiftDoubleRow[];
  canAssignCover: boolean;
}) {
  const { t, locale } = useT();
  const [pending, startTransition] = useTransition();
  const selected = row.shiftId ?? "__none__";
  const name = `${row.employee.firstName} ${row.employee.lastName}`.trim();
  const selectedShift = shifts.find((shift) => shift.id === row.shiftId);
  const covers = doubleShifts.filter(
    (item) => item.employeeId === row.employee.id
  );

  function save(nextId: string) {
    const formData = new FormData();
    formData.set("shiftId", nextId);
    startTransition(async () => {
      try {
        await assignEmployeeShift(row.id, formData);
      } catch (error) {
        showRejectionFromError(error, t("pages.shifts.saveFailed"));
      }
    });
  }

  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-3 py-3 align-middle">
        <div className="font-medium text-text">{name}</div>
        <div className="text-xs text-muted">{row.employee.employeeNo}</div>
        {covers.map((item) => (
          <div key={item.id} className="mt-2">
            <p className="text-xs font-medium text-primary">
              {item.coveringShift && item.coveredEmployee
                ? t("pages.projects.detail.doubleShiftCoverChip", {
                    date: toInputDate(item.date),
                    shift: formatProjectShiftLabel(item.coveringShift),
                    name: `${item.coveredEmployee.firstName} ${item.coveredEmployee.lastName}`.trim(),
                  })
                : t("pages.projects.detail.doubleShiftChip", {
                    date: toInputDate(item.date),
                  })}
            </p>
            {canAssignCover ? (
              <div className="mt-1">
                <ProjectUnassignDoubleShiftButton assignmentId={item.id} />
              </div>
            ) : null}
          </div>
        ))}
      </td>
      <td className="px-3 py-3 align-middle text-sm text-muted">
        {formatEmploymentTypeLabel(row.employee.employmentType, locale)}
      </td>
      <td className="px-3 py-3 align-middle">
        <Select
          value={selected}
          onValueChange={(value) => {
            if (value) save(value);
          }}
          disabled={pending}
        >
          <SelectTrigger className={cn(employeeSelectTriggerClass, "min-w-[16rem]")}>
            <SelectValue>
              {selectedShift
                ? formatProjectShiftLabel(selectedShift)
                : t("pages.shifts.selectShift")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">
              {t("pages.shifts.unassignedShift")}
            </SelectItem>
            {shifts.map((shift) => (
              <SelectItem key={shift.id} value={shift.id}>
                {formatProjectShiftLabel(shift)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
    </tr>
  );
}

export default function ShiftsDirectory({
  project,
  shifts,
  assignments,
  backups = [],
  doubleShifts = [],
  toolbar,
  canAssignCover = false,
  projectMissing = false,
}: Props) {
  const { t } = useT();
  const [query, setQuery] = useState("");

  const visible = useMemo(
    () =>
      assignments.filter((row) =>
        matchesDirectorySearch(
          query,
          `${row.employee.firstName} ${row.employee.lastName}`,
          row.employee.employeeNo
        )
      ),
    [assignments, query]
  );

  if (projectMissing || !project) {
    return (
      <SectionCard>
        <EmptyState
          title={t("pages.shifts.projectNotFoundTitle")}
          description={t("pages.shifts.projectNotFoundDescription")}
        />
      </SectionCard>
    );
  }

  return (
    <div className="space-y-6">
      {toolbar ? (
        <div className="flex flex-wrap items-center gap-2">{toolbar}</div>
      ) : null}

      <SectionCard className="overflow-hidden p-0">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-text">
            {t("pages.shifts.windowsTitle")}
          </h2>
          <p className="mt-1 text-xs text-muted">
            {t("pages.shifts.windowsHint")}
          </p>
        </div>
        {shifts.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted">
            {t("pages.shifts.addShiftEmpty")}
          </div>
        ) : (
          <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
            <table className="w-full min-w-[56rem] table-fixed text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-elevated/60 text-xs uppercase tracking-wide text-muted">
                  <th className="w-1/3 px-3 py-2.5 text-left font-semibold">
                    {t("pages.shifts.columns.shift")}
                  </th>
                  <th className="w-1/3 px-3 py-2.5 text-left font-semibold">
                    {t("pages.shifts.columns.hours")}
                  </th>
                  <th className="w-1/3 px-3 py-2.5 text-center font-semibold">
                    {t("pages.shifts.columns.actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((row) => (
                  <ShiftWindowForm
                    key={row.id}
                    row={row}
                    shifts={shifts}
                    canRemove={shifts.length > MIN_PROJECT_SHIFTS}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-text">
          {t("pages.shifts.rosterTitle")}
        </h2>
        <div className="mb-3">
          <DirectorySearchInput
            value={query}
            onChange={setQuery}
            placeholder={t("pages.shifts.searchEmployeesPlaceholder")}
            className="min-w-[12rem] w-auto max-w-none flex-1"
          />
        </div>

        {visible.length === 0 ? (
          <SectionCard>
            <EmptyState
              title={
                query.trim()
                  ? t("pages.shifts.emptySearch", { query: query.trim() })
                  : t("pages.shifts.emptyStaffTitle")
              }
              description={
                query.trim()
                  ? t("pages.shifts.emptySearchDesc")
                  : t("pages.shifts.emptyStaffDescription")
              }
            />
          </SectionCard>
        ) : (
          <SectionCard className="overflow-hidden p-0">
            <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
              <table className="w-full min-w-[48rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-elevated/60 text-xs uppercase tracking-wide text-muted">
                    <th className="px-3 py-2.5 text-left font-semibold">
                      {t("pages.shifts.columns.employee")}
                    </th>
                    <th className="px-3 py-2.5 text-left font-semibold">
                      {t("pages.shifts.columns.employmentType")}
                    </th>
                    <th className="px-3 py-2.5 text-left font-semibold">
                      {t("pages.shifts.assignShift")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => (
                    <StaffShiftForm
                      key={row.id}
                      row={row}
                      shifts={shifts}
                      doubleShifts={doubleShifts}
                      canAssignCover={canAssignCover}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        )}
      </div>

      {backups.length > 0 ? (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-text">
            {t("pages.shifts.backupTitle")}
          </h2>
          <SectionCard className="overflow-hidden p-0">
            <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
              <table className="w-full min-w-[48rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-elevated/60 text-xs uppercase tracking-wide text-muted">
                    <th className="px-3 py-2.5 text-left font-semibold">
                      {t("pages.shifts.columns.employee")}
                    </th>
                    <th className="px-3 py-2.5 text-left font-semibold">
                      {t("pages.projects.backupCover")}
                    </th>
                    <th className="px-3 py-2.5 text-center font-semibold">
                      {t("pages.shifts.columns.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {backups.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-3 py-3 align-middle">
                        <div className="font-medium text-text">
                          {row.employee.firstName} {row.employee.lastName}
                        </div>
                        <div className="text-xs text-muted">
                          {row.employee.employeeNo}
                        </div>
                      </td>
                      <td className="px-3 py-3 align-middle text-sm text-muted">
                        {row.shift && row.coveredEmployee
                          ? t("pages.projects.detail.backupCoverChip", {
                              start: row.backupStartDate
                                ? toInputDate(row.backupStartDate)
                                : "—",
                              end: row.backupEndDate
                                ? toInputDate(row.backupEndDate)
                                : "—",
                              rate: formatContractPrice(row.dailyRate),
                              shift: formatProjectShiftLabel(row.shift),
                              name: `${row.coveredEmployee.firstName} ${row.coveredEmployee.lastName}`.trim(),
                            })
                          : "—"}
                      </td>
                      <td className="px-3 py-3 text-center align-middle">
                        {canAssignCover ? (
                          <ProjectUnassignBackupButton
                            projectId={project.id}
                            employeeId={row.employeeId}
                          />
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      ) : null}
    </div>
  );
}
