"use client";

import {
  employeeSelectTriggerClass,
} from "@/components/employees/employee-dialog-ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  INVENTORY_UNIT_CODES,
  inventoryUnitMessageKey,
  isInventoryUnitCode,
  normalizeInventoryUnit,
} from "@/lib/inventory-units";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

export function inventoryUnitLabel(
  t: (key: string) => string,
  unit: string
): string {
  const code = normalizeInventoryUnit(unit);
  const key = inventoryUnitMessageKey(code);
  return key ? t(key) : unit;
}

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  extraCodes?: string[];
};

export default function InventoryUnitSelect({
  id,
  value,
  onChange,
  disabled = false,
  extraCodes = [],
}: Props) {
  const { t } = useT();
  const current = normalizeInventoryUnit(value);
  const extras = extraCodes
    .map((code) => normalizeInventoryUnit(code))
    .filter((code) => code && !isInventoryUnitCode(code));
  const options = [
    ...INVENTORY_UNIT_CODES,
    ...extras.filter((code, index) => extras.indexOf(code) === index),
  ];

  return (
    <Select
      value={current || null}
      onValueChange={(next) => {
        if (next) onChange(next);
      }}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        className={cn(employeeSelectTriggerClass, "w-full")}
      >
        <SelectValue>
          {(selected) =>
            selected ? inventoryUnitLabel(t, String(selected)) : null
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((code) => (
          <SelectItem key={code} value={code}>
            {inventoryUnitLabel(t, code)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
