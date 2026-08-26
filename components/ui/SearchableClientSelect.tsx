"use client";

import { useMemo, useState } from "react";

import { employeeSelectTriggerClass } from "@/components/employees/employee-dialog-ui";
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
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

export type ClientSelectOption = {
  id: string;
  name: string;
};

type Props = {
  value: string;
  onValueChange: (value: string) => void;
  clients: readonly ClientSelectOption[];
  placeholder: string;
  disabled?: boolean;
  required?: boolean;
  triggerClassName?: string;
};

export default function SearchableClientSelect({
  value,
  onValueChange,
  clients,
  placeholder,
  disabled,
  required,
  triggerClassName,
}: Props) {
  const { t } = useT();
  const [search, setSearch] = useState("");

  const sorted = useMemo(
    () => [...clients].sort((a, b) => a.name.localeCompare(b.name, "en")),
    [clients]
  );

  const items = useMemo(
    () => sorted.map((client) => ({ value: client.id, label: client.name })),
    [sorted]
  );

  const filtered = useMemo(
    () =>
      sorted.filter((client) => matchesDirectorySearch(search, client.name)),
    [sorted, search]
  );

  return (
    <Select
      value={value || null}
      onValueChange={(next) => onValueChange(next ?? "")}
      items={items}
      disabled={disabled}
      required={required}
      onOpenChange={(open) => {
        if (!open) setSearch("");
      }}
    >
      <SelectTrigger className={cn(employeeSelectTriggerClass, triggerClassName)}>
        <SelectValue placeholder={placeholder}>
          {(selected) => {
            if (!selected) return null;
            return sorted.find((entry) => entry.id === selected)?.name ?? null;
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        toolbar={
          <DirectorySearchInput
            value={search}
            onChange={setSearch}
            placeholder={t("common.labels.searchClients")}
            className="max-w-none"
          />
        }
      >
        {filtered.length === 0 ? (
          <div className="px-3 py-4 text-center text-sm text-subtle">
            {t("common.labels.noMatchingClients")}
          </div>
        ) : (
          filtered.map((client) => (
            <SelectItem key={client.id} value={client.id} label={client.name}>
              {client.name}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
