"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_COUNTRY_CODE,
  DEFAULT_PHONE_COUNTRY_ID,
  formatPhoneDigitsByVariant,
  getCursorPositionAfterFormat,
  getPhoneCountryEntryById,
  normalizeNationalDigitsForInput,
  normalizePhoneForStorage,
  parsePhoneValue,
  PHONE_COUNTRY_CODES,
  type PhoneCountryCode,
  type PhoneFormatVariant,
  stripPhoneDigits,
} from "@/lib/phone";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

type PhoneInputProps = {
  name?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  /** mobile: 3+4+4… · landline: 2-digit area code then 4+4… */
  formatVariant?: PhoneFormatVariant;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  selectClassName?: string;
  selectContentClassName?: string;
  onValueChange?: (value: string) => void;
};

export function PhoneInput({
  name = "phone",
  defaultValue = "",
  value,
  onChange,
  placeholder,
  formatVariant = "mobile",
  disabled = false,
  className,
  inputClassName,
  selectClassName,
  selectContentClassName,
  onValueChange,
}: PhoneInputProps) {
  const { t } = useT();
  const resolvedPlaceholder =
    placeholder ?? t("ui.phoneExcludeCountryCode");
  const isControlled = value !== undefined;
  const initial = parsePhoneValue(defaultValue);
  const [uncontrolledCountryId, setUncontrolledCountryId] = useState(
    initial.countryId
  );
  const [uncontrolledLocalDigits, setUncontrolledLocalDigits] = useState(
    initial.localDigits
  );

  const parsed = parsePhoneValue(isControlled ? value : undefined);
  const countryId = isControlled ? parsed.countryId : uncontrolledCountryId;
  const countryEntry =
    getPhoneCountryEntryById(countryId) ??
    getPhoneCountryEntryById(DEFAULT_PHONE_COUNTRY_ID)!;
  const countryCode: PhoneCountryCode = countryEntry.code;
  const localDigits = isControlled ? parsed.localDigits : uncontrolledLocalDigits;

  const formattedLocal = formatPhoneDigitsByVariant(localDigits, formatVariant);
  const storedValue = normalizePhoneForStorage(
    countryCode,
    localDigits,
    countryId
  );

  function commitLocalDigits(
    nextCountryId: string,
    rawDigits: string,
    input?: HTMLInputElement
  ) {
    const nextEntry =
      getPhoneCountryEntryById(nextCountryId) ??
      getPhoneCountryEntryById(DEFAULT_PHONE_COUNTRY_ID)!;
    const nextCountryCode = nextEntry.code;
    const nextDigits = normalizeNationalDigitsForInput(
      nextCountryCode,
      rawDigits,
      nextEntry.id
    );

    if (isControlled) {
      onChange?.(
        normalizePhoneForStorage(nextCountryCode, nextDigits, nextEntry.id)
      );
    } else {
      setUncontrolledCountryId(nextEntry.id);
      setUncontrolledLocalDigits(nextDigits);
    }

    onValueChange?.(
      normalizePhoneForStorage(nextCountryCode, nextDigits, nextEntry.id)
    );

    if (input) {
      const cursorPos = input.selectionStart ?? 0;
      const digitsBeforeCursor = stripPhoneDigits(
        input.value.slice(0, cursorPos)
      ).length;
      requestAnimationFrame(() => {
        const formatted = formatPhoneDigitsByVariant(nextDigits, formatVariant);
        const nextCursor = getCursorPositionAfterFormat(
          formatted,
          digitsBeforeCursor
        );
        input.setSelectionRange(nextCursor, nextCursor);
      });
    }
  }

  function handleLocalChange(event: React.ChangeEvent<HTMLInputElement>) {
    commitLocalDigits(
      countryId,
      stripPhoneDigits(event.target.value),
      event.target
    );
  }

  function handleLocalBlur() {
    const nextDigits = normalizeNationalDigitsForInput(
      countryCode,
      localDigits,
      countryId
    );
    if (nextDigits === localDigits) return;

    if (isControlled) {
      onChange?.(
        normalizePhoneForStorage(countryCode, nextDigits, countryId)
      );
    } else {
      setUncontrolledLocalDigits(nextDigits);
    }

    onValueChange?.(
      normalizePhoneForStorage(countryCode, nextDigits, countryId)
    );
  }

  function handleCountryChange(nextCountryId: string | null) {
    if (!nextCountryId) return;
    commitLocalDigits(nextCountryId, localDigits);
  }

  return (
    <div className={cn("flex gap-2", className)}>
      <Select
        value={countryEntry.id}
        onValueChange={handleCountryChange}
        disabled={disabled}
      >
        <SelectTrigger
          className={cn("w-[6.5rem] shrink-0", selectClassName)}
          aria-label={t("ui.countryCode")}
        >
          <SelectValue>{countryCode || DEFAULT_COUNTRY_CODE}</SelectValue>
        </SelectTrigger>
        <SelectContent
          className={cn(
            // Wider than the compact dial-code trigger (anchor width is ~6.5rem).
            "max-h-72 w-max min-w-[18rem] max-w-[min(24rem,90vw)]",
            selectContentClassName
          )}
        >
          {PHONE_COUNTRY_CODES.map((entry) => (
            <SelectItem key={entry.id} value={entry.id} className="whitespace-nowrap">
              <span className="flex w-full min-w-0 items-baseline gap-2">
                <span className="inline-block min-w-[3.25rem] shrink-0 text-left tabular-nums">
                  {entry.code}
                </span>
                <span className="min-w-0 flex-1 text-left">{entry.label}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        value={formattedLocal}
        onChange={handleLocalChange}
        onBlur={handleLocalBlur}
        placeholder={resolvedPlaceholder}
        disabled={disabled}
        className={cn("min-w-0 flex-1", inputClassName)}
      />

      {!isControlled && (
        <input type="hidden" name={name} value={storedValue} />
      )}
    </div>
  );
}

export { DEFAULT_COUNTRY_CODE };
