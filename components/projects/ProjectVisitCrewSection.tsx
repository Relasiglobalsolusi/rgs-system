"use client";

import { useMemo, useState, useTransition } from "react";
import { CalendarDays, Users, UserRound, X } from "lucide-react";

import {
  clearProjectVisitAssignment,
  saveProjectVisitAssignment,
} from "@/app/projects/actions";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  EmployeeSecondaryButton,
  employeeDialogChoiceChipClass,
  employeeDialogChoiceGridClass,
  employeeDialogFieldClass,
  employeeDialogHintClass,
} from "@/components/employees/employee-dialog-ui";
import { buttonVariants } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  showRejection,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { outlineChipTones } from "@/components/ui/StatusBadge";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

export type VisitCrewEmployeeOption = {
  id: string;
  firstName: string;
  lastName: string;
  employeeNo: string;
};

export type VisitCrewTeamOption = {
  id: string;
  name: string;
  memberNames: string[];
};

export type VisitCrewAssignment = {
  kind: "team" | "employee";
  teamId?: string;
  teamName?: string;
  memberNames?: string[];
  employeeId?: string;
  employeeName?: string;
  employeeNo?: string;
};

export type VisitCrewRow = {
  id: string;
  visitIndex: number;
  startLabel: string;
  endLabel: string;
  amountLabel: string | null;
  current: boolean;
  assignment: VisitCrewAssignment | null;
  employeeConflicts: Record<string, string>;
  teamConflicts: Record<string, string>;
};

type Props = {
  visits: VisitCrewRow[];
  employees: VisitCrewEmployeeOption[];
  teams: VisitCrewTeamOption[];
  canAssign: boolean;
};

function employeeLabel(employee: VisitCrewEmployeeOption) {
  return `${employee.firstName} ${employee.lastName}`.trim();
}

export default function ProjectVisitCrewSection({
  visits,
  employees,
  teams,
  canAssign,
}: Props) {
  const { t } = useT();
  const [openVisitId, setOpenVisitId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const openVisit = visits.find((visit) => visit.id === openVisitId) ?? null;

  return (
    <>
      <div className="mb-3">
        <h3 className="text-base font-semibold tracking-tight text-text">
          {t("pages.projects.visitCrew")}
        </h3>
        <p className="mt-1 max-w-2xl text-sm text-subtle">
          {t("pages.projects.visitCrewHint")}
        </p>
      </div>

      {visits.length === 0 ? (
        <p className="text-sm text-subtle">{t("pages.projects.visitCrewEmpty")}</p>
      ) : (
        <ul className="space-y-3">
          {visits.map((visit) => (
            <li
              key={visit.id}
              className="rounded-xl border border-border bg-inset p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text">
                    {t("pages.projects.visitN", { n: visit.visitIndex })}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-subtle">
                    <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                    {visit.startLabel === visit.endLabel
                      ? visit.startLabel
                      : `${visit.startLabel} – ${visit.endLabel}`}
                  </p>
                  {visit.amountLabel ? (
                    <p className="mt-1 text-xs text-muted">{visit.amountLabel}</p>
                  ) : null}
                  {visit.current ? (
                    <p className="mt-2 text-xs font-semibold text-primary">
                      {t("pages.projects.visitCrewCurrent")}
                    </p>
                  ) : null}
                </div>
                {canAssign ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className={buttonVariants({
                        variant: "infoBadge",
                        size: "badgeFlex",
                      })}
                      onClick={() => setOpenVisitId(visit.id)}
                    >
                      {visit.assignment
                        ? t("pages.projects.visitCrewChange")
                        : t("pages.projects.visitCrewAssign")}
                    </button>
                    {visit.assignment ? (
                      <button
                        type="button"
                        className={buttonVariants({
                          variant: "destructiveBadge",
                          size: "badgeFlex",
                        })}
                        disabled={pending}
                        onClick={() => {
                          startTransition(async () => {
                            try {
                              const formData = new FormData();
                              formData.set("visitId", visit.id);
                              await clearProjectVisitAssignment(formData);
                            } catch (error) {
                              showRejectionFromError(
                                error,
                                t("pages.projects.visitCrewClearFailed")
                              );
                            }
                          });
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                        {t("pages.projects.visitCrewClear")}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="mt-3">
                {visit.assignment ? (
                  <span
                    className={cn(
                      "inline-flex max-w-full flex-col rounded-md px-2.5 py-1.5 text-left text-sm",
                      outlineChipTones.emerald
                    )}
                  >
                    <span className="font-semibold normal-case tracking-normal">
                      {visit.assignment.kind === "team"
                        ? visit.assignment.teamName
                        : visit.assignment.employeeName}
                    </span>
                    <span className="text-[11px] font-medium normal-case tracking-normal text-primary-dark/70">
                      {visit.assignment.kind === "team"
                        ? visit.assignment.memberNames &&
                          visit.assignment.memberNames.length > 0
                          ? visit.assignment.memberNames.join(", ")
                          : t("pages.teams.emptyMembers")
                        : visit.assignment.employeeNo}
                    </span>
                  </span>
                ) : (
                  <p className="text-sm text-subtle">
                    {t("pages.projects.visitCrewUnassigned")}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {openVisit ? (
        <VisitCrewDialog
          visit={openVisit}
          employees={employees}
          teams={teams}
          open
          pending={pending}
          onOpenChange={(next) => {
            if (!next) setOpenVisitId(null);
          }}
          onSave={(formData) => {
            startTransition(async () => {
              try {
                await saveProjectVisitAssignment(formData);
                setOpenVisitId(null);
              } catch (error) {
                showRejectionFromError(
                  error,
                  t("pages.projects.visitCrewFailed")
                );
              }
            });
          }}
        />
      ) : null}
    </>
  );
}

function VisitCrewDialog({
  visit,
  employees,
  teams,
  open,
  pending,
  onOpenChange,
  onSave,
}: {
  visit: VisitCrewRow;
  employees: VisitCrewEmployeeOption[];
  teams: VisitCrewTeamOption[];
  open: boolean;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (formData: FormData) => void;
}) {
  const { t } = useT();
  const initialMode =
    visit.assignment?.kind === "employee" ? "employee" : "team";
  const [mode, setMode] = useState<"team" | "employee">(initialMode);
  const [teamId, setTeamId] = useState(visit.assignment?.teamId ?? "");
  const [employeeId, setEmployeeId] = useState(
    visit.assignment?.employeeId ?? ""
  );

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === teamId) ?? null,
    [teams, teamId]
  );
  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.id === employeeId) ?? null,
    [employees, employeeId]
  );

  function submit() {
    if (mode === "team" && !teamId) {
      showRejection({ reasons: t("pages.projects.visitCrewNeedChoice") });
      return;
    }
    if (mode === "employee" && !employeeId) {
      showRejection({ reasons: t("pages.projects.visitCrewNeedChoice") });
      return;
    }
    const formData = new FormData();
    formData.set("visitId", visit.id);
    if (mode === "team") formData.set("teamId", teamId);
    if (mode === "employee") formData.set("employeeId", employeeId);
    onSave(formData);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <EmployeeDialogShell
        icon={Users}
        title={t("pages.projects.visitCrewAssign")}
        description={`${t("pages.projects.visitN", { n: visit.visitIndex })} · ${
          visit.startLabel === visit.endLabel
            ? visit.startLabel
            : `${visit.startLabel} – ${visit.endLabel}`
        }`}
        maxWidth="lg"
        footer={
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-end">
            <EmployeeSecondaryButton
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              {t("common.actions.cancel")}
            </EmployeeSecondaryButton>
            <EmployeePrimaryButton
              type="button"
              disabled={pending}
              onClick={submit}
            >
              {pending
                ? t("common.actions.saving")
                : t("pages.projects.visitCrewSave")}
            </EmployeePrimaryButton>
          </div>
        }
      >
        <div className="space-y-5">
          <div className={employeeDialogFieldClass}>
            <p className="text-sm font-semibold text-text">
              {t("pages.projects.visitCrewChooseMode")}
            </p>
            <div className={employeeDialogChoiceGridClass}>
              <button
                type="button"
                className={cn(
                  employeeDialogChoiceChipClass,
                  mode === "team"
                    ? "bg-primary text-primary-foreground"
                    : "bg-elevated text-muted ring-1 ring-border"
                )}
                onClick={() => setMode("team")}
              >
                <Users className="mr-1.5 h-3.5 w-3.5" />
                {t("pages.projects.visitCrewModeTeam")}
              </button>
              <button
                type="button"
                className={cn(
                  employeeDialogChoiceChipClass,
                  mode === "employee"
                    ? "bg-primary text-primary-foreground"
                    : "bg-elevated text-muted ring-1 ring-border"
                )}
                onClick={() => setMode("employee")}
              >
                <UserRound className="mr-1.5 h-3.5 w-3.5" />
                {t("pages.projects.visitCrewModeEmployee")}
              </button>
            </div>
            <p className={employeeDialogHintClass}>
              {t("pages.projects.visitCrewHint")}
            </p>
          </div>

          {mode === "team" ? (
            teams.length === 0 ? (
              <p className="text-sm text-subtle">
                {t("pages.projects.visitCrewNoTeams")}
              </p>
            ) : (
              <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-inset">
                {teams.map((team) => {
                  const conflict = visit.teamConflicts[team.id];
                  const blocked = Boolean(conflict);
                  const checked = teamId === team.id;
                  return (
                    <li key={team.id}>
                      <label
                        className={cn(
                          "flex items-start gap-3 px-3 py-3 text-sm",
                          blocked
                            ? "cursor-not-allowed bg-inset/80 text-subtle"
                            : "cursor-pointer",
                          !blocked &&
                            (checked
                              ? "bg-card-tint-emerald text-primary-dark"
                              : "text-muted hover:bg-elevated")
                        )}
                        title={conflict}
                      >
                        <input
                          type="radio"
                          name="visit-team"
                          checked={checked}
                          disabled={blocked}
                          onChange={() => {
                            if (!blocked) setTeamId(team.id);
                          }}
                          className="mt-0.5 h-4 w-4 border-slate-600 bg-elevated text-primary focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">{team.name}</span>
                          <span className="mt-0.5 block text-[11px] text-subtle">
                            {conflict
                              ? conflict
                              : team.memberNames.length > 0
                                ? team.memberNames.join(", ")
                                : t("pages.teams.emptyMembers")}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )
          ) : employees.length === 0 ? (
            <p className="text-sm text-subtle">
              {t("pages.projects.staffPicker.noActiveStaff")}
            </p>
          ) : (
            <ul className="max-h-72 divide-y divide-border/60 overflow-y-auto rounded-xl border border-border bg-inset">
              {employees.map((employee) => {
                const conflict = visit.employeeConflicts[employee.id];
                const blocked = Boolean(conflict);
                const checked = employeeId === employee.id;
                return (
                  <li key={employee.id}>
                    <label
                      className={cn(
                        "flex items-center gap-3 px-3 py-3 text-sm",
                        blocked
                          ? "cursor-not-allowed bg-inset/80 text-subtle"
                          : "cursor-pointer",
                        !blocked &&
                          (checked
                            ? "bg-card-tint-emerald text-primary-dark"
                            : "text-muted hover:bg-elevated")
                      )}
                      title={conflict}
                    >
                      <input
                        type="radio"
                        name="visit-employee"
                        checked={checked}
                        disabled={blocked}
                        onChange={() => {
                          if (!blocked) setEmployeeId(employee.id);
                        }}
                        className="h-4 w-4 border-slate-600 bg-elevated text-primary focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {employeeLabel(employee)}
                        </span>
                        {conflict ? (
                          <span className="mt-0.5 block truncate text-[11px] text-subtle">
                            {conflict}
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 font-mono text-xs text-subtle">
                        {employee.employeeNo}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}

          {mode === "team" && selectedTeam ? (
            <p className="text-xs text-muted">
              {selectedTeam.name}
              {selectedTeam.memberNames.length > 0
                ? ` · ${selectedTeam.memberNames.join(", ")}`
                : ""}
            </p>
          ) : null}
          {mode === "employee" && selectedEmployee ? (
            <p className="text-xs text-muted">
              {employeeLabel(selectedEmployee)} · {selectedEmployee.employeeNo}
            </p>
          ) : null}
        </div>
      </EmployeeDialogShell>
    </Dialog>
  );
}
