"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Landmark } from "lucide-react";
import { toast } from "sonner";

import { deleteCompanyBankAccount } from "@/app/company-details/actions";
import CompanyBankAccountDialog from "@/components/company-details/CompanyBankAccountDialog";
import {
  employeeDialogHintClass,
  employeeDialogSectionHeadingClass,
} from "@/components/employees/employee-dialog-ui";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import DirectoryAddButton from "@/components/ui/DirectoryAddButton";
import EmptyState from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/button";
import { trashActionChipClassName } from "@/components/ui/trash-action-buttons";
import { cardTintIcon, cardTintWash } from "@/components/ui/card-tint";
import type { CompanyBankAccountOption } from "@/lib/company-bank-accounts";
import { useT } from "@/lib/i18n/use-t";

type Props = {
  accounts: CompanyBankAccountOption[];
};

export default function CompanyBankAccountsCard({ accounts }: Props) {
  const { t } = useT();
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CompanyBankAccountOption | null>(null);
  const [pending, startTransition] = useTransition();

  function openAdd() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(account: CompanyBankAccountOption) {
    setEditing(account);
    setDialogOpen(true);
  }

  function handleDelete(account: CompanyBankAccountOption) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", account.id);
      const result = await deleteCompanyBankAccount(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t("pages.companyDetails.bank.deleted"));
      router.refresh();
    });
  }

  const columns: DataTableColumn<CompanyBankAccountOption>[] = [
    {
      key: "bankName",
      title: t("pages.companyDetails.bank.columns.bankName"),
      width: "11rem",
      share: 1.2,
      render: (row) => (
        <p className="font-medium text-text">{row.bankName}</p>
      ),
    },
    {
      key: "accountNumber",
      title: t("pages.companyDetails.bank.columns.accountNumber"),
      width: "11rem",
      className: "tabular-nums",
      render: (row) => row.accountNumber || "—",
    },
    {
      key: "accountHolder",
      title: t("pages.companyDetails.bank.columns.accountHolder"),
      width: "12rem",
      share: 1.2,
      render: (row) => row.accountHolder || "—",
    },
    {
      key: "label",
      title: t("pages.companyDetails.bank.columns.label"),
      width: "9rem",
      render: (row) => row.label?.trim() || "—",
    },
    {
      key: "actions",
      title: t("pages.companyDetails.bank.columns.actions"),
      width: "16rem",
      align: "center",
      render: (row) => (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            type="button"
            size="badge"
            variant="outline"
            className={trashActionChipClassName}
            disabled={pending}
            onClick={() => openEdit(row)}
          >
            {t("common.actions.edit")}
          </Button>
          <Button
            type="button"
            size="badge"
            variant="destructiveBadge"
            className={trashActionChipClassName}
            disabled={pending}
            onClick={() => handleDelete(row)}
          >
            {t("common.actions.delete")}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <section className={`rounded-2xl border p-6 sm:p-8 ${cardTintWash.primary}`}>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${cardTintIcon.primary}`}
          >
            <Landmark size={18} />
          </div>
          <div className={employeeDialogSectionHeadingClass}>
            <h3 className="text-sm font-semibold text-text">
              {t("pages.companyDetails.sections.bank")}
            </h3>
            <p className={employeeDialogHintClass}>
              {t("pages.companyDetails.sections.bankHint")}
            </p>
          </div>
        </div>
        <DirectoryAddButton
          label={t("pages.companyDetails.bank.add")}
          onClick={openAdd}
        />
      </div>

      {accounts.length === 0 ? (
        <EmptyState
          titleKey="pages.companyDetails.bank.empty"
          descriptionKey="pages.companyDetails.bank.emptyDesc"
        />
      ) : (
        <DataTable
          data={accounts}
          columns={columns}
          getRowKey={(row) => row.id}
        />
      )}

      <CompanyBankAccountDialog
        open={dialogOpen}
        onOpenChange={(next) => {
          setDialogOpen(next);
          if (!next) setEditing(null);
        }}
        account={editing}
        onSaved={() => router.refresh()}
      />
    </section>
  );
}
