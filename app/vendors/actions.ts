"use server";

import { revalidatePath } from "next/cache";

import {
  createBulkActionResult,
  recordBulkFailure,
  recordBulkSuccess,
  type BulkActionResult,
} from "@/lib/bulk-action-result";
import { hardDeleteLinkedUserLogins } from "@/lib/hard-delete-linked-user";
import {
  ensureVendorLoginsStayInactive,
  softDeactivateVendorLogins,
} from "@/lib/linked-login-lifecycle";
import {
  nextCompanyScopedSortOrder,
  persistCompanyScopedReorder,
} from "@/lib/persist-reorder";
import { prisma } from "@/lib/prisma";
import { toActionError } from "@/lib/prisma-errors";
import { parseRequiredClientNpwpValue } from "@/lib/npwp";
import type { AppLocale } from "@/lib/i18n/locale";
import { getServerLocale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";
import { canManageVendors } from "@/lib/project-access";
import { requireModule, toPermissionUser } from "@/lib/session";
import { normalizeAndValidatePhone } from "@/lib/phone";
import { capitalizeName, capitalizeProper } from "@/lib/text-case";
import { parseFormDateInput } from "@/lib/bulk-import/parse-import-date";
import { getNextVendorShortCode } from "@/lib/vendor-short-code";
import {
  assertVendorCanBeSoftDeleted,
  formatVendorSoftDeleteBlockers,
  getVendorSoftDeleteBlockers,
} from "@/lib/vendor-soft-delete";
import {
  normalizePaymentTermsDays,
  PAYMENT_TERMS_DAYS_OPTIONS,
} from "@/lib/invoice-period";
import {
  contactPersonNamePartsChanged,
  formatContactPersonName,
} from "@/lib/contact-person";
import { deleteLocalUpload, saveUpload } from "@/lib/upload";

const ALLOWED_PAYMENT_TERMS_DAYS = new Set<number>(PAYMENT_TERMS_DAYS_OPTIONS);

function parsePaymentTermsDays(formData: FormData): number {
  const raw = Number(formData.get("paymentTermsDays") ?? NaN);
  if (!Number.isFinite(raw) || !ALLOWED_PAYMENT_TERMS_DAYS.has(raw)) {
    return normalizePaymentTermsDays(14);
  }
  return normalizePaymentTermsDays(raw);
}

async function parseRequiredVendorNpwp(
  formData: FormData,
  locale: AppLocale
): Promise<string> {
  return parseRequiredClientNpwpValue(
    String(formData.get("npwp") ?? ""),
    locale,
    "company"
  );
}

function taxIdDocumentMissingMessage(locale: AppLocale): string {
  return translate(locale, "bulkImport.taxIdDocumentRequiredCompany");
}

/**
 * Soft-require: create always needs a file; edit keeps the existing file unless
 * a replacement is uploaded. Returns undefined when no new file was chosen.
 */
async function saveTaxIdDocument(
  formData: FormData,
  options?: { shortCode?: string | null }
): Promise<string | null | undefined> {
  const file = formData.get("taxIdDocument");

  if (!(file instanceof File) || file.size === 0) {
    return undefined;
  }

  const code = options?.shortCode?.trim();
  const fileBaseName = code ? `NPWP_${code}` : "NPWP";

  return saveUpload(file, "uploads/vendors", {
    fileBaseName,
  });
}

async function assertCanManageVendors(locale?: AppLocale) {
  const session = await requireModule("vendors");
  if (!canManageVendors(toPermissionUser(session))) {
    throw new Error(
      translate(
        locale ?? (await getServerLocale()),
        "pages.vendors.permissionDenied"
      )
    );
  }
}

/** Preview next auto Vendor ID (V001…). Create still allocates via getNextVendorShortCode. */
export async function previewVendorShortCode() {
  const locale = await getServerLocale();
  await assertCanManageVendors(locale);

  const company = await prisma.company.findFirst();
  if (!company) {
    throw new Error(translate(locale, "pages.vendors.companyNotFound"));
  }

  return getNextVendorShortCode(company.id);
}

export async function createVendor(formData: FormData) {
  const locale = await getServerLocale();
  try {
    await assertCanManageVendors(locale);

    const name = capitalizeProper(String(formData.get("name") ?? "").trim());
    const email = String(formData.get("email") ?? "").trim();
    const phone = normalizeAndValidatePhone(
      String(formData.get("phone") ?? ""),
      translate(locale, "pages.vendors.form.companyPhone")
    );
    const address = capitalizeProper(String(formData.get("address") ?? "").trim());
    const npwp = await parseRequiredVendorNpwp(formData, locale);
    const contactPersonFirstName = capitalizeName(
      String(formData.get("contactPersonFirstName") ?? "").trim()
    );
    const contactPersonLastName = capitalizeName(
      String(formData.get("contactPersonLastName") ?? "").trim()
    );
    const contactPersonPosition = capitalizeProper(
      String(formData.get("contactPersonPosition") ?? "").trim()
    );
    const contactPersonEmail = String(
      formData.get("contactPersonEmail") ?? ""
    ).trim();
    const contactPersonPhone = normalizeAndValidatePhone(
      String(formData.get("contactPersonPhone") ?? ""),
      translate(locale, "pages.vendors.form.contactPhone")
    );
    const vendorSince =
      parseFormDateInput(formData.get("vendorSince"), {
        fieldLabel: translate(locale, "pages.vendors.form.vendorSince"),
      }) ?? new Date();
    const paymentTermsDays = parsePaymentTermsDays(formData);

    if (!name) {
      throw new Error(translate(locale, "pages.vendors.vendorNameRequired"));
    }
    if (!contactPersonFirstName) {
      throw new Error(
        translate(locale, "pages.vendors.contactFirstNameRequired")
      );
    }

    const company = await prisma.company.findFirst();
    if (!company) {
      throw new Error(translate(locale, "pages.vendors.companyNotFound"));
    }

    const taxIdDocumentUrl = await saveTaxIdDocument(formData);
    if (!taxIdDocumentUrl) {
      throw new Error(taxIdDocumentMissingMessage(locale));
    }

    const sortOrder = await nextCompanyScopedSortOrder("vendor", company.id);

    await prisma.$transaction(async (tx) => {
      const shortCode = await getNextVendorShortCode(company.id, tx);
      const vendor = await tx.vendor.create({
        data: {
          name,
          shortCode,
          email: email || null,
          phone: phone || null,
          address: address || null,
          npwp,
          taxIdDocumentUrl,
          contactPersonFirstName,
          contactPersonLastName: contactPersonLastName || null,
          contactPersonPosition: contactPersonPosition || null,
          contactPersonEmail: contactPersonEmail || null,
          contactPersonPhone: contactPersonPhone || null,
          vendorSince,
          paymentTermsDays,
          companyId: company.id,
          active: true,
          sortOrder,
        },
      });

    });

    revalidatePath("/vendors");
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.vendors.createFailed")
    );
  }
}

export async function reorderVendors(ids: string[]) {
  const locale = await getServerLocale();
  try {
    await assertCanManageVendors(locale);

    const company = await prisma.company.findFirst({ select: { id: true } });
    if (!company) {
      throw new Error(translate(locale, "pages.vendors.companyNotFound"));
    }

    await persistCompanyScopedReorder("vendor", {
      companyId: company.id,
      ids,
      mismatchError: translate(locale, "pages.vendors.reorderInvalid"),
    });

    revalidatePath("/vendors");
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.vendors.reorderFailed")
    );
  }
}

/**
 * Updates a vendor. Contact person rename forces new portal credentials
 * (username is contact-derived). Soft-delete only via Delete dialog.
 */
export async function updateVendor(id: string, formData: FormData) {
  const locale = await getServerLocale();
  try {
    await assertCanManageVendors(locale);

    const name = capitalizeProper(String(formData.get("name") ?? "").trim());
    const email = String(formData.get("email") ?? "").trim();
    const phone = normalizeAndValidatePhone(
      String(formData.get("phone") ?? ""),
      translate(locale, "pages.vendors.form.companyPhone")
    );
    const address = capitalizeProper(String(formData.get("address") ?? "").trim());
    const npwp = await parseRequiredVendorNpwp(formData, locale);
    const contactPersonFirstName = capitalizeName(
      String(formData.get("contactPersonFirstName") ?? "").trim()
    );
    const contactPersonLastName = capitalizeName(
      String(formData.get("contactPersonLastName") ?? "").trim()
    );
    const contactPersonPosition = capitalizeProper(
      String(formData.get("contactPersonPosition") ?? "").trim()
    );
    const contactPersonEmail = String(
      formData.get("contactPersonEmail") ?? ""
    ).trim();
    const contactPersonPhone = normalizeAndValidatePhone(
      String(formData.get("contactPersonPhone") ?? ""),
      translate(locale, "pages.vendors.form.contactPhone")
    );
    const vendorSince =
      parseFormDateInput(formData.get("vendorSince"), {
        fieldLabel: translate(locale, "pages.vendors.form.vendorSince"),
      }) ?? new Date();
    const paymentTermsDays = parsePaymentTermsDays(formData);

    if (!name) {
      throw new Error(translate(locale, "pages.vendors.vendorNameRequired"));
    }
    if (!contactPersonFirstName) {
      throw new Error(
        translate(locale, "pages.vendors.contactFirstNameRequired")
      );
    }

    const existing = await prisma.vendor.findUnique({
      where: { id },
      select: {
        id: true,
        companyId: true,
        shortCode: true,
        active: true,
        taxIdDocumentUrl: true,
        contactPersonFirstName: true,
        contactPersonLastName: true,
        users: { select: { id: true, active: true } },
      },
    });

    if (!existing) {
      throw new Error(translate(locale, "pages.vendors.notFound"));
    }

    const uploadedTaxIdDocumentUrl = await saveTaxIdDocument(formData, {
      shortCode: existing.shortCode,
    });
    const taxIdDocumentUrl =
      uploadedTaxIdDocumentUrl !== undefined
        ? uploadedTaxIdDocumentUrl
        : existing.taxIdDocumentUrl;
    if (!taxIdDocumentUrl) {
      throw new Error(taxIdDocumentMissingMessage(locale));
    }

    const contactRenamed = contactPersonNamePartsChanged(
      {
        firstName: existing.contactPersonFirstName,
        lastName: existing.contactPersonLastName,
      },
      {
        firstName: contactPersonFirstName,
        lastName: contactPersonLastName,
      }
    );
    const contactDisplay =
      formatContactPersonName(
        contactPersonFirstName,
        contactPersonLastName
      ) ?? name;

    await prisma.$transaction(async (tx) => {
      // Soft-delete only via Delete dialog / deactivateVendor — never via edit.
      await tx.vendor.update({
        where: { id },
        data: {
          name,
          email: email || null,
          phone: phone || null,
          address: address || null,
          npwp,
          ...(uploadedTaxIdDocumentUrl !== undefined
            ? { taxIdDocumentUrl: uploadedTaxIdDocumentUrl }
            : {}),
          contactPersonFirstName,
          contactPersonLastName: contactPersonLastName || null,
          contactPersonPosition: contactPersonPosition || null,
          contactPersonEmail: contactPersonEmail || null,
          contactPersonPhone: contactPersonPhone || null,
          vendorSince,
          paymentTermsDays,
        },
      });

      if (existing.users.length === 0) {
        return;
      }

      // Sync display name on linked user records (portal access is disabled).
      await tx.user.updateMany({
        where: { vendorId: id },
        data: { name: contactDisplay },
      });
    });

    if (
      uploadedTaxIdDocumentUrl &&
      existing.taxIdDocumentUrl &&
      existing.taxIdDocumentUrl !== uploadedTaxIdDocumentUrl
    ) {
      await deleteLocalUpload(existing.taxIdDocumentUrl);
    }

    revalidatePath("/vendors");
    revalidatePath("/users");
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.vendors.updateFailed")
    );
  }
}

/** Translated soft-delete blockers for the Delete dialog (shown before confirm). */
export async function fetchVendorSoftDeleteBlockers(
  vendorId: string
): Promise<string[]> {
  const locale = await getServerLocale();
  await assertCanManageVendors(locale);
  const blockers = await getVendorSoftDeleteBlockers(vendorId);
  return formatVendorSoftDeleteBlockers(blockers, locale);
}

export async function deactivateVendor(id: string) {
  const locale = await getServerLocale();
  try {
    await assertCanManageVendors(locale);

    const vendor = await prisma.vendor.findUnique({
      where: { id },
      select: { active: true },
    });
    if (!vendor) {
      throw new Error(translate(locale, "pages.vendors.notFound"));
    }
    if (!vendor.active) {
      throw new Error(translate(locale, "pages.vendors.alreadyDeleted"));
    }

    await prisma.$transaction(async (tx) => {
      await assertVendorCanBeSoftDeleted(id, tx, locale);

      await tx.vendor.update({
        where: { id },
        data: { active: false },
      });

      // Soft-delete portal logins (credentials kept; vendorId stays linked).
      await softDeactivateVendorLogins(tx, id);
    });

    revalidatePath("/vendors");
    revalidatePath("/users");
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.vendors.deleteFailed")
    );
  }
}

export async function bulkDeactivateVendors(
  ids: string[]
): Promise<BulkActionResult> {
  const locale = await getServerLocale();
  await assertCanManageVendors(locale);

  const result = createBulkActionResult();
  const uniqueIds = [...new Set(ids.filter(Boolean))];

  for (const id of uniqueIds) {
    try {
      const vendor = await prisma.vendor.findUnique({
        where: { id },
        select: { active: true },
      });
      if (!vendor) {
        throw new Error(translate(locale, "pages.vendors.notFound"));
      }
      if (!vendor.active) {
        throw new Error(translate(locale, "pages.vendors.alreadyDeleted"));
      }

      await prisma.$transaction(async (tx) => {
        await assertVendorCanBeSoftDeleted(id, tx, locale);

        await tx.vendor.update({
          where: { id },
          data: { active: false },
        });

        await softDeactivateVendorLogins(tx, id);
      });

      recordBulkSuccess(result);
    } catch (error) {
      recordBulkFailure(
        result,
        error instanceof Error
          ? error.message
          : translate(locale, "pages.vendors.deleteFailed")
      );
    }
  }

  if (result.successCount > 0) {
    revalidatePath("/vendors");
    revalidatePath("/users");
  }

  return result;
}

async function reactivateVendorRecord(id: string, locale: AppLocale) {
  const vendor = await prisma.vendor.findUnique({
    where: { id },
    select: { active: true },
  });
  if (!vendor) {
    throw new Error(translate(locale, "pages.vendors.notFound"));
  }
  if (vendor.active) {
    throw new Error(translate(locale, "pages.vendors.alreadyActive"));
  }

  // Restore parent only — linked portal logins stay inactive (Revoked Access)
  // until an admin uses Users → Revoked Access → Restore Access.
  await prisma.$transaction(async (tx) => {
    await tx.vendor.update({
      where: { id },
      data: { active: true },
    });
    await ensureVendorLoginsStayInactive(tx, id);
  });
}

export async function reactivateVendor(id: string) {
  const locale = await getServerLocale();
  try {
    await assertCanManageVendors(locale);
    await reactivateVendorRecord(id, locale);
    revalidatePath("/vendors");
    revalidatePath("/users");
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.vendors.restoreFailed")
    );
  }
}

export async function bulkReactivateVendors(
  ids: string[]
): Promise<BulkActionResult> {
  const locale = await getServerLocale();
  await assertCanManageVendors(locale);

  const result = createBulkActionResult();
  const uniqueIds = [...new Set(ids.filter(Boolean))];

  for (const id of uniqueIds) {
    try {
      await reactivateVendorRecord(id, locale);
      recordBulkSuccess(result);
    } catch (error) {
      recordBulkFailure(
        result,
        error instanceof Error
          ? error.message
          : translate(locale, "pages.vendors.restoreFailed")
      );
    }
  }

  if (result.successCount > 0) {
    revalidatePath("/vendors");
    revalidatePath("/users");
  }

  return result;
}


/** Permanent delete — only for deleted (soft-deleted) vendors. Hard-deletes portal users. */
export async function deleteVendor(id: string) {
  const locale = await getServerLocale();
  try {
    await assertCanManageVendors(locale);

    const vendor = await prisma.vendor.findUnique({
      where: { id },
      include: {
        users: { select: { id: true } },
      },
    });

    if (!vendor) {
      throw new Error(translate(locale, "pages.vendors.notFound"));
    }
    if (vendor.active) {
      throw new Error(
        translate(locale, "pages.vendors.permanentDeleteRequiresDeleted")
      );
    }

    const userIds = vendor.users.map((user) => user.id);
    const taxIdDocumentUrl = vendor.taxIdDocumentUrl;

    await prisma.$transaction(async (tx) => {
      if (userIds.length > 0) {
        await hardDeleteLinkedUserLogins(tx, userIds);
      }

      await tx.vendor.delete({ where: { id } });
    });

    await deleteLocalUpload(taxIdDocumentUrl);

    revalidatePath("/vendors");
    revalidatePath("/users");
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.vendors.deleteFailed")
    );
  }
}

export async function bulkDeleteVendors(
  ids: string[]
): Promise<BulkActionResult> {
  const locale = await getServerLocale();
  await assertCanManageVendors(locale);

  const result = createBulkActionResult();
  const uniqueIds = [...new Set(ids.filter(Boolean))];

  for (const id of uniqueIds) {
    try {
      const vendor = await prisma.vendor.findUnique({
        where: { id },
        include: {
          users: { select: { id: true } },
        },
      });

      if (!vendor) {
        throw new Error(translate(locale, "pages.vendors.notFound"));
      }
      if (vendor.active) {
        throw new Error(
          translate(locale, "pages.vendors.permanentDeleteRequiresDeleted")
        );
      }

      const userIds = vendor.users.map((user) => user.id);
      const taxIdDocumentUrl = vendor.taxIdDocumentUrl;

      await prisma.$transaction(async (tx) => {
        if (userIds.length > 0) {
          await hardDeleteLinkedUserLogins(tx, userIds);
        }

        await tx.vendor.delete({ where: { id } });
      });

      await deleteLocalUpload(taxIdDocumentUrl);

      recordBulkSuccess(result);
    } catch (error) {
      recordBulkFailure(
        result,
        error instanceof Error
          ? error.message
          : translate(locale, "pages.vendors.deleteFailed")
      );
    }
  }

  if (result.successCount > 0) {
    revalidatePath("/vendors");
    revalidatePath("/users");
  }

  return result;
}
