"use client";

import { useState, type ComponentProps } from "react";

import { Input } from "@/components/ui/input";
import { formatIdrInput, idrInputDigits } from "@/lib/project-billing";
import { cn } from "@/lib/utils";

type MoneyInputProps = Omit<
  ComponentProps<"input">,
  "type" | "value" | "defaultValue" | "onChange"
> & {
  value?: string;
  defaultValue?: string | number | null;
  onValueChange?: (digits: string) => void;
};

/**
 * Rupiah amount field that inserts thousand dots as you type
 * (`32000000` → `32.000.000`). Submits digits via a hidden input when `name`
 * is set, so server parsers keep receiving a plain number.
 */
export function MoneyInput({
  id,
  name,
  value,
  defaultValue,
  onValueChange,
  className,
  disabled,
  required,
  placeholder = "0",
  ...props
}: MoneyInputProps) {
  const isControlled = value !== undefined;
  const [internalDigits, setInternalDigits] = useState(() =>
    idrInputDigits(defaultValue ?? "")
  );
  const digits = isControlled ? idrInputDigits(value) : internalDigits;

  return (
    <>
      <Input
        {...props}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        value={formatIdrInput(digits)}
        onChange={(event) => {
          const next = idrInputDigits(event.target.value);
          if (!isControlled) {
            setInternalDigits(next);
          }
          onValueChange?.(next);
        }}
        className={cn("tabular-nums", className)}
      />
      {name ? (
        <input type="hidden" name={name} value={digits} disabled={disabled} />
      ) : null}
    </>
  );
}
