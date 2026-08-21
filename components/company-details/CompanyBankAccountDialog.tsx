"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Landmark } from "lucide-react";
import { toast } from "sonner";

import {
  createCompanyBankAccount,
  updateCompanyBankAccount,
} from "@/app/company-details/actions";
import type { CompanyBankAccountOption } from "@/lib/company-bank-accounts";
import {
  captureHtmlFormBaseline,
  EmployeeDialogShell,
  EmployeePrimaryButton,
  EmployeeUnsavedExitDialog,
  employeeDialogFieldClass,
  employeeDialogFormClass,
  employeeDialogGridClass,
  employeeDialogHintClass,
  employeeDialogLabelClass,
  employeeInputClass,
  handleEmployeeDialogOpenChange,
  useHtmlFormDirty,
  type HtmlFormDirtyBaseline,
} from "@/components/employees/employee-dialog-ui";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/use-t";

const FORM_ID = "company-bank-account-form";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: CompanyBankAccountOption | null;
  onSaved?: () => void;
};

export default function CompanyBankAccountDialog({
  open,
  onOpenChange,
  account = null,
  onSaved,
}: Props) {
  const { t } = useT();
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [baseline, setBaseline] = useState<HtmlFormDirtyBaseline | null>(null);
  const isEdit = Boolean(account?.id);
  const signature = account?.id ?? "new";
  const signatureRef = useRef(signature);
  signatureRef.current = signature;

  const { isDirty, handleFormInput, resetDirtyTracking } = useHtmlFormDirty(
    FORM_ID,
    signature,
    baseline
  );
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  function closeDialog() {
    onOpenChange(false);
    resetDirtyTracking();
    setBaseline(null);
  }

  function handleOpenChange(
    nextOpen: boolean,
    eventDetails?: { cancel: () => void }
  ) {
    handleEmployeeDialogOpenChange(nextOpen, eventDetails, {
      isDirty: isDirtyRef.current,
      onOpen: () => onOpenChange(true),
      onClose: closeDialog,
      onRequestExitConfirm: () => setExitConfirmOpen(true),
    });
  }

  useEffect(() => {
    if (!open) {
      setBaseline(null);
      return;
    }
    const frame = requestAnimationFrame(() => {
      setBaseline(captureHtmlFormBaseline(FORM_ID, signatureRef.current));
    });
    return () => cancelAnimationFrame(frame);
  }, [open, account?.id]);

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = isEdit
        ? await updateCompanyBankAccount(formData)
        : await createCompanyBankAccount(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t("pages.companyDetails.bank.saved"));
      setExitConfirmOpen(false);
      closeDialog();
      onSaved?.();
    });
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={handleOpenChange}
        disablePointerDismissal
      >
        <EmployeeDialogShell
          icon={Landmark}
          title={
            isEdit
              ? t("pages.companyDetails.bank.editTitle")
              : t("pages.companyDetails.bank.addTitle")
          }
          description={
            isEdit
              ? t("pages.companyDetails.bank.editDesc")
              : t("pages.companyDetails.bank.addDesc")
          }
          maxWidth="lg"
          footer={
            <EmployeePrimaryButton form={FORM_ID} disabled={pending}>
              {pending
                ? t("common.actions.saving")
                : t("pages.companyDetails.bank.save")}
            </EmployeePrimaryButton>
          }
        >
          <form
            id={FORM_ID}
            key={account?.id ?? "new"}
            action={submit}
            className={employeeDialogFormClass}
            onInput={handleFormInput}
          >
            {isEdit ? <input type="hidden" name="id" value={account?.id} /> : null}
            <div className={employeeDialogGridClass}>
              <div className={employeeDialogFieldClass}>
                <label
                  htmlFor="bank-account-bank-name"
                  className={employeeDialogLabelClass}
                >
                  {t("pages.companyDetails.form.bankName")}
                  <span className="text-danger"> *</span>
                </label>
                <Input
                  id="bank-account-bank-name"
                  name="bankName"
                  required
                  defaultValue={account?.bankName ?? ""}
                  className={employeeInputClass}
                />
              </div>
              <div className={employeeDialogFieldClass}>
                <label
                  htmlFor="bank-account-number"
                  className={employeeDialogLabelClass}
                >
                  {t("pages.companyDetails.form.bankAccountNumber")}
                  <span className="text-danger"> *</span>
                </label>
                <Input
                  id="bank-account-number"
                  name="accountNumber"
                  required
                  inputMode="numeric"
                  defaultValue={account?.accountNumber ?? ""}
                  className={employeeInputClass}
                />
              </div>
              <div className={employeeDialogFieldClass}>
                <label
                  htmlFor="bank-account-holder"
                  className={employeeDialogLabelClass}
                >
                  {t("pages.companyDetails.form.bankAccountName")}
                  <span className="text-danger"> *</span>
                </label>
                <Input
                  id="bank-account-holder"
                  name="accountHolder"
                  required
                  defaultValue={account?.accountHolder ?? ""}
                  className={employeeInputClass}
                />
              </div>
              <div className={employeeDialogFieldClass}>
                <label
                  htmlFor="bank-account-label"
                  className={employeeDialogLabelClass}
                >
                  {t("pages.companyDetails.form.bankLabel")}
                </label>
                <Input
                  id="bank-account-label"
                  name="label"
                  defaultValue={account?.label ?? ""}
                  className={employeeInputClass}
                />
                <p className={employeeDialogHintClass}>
                  {t("pages.companyDetails.form.bankLabelHint")}
                </p>
              </div>
            </div>
          </form>
        </EmployeeDialogShell>
      </Dialog>
      <EmployeeUnsavedExitDialog
        open={exitConfirmOpen}
        onConfirm={() => {
          setExitConfirmOpen(false);
          closeDialog();
        }}
        onCancel={() => setExitConfirmOpen(false)}
      />
    </>
  );
}
