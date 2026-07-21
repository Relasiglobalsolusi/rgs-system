"use client";

import { Input } from "@/components/ui/input";
import {
  employeeDialogFieldClass,
  employeeInputClass,
} from "@/components/employees/employee-dialog-ui";
import {
  CONTRACT_DURATION_PRESETS,
  PROJECT_DURATION_DAY_OPTIONS,
  addDaysToDateInput,
  addMonthsToDateInput,
  clampProjectDurationDays,
} from "@/lib/project-contract";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

type ContractProps = {
  mode: "contract";
  startDate: string;
  durationMonths: number;
  onStartDateChange: (value: string) => void;
  onDurationMonthsChange: (value: number) => void;
  /** Planning: estimated contract start; In Progress: real contract start. */
  planning?: boolean;
};

type StandardProps = {
  mode: "standard";
  startDate: string;
  durationDays: number;
  onStartDateChange: (value: string) => void;
  onDurationDaysChange: (value: number) => void;
  /** Planning: estimated job start; In Progress: real job start. */
  planning?: boolean;
};

type Props = ContractProps | StandardProps;

function ContractTimelineFields({
  startDate,
  durationMonths,
  onStartDateChange,
  onDurationMonthsChange,
  planning,
}: Omit<ContractProps, "mode">) {
  const { t } = useT();
  const endDate = addMonthsToDateInput(startDate, durationMonths);
  const startLabel = t("pages.projects.timelineFields.contractStart");
  const endLabel = t("pages.projects.timelineFields.contractEnd");

  return (
    <div className="space-y-3 rounded-xl border border-accent-cyan/30 bg-card-tint-cyan p-4">
      <div>
        <p className="text-sm font-medium text-accent-teal">
          {planning
            ? t("pages.projects.timelineFields.planningOngoingContract")
            : t("pages.projects.timelineFields.ongoingContract")}
        </p>
        <p className="mt-0.5 text-xs text-muted">
          {planning
            ? t("pages.projects.timelineFields.planningContractHelp")
            : t("pages.projects.timelineFields.contractHelp")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 sm:gap-x-8 sm:gap-y-5">
        <div className={employeeDialogFieldClass}>
          <label className="text-sm font-medium text-text">
            {startLabel}
          </label>
          {planning ? (
            <p className="text-xs text-muted">
              {t("pages.projects.timelineFields.planningStageFieldNote")}
            </p>
          ) : null}
          <Input
            name={planning ? "estimatedStartDate" : "startDate"}
            type="date"
            required
            value={startDate}
            onChange={(event) => onStartDateChange(event.target.value)}
            className={employeeInputClass}
          />
        </div>

        <div className={employeeDialogFieldClass}>
          <label className="text-sm font-medium text-text">
            {t("pages.projects.timelineFields.durationMonths")}
          </label>
          {planning ? (
            <p className="text-xs text-muted">
              {t("pages.projects.timelineFields.planningStageFieldNote")}
            </p>
          ) : null}
          <Input
            type="number"
            min={1}
            max={120}
            required
            value={durationMonths}
            onChange={(event) => {
              const next = Number(event.target.value);
              onDurationMonthsChange(
                Number.isFinite(next) && next >= 1 ? Math.floor(next) : 1
              );
            }}
            className={employeeInputClass}
          />
          <div className="flex flex-wrap gap-1.5">
            {CONTRACT_DURATION_PRESETS.map((months) => (
              <button
                key={months}
                type="button"
                onClick={() => onDurationMonthsChange(months)}
                className={cn(
                  "rounded-lg border px-2 py-1 text-[11px] font-medium transition",
                  durationMonths === months
                    ? "border-accent-cyan/40 bg-card-tint-cyan text-accent-teal"
                    : "border-border bg-elevated text-muted hover:border-border-strong hover:text-text"
                )}
              >
                {months === 12
                  ? t("pages.projects.timelineFields.yearOne")
                  : months % 12 === 0
                    ? t("pages.projects.timelineFields.yearsCount", {
                        count: months / 12,
                      })
                    : t("pages.projects.timelineFields.monthsShort", {
                        count: months,
                      })}
              </button>
            ))}
          </div>
        </div>

        <div className={employeeDialogFieldClass}>
          <label className="text-sm font-medium text-text">
            {endLabel}
          </label>
          {planning ? (
            <p className="text-xs text-muted">
              {t("pages.projects.timelineFields.planningStageFieldNote")}
            </p>
          ) : null}
          <Input
            type="date"
            readOnly
            value={endDate}
            tabIndex={-1}
            className={cn(employeeInputClass, "cursor-not-allowed opacity-80")}
          />
          {/* Planned/real end for server — duration-derived. */}
          <input type="hidden" name="endDate" value={endDate} />
        </div>
      </div>
    </div>
  );
}

function StandardTimelineFields({
  startDate,
  durationDays,
  onStartDateChange,
  onDurationDaysChange,
  planning,
}: Omit<StandardProps, "mode">) {
  const { t } = useT();
  const safeDays = clampProjectDurationDays(durationDays);
  const endDate = addDaysToDateInput(startDate, safeDays);
  const startLabel = planning
    ? t("pages.projects.timelineFields.estimatedProjectStart")
    : t("pages.projects.timelineFields.projectStart");
  const endLabel = t("pages.projects.timelineFields.estimatedProjectCompletion");

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 sm:gap-x-8 sm:gap-y-5">
      <div className={employeeDialogFieldClass}>
        <label className="text-sm font-medium text-text">{startLabel}</label>
        {planning ? (
          <p className="text-xs text-muted">
            {t("pages.projects.timelineFields.planningStageFieldNote")}
          </p>
        ) : null}
        <Input
          name={planning ? "estimatedStartDate" : "startDate"}
          type="date"
          required
          value={startDate}
          onChange={(event) => onStartDateChange(event.target.value)}
          className={employeeInputClass}
        />
        {planning ? (
          <p className="text-xs text-muted">
            {t("pages.projects.timelineFields.planningJobHelp")}
          </p>
        ) : null}
      </div>

      <div className={employeeDialogFieldClass}>
        <label className="text-sm font-medium text-text">
          {t("pages.projects.timelineFields.durationDays")}
        </label>
        {planning ? (
          <p className="text-xs text-muted">
            {t("pages.projects.timelineFields.planningStageFieldNote")}
          </p>
        ) : null}
        <div className="flex items-center gap-2">
          <select
            required
            value={safeDays}
            onChange={(event) => {
              onDurationDaysChange(
                clampProjectDurationDays(Number(event.target.value))
              );
            }}
            className={cn(employeeInputClass, "min-w-0 flex-1")}
            aria-label={t("pages.projects.timelineFields.durationDays")}
          >
            {PROJECT_DURATION_DAY_OPTIONS.map((days) => (
              <option key={days} value={days}>
                {days}
              </option>
            ))}
          </select>
          <span className="shrink-0 text-sm text-muted">
            {t("pages.projects.timelineFields.daysUnit")}
          </span>
        </div>
        <input type="hidden" name="durationDays" value={safeDays} />
      </div>

      <div className={employeeDialogFieldClass}>
        <label className="text-sm font-medium text-text">{endLabel}</label>
        {planning ? (
          <p className="text-xs text-muted">
            {t("pages.projects.timelineFields.planningStageFieldNote")}
          </p>
        ) : null}
        <Input
          type="date"
          readOnly
          value={endDate}
          tabIndex={-1}
          className={cn(employeeInputClass, "cursor-not-allowed opacity-80")}
        />
        <input type="hidden" name="endDate" value={endDate} />
      </div>
    </div>
  );
}

export default function ProjectTimelineFields(props: Props) {
  if (props.mode === "contract") {
    return (
      <ContractTimelineFields
        startDate={props.startDate}
        durationMonths={props.durationMonths}
        onStartDateChange={props.onStartDateChange}
        onDurationMonthsChange={props.onDurationMonthsChange}
        planning={props.planning}
      />
    );
  }

  return (
    <StandardTimelineFields
      startDate={props.startDate}
      durationDays={props.durationDays}
      onStartDateChange={props.onStartDateChange}
      onDurationDaysChange={props.onDurationDaysChange}
      planning={props.planning}
    />
  );
}
