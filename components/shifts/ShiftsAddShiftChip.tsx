"use client";

import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";

import { addProjectShift } from "@/app/shifts/actions";
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
} from "@/components/employees/employee-dialog-ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/use-t";
import { defaultShiftWindows } from "@/lib/project-shifts";
import { showRejectionFromError } from "@/components/ui/rejection-notice";

export default function ShiftsAddShiftChip({
  projectId,
  nextNumber,
}: {
  projectId: string;
  nextNumber: number;
}) {
  const { t } = useT();
  const router = useRouter();
  const defaults = defaultShiftWindows(nextNumber).find(
    (row) => row.number === nextNumber
  );
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [startTime, setStartTime] = useState(defaults?.startTime ?? "07:00");
  const [endTime, setEndTime] = useState(defaults?.endTime ?? "16:00");

  function reset() {
    setStartTime(defaults?.startTime ?? "07:00");
    setEndTime(defaults?.endTime ?? "16:00");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData();
    formData.set("startTime", startTime);
    formData.set("endTime", endTime);
    setPending(true);
    try {
      await addProjectShift(projectId, formData);
      reset();
      setOpen(false);
      router.refresh();
    } catch (error) {
      showRejectionFromError(error, t("pages.shifts.addShiftFailed"));
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
          <Plus />
          {t("pages.shifts.addShift")}
        </Button>
      </DialogTrigger>
      <EmployeeDialogShell
        icon={Plus}
        title={t("pages.shifts.addShift")}
        description={t("pages.shifts.addShiftDesc", { number: nextNumber })}
        maxWidth="md"
        footer={
          <div className="flex w-full flex-col gap-3">
            <EmployeePrimaryButton
              type="submit"
              form="add-shift-form"
              disabled={pending}
            >
              {pending
                ? t("pages.shifts.addShiftSaving")
                : t("pages.shifts.addShiftConfirm")}
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
          id="add-shift-form"
          onSubmit={handleSubmit}
          className={employeeDialogFormClass}
        >
          <div className={employeeDialogGridClass}>
            <div className={employeeDialogFieldClass}>
              <label className={employeeDialogLabelClass}>
                {t("pages.shifts.shiftStart")}
                <span className="text-red-400"> *</span>
              </label>
              <Input
                type="time"
                required
                disabled={pending}
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                className={employeeInputClass}
              />
            </div>
            <div className={employeeDialogFieldClass}>
              <label className={employeeDialogLabelClass}>
                {t("pages.shifts.shiftEnd")}
                <span className="text-red-400"> *</span>
              </label>
              <Input
                type="time"
                required
                disabled={pending}
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                className={employeeInputClass}
              />
            </div>
            <p className={`${employeeDialogHintClass} sm:col-span-2`}>
              {t("pages.shifts.addShiftHint")}
            </p>
          </div>
        </form>
      </EmployeeDialogShell>
    </Dialog>
  );
}
