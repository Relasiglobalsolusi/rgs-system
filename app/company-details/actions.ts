"use server";

import { revalidatePath } from "next/cache";

import { COMPANY_IDENTITY_SELECT } from "@/lib/company-for-pdf";
import {
  companyBankAccounts,
  countOpenInvoicesForBankAccount,
  syncCompanyLegacyBankFields,
} from "@/lib/company-bank-accounts";
import { getServerLocale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";
import {
  isValidNpwp,
  npwpDigitCount,
  npwpInvalidMessage,
} from "@/lib/npwp";
import { isOwnerAccount } from "@/lib/permissions";
import { normalizeAndValidatePhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { toActionError } from "@/lib/prisma-errors";
import { requireModule, toPermissionUser } from "@/lib/session";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function optionalText(value: FormDataEntryValue | null): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

function normalizeWebsite(
  raw: string,
  invalidMessage: string
): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error(invalidMessage);
    }
    if (!url.hostname.includes(".")) {
      throw new Error(invalidMessage);
    }
    return `${url.protocol}//${url.host}${url.pathname}`.replace(/\/$/, "");
  } catch (error) {
    if (error instanceof Error && error.message === invalidMessage) {
      throw error;
    }
    throw new Error(invalidMessage);
  }
}

async function requireOwnerCompany() {
  const locale = await getServerLocale();
  const session = await requireModule("settings");
  if (!isOwnerAccount(toPermissionUser(session))) {
    return {
      ok: false as const,
      error: translate(locale, "pages.companyDetails.permissionDenied"),
      locale,
      companyId: null as string | null,
    };
  }

  const company = await prisma.company.findFirst({
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (!company) {
    return {
      ok: false as const,
      error: translate(locale, "pages.companyDetails.companyNotFound"),
      locale,
      companyId: null as string | null,
    };
  }

  return {
    ok: true as const,
    locale,
    companyId: company.id,
  };
}

function revalidateCompanyPaths() {
  revalidatePath("/company-details");
  revalidatePath("/dashboard");
  revalidatePath("/projects");
  revalidatePath("/billing");
}

export async function updateCompanyIdentity(formData: FormData) {
  const gate = await requireOwnerCompany();
  if (!gate.ok) return { ok: false as const, error: gate.error };
  const { locale, companyId } = gate;

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return {
      ok: false as const,
      error: translate(locale, "pages.companyDetails.nameRequired"),
    };
  }

  let website: string | null = null;
  try {
    website = normalizeWebsite(
      String(formData.get("website") ?? ""),
      translate(locale, "pages.companyDetails.websiteInvalid")
    );
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  try {
    await prisma.company.update({
      where: { id: companyId },
      data: { name, website },
      select: COMPANY_IDENTITY_SELECT,
    });
  } catch (error) {
    return {
      ok: false as const,
      error: toActionError(
        error,
        translate(locale, "pages.companyDetails.saveFailed")
      ).message,
    };
  }

  revalidateCompanyPaths();
  return { ok: true as const };
}

export async function updateCompanyContact(formData: FormData) {
  const gate = await requireOwnerCompany();
  if (!gate.ok) return { ok: false as const, error: gate.error };
  const { locale, companyId } = gate;

  const emailRaw = optionalText(formData.get("email"));
  if (emailRaw && !EMAIL_RE.test(emailRaw)) {
    return {
      ok: false as const,
      error: translate(locale, "validation.invalidEmail"),
    };
  }

  const phoneLabel = translate(locale, "pages.companyDetails.form.phone");
  let phone: string | null = null;
  try {
    const normalized = normalizeAndValidatePhone(
      String(formData.get("phone") ?? ""),
      phoneLabel,
      translate(locale, "validation.fieldInvalid", { field: phoneLabel })
    );
    phone = normalized || null;
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  try {
    await prisma.company.update({
      where: { id: companyId },
      data: {
        email: emailRaw,
        phone,
        address: optionalText(formData.get("address")),
      },
      select: COMPANY_IDENTITY_SELECT,
    });
  } catch (error) {
    return {
      ok: false as const,
      error: toActionError(
        error,
        translate(locale, "pages.companyDetails.saveFailed")
      ).message,
    };
  }

  revalidateCompanyPaths();
  return { ok: true as const };
}

export async function updateCompanyTax(formData: FormData) {
  const gate = await requireOwnerCompany();
  if (!gate.ok) return { ok: false as const, error: gate.error };
  const { locale, companyId } = gate;

  const npwpRaw = optionalText(formData.get("npwp"));
  if (npwpRaw && !isValidNpwp(npwpRaw)) {
    return {
      ok: false as const,
      error: npwpInvalidMessage(locale, npwpDigitCount(npwpRaw), "company"),
    };
  }

  try {
    await prisma.company.update({
      where: { id: companyId },
      data: { npwp: npwpRaw },
      select: COMPANY_IDENTITY_SELECT,
    });
  } catch (error) {
    return {
      ok: false as const,
      error: toActionError(
        error,
        translate(locale, "pages.companyDetails.saveFailed")
      ).message,
    };
  }

  revalidateCompanyPaths();
  return { ok: true as const };
}

export async function updateCompanyBpjsAccounts(formData: FormData) {
  const gate = await requireOwnerCompany();
  if (!gate.ok) return { ok: false as const, error: gate.error };
  const { companyId } = gate;

  try {
    await prisma.company.update({
      where: { id: companyId },
      data: {
        bpjsKesehatanVirtualAccount: optionalText(
          formData.get("bpjsKesehatanVirtualAccount")
        ),
        bpjsKetenagakerjaanVirtualAccount: optionalText(
          formData.get("bpjsKetenagakerjaanVirtualAccount")
        ),
      },
    });
  } catch (error) {
    return {
      ok: false as const,
      error: toActionError(
        error,
        translate(gate.locale, "pages.companyDetails.saveFailed")
      ).message,
    };
  }

  revalidateCompanyPaths();
  return { ok: true as const };
}

function requiredBankField(
  formData: FormData,
  name: string,
  locale: Awaited<ReturnType<typeof getServerLocale>>,
  labelKey:
    | "pages.companyDetails.form.bankName"
    | "pages.companyDetails.form.bankAccountNumber"
    | "pages.companyDetails.form.bankAccountName"
): string | { ok: false; error: string } {
  const value = String(formData.get(name) ?? "").trim();
  if (!value) {
    return {
      ok: false,
      error: translate(locale, "pages.companyDetails.bank.fieldRequired", {
        field: translate(locale, labelKey),
      }),
    };
  }
  return value;
}

export async function createCompanyBankAccount(formData: FormData) {
  const gate = await requireOwnerCompany();
  if (!gate.ok) return { ok: false as const, error: gate.error };
  const { locale, companyId } = gate;

  const bankName = requiredBankField(
    formData,
    "bankName",
    locale,
    "pages.companyDetails.form.bankName"
  );
  if (typeof bankName !== "string") return bankName;
  const accountNumber = requiredBankField(
    formData,
    "accountNumber",
    locale,
    "pages.companyDetails.form.bankAccountNumber"
  );
  if (typeof accountNumber !== "string") return accountNumber;
  const accountHolder = requiredBankField(
    formData,
    "accountHolder",
    locale,
    "pages.companyDetails.form.bankAccountName"
  );
  if (typeof accountHolder !== "string") return accountHolder;

  try {
    const existing = await companyBankAccounts(prisma).count({
      where: { companyId },
    });
    await companyBankAccounts(prisma).create({
      data: {
        companyId,
        bankName,
        accountNumber,
        accountHolder,
        label: optionalText(formData.get("label")),
        sortOrder: existing,
      },
    });
    await syncCompanyLegacyBankFields(companyId);
  } catch (error) {
    return {
      ok: false as const,
      error: toActionError(
        error,
        translate(locale, "pages.companyDetails.bank.saveFailed")
      ).message,
    };
  }

  revalidateCompanyPaths();
  return { ok: true as const };
}

export async function updateCompanyBankAccount(formData: FormData) {
  const gate = await requireOwnerCompany();
  if (!gate.ok) return { ok: false as const, error: gate.error };
  const { locale, companyId } = gate;

  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    return {
      ok: false as const,
      error: translate(locale, "pages.companyDetails.bank.notFound"),
    };
  }

  const existing = await companyBankAccounts(prisma).findFirst({
    where: { id, companyId },
  });
  if (!existing) {
    return {
      ok: false as const,
      error: translate(locale, "pages.companyDetails.bank.notFound"),
    };
  }

  const bankName = requiredBankField(
    formData,
    "bankName",
    locale,
    "pages.companyDetails.form.bankName"
  );
  if (typeof bankName !== "string") return bankName;
  const accountNumber = requiredBankField(
    formData,
    "accountNumber",
    locale,
    "pages.companyDetails.form.bankAccountNumber"
  );
  if (typeof accountNumber !== "string") return accountNumber;
  const accountHolder = requiredBankField(
    formData,
    "accountHolder",
    locale,
    "pages.companyDetails.form.bankAccountName"
  );
  if (typeof accountHolder !== "string") return accountHolder;

  try {
    await companyBankAccounts(prisma).update({
      where: { id },
      data: {
        bankName,
        accountNumber,
        accountHolder,
        label: optionalText(formData.get("label")),
      },
    });
    await syncCompanyLegacyBankFields(companyId);
  } catch (error) {
    return {
      ok: false as const,
      error: toActionError(
        error,
        translate(locale, "pages.companyDetails.bank.saveFailed")
      ).message,
    };
  }

  revalidateCompanyPaths();
  return { ok: true as const };
}

export async function deleteCompanyBankAccount(formData: FormData) {
  const gate = await requireOwnerCompany();
  if (!gate.ok) return { ok: false as const, error: gate.error };
  const { locale, companyId } = gate;

  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    return {
      ok: false as const,
      error: translate(locale, "pages.companyDetails.bank.notFound"),
    };
  }

  const existing = await companyBankAccounts(prisma).findFirst({
    where: { id, companyId },
  });
  if (!existing) {
    return {
      ok: false as const,
      error: translate(locale, "pages.companyDetails.bank.notFound"),
    };
  }

  try {
    const open = await countOpenInvoicesForBankAccount(id);
    if (open.invoicePeriods > 0 || open.unpaidSales > 0) {
      return {
        ok: false as const,
        error: translate(locale, "pages.companyDetails.bank.cannotDeleteOpen"),
      };
    }

    await companyBankAccounts(prisma).delete({ where: { id } });
    await syncCompanyLegacyBankFields(companyId);
  } catch (error) {
    return {
      ok: false as const,
      error: toActionError(
        error,
        translate(locale, "pages.companyDetails.bank.deleteFailed")
      ).message,
    };
  }

  revalidateCompanyPaths();
  return { ok: true as const };
}

