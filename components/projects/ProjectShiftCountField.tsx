"use client";

import { useEffect, useState } from "react";

import {
  employeeDialogFieldClass,
  employeeDialogHintClass,
  employeeInputClass,
  employeeSelectTriggerClass,
} from "@/components/employees/employee-dialog-ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_NEW_PROJECT_SHIFTS,
  MAX_PROJECT_SHIFTS,
  MIN_PROJECT_SHIFTS,
  mergeShiftWindows,
  type ProjectShiftWindow,
} from "@/lib/project-shifts";
import { useT } from "@/lib/i18n/use-t";

export default function ProjectShiftCountField({
  name = "shiftCount",
  namePrefix = "",
  value,
  onChange,
  windows: initialWindows,
  disabled = false,
}: {
  name?: string;
  namePrefix?: string;
  value: number;
  onChange: (next: number) => void;
  windows?: ProjectShiftWindow[];
  disabled?: boolean;
}) {
  const { t } = useT();
  const selected = Math.min(
    MAX_PROJECT_SHIFTS,
    Math.max(MIN_PROJECT_SHIFTS, value || DEFAULT_NEW_PROJECT_SHIFTS)
  );
  const [windows, setWindows] = useState<ProjectShiftWindow[]>(() =>
    mergeShiftWindows(selected, initialWindows)
  );

  useEffect(() => {
    setWindows((current) => mergeShiftWindows(selected, current));
  }, [selected]);

  function countLabel(count: number) {
    return count === 1
      ? t("pages.projects.shiftCountOptionOne")
      : t("pages.projects.shiftCountOption", { count });
  }

  function fieldName(field: string) {
    return namePrefix ? `${namePrefix}${field}` : field;
  }

  function setWindowTime(
    number: number,
    key: "startTime" | "endTime",
    raw: string
  ) {
    const match = raw.match(/^(\d{2}):(\d{2})/);
    const next = match ? `${match[1]}:${match[2]}` : raw;
    setWindows((current) =>
      current.map((row) =>
        row.number === number ? { ...row, [key]: next } : row
      )
    );
  }

  return (
    <div className="space-y-3">
      <div className={employeeDialogFieldClass}>
        <input type="hidden" name={name} value={String(selected)} />
        <label className="text-sm font-medium text-text">
          {t("pages.projects.shiftCount")}
        </label>
        <Select
          value={String(selected)}
          onValueChange={(next) => {
            const parsed = Number(next);
            if (Number.isInteger(parsed)) onChange(parsed);
          }}
          disabled={disabled}
        >
          <SelectTrigger className={employeeSelectTriggerClass}>
            <SelectValue>{countLabel(selected)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Array.from(
              { length: MAX_PROJECT_SHIFTS - MIN_PROJECT_SHIFTS + 1 },
              (_, index) => MIN_PROJECT_SHIFTS + index
            ).map((count) => (
              <SelectItem key={count} value={String(count)}>
                {countLabel(count)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className={employeeDialogHintClass}>
          {t("pages.projects.shiftCountHint")}
        </p>
      </div>

      {windows.map((window) => (
        <div key={window.number} className={employeeDialogFieldClass}>
          <input
            type="hidden"
            name={fieldName(`shiftStart.${window.number}`)}
            value={window.startTime}
          />
          <input
            type="hidden"
            name={fieldName(`shiftEnd.${window.number}`)}
            value={window.endTime}
          />
          <label className="text-sm font-medium text-text">
            {t("pages.projects.shiftWindowLabel", { number: window.number })}
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="time"
              required
              disabled={disabled}
              value={window.startTime}
              onChange={(event) =>
                setWindowTime(window.number, "startTime", event.target.value)
              }
              className={employeeInputClass}
              aria-label={t("pages.projects.shiftWindowStart", {
                number: window.number,
              })}
            />
            <span className="text-muted">–</span>
            <input
              type="time"
              required
              disabled={disabled}
              value={window.endTime}
              onChange={(event) =>
                setWindowTime(window.number, "endTime", event.target.value)
              }
              className={employeeInputClass}
              aria-label={t("pages.projects.shiftWindowEnd", {
                number: window.number,
              })}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
