"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { Textarea } from "@/components/ui/textarea";
import YesNoChoiceCards, {
  type YesNoChoice,
} from "@/components/ui/YesNoChoiceCards";
import {
  employeeDialogFieldClass,
  employeeDialogGridClass,
  employeeDialogHintClass,
  employeeDialogLabelClass,
  employeeDialogSectionClass,
  employeeDialogSectionHeadingClass,
  employeeDialogSectionsClass,
  employeeInputClass,
} from "@/components/employees/employee-dialog-ui";
import { cn } from "@/lib/utils";
import { todayDateInput } from "@/lib/project-contract";
import { formatDateForInput } from "@/lib/format-tenure";
import { useT } from "@/lib/i18n/use-t";
import { npwpFieldCustomValidity } from "@/lib/npwp";
import { PAYMENT_TERMS_DAYS_OPTIONS } from "@/lib/invoice-period";

export type VendorFormDefaults = {
  name?: string;
  /** Auto-assigned short code (read-only; create shows preview). */
  shortCode?: string | null;
  email?: string;
  phone?: string;
  address?: string;
  npwp?: string;
  vendorSince?: Date | string | null;
  /** Payment terms in days; 0 = Cash (default 14). */
  paymentTermsDays?: number | null;
  contactPersonFirstName?: string;
  contactPersonLastName?: string;
  contactPersonPosition?: string;
  contactPersonEmail?: string;
  contactPersonPhone?: string;
};

const PAYMENT_TERMS_OPTIONS = PAYMENT_TERMS_DAYS_OPTIONS;

type Props = {
  mode: "create" | "edit";
  defaults?: VendorFormDefaults;
  /** Next Vendor ID preview for create mode (assigned on save). */
  previewShortCode?: string;
  onFormValuesChange?: () => void;
};

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className={employeeDialogSectionHeadingClass}>
      <h3 className="text-sm font-semibold text-text">{title}</h3>
      {description && (
        <p className={employeeDialogHintClass}>{description}</p>
      )}
    </div>
  );
}

export default function VendorFormFields({
  mode,
  defaults,
  previewShortCode,
  onFormValuesChange,
}: Props) {
  const { t } = useT();
  const [createPortalLogin, setCreatePortalLogin] =
    useState<YesNoChoice>("No");

  const shortCodeValue =
    mode === "create"
      ? previewShortCode ?? ""
      : defaults?.shortCode ?? "";

  return (
    <div className={employeeDialogSectionsClass}>
      <div className={employeeDialogSectionClass}>
        <SectionHeading
          title={t("pages.vendors.form.organization")}
          description={t("pages.vendors.form.organizationDesc")}
        />

        <div className={employeeDialogGridClass}>
          <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
            <label htmlFor="vendor-name" className={employeeDialogLabelClass}>
              {t("pages.vendors.form.vendorName")}
            </label>
            <Input
              id="vendor-name"
              name="name"
              placeholder="e.g. PT Bahan Bangunan Jaya"
              defaultValue={defaults?.name ?? ""}
              required
              className={employeeInputClass}
            />
          </div>

          <div className={employeeDialogFieldClass}>
            <label
              htmlFor="vendor-short-code"
              className={employeeDialogLabelClass}
            >
              {t("pages.vendors.form.shortCode")}
            </label>
            <Input
              id="vendor-short-code"
              value={shortCodeValue}
              readOnly
              placeholder={
                mode === "create"
                  ? t("pages.vendors.form.shortCodeLoading")
                  : undefined
              }
              className={cn(employeeInputClass, "text-primary-dark")}
            />
            <p className={employeeDialogHintClass}>
              {mode === "create"
                ? t("pages.vendors.form.shortCodePreviewHint")
                : t("pages.vendors.form.shortCodeHint")}
            </p>
          </div>

          <div className={employeeDialogFieldClass}>
            <label htmlFor="vendor-email" className={employeeDialogLabelClass}>
              {t("pages.vendors.form.companyEmail")}
            </label>
            <Input
              id="vendor-email"
              name="email"
              type="email"
              placeholder="info@company.co.id"
              defaultValue={defaults?.email ?? ""}
              className={employeeInputClass}
            />
          </div>

          <div className={employeeDialogFieldClass}>
            <label htmlFor="vendor-phone" className={employeeDialogLabelClass}>
              {t("pages.vendors.form.companyPhone")}
            </label>
            <PhoneInput
              name="phone"
              formatVariant="landline"
              defaultValue={defaults?.phone ?? ""}
              onValueChange={() => onFormValuesChange?.()}
              inputClassName={employeeInputClass}
              selectClassName={cn(employeeInputClass, "w-[5.5rem] px-3")}
            />
          </div>

          <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
            <label htmlFor="vendor-address" className={employeeDialogLabelClass}>
              {t("pages.vendors.form.companyAddress")}
            </label>
            <Textarea
              id="vendor-address"
              name="address"
              placeholder="Street, city, region"
              rows={3}
              defaultValue={defaults?.address ?? ""}
              className={cn(
                employeeInputClass,
                "min-h-[5.5rem] resize-none py-3"
              )}
            />
          </div>

          <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
            <label htmlFor="vendor-npwp" className={employeeDialogLabelClass}>
              {t("pages.vendors.form.companyNpwp")}
            </label>
            <Input
              id="vendor-npwp"
              name="npwp"
              placeholder="e.g. 10.20.0.1-012.000"
              defaultValue={defaults?.npwp ?? ""}
              autoComplete="off"
              inputMode="numeric"
              className={employeeInputClass}
              onInput={(event) => {
                const input = event.currentTarget;
                input.setCustomValidity(
                  npwpFieldCustomValidity(
                    input.value,
                    t("validation.npwpInvalid")
                  )
                );
              }}
              onBlur={(event) => {
                const input = event.currentTarget;
                input.setCustomValidity(
                  npwpFieldCustomValidity(
                    input.value,
                    t("validation.npwpInvalid")
                  )
                );
                if (input.value.trim() && !input.validity.valid) {
                  input.reportValidity();
                }
              }}
            />
            <p className={employeeDialogHintClass}>
              {t("pages.vendors.form.companyNpwpHint")}
            </p>
          </div>

          <div className={employeeDialogFieldClass}>
            <label
              htmlFor="vendor-since"
              className={employeeDialogLabelClass}
            >
              {t("pages.vendors.form.vendorSince")}
            </label>
            <Input
              id="vendor-since"
              name="vendorSince"
              type="date"
              defaultValue={
                formatDateForInput(defaults?.vendorSince) ||
                (mode === "create" ? todayDateInput() : "")
              }
              className={employeeInputClass}
            />
            <p className={employeeDialogHintClass}>
              {t("pages.vendors.form.vendorSinceHint")}
            </p>
          </div>

          <div className={employeeDialogFieldClass}>
            <label
              htmlFor="vendor-payment-terms"
              className={employeeDialogLabelClass}
            >
              {t("pages.vendors.form.paymentTerms")}
            </label>
            <select
              id="vendor-payment-terms"
              name="paymentTermsDays"
              defaultValue={String(
                defaults?.paymentTermsDays != null &&
                  PAYMENT_TERMS_OPTIONS.includes(
                    defaults.paymentTermsDays as (typeof PAYMENT_TERMS_OPTIONS)[number]
                  )
                  ? defaults.paymentTermsDays
                  : 14
              )}
              className={employeeInputClass}
              onChange={() => onFormValuesChange?.()}
            >
              {PAYMENT_TERMS_OPTIONS.map((days) => (
                <option key={days} value={days}>
                  {days === 0
                    ? t("common.paymentTerms.cash")
                    : t("common.paymentTerms.net", { days })}
                </option>
              ))}
            </select>
            <p className={employeeDialogHintClass}>
              {t("pages.vendors.form.paymentTermsHint")}
            </p>
          </div>
        </div>
      </div>

      <div className={employeeDialogSectionClass}>
        <SectionHeading
          title={t("pages.vendors.form.contactPerson")}
          description={
            mode === "create"
              ? t("pages.vendors.form.contactPersonDescCreate")
              : t("pages.vendors.form.contactPersonDescEdit")
          }
        />

        <div className={employeeDialogGridClass}>
          <div className={employeeDialogFieldClass}>
            <label
              htmlFor="vendor-contact-first-name"
              className={employeeDialogLabelClass}
            >
              {t("pages.vendors.form.contactFirstName")}
            </label>
            <Input
              id="vendor-contact-first-name"
              name="contactPersonFirstName"
              placeholder="e.g. Budi"
              defaultValue={defaults?.contactPersonFirstName ?? ""}
              required={mode === "create"}
              className={employeeInputClass}
            />
          </div>

          <div className={employeeDialogFieldClass}>
            <label
              htmlFor="vendor-contact-last-name"
              className={employeeDialogLabelClass}
            >
              {t("pages.vendors.form.contactLastName")}
            </label>
            <Input
              id="vendor-contact-last-name"
              name="contactPersonLastName"
              placeholder="e.g. Santoso"
              defaultValue={defaults?.contactPersonLastName ?? ""}
              className={employeeInputClass}
            />
          </div>

          <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
            <label
              htmlFor="vendor-contact-position"
              className={employeeDialogLabelClass}
            >
              {t("pages.vendors.form.contactPosition")}
            </label>
            <Input
              id="vendor-contact-position"
              name="contactPersonPosition"
              placeholder="e.g. Sales Manager"
              defaultValue={defaults?.contactPersonPosition ?? ""}
              className={employeeInputClass}
            />
          </div>

          <div className={employeeDialogFieldClass}>
            <label
              htmlFor="vendor-contact-email"
              className={employeeDialogLabelClass}
            >
              {t("pages.vendors.form.contactEmail")}
            </label>
            <Input
              id="vendor-contact-email"
              name="contactPersonEmail"
              type="email"
              placeholder="e.g. budi@company.co.id"
              defaultValue={defaults?.contactPersonEmail ?? ""}
              className={employeeInputClass}
            />
          </div>

          <div className={employeeDialogFieldClass}>
            <label
              htmlFor="vendor-contact-phone"
              className={employeeDialogLabelClass}
            >
              {t("pages.vendors.form.contactPhone")}
            </label>
            <PhoneInput
              name="contactPersonPhone"
              defaultValue={defaults?.contactPersonPhone ?? ""}
              onValueChange={() => onFormValuesChange?.()}
              inputClassName={employeeInputClass}
              selectClassName={cn(employeeInputClass, "w-[5.5rem] px-3")}
            />
          </div>
        </div>
      </div>

      {mode === "create" ? (
        <div className={employeeDialogSectionClass}>
          <SectionHeading
            title={t("pages.vendors.form.portalAccess")}
            description={t("pages.vendors.form.portalAccessDesc")}
          />

          <div className={employeeDialogGridClass}>
            <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
              <label
                id="vendor-create-portal-login-label"
                htmlFor="vendor-create-portal-login"
                className={employeeDialogLabelClass}
              >
                {t("pages.vendors.form.createPortalLogin")}
              </label>
              <YesNoChoiceCards
                id="vendor-create-portal-login"
                labelledBy="vendor-create-portal-login-label"
                value={createPortalLogin}
                onChange={(value) => {
                  setCreatePortalLogin(value);
                  onFormValuesChange?.();
                }}
              />
              <input
                type="hidden"
                name="createPortalLogin"
                value={createPortalLogin}
              />
              <p className={employeeDialogHintClass}>
                {t("pages.vendors.form.createPortalLoginHint")}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
