"use client";

import { useMemo, useState } from "react";

import {
  employeeDialogFieldClass,
  employeeDialogHintClass,
  employeeDialogLabelClass,
  employeeSelectTriggerClass,
} from "@/components/employees/employee-dialog-ui";
import DirectorySearchInput, {
  matchesDirectorySearch,
} from "@/components/ui/DirectorySearchInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatBankAccountOptionLabel,
  type CompanyBankAccountOption,
} from "@/lib/company-bank-accounts";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

const SEARCHABLE_MIN_ACCOUNTS = 6;

type Props = {
  name?: string;
  id?: string;
  accounts: CompanyBankAccountOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (id: string) => void;
  required?: boolean;
  disabled?: boolean;
  label?: string;
  hint?: string;
  hideLabel?: boolean;
  className?: string;
};

export default function CompanyBankAccountField({
  name = "bankAccountId",
  id,
  accounts,
  value,
  defaultValue,
  onChange,
  required,
  disabled = false,
  label,
  hint,
  hideLabel = false,
  className,
}: Props) {
  const { t } = useT();
  const controlled = value != null;
  const empty = accounts.length === 0;
  const isRequired = required ?? !empty;
  const searchable = accounts.length >= SEARCHABLE_MIN_ACCOUNTS;
  const [search, setSearch] = useState("");
  const [uncontrolled, setUncontrolled] = useState(
    () => defaultValue ?? accounts[0]?.id ?? ""
  );
  const selected = controlled ? value : uncontrolled;

  const items = useMemo(
    () =>
      accounts.map((account) => ({
        value: account.id,
        label: formatBankAccountOptionLabel(account),
      })),
    [accounts]
  );

  const filtered = useMemo(
    () =>
      accounts.filter((account) =>
        matchesDirectorySearch(
          search,
          account.bankName,
          account.accountNumber,
          account.accountHolder,
          account.label
        )
      ),
    [accounts, search]
  );

  function setSelected(next: string) {
    if (!controlled) setUncontrolled(next);
    onChange?.(next);
  }

  return (
    <div className={cn(employeeDialogFieldClass, className)}>
      {hideLabel ? (
        <label htmlFor={id ?? name} className="sr-only">
          {label ?? t("pages.projects.bankAccount")}
        </label>
      ) : (
        <label htmlFor={id ?? name} className={employeeDialogLabelClass}>
          {label ?? t("pages.projects.bankAccount")}
          {isRequired ? <span className="text-danger"> *</span> : null}
        </label>
      )}
      <input type="hidden" name={name} value={selected} />
      <Select
        value={selected ? selected : null}
        onValueChange={(next) => setSelected(next ?? "")}
        items={items}
        disabled={disabled || empty}
        required={isRequired && !empty}
        onOpenChange={(open) => {
          if (!open) setSearch("");
        }}
      >
        <SelectTrigger
          id={id ?? name}
          className={employeeSelectTriggerClass}
        >
          <SelectValue
            placeholder={t("pages.projects.bankAccountPlaceholder")}
          >
            {(current) => {
              if (!current) return null;
              const account = accounts.find((row) => row.id === current);
              return account ? formatBankAccountOptionLabel(account) : null;
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent
          toolbar={
            searchable ? (
              <DirectorySearchInput
                value={search}
                onChange={setSearch}
                placeholder={t("common.labels.searchBankAccounts")}
                className="max-w-none"
              />
            ) : undefined
          }
        >
          {empty ? (
            <div className="px-3 py-4 text-center text-sm text-subtle">
              {t("pages.projects.bankAccountEmpty")}
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-subtle">
              {t("common.labels.noMatchingBankAccounts")}
            </div>
          ) : (
            filtered.map((account) => {
              const optionLabel = formatBankAccountOptionLabel(account);
              return (
                <SelectItem
                  key={account.id}
                  value={account.id}
                  label={optionLabel}
                >
                  {optionLabel}
                </SelectItem>
              );
            })
          )}
        </SelectContent>
      </Select>
      <p className={employeeDialogHintClass}>
        {hint ??
          (empty
            ? t("pages.projects.bankAccountEmpty")
            : t("pages.projects.bankAccountHint"))}
      </p>
    </div>
  );
}
