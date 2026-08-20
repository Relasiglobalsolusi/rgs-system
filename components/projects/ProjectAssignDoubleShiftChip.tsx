"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Repeat } from "lucide-react";
import { useRouter } from "next/navigation";

import { assignDoubleShift } from "@/app/projects/actions";
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

export type DoubleShiftEmployeeOption = {
  id: string;
  firstName: string;
  lastName: string;
  employeeNo: string;
  shiftId: string | null;
  shiftNumber: number | null;
  shiftStart: string | null;
  shiftEnd: string | null;
};

export default function ProjectAssignDoubleShiftChip({
  projectId,
  employees,
}: {
  projectId: string;
  employees: DoubleShiftEmployeeOption[];
}) {
  const { t } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState("");
  const [coverKey, setCoverKey] = useState("");
  const [date, setDate] = useState(todayDateInput());

  function reset() {
    setError(null);
    setEmployeeId("");
    setCoverKey("");
    setDate(todayDateInput());
  }

  function employeeLabel(employee: DoubleShiftEmployeeOption) {
    const shift =
      employee.shiftNumber != null
        ? formatProjectShiftLabel({
            number: employee.shiftNumber,
            startTime: employee.shiftStart,
            endTime: employee.shiftEnd,
          })
        : t("pages.projects.detail.noShiftSet");
    return `${employee.firstName} ${employee.lastName} · ${employee.employeeNo} · ${shift}`;
  }

  const selectedEmployee = employees.find((row) => row.id === employeeId);
  const coverOptions = useMemo(() => {
    if (!employeeId) return [];
    return employees
      .filter(
        (row) =>
          row.id !== employeeId &&
          row.shiftId &&
          row.shiftNumber != null &&
          row.shiftId !== selectedEmployee?.shiftId
      )
      .map((row) => ({
        key: `${row.shiftId}:${row.id}`,
        coveringShiftId: row.shiftId as string,
        coveredEmployeeId: row.id,
        label: `${formatProjectShiftLabel({
          number: row.shiftNumber as number,
          startTime: row.shiftStart,
          endTime: row.shiftEnd,
        })} · ${row.firstName} ${row.lastName}`,
      }));
  }, [employeeId, employees, selectedEmployee?.shiftId]);

  const selectedCover = coverOptions.find((row) => row.key === coverKey);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!selectedCover) {
      setError(t("pages.projects.doubleShiftCoverEmpty"));
      return;
    }
    const formData = new FormData(event.currentTarget);
    formData.set("projectId", projectId);
    formData.set("employeeId", employeeId);
    formData.set("date", date);
    formData.set("coveringShiftId", selectedCover.coveringShiftId);
    formData.set("coveredEmployeeId", selectedCover.coveredEmployeeId);
    setPending(true);
    try {
      await assignDoubleShift(formData);
      reset();
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("pages.projects.assignDoubleShiftFailed")
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
        <Button type="button" variant="successBadge" size="badgeFlex">
          <Repeat />
          {t("pages.projects.assignDoubleShift")}
        </Button>
      </DialogTrigger>
      <EmployeeDialogShell
        icon={Repeat}
        title={t("pages.projects.assignDoubleShift")}
        description={t("pages.projects.assignDoubleShiftDesc")}
        maxWidth="md"
        footer={
          <div className="flex w-full flex-col gap-3">
            <EmployeePrimaryButton
              type="submit"
              form="assign-double-shift-form"
              disabled={
                pending ||
                employees.length === 0 ||
                !employeeId ||
                !coverKey
              }
            >
              {pending
                ? t("pages.projects.assignDoubleShiftSaving")
                : t("pages.projects.assignDoubleShiftConfirm")}
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
          id="assign-double-shift-form"
          onSubmit={handleSubmit}
          className={employeeDialogFormClass}
        >
          <div className={employeeDialogGridClass}>
            <div className="sm:col-span-2">
              <div className={employeeDialogFieldClass}>
                <label className={employeeDialogLabelClass}>
                  {t("pages.projects.doubleShiftEmployee")}
                  <span className="text-red-400"> *</span>
                </label>
                <Select
                  value={employeeId || undefined}
                  onValueChange={(value) => {
                    setEmployeeId(value ?? "");
                    setCoverKey("");
                  }}
                  disabled={pending || employees.length === 0}
                >
                  <SelectTrigger className={employeeSelectTriggerClass}>
                    <SelectValue>
                      {selectedEmployee
                        ? employeeLabel(selectedEmployee)
                        : t("pages.projects.doubleShiftEmployeePlaceholder")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employeeLabel(employee)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className={employeeDialogHintClass}>
                  {employees.length === 0
                    ? t("pages.projects.doubleShiftEmployeeEmpty")
                    : t("pages.projects.doubleShiftEmployeeHint")}
                </p>
              </div>
            </div>
            <div className={`${employeeDialogFieldClass} sm:col-span-2`}>
              <label className={employeeDialogLabelClass}>
                {t("pages.projects.doubleShiftDate")}
                <span className="text-red-400"> *</span>
              </label>
              <Input
                type="date"
                required
                disabled={pending}
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className={employeeInputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <div className={employeeDialogFieldClass}>
                <label className={employeeDialogLabelClass}>
                  {t("pages.projects.doubleShiftCover")}
                  <span className="text-red-400"> *</span>
                </label>
                <Select
                  value={coverKey || undefined}
                  onValueChange={(value) => setCoverKey(value ?? "")}
                  disabled={pending || !employeeId || coverOptions.length === 0}
                >
                  <SelectTrigger className={employeeSelectTriggerClass}>
                    <SelectValue>
                      {selectedCover
                        ? selectedCover.label
                        : t("pages.projects.doubleShiftCoverPlaceholder")}
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
                  {!employeeId
                    ? t("pages.projects.doubleShiftEmployeeHint")
                    : coverOptions.length === 0
                      ? t("pages.projects.doubleShiftCoverEmpty")
                      : t("pages.projects.doubleShiftCoverHint")}
                </p>
              </div>
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
