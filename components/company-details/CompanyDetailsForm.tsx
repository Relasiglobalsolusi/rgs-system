"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Building2,
  FileText,
  Globe,
  Landmark,
  MapPin,
  Wallet,
} from "lucide-react";

import {
  updateCompanyBpjsAccounts,
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
  employeeInputClass,
} from "@/components/employees/employee-dialog-ui";
import {
  cardTintIcon,
  cardTintWash,
  type CardTintAccent,
} from "@/components/ui/card-tint";
import DirectoryStatCard from "@/components/ui/DirectoryStatCard";
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
  bpjsKesehatanVirtualAccount: string;
  bpjsKetenagakerjaanVirtualAccount: string;
};

type SectionTone = "primary" | "info" | "warning" | "danger" | "success";

const sectionToneToAccent: Record<SectionTone, CardTintAccent> = {
  primary: "primary",
  info: "info",
  warning: "warning",
  danger: "danger",
  success: "success",
};

function SectionCard({
  children,
  tone,
  icon,
  title,
  description,
}: {
  children: ReactNode;
  tone: SectionTone;
  icon: ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border p-6 sm:p-8",
        cardTintWash[sectionToneToAccent[tone]]
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-md",
            cardTintIcon[sectionToneToAccent[tone]]
          )}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-text">{title}</h3>
          {description ? (
            <p className={cn(employeeDialogHintClass, "mt-1")}>{description}</p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function websiteHost(value: string) {
  const raw = value.trim();
  if (!raw) return "";
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return raw;
  }
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
  const [bpjsSaving, setBpjsSaving] = useState(false);
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

  const websiteLabel = websiteHost(defaults.website);
  const taxSet = Boolean(defaults.npwp.trim());

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DirectoryStatCard
          compact
          tinted
          title={t("pages.companyDetails.form.name")}
          value={defaults.name}
          accent="primary"
          icon={<Building2 size={18} />}
        />
        <DirectoryStatCard
          compact
          tinted
          title={t("pages.companyDetails.cards.website")}
          value={websiteLabel || t("pages.companyDetails.cards.notSet")}
          accent={websiteLabel ? "info" : "muted"}
          icon={<Globe size={18} />}
        />
        <DirectoryStatCard
          compact
          tinted
          title={t("pages.companyDetails.cards.taxId")}
          value={
            taxSet
              ? t("pages.companyDetails.cards.set")
              : t("pages.companyDetails.cards.notSet")
          }
          accent={taxSet ? "warning" : "danger"}
          icon={<FileText size={18} />}
        />
        <DirectoryStatCard
          compact
          tinted
          title={t("pages.companyDetails.cards.banks")}
          value={bankAccounts.length}
          subtitle={t(
            bankAccounts.length === 1
              ? "pages.companyDetails.cards.banksOne"
              : "pages.companyDetails.cards.banksOther",
            { count: bankAccounts.length }
          )}
          accent={bankAccounts.length > 0 ? "success" : "muted"}
          icon={<Wallet size={18} />}
        />
      </div>

      <form
        onSubmit={(event) =>
          saveSection(event, updateCompanyIdentity, setIdentitySaving)
        }
      >
        <SectionCard
          tone="primary"
          icon={<Building2 size={18} />}
          title={t("pages.companyDetails.sections.identity")}
          description={t("pages.companyDetails.sections.identityHint")}
        >
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
        <SectionCard
          tone="info"
          icon={<MapPin size={18} />}
          title={t("pages.companyDetails.sections.contact")}
          description={t("pages.companyDetails.sections.contactHint")}
        >
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
        <SectionCard
          tone="warning"
          icon={<FileText size={18} />}
          title={t("pages.companyDetails.sections.tax")}
        >
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

      <form
        onSubmit={(event) =>
          saveSection(event, updateCompanyBpjsAccounts, setBpjsSaving)
        }
      >
        <SectionCard
          tone="danger"
          icon={<Landmark size={18} />}
          title={t("pages.companyDetails.sections.government")}
          description={t("pages.companyDetails.sections.governmentHint")}
        >
          <div className={cn(employeeDialogGridClass, "mt-6")}>
            <div className={employeeDialogFieldClass}>
              <label
                htmlFor="company-bpjs-kesehatan"
                className={employeeDialogLabelClass}
              >
                {t("pages.companyDetails.form.bpjsKesehatanVa")}
              </label>
              <Input
                id="company-bpjs-kesehatan"
                name="bpjsKesehatanVirtualAccount"
                defaultValue={defaults.bpjsKesehatanVirtualAccount}
                className={employeeInputClass}
              />
            </div>
            <div className={employeeDialogFieldClass}>
              <label
                htmlFor="company-bpjs-ketenagakerjaan"
                className={employeeDialogLabelClass}
              >
                {t("pages.companyDetails.form.bpjsKetenagakerjaanVa")}
              </label>
              <Input
                id="company-bpjs-ketenagakerjaan"
                name="bpjsKetenagakerjaanVirtualAccount"
                defaultValue={defaults.bpjsKetenagakerjaanVirtualAccount}
                className={employeeInputClass}
              />
            </div>
            <p className={cn(employeeDialogHintClass, "sm:col-span-2")}>
              {t("pages.companyDetails.form.bpjsVaHint")}
            </p>
          </div>
          <SaveRow saving={bpjsSaving} />
        </SectionCard>
      </form>

      <CompanyBankAccountsCard accounts={bankAccounts} />
    </div>
  );
}
