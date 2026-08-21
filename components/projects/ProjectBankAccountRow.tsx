"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateProjectBankAccount } from "@/app/projects/actions";
import CompanyBankAccountField from "@/components/company-details/CompanyBankAccountField";
import {
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import {
  formatBankAccountOptionLabel,
  type CompanyBankAccountOption,
} from "@/lib/company-bank-accounts";
import { useT } from "@/lib/i18n/use-t";

type Props = {
  projectId: string;
  bankAccountId: string | null;
  accounts: CompanyBankAccountOption[];
  canEdit: boolean;
};

export default function ProjectBankAccountRow({
  projectId,
  bankAccountId,
  accounts,
  canEdit,
}: Props) {
  const { t } = useT();
  const [value, setValue] = useState(bankAccountId ?? accounts[0]?.id ?? "");
  const [pending, startTransition] = useTransition();

  const selected = accounts.find((account) => account.id === (bankAccountId ?? value));

  if (!canEdit) {
    return (
      <span>
        {selected
          ? formatBankAccountOptionLabel(selected)
          : t("pages.financialReport.filterBankUnassigned")}
      </span>
    );
  }

  function save(next: string) {
    setValue(next);
    const formData = new FormData();
    formData.set("bankAccountId", next);
    startTransition(async () => {
      try {
        await updateProjectBankAccount(projectId, formData);
        toast.success(t("pages.projects.bankAccountSaved"));
      } catch (error) {
        showRejectionFromError(error, t("pages.projects.bankAccountRequired"));
      }
    });
  }

  return (
    <CompanyBankAccountField
      id={`project-bank-${projectId}`}
      accounts={accounts}
      value={value}
      onChange={save}
      disabled={pending}
      hideLabel
      className="max-w-xl !space-y-1"
      hint={t("pages.projects.bankAccountChangeHint")}
    />
  );
}
