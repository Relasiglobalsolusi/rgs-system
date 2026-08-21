"use client";

import { useState } from "react";
import { toast } from "sonner";

import {
  updateCompanyContact,
  updateCompanyIdentity,
  updateCompanyTax,
} from "@/app/company-details/actions";
import CompanyBankAccountsCard from "@/components/company-details/CompanyBankAccountsCard";
import {
  employeeDialogFieldClass,
  employeeDialogGridClass,
  employeeDialogHintClass,
  employeeDialogLabelClass,
  employeeDialogSectionHeadingClass,
  employeeInputClass,
} from "@/components/employees/employee-dialog-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { Textarea } from "@/components/ui/textarea";
import type { CompanyBankAccountOption } from "@/lib/company-bank-accounts";
import { useT } from "@/lib/i18n/use-t";
import { npwpFieldCustomValidity } from "@/lib/npwp";
import { cn } from "@/lib/utils";

export type CompanyDetailsValues = {
  name: string;
  website: string;
  address: string;
  phone: string;
  email: string;
  npwp: string;
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
      {description ? (
        <p className={employeeDialogHintClass}>{description}</p>
      ) : null}
    </div>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-border bg-elevated p-6 sm:p-8">
      {children}
    </section>
  );
}

function SaveRow({ saving }: { saving: boolean }) {
  const { t } = useT();
  return (
    <div className="mt-8 flex justify-end">
      <Button type="submit" disabled={saving}>
        {saving
          ? t("common.actions.saving")
          : t("common.actions.saveChanges")}
      </Button>
    </div>
  );
}

export default function CompanyDetailsForm({
  defaults,
  bankAccounts,
}: {
  defaults: CompanyDetailsValues;
  bankAccounts: CompanyBankAccountOption[];
}) {
  const { t } = useT();
  const [identitySaving, setIdentitySaving] = useState(false);
  const [contactSaving, setContactSaving] = useState(false);
  const [taxSaving, setTaxSaving] = useState(false);
  const npwpInvalidMessage = t("validation.npwpInvalid");

  async function saveSection(
    event: React.FormEvent<HTMLFormElement>,
    action: (formData: FormData) => Promise<{ ok: true } | { ok: false; error: string }>,
    setSaving: (value: boolean) => void
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;

    setSaving(true);
    try {
      const result = await action(new FormData(form));
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t("pages.companyDetails.saved"));
    } catch {
      toast.error(t("pages.companyDetails.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={(event) =>
          saveSection(event, updateCompanyIdentity, setIdentitySaving)
        }
      >
        <SectionCard>
          <SectionHeading
            title={t("pages.companyDetails.sections.identity")}
            description={t("pages.companyDetails.sections.identityHint")}
          />
          <div className={cn(employeeDialogGridClass, "mt-6")}>
            <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
              <label htmlFor="company-name" className={employeeDialogLabelClass}>
                {t("pages.companyDetails.form.name")}
              </label>
              <Input
                id="company-name"
                name="name"
                required
                defaultValue={defaults.name}
                className={employeeInputClass}
                autoComplete="organization"
              />
            </div>
            <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
              <label
                htmlFor="company-website"
                className={employeeDialogLabelClass}
              >
                {t("pages.companyDetails.form.website")}
              </label>
              <Input
                id="company-website"
                name="website"
                inputMode="url"
                defaultValue={defaults.website}
                placeholder={t("pages.companyDetails.form.websitePlaceholder")}
                className={employeeInputClass}
                autoComplete="url"
              />
            </div>
          </div>
          <SaveRow saving={identitySaving} />
        </SectionCard>
      </form>

      <form
        onSubmit={(event) =>
          saveSection(event, updateCompanyContact, setContactSaving)
        }
      >
        <SectionCard>
          <SectionHeading
            title={t("pages.companyDetails.sections.contact")}
            description={t("pages.companyDetails.sections.contactHint")}
          />
          <div className={cn(employeeDialogGridClass, "mt-6")}>
            <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
              <label
                htmlFor="company-address"
                className={employeeDialogLabelClass}
              >
                {t("pages.companyDetails.form.address")}
              </label>
              <Textarea
                id="company-address"
                name="address"
                rows={3}
                defaultValue={defaults.address}
                placeholder={t("pages.companyDetails.form.addressPlaceholder")}
                className={cn(employeeInputClass, "min-h-24 py-3")}
              />
              <p className={employeeDialogHintClass}>
                {t("pages.companyDetails.form.addressHint")}
              </p>
            </div>
            <div className={employeeDialogFieldClass}>
              <label htmlFor="company-phone" className={employeeDialogLabelClass}>
                {t("pages.companyDetails.form.phone")}
              </label>
              <PhoneInput
                name="phone"
                defaultValue={defaults.phone}
                formatVariant="landline"
                inputClassName={employeeInputClass}
              />
            </div>
            <div className={employeeDialogFieldClass}>
              <label htmlFor="company-email" className={employeeDialogLabelClass}>
                {t("pages.companyDetails.form.email")}
              </label>
              <Input
                id="company-email"
                name="email"
                type="email"
                defaultValue={defaults.email}
                className={employeeInputClass}
                autoComplete="email"
              />
            </div>
          </div>
          <SaveRow saving={contactSaving} />
        </SectionCard>
      </form>

      <form
        onSubmit={(event) => saveSection(event, updateCompanyTax, setTaxSaving)}
      >
        <SectionCard>
          <SectionHeading title={t("pages.companyDetails.sections.tax")} />
          <div className={cn(employeeDialogGridClass, "mt-6")}>
            <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
              <label htmlFor="company-npwp" className={employeeDialogLabelClass}>
                {t("pages.companyDetails.form.npwp")}
              </label>
              <Input
                id="company-npwp"
                name="npwp"
                defaultValue={defaults.npwp}
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
                  if (!input.validity.valid) {
                    input.reportValidity();
                  }
                }}
              />
              <p className={employeeDialogHintClass}>
                {t("pages.companyDetails.form.npwpHint")}
              </p>
            </div>
          </div>
          <SaveRow saving={taxSaving} />
        </SectionCard>
      </form>

      <CompanyBankAccountsCard accounts={bankAccounts} />
    </div>
  );
}
