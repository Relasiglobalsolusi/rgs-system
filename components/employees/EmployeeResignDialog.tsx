"use client";

import { useState, useTransition } from "react";
import { UserMinus } from "lucide-react";

import { resignEmployee } from "@/app/employees/actions";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  employeeDialogFieldClass,
  employeeDialogHintClass,
  employeeInputClass,
} from "@/components/employees/employee-dialog-ui";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { showRejectionFromError } from "@/components/ui/rejection-notice";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n/use-t";
import { formatContractPrice } from "@/lib/project-billing";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNo: string;
    depositHeldAmount?: number | null;
    depositStatus?: string | null;
  };
  onResigned?: () => void;
};

export default function EmployeeResignDialog({
  open,
  onOpenChange,
  employee,
  onResigned,
}: Props) {
  const { t } = useT();
  const [pending, startTransition] = useTransition();
  const [lastWorkingDay, setLastWorkingDay] = useState("");
  const [procedure, setProcedure] = useState<"according" | "notAccording" | "">(
    ""
  );
  const [forfeitRemainingWages, setForfeitRemainingWages] = useState(false);
  const [note, setNote] = useState("");
  const held = employee.depositHeldAmount ?? 0;

  function submit() {
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("employeeId", employee.id);
        formData.set("lastWorkingDay", lastWorkingDay);
        formData.set("procedure", procedure);
        if (procedure === "notAccording" && forfeitRemainingWages) {
          formData.set("forfeitRemainingWages", "1");
        }
        formData.set("note", note);
        await resignEmployee(formData);
        onResigned?.();
        onOpenChange(false);
      } catch (error) {
        showRejectionFromError(error, t("pages.employees.errors.resignFailed"));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <EmployeeDialogShell
        icon={UserMinus}
        title={t("pages.employees.resignTitle")}
        description={t("pages.employees.resignDescription", {
          name: `${employee.firstName} ${employee.lastName}`,
        })}
        maxWidth="md"
        footer={
          <EmployeePrimaryButton
            type="button"
            variant="danger"
            disabled={pending || !lastWorkingDay || !procedure}
            onClick={submit}
          >
            {pending
              ? t("pages.employees.resigning")
              : t("pages.employees.resignConfirm")}
          </EmployeePrimaryButton>
        }
      >
        <div className="flex flex-col gap-5">
          <div className={employeeDialogFieldClass}>
            <label className="text-sm font-semibold text-text">
              {t("pages.employees.lastWorkingDay")}
            </label>
            <Input
              type="date"
              className={employeeInputClass}
              value={lastWorkingDay}
              onChange={(event) => setLastWorkingDay(event.target.value)}
            />
          </div>

          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-semibold text-text">
              {t("pages.employees.resignProcedure")}
            </legend>
            <label className="flex items-start gap-2 text-sm text-text">
              <input
                type="radio"
                name="resign-procedure"
                className="mt-1"
                checked={procedure === "according"}
                onChange={() => {
                  setProcedure("according");
                  setForfeitRemainingWages(false);
                }}
              />
              <span>
                <span className="font-medium">
                  {t("pages.employees.accordingToProcedure")}
                </span>
                <span className={`block ${employeeDialogHintClass}`}>
                  {t("pages.employees.accordingToProcedureHint")}
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-text">
              <input
                type="radio"
                name="resign-procedure"
                className="mt-1"
                checked={procedure === "notAccording"}
                onChange={() => {
                  setProcedure("notAccording");
                }}
              />
              <span>
                <span className="font-medium">
                  {t("pages.employees.notAccordingToProcedure")}
                </span>
                <span className={`block ${employeeDialogHintClass}`}>
                  {t("pages.employees.notAccordingToProcedureHint")}
                </span>
              </span>
            </label>
          </fieldset>

          {procedure === "notAccording" ? (
            <label className="flex items-start gap-2 text-sm text-text">
              <input
                type="checkbox"
                className="mt-1"
                checked={forfeitRemainingWages}
                onChange={(event) =>
                  setForfeitRemainingWages(event.target.checked)
                }
              />
              <span>
                <span className="font-medium">
                  {t("pages.employees.forfeitRemainingWages")}
                </span>
                <span className={`block ${employeeDialogHintClass}`}>
                  {t("pages.employees.forfeitRemainingWagesHint")}
                </span>
              </span>
            </label>
          ) : null}

          {held > 0 ? (
            <p className="rounded-xl border border-border bg-elevated px-4 py-3 text-sm text-text">
              {t("pages.employees.depositHeldNote", {
                amount: formatContractPrice(held),
              })}
            </p>
          ) : null}

          <div className={employeeDialogFieldClass}>
            <label className="text-sm font-semibold text-text">
              {t("pages.employees.resignNote")}
            </label>
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
            />
          </div>
        </div>
      </EmployeeDialogShell>
    </Dialog>
  );
}
