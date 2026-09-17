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
  suggestedExclusive,
  periodId,
}: {
  projectId: string;
  target: CatchUpCompleteTarget;
  bankAccounts: CompanyBankAccountOption[];
  suggestedExclusive?: number | null;
  periodId?: string | null;
}) {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [staffTotal, setStaffTotal] = useState("");
  const [materialTotal, setMaterialTotal] = useState("");
  const [paid, setPaid] = useState(false);

  function submit(formData: FormData) {
    formData.set("projectId", projectId);
    formData.set("periodStart", target.periodStart);
    formData.set("periodEnd", target.periodEnd);
    formData.set("completeKind", target.kind);
    if (paid) formData.set("catchUpPaid", "1");
    startTransition(async () => {
      try {
        const result = await completeCatchUpPeriod(formData);
        const nextId = result?.periodId ?? periodId ?? null;
        router.push(
          nextId
            ? `/projects/${projectId}/periods/${nextId}`
            : `/projects/${projectId}`
        );
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
          defaultValue={
            suggestedExclusive && suggestedExclusive > 0
              ? suggestedExclusive
              : undefined
          }
        />
      </div>

      <FileDropField
        id="catch-up-tax"
        name="catchUpTaxInvoice"
        label={t("pages.projects.catchUp.taxInvoice")}
        required
        multiple
      />
      <p className={employeeDialogHintClass}>
        {t("pages.projects.catchUp.invoiceHint")}{" "}
        {t("pages.projects.catchUp.taxInvoiceHint")}
      </p>

      <label className="flex items-start gap-2 text-sm text-text">
        <input
          type="checkbox"
          className="mt-1"
          checked={paid}
          onChange={(event) => setPaid(event.target.checked)}
        />
        <span>
          {t("pages.projects.catchUp.paymentReceived")}
          <span className={`mt-1 block ${employeeDialogHintClass}`}>
            {t("pages.projects.catchUp.paymentHint")}
          </span>
        </span>
      </label>

      {paid ? (
      <>
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
      </>
      ) : null}

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
