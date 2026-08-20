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
import { formatContactPersonName } from "@/lib/contact-person";
import {
  bulkLineFile,
  lineFormData,
  parseBulkLineCount,
} from "@/lib/bulk-create";
import { SORT_ORDER_STEP } from "@/lib/reorder";
import { deleteLocalUpload, saveUpload } from "@/lib/upload";

const ALLOWED_PAYMENT_TERMS_DAYS = new Set<number>(PAYMENT_TERMS_DAYS_OPTIONS);

type VendorTypeValue = "COMPANY" | "INDIVIDUAL";

function parsePaymentTermsDays(formData: FormData): number {
  const raw = Number(formData.get("paymentTermsDays") ?? NaN);
  if (!Number.isFinite(raw) || !ALLOWED_PAYMENT_TERMS_DAYS.has(raw)) {
    return normalizePaymentTermsDays(14);
  }
  return normalizePaymentTermsDays(raw);
}

function parseVendorType(formData: FormData): VendorTypeValue {
  const vendorTypeRaw = String(formData.get("vendorType") ?? "COMPANY")
    .trim()
    .toUpperCase();
  return vendorTypeRaw === "INDIVIDUAL" ? "INDIVIDUAL" : "COMPANY";
}

/**
 * Company: vendor name + separate contact person.
 * Individual: first/last are the vendor; contactPerson* mirrors self (schema).
 */
function resolveVendorFormIdentity(
  formData: FormData,
  vendorType: VendorTypeValue,
  locale: AppLocale
) {
  const contactPersonFirstName = capitalizeName(
    String(formData.get("contactPersonFirstName") ?? "").trim()
  );
  const contactPersonLastName = capitalizeName(
    String(formData.get("contactPersonLastName") ?? "").trim()
  );
  const email = String(formData.get("email") ?? "").trim();
  const phoneLabel =
    vendorType === "INDIVIDUAL"
      ? translate(locale, "pages.vendors.form.phone")
      : translate(locale, "pages.vendors.form.companyPhone");
  const phone = normalizeAndValidatePhone(
    String(formData.get("phone") ?? ""),
    phoneLabel
  );

  if (vendorType === "INDIVIDUAL") {
    if (!contactPersonFirstName) {
      throw new Error(translate(locale, "pages.vendors.firstNameRequired"));
    }
    const composedName =
      formatContactPersonName(contactPersonFirstName, contactPersonLastName) ||
      contactPersonFirstName;
    const nameFromForm = capitalizeProper(
      String(formData.get("name") ?? "").trim()
    );
    return {
      name: nameFromForm || composedName,
      email,
      phone,
      contactPersonFirstName,
      contactPersonLastName: contactPersonLastName || null,
      contactPersonPosition: null as string | null,
      contactPersonEmail: email || null,
      contactPersonPhone: phone || null,
    };
  }

  const name = capitalizeProper(String(formData.get("name") ?? "").trim());
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

  if (!name) {
    throw new Error(translate(locale, "pages.vendors.vendorNameRequired"));
  }
  if (!contactPersonFirstName) {
    throw new Error(
      translate(locale, "pages.vendors.contactFirstNameRequired")
    );
  }

  return {
    name,
    email,
    phone,
    contactPersonFirstName,
    contactPersonLastName: contactPersonLastName || null,
    contactPersonPosition: contactPersonPosition || null,
    contactPersonEmail: contactPersonEmail || null,
    contactPersonPhone: contactPersonPhone || null,
  };
}

async function parseRequiredVendorNpwp(
  formData: FormData,
  vendorType: VendorTypeValue,
  locale: AppLocale
): Promise<string> {
  return parseRequiredClientNpwpValue(
    String(formData.get("npwp") ?? ""),
    locale,
    vendorType === "INDIVIDUAL" ? "client" : "company"
  );
}

function taxIdDocumentMissingMessage(
  vendorType: VendorTypeValue,
  locale: AppLocale
): string {
  return translate(
    locale,
    vendorType === "INDIVIDUAL"
      ? "bulkImport.taxIdDocumentRequiredIndividual"
      : "bulkImport.taxIdDocumentRequiredCompany"
  );
}

/**
 * Soft-require: create always needs a file; edit keeps the existing file unless
 * a replacement is uploaded. Returns undefined when no new file was chosen.
 */
async function saveTaxIdDocument(
  formData: FormData,
  options?: { shortCode?: string | null; fileBasePrefix?: string }
): Promise<string | null | undefined> {
  const file = formData.get("taxIdDocument");

  if (!(file instanceof File) || file.size === 0) {
    return undefined;
  }

  const prefix = options?.fileBasePrefix ?? "NPWP";
  const code = options?.shortCode?.trim();
  const fileBaseName = code ? `${prefix}_${code}` : prefix;

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

    const vendorType = parseVendorType(formData);
    const identity = resolveVendorFormIdentity(formData, vendorType, locale);
    const address = capitalizeProper(
      String(formData.get("address") ?? "").trim()
    );
    const npwp = await parseRequiredVendorNpwp(formData, vendorType, locale);
    const vendorSince =
      parseFormDateInput(formData.get("vendorSince"), {
        fieldLabel: translate(locale, "pages.vendors.form.vendorSince"),
      }) ?? new Date();
    const paymentTermsDays = parsePaymentTermsDays(formData);

    const company = await prisma.company.findFirst();
    if (!company) {
      throw new Error(translate(locale, "pages.vendors.companyNotFound"));
    }

    const taxIdDocumentUrl = await saveTaxIdDocument(formData, {
      fileBasePrefix: vendorType === "INDIVIDUAL" ? "NPWP-NIK" : "NPWP",
    });
    if (!taxIdDocumentUrl) {
      throw new Error(taxIdDocumentMissingMessage(vendorType, locale));
    }

    const sortOrder = await nextCompanyScopedSortOrder("vendor", company.id);

    await prisma.$transaction(async (tx) => {
      const shortCode = await getNextVendorShortCode(company.id, tx);
      await tx.vendor.create({
        data: {
          name: identity.name,
          vendorType,
          shortCode,
          email: identity.email || null,
          phone: identity.phone || null,
          address: address || null,
          npwp,
          taxIdDocumentUrl,
          contactPersonFirstName: identity.contactPersonFirstName,
          contactPersonLastName: identity.contactPersonLastName,
          contactPersonPosition: identity.contactPersonPosition,
          contactPersonEmail: identity.contactPersonEmail,
          contactPersonPhone: identity.contactPersonPhone,
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

const VENDOR_LINE_FIELDS = [
  "name",
  "vendorType",
  "email",
  "phone",
  "address",
  "npwp",
  "contactPersonFirstName",
  "contactPersonLastName",
  "contactPersonPosition",
  "contactPersonEmail",
  "contactPersonPhone",
  "vendorSince",
  "paymentTermsDays",
];

export async function createVendorsInBulk(formData: FormData) {
  const locale = await getServerLocale();
  const uploaded: string[] = [];
  try {
    await assertCanManageVendors(locale);

    const company = await prisma.company.findFirst();
    if (!company) {
      throw new Error(translate(locale, "pages.vendors.companyNotFound"));
    }

    const lineCount = parseBulkLineCount(formData);
    const rows: Array<{
      identity: ReturnType<typeof resolveVendorFormIdentity>;
      vendorType: VendorTypeValue;
      address: string;
      npwp: string;
      taxIdDocumentUrl: string;
      vendorSince: Date;
      paymentTermsDays: number;
    }> = [];

    for (let index = 0; index < lineCount; index += 1) {
      const row = lineFormData(formData, index, VENDOR_LINE_FIELDS);
      const vendorType = parseVendorType(row);
      const namePeek = String(row.get("name") ?? "").trim();
      const firstPeek = String(row.get("contactPersonFirstName") ?? "").trim();
      const npwpPeek = String(row.get("npwp") ?? "").trim();
      const emailPeek = String(row.get("email") ?? "").trim();
      if (!namePeek && !firstPeek && !npwpPeek && !emailPeek) continue;

      let identity: ReturnType<typeof resolveVendorFormIdentity>;
      let address: string;
      let npwp: string;
      let vendorSince: Date;
      let paymentTermsDays: number;
      try {
        identity = resolveVendorFormIdentity(row, vendorType, locale);
        address = capitalizeProper(String(row.get("address") ?? "").trim());
        npwp = await parseRequiredVendorNpwp(row, vendorType, locale);
        vendorSince =
          parseFormDateInput(row.get("vendorSince"), {
            fieldLabel: translate(locale, "pages.vendors.form.vendorSince"),
          }) ?? new Date();
        paymentTermsDays = parsePaymentTermsDays(row);
      } catch (error) {
        throw new Error(
          translate(locale, "bulkCreate.lineError", {
            n: String(index + 1),
            message:
              error instanceof Error ? error.message : "Invalid vendor line.",
          })
        );
      }

      const file = bulkLineFile(formData, index, "taxIdDocument");
      if (!file) {
        throw new Error(
          translate(locale, "bulkCreate.lineError", {
            n: String(index + 1),
            message: taxIdDocumentMissingMessage(vendorType, locale),
          })
        );
      }
      const taxIdDocumentUrl = await saveUpload(file, "uploads/vendors", {
        fileBaseName: vendorType === "INDIVIDUAL" ? "NPWP-NIK" : "NPWP",
      });
      uploaded.push(taxIdDocumentUrl);
      rows.push({
        identity,
        vendorType,
        address,
        npwp,
        taxIdDocumentUrl,
        vendorSince,
        paymentTermsDays,
      });
    }

    if (rows.length === 0) {
      throw new Error(translate(locale, "bulkCreate.emptyLines"));
    }

    let sortOrder = await nextCompanyScopedSortOrder("vendor", company.id);

    await prisma.$transaction(async (tx) => {
      for (const row of rows) {
        const shortCode = await getNextVendorShortCode(company.id, tx);
        await tx.vendor.create({
          data: {
            name: row.identity.name,
            vendorType: row.vendorType,
            shortCode,
            email: row.identity.email || null,
            phone: row.identity.phone || null,
            address: row.address || null,
            npwp: row.npwp,
            taxIdDocumentUrl: row.taxIdDocumentUrl,
            contactPersonFirstName: row.identity.contactPersonFirstName,
            contactPersonLastName: row.identity.contactPersonLastName,
            contactPersonPosition: row.identity.contactPersonPosition,
            contactPersonEmail: row.identity.contactPersonEmail,
            contactPersonPhone: row.identity.contactPersonPhone,
            vendorSince: row.vendorSince,
            paymentTermsDays: row.paymentTermsDays,
            companyId: company.id,
            active: true,
            sortOrder,
          },
        });
        sortOrder += SORT_ORDER_STEP;
      }
    });

    revalidatePath("/vendors");
  } catch (error) {
    await Promise.all(uploaded.map((path) => deleteLocalUpload(path)));
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
 * Updates a vendor. Vendor portal login is disabled (see lib/auth.ts /
 * lib/permissions.ts) — this only syncs the display name on any legacy
 * linked User records; it never creates or re-enables credentials.
 * Soft-delete only via Delete dialog.
 */
export async function updateVendor(id: string, formData: FormData) {
  const locale = await getServerLocale();
  try {
    await assertCanManageVendors(locale);

    const vendorType = parseVendorType(formData);
    const identity = resolveVendorFormIdentity(formData, vendorType, locale);
    const address = capitalizeProper(
      String(formData.get("address") ?? "").trim()
    );
    const npwp = await parseRequiredVendorNpwp(formData, vendorType, locale);
    const vendorSince =
      parseFormDateInput(formData.get("vendorSince"), {
        fieldLabel: translate(locale, "pages.vendors.form.vendorSince"),
      }) ?? new Date();
    const paymentTermsDays = parsePaymentTermsDays(formData);

    const existing = await prisma.vendor.findUnique({
      where: { id },
      select: {
        id: true,
        companyId: true,
        shortCode: true,
        active: true,
        taxIdDocumentUrl: true,
        users: { select: { id: true, active: true } },
      },
    });

    if (!existing) {
      throw new Error(translate(locale, "pages.vendors.notFound"));
    }

    const uploadedTaxIdDocumentUrl = await saveTaxIdDocument(formData, {
      shortCode: existing.shortCode,
      fileBasePrefix: vendorType === "INDIVIDUAL" ? "NPWP-NIK" : "NPWP",
    });
    const taxIdDocumentUrl =
      uploadedTaxIdDocumentUrl !== undefined
        ? uploadedTaxIdDocumentUrl
        : existing.taxIdDocumentUrl;
    if (!taxIdDocumentUrl) {
      throw new Error(taxIdDocumentMissingMessage(vendorType, locale));
    }

    const contactDisplay =
      formatContactPersonName(
        identity.contactPersonFirstName,
        identity.contactPersonLastName
      ) ?? identity.name;

    await prisma.$transaction(async (tx) => {
      // Soft-delete only via Delete dialog / deactivateVendor — never via edit.
      await tx.vendor.update({
        where: { id },
        data: {
          name: identity.name,
          vendorType,
          email: identity.email || null,
          phone: identity.phone || null,
          address: address || null,
          npwp,
          ...(uploadedTaxIdDocumentUrl !== undefined
            ? { taxIdDocumentUrl: uploadedTaxIdDocumentUrl }
            : {}),
          contactPersonFirstName: identity.contactPersonFirstName,
          contactPersonLastName: identity.contactPersonLastName,
          contactPersonPosition: identity.contactPersonPosition,
          contactPersonEmail: identity.contactPersonEmail,
          contactPersonPhone: identity.contactPersonPhone,
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
