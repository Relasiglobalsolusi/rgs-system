"use client";

import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/use-t";
import {
  extractTaxInvoiceSerialFromFile,
  formatTaxInvoiceSerial,
} from "@/lib/tax-invoice-serial";

export function useTaxInvoiceSerialAssist(file: File | null) {
  const [serial, setSerial] = useState("");
  const [verified, setVerified] = useState(false);
  const [detected, setDetected] = useState(false);
  const [reading, setReading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setVerified(false);
    if (!file) {
      setSerial("");
      setDetected(false);
      setReading(false);
      return;
    }
    setReading(true);
    void extractTaxInvoiceSerialFromFile(file).then((found) => {
      if (cancelled) return;
      setReading(false);
      if (found) {
        setSerial(formatTaxInvoiceSerial(found));
        setDetected(true);
      } else {
        setSerial("");
        setDetected(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [file]);

  return {
    serial,
    setSerial: (value: string) => {
      setSerial(value);
      setVerified(false);
    },
    verified,
    setVerified,
    detected,
    reading,
  };
}

type Props = {
  id: string;
  serial: string;
  onSerialChange: (value: string) => void;
  verified: boolean;
  onVerifiedChange: (value: boolean) => void;
  detected: boolean;
  reading: boolean;
  disabled?: boolean;
  required?: boolean;
};

export default function TaxInvoiceNumberFields({
  id,
  serial,
  onSerialChange,
  verified,
  onVerifiedChange,
  detected,
  reading,
  disabled,
  required = true,
}: Props) {
  const { t } = useT();
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <label htmlFor={id} className="text-sm font-semibold text-text">
          {t("pages.vat.columns.taxInvoiceNumber")}
          {required ? <span className="text-red-400"> *</span> : null}
        </label>
        <Input
          id={id}
          name="taxInvoiceSerial"
          value={serial}
          onChange={(event) => onSerialChange(event.target.value)}
          disabled={disabled || reading}
          required={required}
          autoComplete="off"
          placeholder={t("pages.vat.taxInvoiceNumberPlaceholder")}
        />
        <p className="text-xs text-muted">
          {reading
            ? t("pages.vat.taxInvoiceNumberReading")
            : detected
              ? t("pages.vat.taxInvoiceNumberDetected")
              : t("pages.vat.taxInvoiceNumberHint")}
        </p>
      </div>
      <label className="flex items-start gap-2 text-sm text-text">
        <input
          type="checkbox"
          name="taxInvoiceSerialVerified"
          className="mt-1 h-4 w-4 shrink-0 accent-primary"
          checked={verified}
          disabled={disabled}
          required={required}
          onChange={(event) => onVerifiedChange(event.target.checked)}
        />
        <span>{t("pages.vat.taxInvoiceNumberVerify")}</span>
      </label>
    </div>
  );
}
