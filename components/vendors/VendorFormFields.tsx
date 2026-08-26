"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

import ProjectOptionPills from "@/components/projects/ProjectOptionPills";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { Textarea } from "@/components/ui/textarea";
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
import { resolveContactPersonNameParts } from "@/lib/contact-person";
import { formatDateForInput } from "@/lib/format-tenure";
import { useT } from "@/lib/i18n/use-t";
import { npwpFieldCustomValidity } from "@/lib/npwp";
import { todayDateInput } from "@/lib/project-contract";
import { FileDropField } from "@/components/ui/FileDropField";
import { cn } from "@/lib/utils";
import {
  vendorRequiresIndonesianTaxId,
  type VendorTypeValue,
} from "@/lib/vendor-type";

export type VendorBankAccountDefault = {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  label?: string | null;
};

export type VendorFormDefaults = {
  name?: string;
  /** Auto-assigned short code (read-only; create shows preview). */
  shortCode?: string | null;
  email?: string;
  phone?: string;
  address?: string;
  npwp?: string;
  taxIdDocumentUrl?: string | null;
  vendorSince?: Date | string | null;
  contactPersonFirstName?: string;
  contactPersonLastName?: string;
  contactPersonPosition?: string;
  contactPersonEmail?: string;
  contactPersonPhone?: string;
  vendorType?: VendorTypeValue;
  bankAccounts?: VendorBankAccountDefault[];
};

type Props = {
  mode: "create" | "edit";
  defaults?: VendorFormDefaults;
  /** Next Vendor ID preview for create mode (assigned on save). */
  previewShortCode?: string;
  onFormValuesChange?: () => void;
  /** Prefix form field names (e.g. `line.0.`) for bulk create. */
  namePrefix?: string;
  /** Prefix element ids so multiple forms can sit on one page. */
  idPrefix?: string;
  hideShortCode?: boolean;
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

function initialPersonNameParts(defaults?: VendorFormDefaults): {
  firstName: string;
  lastName: string;
} {
  const first = defaults?.contactPersonFirstName?.trim() ?? "";
  const last = defaults?.contactPersonLastName?.trim() ?? "";
  if (first || last) {
    return { firstName: first, lastName: last };
  }

  if (defaults?.vendorType === "INDIVIDUAL" && defaults.name?.trim()) {
    const parts = resolveContactPersonNameParts(defaults.name, null);
    return {
      firstName: parts.firstName,
      lastName: parts.lastName ?? "",
    };
  }

  return { firstName: "", lastName: "" };
}

export default function VendorFormFields({
  mode,
  defaults,
  previewShortCode,
  onFormValuesChange,
  namePrefix = "",
  idPrefix = "",
  hideShortCode = false,
}: Props) {
  const { t } = useT();
  const nameOf = (field: string) =>
    namePrefix ? `${namePrefix}${field}` : field;
  const idOf = (id: string) => (idPrefix ? `${idPrefix}${id}` : id);
  const initialParts = initialPersonNameParts(defaults);
  const [vendorName, setVendorName] = useState(defaults?.name ?? "");
  const [firstName, setFirstName] = useState(initialParts.firstName);
  const [lastName, setLastName] = useState(initialParts.lastName);
  const [vendorType, setVendorType] = useState<VendorTypeValue>(
    defaults?.vendorType ?? "COMPANY"
  );
  const [selectedTaxIdFileName, setSelectedTaxIdFileName] = useState<
    string | null
  >(null);
  const [bankAccounts, setBankAccounts] = useState<
    Array<{
      bankName: string;
      accountNumber: string;
      accountHolder: string;
      label: string;
    }>
  >(() =>
    defaults?.bankAccounts?.length
      ? defaults.bankAccounts.map((row) => ({
          bankName: row.bankName,
          accountNumber: row.accountNumber,
          accountHolder: row.accountHolder,
          label: row.label ?? "",
        }))
      : [{ bankName: "", accountNumber: "", accountHolder: "", label: "" }]
  );

  const isIndividual = vendorType === "INDIVIDUAL";
  const isOverseas = vendorType === "OVERSEAS";
  const requiresIndonesianTaxId = vendorRequiresIndonesianTaxId(vendorType);
  const individualDisplayName = `${firstName} ${lastName}`.trim();
  const hasExistingTaxIdDocument = Boolean(defaults?.taxIdDocumentUrl);
  const taxIdDocumentRequired =
    requiresIndonesianTaxId && (mode === "create" || !hasExistingTaxIdDocument);

  const shortCodeValue =
    mode === "create"
      ? previewShortCode ?? ""
      : defaults?.shortCode ?? "";

  function handleVendorTypeChange(next: VendorTypeValue) {
    if (next === "INDIVIDUAL" && vendorType !== "INDIVIDUAL") {
      if (!firstName.trim() && !lastName.trim() && vendorName.trim()) {
        const parts = resolveContactPersonNameParts(vendorName, null);
        setFirstName(parts.firstName);
        setLastName(parts.lastName ?? "");
      }
    }
    if (next !== "INDIVIDUAL" && vendorType === "INDIVIDUAL") {
      if (individualDisplayName) {
        setVendorName(individualDisplayName);
      }
    }
    setVendorType(next);
    onFormValuesChange?.();
  }

  const npwpInvalidMessage = isIndividual
    ? t("validation.npwpOrNikInvalid")
    : t("validation.npwpInvalid");
  const npwpRequiredMessage = isIndividual
    ? t("validation.npwpOrNikRequired")
    : t("validation.npwpRequired");

  return (
    <div className={employeeDialogSectionsClass}>
      <div className={employeeDialogSectionClass}>
        <SectionHeading
          title={
            isIndividual
              ? t("pages.vendors.form.organizationIndividual")
              : isOverseas
                ? t("pages.vendors.form.organizationOverseas")
                : t("pages.vendors.form.organization")
          }
          description={
            isIndividual
              ? t("pages.vendors.form.organizationIndividualDesc")
              : isOverseas
                ? t("pages.vendors.form.organizationOverseasDesc")
                : t("pages.vendors.form.organizationDesc")
          }
        />

        <div className={employeeDialogGridClass}>
          <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
            <ProjectOptionPills
              label={t("pages.vendors.form.vendorType")}
              value={vendorType}
              options={[
                {
                  value: "COMPANY",
                  label: t("pages.vendors.form.vendorTypeCompany"),
                },
                {
                  value: "INDIVIDUAL",
                  label: t("pages.vendors.form.vendorTypeIndividual"),
                },
                {
                  value: "OVERSEAS",
                  label: t("pages.vendors.form.vendorTypeOverseas"),
                },
              ]}
              onChange={(value) =>
                handleVendorTypeChange(value as VendorTypeValue)
              }
              columns={3}
            />
            <input type="hidden" name={nameOf("vendorType")} value={vendorType} />
          </div>

          {isIndividual ? (
            <>
              <input
                type="hidden"
                name={nameOf("name")}
                value={individualDisplayName}
              />
              <div className={employeeDialogFieldClass}>
                <label
                  htmlFor={idOf("vendor-first-name")}
                  className={employeeDialogLabelClass}
                >
                  {t("pages.vendors.form.firstName")}
                </label>
                <Input
                  id={idOf("vendor-first-name")}
                  name={nameOf("contactPersonFirstName")}
                  placeholder="e.g. Budi"
                  value={firstName}
                  onChange={(event) => {
                    setFirstName(event.target.value);
                    onFormValuesChange?.();
                  }}
                  required
                  className={employeeInputClass}
                />
              </div>
              <div className={employeeDialogFieldClass}>
                <label
                  htmlFor={idOf("vendor-last-name")}
                  className={employeeDialogLabelClass}
                >
                  {t("pages.vendors.form.lastName")}
                </label>
                <Input
                  id={idOf("vendor-last-name")}
                  name={nameOf("contactPersonLastName")}
                  placeholder="e.g. Santoso"
                  value={lastName}
                  onChange={(event) => {
                    setLastName(event.target.value);
                    onFormValuesChange?.();
                  }}
                  className={employeeInputClass}
                />
              </div>
            </>
          ) : (
            <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
              <label
                htmlFor={idOf("vendor-name")}
                className={employeeDialogLabelClass}
              >
                {t("pages.vendors.form.vendorName")}
              </label>
              <Input
                id={idOf("vendor-name")}
                name={nameOf("name")}
                placeholder="e.g. PT Bahan Bangunan Jaya"
                value={vendorName}
                onChange={(event) => {
                  setVendorName(event.target.value);
                  onFormValuesChange?.();
                }}
                required
                className={employeeInputClass}
              />
            </div>
          )}

          {hideShortCode ? null : (
            <div className={employeeDialogFieldClass}>
              <label
                htmlFor={idOf("vendor-short-code")}
                className={employeeDialogLabelClass}
              >
                {t("pages.vendors.form.shortCode")}
              </label>
              <Input
                id={idOf("vendor-short-code")}
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
          )}

          <div className={employeeDialogFieldClass}>
            <label
              htmlFor={idOf("vendor-email")}
              className={employeeDialogLabelClass}
            >
              {isIndividual
                ? t("pages.vendors.form.email")
                : t("pages.vendors.form.companyEmail")}
            </label>
            <Input
              id={idOf("vendor-email")}
              name={nameOf("email")}
              type="email"
              placeholder={
                isIndividual ? "e.g. budi@email.com" : "info@company.co.id"
              }
              defaultValue={defaults?.email ?? ""}
              className={employeeInputClass}
            />
          </div>

          <div className={employeeDialogFieldClass}>
            <label
              htmlFor={idOf("vendor-phone")}
              className={employeeDialogLabelClass}
            >
              {isIndividual
                ? t("pages.vendors.form.phone")
                : t("pages.vendors.form.companyPhone")}
            </label>
            <PhoneInput
              name={nameOf("phone")}
              formatVariant="landline"
              defaultValue={defaults?.phone ?? ""}
              onValueChange={() => onFormValuesChange?.()}
              inputClassName={employeeInputClass}
              selectClassName={cn(employeeInputClass, "w-[5.5rem] px-3")}
            />
          </div>

          <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
            <label
              htmlFor={idOf("vendor-address")}
              className={employeeDialogLabelClass}
            >
              {isIndividual
                ? t("pages.vendors.form.address")
                : t("pages.vendors.form.companyAddress")}
            </label>
            <Textarea
              id={idOf("vendor-address")}
              name={nameOf("address")}
              placeholder="Street, city, region"
              rows={3}
              defaultValue={defaults?.address ?? ""}
              className={cn(
                employeeInputClass,
                "min-h-[5.5rem] resize-none py-3"
              )}
            />
          </div>

          {requiresIndonesianTaxId ? (
          <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
            <label
              htmlFor={idOf("vendor-npwp")}
              className={employeeDialogLabelClass}
            >
              {isIndividual
                ? t("pages.vendors.form.vendorNpwpOrNik")
                : t("pages.vendors.form.companyNpwp")}
            </label>
            <Input
              id={idOf("vendor-npwp")}
              name={nameOf("npwp")}
              placeholder="e.g. 10.20.0.1-012.000"
              defaultValue={defaults?.npwp ?? ""}
              autoComplete="off"
              inputMode="numeric"
              required
              className={employeeInputClass}
              onInput={(event) => {
                const input = event.currentTarget;
                input.setCustomValidity(
                  npwpFieldCustomValidity(input.value, npwpInvalidMessage, {
                    required: true,
                    requiredMessage: npwpRequiredMessage,
                  })
                );
              }}
              onBlur={(event) => {
                const input = event.currentTarget;
                input.setCustomValidity(
                  npwpFieldCustomValidity(input.value, npwpInvalidMessage, {
                    required: true,
                    requiredMessage: npwpRequiredMessage,
                  })
                );
                if (!input.validity.valid) {
                  input.reportValidity();
                }
              }}
            />
            <p className={employeeDialogHintClass}>
              {isIndividual
                ? t("pages.vendors.form.vendorNpwpOrNikHint")
                : t("pages.vendors.form.companyNpwpHint")}
            </p>
          </div>
          ) : null}

          {requiresIndonesianTaxId ? (
          <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
            <label
              htmlFor={idOf("vendor-tax-id-document")}
              className={employeeDialogLabelClass}
            >
              {isIndividual
                ? t("pages.vendors.form.taxIdDocumentIndividual")
                : t("pages.vendors.form.taxIdDocumentCompany")}
            </label>
            {hasExistingTaxIdDocument ? (
              <p className="mb-2 text-xs text-muted">
                {t("pages.vendors.form.taxIdDocumentCurrent")}{" "}
                <a
                  href={defaults?.taxIdDocumentUrl ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-dark hover:text-accent-teal"
                >
                  {t("pages.vendors.form.taxIdDocumentView")}
                </a>
              </p>
            ) : null}
            <FileDropField
              id={idOf("vendor-tax-id-document")}
              name={nameOf("taxIdDocument")}
              required={taxIdDocumentRequired}
              fileName={selectedTaxIdFileName}
              onPick={(file) => {
                setSelectedTaxIdFileName(file?.name ?? null);
                onFormValuesChange?.();
              }}
              accept="image/*,.pdf"
              emptyLabel={
                hasExistingTaxIdDocument
                  ? t("pages.vendors.form.taxIdDocumentReplace")
                  : isIndividual
                    ? t("pages.vendors.form.taxIdDocumentUploadIndividual")
                    : t("pages.vendors.form.taxIdDocumentUploadCompany")
              }
            />
            <p className={employeeDialogHintClass}>
              {hasExistingTaxIdDocument
                ? t("pages.vendors.form.taxIdDocumentHintEdit")
                : isIndividual
                  ? t("pages.vendors.form.taxIdDocumentHintIndividual")
                  : t("pages.vendors.form.taxIdDocumentHintCompany")}
            </p>
          </div>
          ) : null}

          <div className={employeeDialogFieldClass}>
            <label
              htmlFor={idOf("vendor-since")}
              className={employeeDialogLabelClass}
            >
              {t("pages.vendors.form.vendorSince")}
            </label>
            <Input
              id={idOf("vendor-since")}
              name={nameOf("vendorSince")}
              type="date"
              defaultValue={
                formatDateForInput(defaults?.vendorSince) ||
                (mode === "create" ? todayDateInput() : "")
              }
              className={employeeInputClass}
            />
            <p className={employeeDialogHintClass}>
              {isIndividual
                ? t("pages.vendors.form.vendorSinceHintIndividual")
                : t("pages.vendors.form.vendorSinceHint")}
            </p>
          </div>
        </div>
      </div>

      {!isIndividual ? (
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
                htmlFor={idOf("vendor-contact-first-name")}
                className={employeeDialogLabelClass}
              >
                {t("pages.vendors.form.contactFirstName")}
              </label>
              <Input
                id={idOf("vendor-contact-first-name")}
                name={nameOf("contactPersonFirstName")}
                placeholder="e.g. Budi"
                value={firstName}
                onChange={(event) => {
                  setFirstName(event.target.value);
                  onFormValuesChange?.();
                }}
                required={mode === "create"}
                className={employeeInputClass}
              />
            </div>

            <div className={employeeDialogFieldClass}>
              <label
                htmlFor={idOf("vendor-contact-last-name")}
                className={employeeDialogLabelClass}
              >
                {t("pages.vendors.form.contactLastName")}
              </label>
              <Input
                id={idOf("vendor-contact-last-name")}
                name={nameOf("contactPersonLastName")}
                placeholder="e.g. Santoso"
                value={lastName}
                onChange={(event) => {
                  setLastName(event.target.value);
                  onFormValuesChange?.();
                }}
                className={employeeInputClass}
              />
            </div>

            <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
              <label
                htmlFor={idOf("vendor-contact-position")}
                className={employeeDialogLabelClass}
              >
                {t("pages.vendors.form.contactPosition")}
              </label>
              <Input
                id={idOf("vendor-contact-position")}
                name={nameOf("contactPersonPosition")}
                placeholder="e.g. Sales Manager"
                defaultValue={defaults?.contactPersonPosition ?? ""}
                className={employeeInputClass}
              />
            </div>

            <div className={employeeDialogFieldClass}>
              <label
                htmlFor={idOf("vendor-contact-email")}
                className={employeeDialogLabelClass}
              >
                {t("pages.vendors.form.contactEmail")}
              </label>
              <Input
                id={idOf("vendor-contact-email")}
                name={nameOf("contactPersonEmail")}
                type="email"
                placeholder="e.g. budi@company.co.id"
                defaultValue={defaults?.contactPersonEmail ?? ""}
                className={employeeInputClass}
              />
            </div>

            <div className={employeeDialogFieldClass}>
              <label
                htmlFor={idOf("vendor-contact-phone")}
                className={employeeDialogLabelClass}
              >
                {t("pages.vendors.form.contactPhone")}
              </label>
              <PhoneInput
                name={nameOf("contactPersonPhone")}
                defaultValue={defaults?.contactPersonPhone ?? ""}
                onValueChange={() => onFormValuesChange?.()}
                inputClassName={employeeInputClass}
                selectClassName={cn(employeeInputClass, "w-[5.5rem] px-3")}
              />
            </div>
          </div>
        </div>
      ) : null}

      <div className={employeeDialogSectionClass}>
        <SectionHeading
          title={t("pages.vendors.form.bankAccounts")}
          description={t("pages.vendors.form.bankAccountsDesc")}
        />
        <div className="space-y-4">
          {bankAccounts.map((account, index) => (
            <div
              key={`${index}`}
              className="rounded-2xl border border-border bg-elevated/30 p-4"
            >
              <div className={employeeDialogGridClass}>
                <div className={employeeDialogFieldClass}>
                  <label
                    htmlFor={idOf(`vendor-bank-${index}-name`)}
                    className={employeeDialogLabelClass}
                  >
                    {t("pages.vendors.form.bankName")}
                    <span className="text-red-400"> *</span>
                  </label>
                  <input
                    type="hidden"
                    id={idOf(`vendor-bank-${index}-name`)}
                    name={nameOf(`vendorBank.${index}.bankName`)}
                    value={account.bankName}
                    required
                    data-required-label={t("pages.vendors.form.bankName")}
                  />
                  <Input
                    value={account.bankName}
                    onChange={(event) => {
                      const value = event.target.value;
                      setBankAccounts((current) =>
                        current.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, bankName: value } : row
                        )
                      );
                      onFormValuesChange?.();
                    }}
                    className={employeeInputClass}
                  />
                </div>
                <div className={employeeDialogFieldClass}>
                  <label
                    htmlFor={idOf(`vendor-bank-${index}-number`)}
                    className={employeeDialogLabelClass}
                  >
                    {t("pages.vendors.form.accountNumber")}
                    <span className="text-red-400"> *</span>
                  </label>
                  <input
                    type="hidden"
                    id={idOf(`vendor-bank-${index}-number`)}
                    name={nameOf(`vendorBank.${index}.accountNumber`)}
                    value={account.accountNumber}
                    required
                    data-required-label={t("pages.vendors.form.accountNumber")}
                  />
                  <Input
                    value={account.accountNumber}
                    onChange={(event) => {
                      const value = event.target.value;
                      setBankAccounts((current) =>
                        current.map((row, rowIndex) =>
                          rowIndex === index
                            ? { ...row, accountNumber: value }
                            : row
                        )
                      );
                      onFormValuesChange?.();
                    }}
                    className={employeeInputClass}
                  />
                </div>
                <div className={employeeDialogFieldClass}>
                  <label
                    htmlFor={idOf(`vendor-bank-${index}-holder`)}
                    className={employeeDialogLabelClass}
                  >
                    {t("pages.vendors.form.accountHolder")}
                    <span className="text-red-400"> *</span>
                  </label>
                  <input
                    type="hidden"
                    id={idOf(`vendor-bank-${index}-holder`)}
                    name={nameOf(`vendorBank.${index}.accountHolder`)}
                    value={account.accountHolder}
                    required
                    data-required-label={t("pages.vendors.form.accountHolder")}
                  />
                  <Input
                    value={account.accountHolder}
                    onChange={(event) => {
                      const value = event.target.value;
                      setBankAccounts((current) =>
                        current.map((row, rowIndex) =>
                          rowIndex === index
                            ? { ...row, accountHolder: value }
                            : row
                        )
                      );
                      onFormValuesChange?.();
                    }}
                    className={employeeInputClass}
                  />
                </div>
                <div className={employeeDialogFieldClass}>
                  <label className={employeeDialogLabelClass}>
                    {t("pages.vendors.form.accountLabel")}
                  </label>
                  <input
                    type="hidden"
                    name={nameOf(`vendorBank.${index}.label`)}
                    value={account.label}
                  />
                  <Input
                    value={account.label}
                    placeholder={t("pages.vendors.form.accountLabelPlaceholder")}
                    onChange={(event) => {
                      const value = event.target.value;
                      setBankAccounts((current) =>
                        current.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, label: value } : row
                        )
                      );
                      onFormValuesChange?.();
                    }}
                    className={employeeInputClass}
                  />
                </div>
              </div>
              {bankAccounts.length > 1 ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-3"
                  onClick={() => {
                    setBankAccounts((current) =>
                      current.filter((_, rowIndex) => rowIndex !== index)
                    );
                    onFormValuesChange?.();
                  }}
                >
                  {t("pages.vendors.form.removeBankAccount")}
                </Button>
              ) : null}
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setBankAccounts((current) => [
                ...current,
                { bankName: "", accountNumber: "", accountHolder: "", label: "" },
              ]);
              onFormValuesChange?.();
            }}
          >
            {t("pages.vendors.form.addBankAccount")}
          </Button>
        </div>
      </div>
    </div>
  );
}
