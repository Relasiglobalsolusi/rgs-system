"use client";

import { useEffect, useMemo, useState } from "react";

import ProjectOptionPills from "@/components/projects/ProjectOptionPills";
import { Button } from "@/components/ui/button";
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
import {
  isValidClientLoginId,
  suggestClientLoginIds,
} from "@/lib/client-login-id";
import { resolveContactPersonNameParts } from "@/lib/contact-person";
import { formatDateForInput } from "@/lib/format-tenure";
import { useT } from "@/lib/i18n/use-t";
import { PAYMENT_TERMS_DAYS_OPTIONS } from "@/lib/invoice-period";
import { npwpFieldCustomValidity } from "@/lib/npwp";
import { todayDateInput } from "@/lib/project-contract";
import { cn } from "@/lib/utils";

export type ClientFormDefaults = {
  name?: string;
  /** Auto-assigned short code (read-only; create shows preview). */
  shortCode?: string | null;
  email?: string;
  phone?: string;
  address?: string;
  npwp?: string;
  clientSince?: Date | string | null;
  /** Payment terms in days; 0 = Cash (default 14). */
  paymentTermsDays?: number | null;
  contactPersonFirstName?: string;
  contactPersonLastName?: string;
  contactPersonPosition?: string;
  contactPersonEmail?: string;
  contactPersonPhone?: string;
  clientType?: "COMPANY" | "INDIVIDUAL";
  multiProjectAccess?: boolean;
};

const PAYMENT_TERMS_OPTIONS = PAYMENT_TERMS_DAYS_OPTIONS;

type Props = {
  mode: "create" | "edit";
  defaults?: ClientFormDefaults;
  /** Next Client ID preview for create mode (assigned on save). */
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

function initialPersonNameParts(defaults?: ClientFormDefaults): {
  firstName: string;
  lastName: string;
} {
  const first = defaults?.contactPersonFirstName?.trim() ?? "";
  const last = defaults?.contactPersonLastName?.trim() ?? "";
  if (first || last) {
    return { firstName: first, lastName: last };
  }

  if (defaults?.clientType === "INDIVIDUAL" && defaults.name?.trim()) {
    const parts = resolveContactPersonNameParts(defaults.name, null);
    return {
      firstName: parts.firstName,
      lastName: parts.lastName ?? "",
    };
  }

  return { firstName: "", lastName: "" };
}

export default function ClientFormFields({
  mode,
  defaults,
  previewShortCode,
  onFormValuesChange,
}: Props) {
  const { t } = useT();
  const initialParts = initialPersonNameParts(defaults);
  const [clientName, setClientName] = useState(defaults?.name ?? "");
  const [firstName, setFirstName] = useState(initialParts.firstName);
  const [lastName, setLastName] = useState(initialParts.lastName);
  const [clientType, setClientType] = useState<"COMPANY" | "INDIVIDUAL">(
    defaults?.clientType ?? "COMPANY"
  );
  const [multiProjectAccess, setMultiProjectAccess] = useState<YesNoChoice>(
    () => (defaults?.multiProjectAccess ? "Yes" : "No")
  );
  const [loginIdAvoid, setLoginIdAvoid] = useState<string[]>([]);
  const [loginId, setLoginId] = useState("");

  const isIndividual = clientType === "INDIVIDUAL";
  const individualDisplayName = `${firstName} ${lastName}`.trim();
  const loginSourceName = isIndividual ? individualDisplayName : clientName;

  const loginSuggestions = useMemo(
    () =>
      suggestClientLoginIds(loginSourceName || "client portal", {
        avoid: loginIdAvoid,
        count: 5,
      }),
    [loginSourceName, loginIdAvoid]
  );

  useEffect(() => {
    if (mode !== "create") return;
    if (!loginId || !loginSuggestions.includes(loginId)) {
      setLoginId(loginSuggestions[0] ?? "");
    }
  }, [loginSuggestions, loginId, mode]);

  const shortCodeValue =
    mode === "create" ? previewShortCode ?? "" : defaults?.shortCode ?? "";

  function handleClientTypeChange(next: "COMPANY" | "INDIVIDUAL") {
    if (next === "INDIVIDUAL" && clientType === "COMPANY") {
      if (!firstName.trim() && !lastName.trim() && clientName.trim()) {
        const parts = resolveContactPersonNameParts(clientName, null);
        setFirstName(parts.firstName);
        setLastName(parts.lastName ?? "");
      }
      if (mode === "create") {
        setMultiProjectAccess("No");
      }
    }
    if (next === "COMPANY" && clientType === "INDIVIDUAL") {
      if (individualDisplayName) {
        setClientName(individualDisplayName);
      }
    }
    setClientType(next);
    onFormValuesChange?.();
  }

  const npwpInvalidMessage = isIndividual
    ? t("validation.npwpOrNikInvalid")
    : t("validation.npwpInvalid");

  return (
    <div className={employeeDialogSectionsClass}>
      <div className={employeeDialogSectionClass}>
        <SectionHeading
          title={
            isIndividual
              ? t("pages.clients.form.organizationIndividual")
              : t("pages.clients.form.organization")
          }
          description={
            isIndividual
              ? t("pages.clients.form.organizationIndividualDesc")
              : t("pages.clients.form.organizationDesc")
          }
        />

        <div className={employeeDialogGridClass}>
          <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
            <ProjectOptionPills
              label={t("pages.clients.form.clientType")}
              value={clientType}
              options={[
                {
                  value: "COMPANY",
                  label: t("pages.clients.form.clientTypeCompany"),
                },
                {
                  value: "INDIVIDUAL",
                  label: t("pages.clients.form.clientTypeIndividual"),
                },
              ]}
              onChange={(value) =>
                handleClientTypeChange(value as "COMPANY" | "INDIVIDUAL")
              }
              columns={2}
            />
            <input type="hidden" name="clientType" value={clientType} />
          </div>

          {isIndividual ? (
            <>
              <input type="hidden" name="name" value={individualDisplayName} />
              <div className={employeeDialogFieldClass}>
                <label
                  htmlFor="client-first-name"
                  className={employeeDialogLabelClass}
                >
                  {t("pages.clients.form.firstName")}
                </label>
                <Input
                  id="client-first-name"
                  name="contactPersonFirstName"
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
                  htmlFor="client-last-name"
                  className={employeeDialogLabelClass}
                >
                  {t("pages.clients.form.lastName")}
                </label>
                <Input
                  id="client-last-name"
                  name="contactPersonLastName"
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
              <label htmlFor="client-name" className={employeeDialogLabelClass}>
                {t("pages.clients.form.clientName")}
              </label>
              <Input
                id="client-name"
                name="name"
                placeholder="e.g. PT Gedung Sejahtera"
                value={clientName}
                onChange={(event) => {
                  setClientName(event.target.value);
                  onFormValuesChange?.();
                }}
                required
                className={employeeInputClass}
              />
            </div>
          )}

          <div className={employeeDialogFieldClass}>
            <label
              htmlFor="client-short-code"
              className={employeeDialogLabelClass}
            >
              {t("pages.clients.form.shortCode")}
            </label>
            <Input
              id="client-short-code"
              value={shortCodeValue}
              readOnly
              placeholder={
                mode === "create"
                  ? t("pages.clients.form.shortCodeLoading")
                  : undefined
              }
              className={cn(employeeInputClass, "text-primary-dark")}
            />
            <p className={employeeDialogHintClass}>
              {mode === "create"
                ? t("pages.clients.form.shortCodePreviewHint")
                : t("pages.clients.form.shortCodeHint")}
            </p>
          </div>

          <div className={employeeDialogFieldClass}>
            <label htmlFor="client-email" className={employeeDialogLabelClass}>
              {isIndividual
                ? t("pages.clients.form.email")
                : t("pages.clients.form.companyEmail")}
            </label>
            <Input
              id="client-email"
              name="email"
              type="email"
              placeholder={
                isIndividual ? "e.g. budi@email.com" : "info@company.co.id"
              }
              defaultValue={defaults?.email ?? ""}
              className={employeeInputClass}
            />
          </div>

          <div className={employeeDialogFieldClass}>
            <label htmlFor="client-phone" className={employeeDialogLabelClass}>
              {isIndividual
                ? t("pages.clients.form.phone")
                : t("pages.clients.form.companyPhone")}
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
            <label
              htmlFor="client-address"
              className={employeeDialogLabelClass}
            >
              {isIndividual
                ? t("pages.clients.form.address")
                : t("pages.clients.form.companyAddress")}
            </label>
            <Textarea
              id="client-address"
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
            <label htmlFor="client-npwp" className={employeeDialogLabelClass}>
              {isIndividual
                ? t("pages.clients.form.clientNpwpOrNik")
                : t("pages.clients.form.companyNpwp")}
            </label>
            <Input
              id="client-npwp"
              name="npwp"
              placeholder="e.g. 10.20.0.1-012.000"
              defaultValue={defaults?.npwp ?? ""}
              autoComplete="off"
              inputMode="numeric"
              className={employeeInputClass}
              onInput={(event) => {
                const input = event.currentTarget;
                input.setCustomValidity(
                  npwpFieldCustomValidity(input.value, npwpInvalidMessage)
                );
              }}
              onBlur={(event) => {
                const input = event.currentTarget;
                input.setCustomValidity(
                  npwpFieldCustomValidity(input.value, npwpInvalidMessage)
                );
                if (input.value.trim() && !input.validity.valid) {
                  input.reportValidity();
                }
              }}
            />
            <p className={employeeDialogHintClass}>
              {isIndividual
                ? t("pages.clients.form.clientNpwpOrNikHint")
                : t("pages.clients.form.companyNpwpHint")}
            </p>
          </div>

          <div className={employeeDialogFieldClass}>
            <label
              htmlFor="client-since"
              className={employeeDialogLabelClass}
            >
              {t("pages.clients.form.clientSince")}
            </label>
            <Input
              id="client-since"
              name="clientSince"
              type="date"
              defaultValue={
                formatDateForInput(defaults?.clientSince) ||
                (mode === "create" ? todayDateInput() : "")
              }
              className={employeeInputClass}
            />
            <p className={employeeDialogHintClass}>
              {isIndividual
                ? t("pages.clients.form.clientSinceHintIndividual")
                : t("pages.clients.form.clientSinceHint")}
            </p>
          </div>

          <div className={employeeDialogFieldClass}>
            <label
              htmlFor="client-payment-terms"
              className={employeeDialogLabelClass}
            >
              {t("pages.clients.form.paymentTerms")}
            </label>
            <select
              id="client-payment-terms"
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
              {t("pages.clients.form.paymentTermsHint")}
            </p>
          </div>
        </div>
      </div>

      {!isIndividual ? (
        <div className={employeeDialogSectionClass}>
          <SectionHeading
            title={t("pages.clients.form.contactPerson")}
            description={
              mode === "create"
                ? t("pages.clients.form.contactPersonDescCreate")
                : t("pages.clients.form.contactPersonDescEdit")
            }
          />

          <div className={employeeDialogGridClass}>
            <div className={employeeDialogFieldClass}>
              <label
                htmlFor="client-contact-first-name"
                className={employeeDialogLabelClass}
              >
                {t("pages.clients.form.contactFirstName")}
              </label>
              <Input
                id="client-contact-first-name"
                name="contactPersonFirstName"
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
                htmlFor="client-contact-last-name"
                className={employeeDialogLabelClass}
              >
                {t("pages.clients.form.contactLastName")}
              </label>
              <Input
                id="client-contact-last-name"
                name="contactPersonLastName"
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
                htmlFor="client-contact-position"
                className={employeeDialogLabelClass}
              >
                {t("pages.clients.form.contactPosition")}
              </label>
              <Input
                id="client-contact-position"
                name="contactPersonPosition"
                placeholder="e.g. Operations Manager"
                defaultValue={defaults?.contactPersonPosition ?? ""}
                className={employeeInputClass}
              />
            </div>

            <div className={employeeDialogFieldClass}>
              <label
                htmlFor="client-contact-email"
                className={employeeDialogLabelClass}
              >
                {t("pages.clients.form.contactEmail")}
              </label>
              <Input
                id="client-contact-email"
                name="contactPersonEmail"
                type="email"
                placeholder="e.g. budi@company.co.id"
                defaultValue={defaults?.contactPersonEmail ?? ""}
                className={employeeInputClass}
              />
            </div>

            <div className={employeeDialogFieldClass}>
              <label
                htmlFor="client-contact-phone"
                className={employeeDialogLabelClass}
              >
                {t("pages.clients.form.contactPhone")}
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
      ) : null}

      {mode === "create" ? (
        <div className={employeeDialogSectionClass}>
          <SectionHeading
            title={t("pages.clients.form.portalAccess")}
            description={
              isIndividual
                ? t("pages.clients.form.portalAccessDescIndividual")
                : t("pages.clients.form.portalAccessDesc")
            }
          />

          <div className={employeeDialogGridClass}>
            <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
              <label
                htmlFor="client-login-id"
                className={employeeDialogLabelClass}
              >
                {t("pages.clients.form.loginId")}
              </label>
              <div className="flex flex-wrap gap-2">
                <Input
                  id="client-login-id"
                  name="loginId"
                  value={loginId}
                  onChange={(event) => {
                    const next = event.target.value
                      .toLowerCase()
                      .replace(/[^a-z]/g, "")
                      .slice(0, 8);
                    setLoginId(next);
                    onFormValuesChange?.();
                  }}
                  maxLength={8}
                  pattern="[a-z]{8}"
                  required
                  className={cn(employeeInputClass, "font-mono tracking-wide")}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    if (loginId) {
                      setLoginIdAvoid((prev) =>
                        prev.includes(loginId) ? prev : [...prev, loginId]
                      );
                    } else {
                      setLoginIdAvoid((prev) => [
                        ...prev,
                        ...loginSuggestions,
                      ]);
                    }
                    onFormValuesChange?.();
                  }}
                >
                  {t("pages.clients.form.regenerateLoginId")}
                </Button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {loginSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className={cn(
                      "rounded-lg border px-3 py-1.5 font-mono text-xs",
                      suggestion === loginId
                        ? "border-accent bg-accent/10 text-text"
                        : "border-border bg-elevated text-muted hover:text-text"
                    )}
                    onClick={() => {
                      setLoginId(suggestion);
                      onFormValuesChange?.();
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
              <p className={employeeDialogHintClass}>
                {isIndividual
                  ? t("pages.clients.form.loginIdHintIndividual")
                  : t("pages.clients.form.loginIdHint")}
              </p>
              {!isValidClientLoginId(loginId) && loginId.length > 0 ? (
                <p className="text-xs text-danger">
                  {t("pages.clients.form.loginIdInvalid")}
                </p>
              ) : null}
            </div>

            <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
              <label
                id="client-multi-project-label"
                htmlFor="client-multi-project"
                className={employeeDialogLabelClass}
              >
                {t("pages.clients.form.multiProjectAccess")}
              </label>
              <YesNoChoiceCards
                id="client-multi-project"
                labelledBy="client-multi-project-label"
                value={multiProjectAccess}
                onChange={(value) => {
                  setMultiProjectAccess(value);
                  onFormValuesChange?.();
                }}
              />
              <input
                type="hidden"
                name="multiProjectAccess"
                value={multiProjectAccess === "Yes" ? "yes" : "no"}
              />
              <p className={employeeDialogHintClass}>
                {t("pages.clients.form.multiProjectAccessHint")}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
