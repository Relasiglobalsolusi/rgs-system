"use client";

import { useMemo, useState, type FormEvent } from "react";
import { UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";

import { assignBackupEmployee } from "@/app/projects/actions";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  EmployeeSecondaryButton,
  employeeDialogFieldClass,
  employeeDialogFormClass,
  employeeDialogGridClass,
  employeeDialogHintClass,
  employeeDialogLabelClass,
  employeeInputClass,
  employeeSelectTriggerClass,
} from "@/components/employees/employee-dialog-ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useT } from "@/lib/i18n/use-t";
import { formatProjectShiftLabel } from "@/lib/project-shifts";
import { todayDateInput } from "@/lib/project-contract";
import type { DoubleShiftEmployeeOption } from "@/components/projects/ProjectAssignDoubleShiftChip";

export type BackupEmployeeOption = {
  id: string;
  firstName: string;
  lastName: string;
  employeeNo: string;
};

export default function ProjectAssignBackupChip({
  projectId,
  employees,
  coverEmployees,
}: {
  projectId: string;
  employees: BackupEmployeeOption[];
  coverEmployees: DoubleShiftEmployeeOption[];
}) {
  const { t } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState("");
  const [coverKey, setCoverKey] = useState("");
  const [startDate, setStartDate] = useState(todayDateInput());
  const [endDate, setEndDate] = useState(todayDateInput());
  const [dailyRate, setDailyRate] = useState("");

  function reset() {
    setError(null);
    setEmployeeId("");
    setCoverKey("");
    setStartDate(todayDateInput());
    setEndDate(todayDateInput());
    setDailyRate("");
  }

  const coverOptions = useMemo(
    () =>
      coverEmployees
        .filter((row) => row.shiftId && row.shiftNumber != null)
        .map((row) => ({
          key: `${row.shiftId}:${row.id}`,
          coveringShiftId: row.shiftId as string,
          coveredEmployeeId: row.id,
          label: `${formatProjectShiftLabel({
            number: row.shiftNumber as number,
            startTime: row.shiftStart,
            endTime: row.shiftEnd,
          })} · ${row.firstName} ${row.lastName}`,
        })),
    [coverEmployees]
  );

  const selectedCover = coverOptions.find((row) => row.key === coverKey);
  const selectedEmployee = employees.find((row) => row.id === employeeId);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!selectedCover) {
      setError(t("pages.projects.backupCoverEmpty"));
      return;
    }
    const formData = new FormData(event.currentTarget);
    formData.set("projectId", projectId);
    formData.set("employeeId", employeeId);
    formData.set("coveringShiftId", selectedCover.coveringShiftId);
    formData.set("coveredEmployeeId", selectedCover.coveredEmployeeId);
    formData.set("backupStartDate", startDate);
    formData.set("backupEndDate", endDate);
    formData.set("dailyRate", dailyRate);
    setPending(true);
    try {
      await assignBackupEmployee(formData);
      reset();
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("pages.projects.assignBackupFailed")
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="infoBadge" size="badgeFlex">
          <UserPlus />
          {t("pages.projects.assignBackup")}
        </Button>
      </DialogTrigger>
      <EmployeeDialogShell
        icon={UserPlus}
        title={t("pages.projects.assignBackup")}
        description={t("pages.projects.assignBackupDesc")}
        maxWidth="md"
        footer={
          <div className="flex w-full flex-col gap-3">
            <EmployeePrimaryButton
              type="submit"
              form="assign-backup-form"
              disabled={
                pending ||
                employees.length === 0 ||
                !employeeId ||
                !coverKey
              }
            >
              {pending
                ? t("pages.projects.assignBackupSaving")
                : t("pages.projects.assignBackupConfirm")}
            </EmployeePrimaryButton>
            <EmployeeSecondaryButton
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              {t("common.actions.cancel")}
            </EmployeeSecondaryButton>
          </div>
        }
      >
        <form
          id="assign-backup-form"
          onSubmit={handleSubmit}
          className={employeeDialogFormClass}
        >
          <div className={employeeDialogGridClass}>
            <div className="sm:col-span-2">
              <div className={employeeDialogFieldClass}>
                <label className={employeeDialogLabelClass}>
                  {t("pages.projects.backupCover")}
                  <span className="text-red-400"> *</span>
                </label>
                <Select
                  value={coverKey || undefined}
                  onValueChange={(value) => setCoverKey(value ?? "")}
                  disabled={pending || coverOptions.length === 0}
                >
                  <SelectTrigger className={employeeSelectTriggerClass}>
                    <SelectValue>
                      {selectedCover
                        ? selectedCover.label
                        : t("pages.projects.backupCoverPlaceholder")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {coverOptions.map((option) => (
                      <SelectItem key={option.key} value={option.key}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className={employeeDialogHintClass}>
                  {coverOptions.length === 0
                    ? t("pages.projects.backupCoverEmpty")
                    : t("pages.projects.backupCoverHint")}
                </p>
              </div>
            </div>
            <div className="sm:col-span-2">
              <div className={employeeDialogFieldClass}>
                <label className={employeeDialogLabelClass}>
                  {t("pages.projects.backupEmployee")}
                  <span className="text-red-400"> *</span>
                </label>
                <Select
                  value={employeeId || undefined}
                  onValueChange={(value) => setEmployeeId(value ?? "")}
                  disabled={pending || employees.length === 0}
                >
                  <SelectTrigger className={employeeSelectTriggerClass}>
                    <SelectValue>
                      {selectedEmployee
                        ? `${selectedEmployee.firstName} ${selectedEmployee.lastName} · ${selectedEmployee.employeeNo}`
                        : t("pages.projects.backupEmployeePlaceholder")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.firstName} {employee.lastName} ·{" "}
                        {employee.employeeNo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className={employeeDialogHintClass}>
                  {employees.length === 0
                    ? t("pages.projects.backupEmployeeEmpty")
                    : t("pages.projects.backupEmployeeHint")}
                </p>
              </div>
            </div>
            <div className={employeeDialogFieldClass}>
              <label className={employeeDialogLabelClass}>
                {t("pages.projects.backupStart")}
                <span className="text-red-400"> *</span>
              </label>
              <Input
                type="date"
                required
                disabled={pending}
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className={employeeInputClass}
              />
            </div>
            <div className={employeeDialogFieldClass}>
              <label className={employeeDialogLabelClass}>
                {t("pages.projects.backupEnd")}
                <span className="text-red-400"> *</span>
              </label>
              <Input
                type="date"
                required
                disabled={pending}
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className={employeeInputClass}
              />
            </div>
            <div className={`${employeeDialogFieldClass} sm:col-span-2`}>
              <label className={employeeDialogLabelClass}>
                {t("pages.projects.backupDailyRate")}
                <span className="text-red-400"> *</span>
              </label>
              <Input
                required
                inputMode="numeric"
                disabled={pending}
                value={dailyRate}
                onChange={(event) => setDailyRate(event.target.value)}
                placeholder={t("pages.projects.backupDailyRatePlaceholder")}
                className={employeeInputClass}
              />
              <p className={employeeDialogHintClass}>
                {t("pages.projects.backupDailyRateHint")}
              </p>
            </div>
            {error ? (
              <p className="sm:col-span-2 text-sm text-danger">{error}</p>
            ) : null}
          </div>
        </form>
      </EmployeeDialogShell>
    </Dialog>
  );
}
