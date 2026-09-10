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
import CompanyBankAccountField from "@/components/company-details/CompanyBankAccountField";
import { Dialog } from "@/components/ui/dialog";
import { FileDropField } from "@/components/ui/FileDropField";
import { Input } from "@/components/ui/input";
import { showRejectionFromError } from "@/components/ui/rejection-notice";
import { Textarea } from "@/components/ui/textarea";
import type { CompanyBankAccountOption } from "@/lib/company-bank-accounts";
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
    amountOwedToCompany?: number | null;
  };
  bankAccounts?: CompanyBankAccountOption[];
  onResigned?: () => void;
};

export default function EmployeeResignDialog({
  open,
  onOpenChange,
  employee,
  bankAccounts = [],
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
  const [paysRest, setPaysRest] = useState<"yes" | "no" | "">("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);
  const held = employee.depositHeldAmount ?? 0;
  const owed = employee.amountOwedToCompany ?? 0;
  const depositAfter = Math.max(0, held - owed);
  const shortfall = Math.max(0, owed - held);

  function submit() {
    if (shortfall > 0 && !paysRest) return;
    if (shortfall > 0 && paysRest === "yes") {
      if (!bankAccountId && bankAccounts.length > 0) return;
      if (!paidAt || !paymentProofFile) return;
    }
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
        if (shortfall > 0) {
          formData.set("employeePaysRest", paysRest);
          if (paysRest === "yes") {
            formData.set("bankAccountId", bankAccountId);
            formData.set("paidAt", paidAt);
            if (paymentProofFile) {
              formData.set("paymentProof", paymentProofFile);
            }
          }
        }
        await resignEmployee(formData);
        onResigned?.();
        onOpenChange(false);
      } catch (error) {
        showRejectionFromError(error, t("pages.employees.errors.resignFailed"));
      }
    });
  }

  const shortfallBlocked =
    shortfall > 0 &&
    (paysRest === "" ||
      (paysRest === "yes" &&
        ((bankAccounts.length > 0 && !bankAccountId) ||
          !paidAt ||
          !paymentProofFile)));

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
            disabled={pending || !lastWorkingDay || !procedure || shortfallBlocked}
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

          <div className="space-y-2 rounded-xl border border-border bg-elevated px-4 py-3 text-sm text-text">
            <p>
              {t("pages.employees.depositHeldNote", {
                amount: formatContractPrice(held),
              })}
            </p>
            <p>
              {t("pages.employees.resignBalanceOwed", {
                amount: formatContractPrice(owed),
              })}
            </p>
            <p>
              {t("pages.employees.resignDepositAfterDeduction", {
                amount: formatContractPrice(depositAfter),
              })}
            </p>
            {shortfall > 0 ? (
              <p>
                {t("pages.employees.resignShortfall", {
                  amount: formatContractPrice(shortfall),
                })}
              </p>
            ) : null}
          </div>

          {shortfall > 0 ? (
            <fieldset className="flex flex-col gap-3">
              <legend className="text-sm font-semibold text-text">
                {t("pages.employees.resignPaysRest")}
              </legend>
              <p className={employeeDialogHintClass}>
                {t("pages.employees.resignPaysRestHint")}
              </p>
              <label className="flex items-start gap-2 text-sm text-text">
                <input
                  type="radio"
                  name="resign-pays-rest"
                  className="mt-1"
                  checked={paysRest === "yes"}
                  onChange={() => setPaysRest("yes")}
                />
                <span className="font-medium">
                  {t("pages.employees.resignPaysRestYes")}
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-text">
                <input
                  type="radio"
                  name="resign-pays-rest"
                  className="mt-1"
                  checked={paysRest === "no"}
                  onChange={() => setPaysRest("no")}
                />
                <span className="font-medium">
                  {t("pages.employees.resignPaysRestNo")}
                </span>
              </label>
              {paysRest === "yes" ? (
                <>
                  <CompanyBankAccountField
                    accounts={bankAccounts}
                    value={bankAccountId}
                    onChange={setBankAccountId}
                    required
                    label={t("pages.employees.resignPaysRestBank")}
                  />
                  <div className={employeeDialogFieldClass}>
                    <label className="text-sm font-semibold text-text">
                      {t("pages.employees.resignPaysRestPaidAt")}
                    </label>
                    <Input
                      type="date"
                      className={employeeInputClass}
                      value={paidAt}
                      onChange={(event) => setPaidAt(event.target.value)}
                    />
                    <p className={employeeDialogHintClass}>
                      {t("pages.employees.resignPaysRestPaidAtHint")}
                    </p>
                  </div>
                  <FileDropField
                    id="resign-shortfall-proof"
                    name="paymentProof"
                    label={t("pages.employees.resignPaysRestProof")}
                    accept="image/*,.pdf"
                    required
                    fileName={paymentProofFile?.name ?? null}
                    onPick={setPaymentProofFile}
                  />
                  <p className={employeeDialogHintClass}>
                    {t("pages.employees.resignPaysRestProofHint")}
                  </p>
                </>
              ) : null}
            </fieldset>
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
