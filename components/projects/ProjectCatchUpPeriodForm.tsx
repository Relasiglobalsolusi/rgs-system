"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { completeCatchUpPeriod } from "@/app/projects/actions";
import {
  EmployeePrimaryButton,
  employeeDialogFieldClass,
  employeeDialogHintClass,
  employeeDialogLabelClass,
  employeeInputClass,
} from "@/components/employees/employee-dialog-ui";
import CompanyBankAccountField from "@/components/company-details/CompanyBankAccountField";
import { FileDropField } from "@/components/ui/FileDropField";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { showRejectionFromError } from "@/components/ui/rejection-notice";
import type { CompanyBankAccountOption } from "@/lib/company-bank-accounts";
import { useT } from "@/lib/i18n/use-t";
import type { CatchUpCompleteTarget } from "@/lib/project-catch-up-periods";

export default function ProjectCatchUpPeriodForm({
  projectId,
  target,
  bankAccounts,
}: {
  projectId: string;
  target: CatchUpCompleteTarget;
  bankAccounts: CompanyBankAccountOption[];
}) {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [staffTotal, setStaffTotal] = useState("");
  const [materialTotal, setMaterialTotal] = useState("");

  function submit(formData: FormData) {
    formData.set("projectId", projectId);
    formData.set("periodStart", target.periodStart);
    formData.set("periodEnd", target.periodEnd);
    formData.set("completeKind", target.kind);
    startTransition(async () => {
      try {
        await completeCatchUpPeriod(formData);
        router.push(`/projects/${projectId}/catch-up`);
        router.refresh();
      } catch (error) {
        showRejectionFromError(error, t("pages.projects.catchUp.failed"));
      }
    });
  }

  const staffPositive = Boolean(staffTotal.trim());
  const materialPositive = Boolean(materialTotal.trim());

  return (
    <form action={submit} className="flex flex-col gap-6">
      <div className={employeeDialogFieldClass}>
        <label className={employeeDialogLabelClass} htmlFor="catch-up-client-amount">
          {t("pages.projects.catchUp.clientPays")}
          <span className="text-red-400"> *</span>
        </label>
        <p className={employeeDialogHintClass}>
          {t("pages.projects.catchUp.clientPaysHint")}
        </p>
        <MoneyInput
          id="catch-up-client-amount"
          name="clientAmount"
          className={employeeInputClass}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FileDropField
          id="catch-up-invoice"
          name="catchUpInvoice"
          label={t("pages.projects.catchUp.invoice")}
          required
          multiple
        />
        <FileDropField
          id="catch-up-tax"
          name="catchUpTaxInvoice"
          label={t("pages.projects.catchUp.taxInvoice")}
          required
          multiple
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className={employeeDialogFieldClass}>
          <label className={employeeDialogLabelClass} htmlFor="catch-up-paid-at">
            {t("pages.projects.catchUp.paidDate")}
            <span className="text-red-400"> *</span>
          </label>
          <Input
            id="catch-up-paid-at"
            name="catchUpPaidAt"
            type="date"
            required
            className={employeeInputClass}
          />
        </div>
        <div className={employeeDialogFieldClass}>
          <label className={employeeDialogLabelClass} htmlFor="catch-up-paid-amount">
            {t("pages.projects.catchUp.amountReceived")}
            <span className="text-red-400"> *</span>
          </label>
          <MoneyInput
            id="catch-up-paid-amount"
            name="catchUpPaymentAmount"
            className={employeeInputClass}
            required
          />
        </div>
      </div>

      <CompanyBankAccountField
        name="catchUpBankAccountId"
        accounts={bankAccounts}
        required
        label={t("pages.projects.catchUp.receivingBank")}
        hint={t("pages.projects.catchUp.receivingBankHint")}
      />

      <FileDropField
        id="catch-up-pay-proof"
        name="catchUpPaymentProof"
        label={t("pages.projects.catchUp.paymentProof")}
        required
        multiple
      />

      <div className={employeeDialogFieldClass}>
        <label className={employeeDialogLabelClass} htmlFor="catch-up-staff-total">
          {t("pages.projects.catchUp.staffTotal")}
        </label>
        <p className={employeeDialogHintClass}>
          {t("pages.projects.catchUp.staffTotalHint")}
        </p>
        <MoneyInput
          id="catch-up-staff-total"
          name="staffTotal"
          className={employeeInputClass}
          value={staffTotal}
          onValueChange={setStaffTotal}
        />
      </div>
      {staffPositive ? (
        <FileDropField
          id="catch-up-staff-pdf"
          name="catchUpStaffPdf"
          label={t("pages.projects.catchUp.staffPdf")}
          required
          multiple
        />
      ) : null}

      <div className={employeeDialogFieldClass}>
        <label className={employeeDialogLabelClass} htmlFor="catch-up-material-total">
          {t("pages.projects.catchUp.materialTotal")}
        </label>
        <p className={employeeDialogHintClass}>
          {t("pages.projects.catchUp.materialTotalHint")}
        </p>
        <MoneyInput
          id="catch-up-material-total"
          name="materialTotal"
          className={employeeInputClass}
          value={materialTotal}
          onValueChange={setMaterialTotal}
        />
      </div>
      {materialPositive ? (
        <FileDropField
          id="catch-up-supplier-invoices"
          name="catchUpSupplierInvoices"
          label={t("pages.projects.catchUp.supplierInvoices")}
          required
          multiple
        />
      ) : null}

      <EmployeePrimaryButton type="submit" disabled={pending}>
        {target.kind === "job"
          ? t("pages.projects.catchUp.saveJob")
          : t("pages.projects.catchUp.savePeriod")}
      </EmployeePrimaryButton>
    </form>
  );
}
