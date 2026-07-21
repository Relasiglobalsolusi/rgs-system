"use server";

import { revalidatePath } from "next/cache";

import {
  createBulkActionResult,
  recordBulkFailure,
  recordBulkSuccess,
  type BulkActionResult,
} from "@/lib/bulk-action-result";
import { contactPersonNamePartsChanged } from "@/lib/contact-person";
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
import { parseOptionalNpwpValue } from "@/lib/npwp";
import { getServerLocale } from "@/lib/i18n/locale";
import { canManageVendors } from "@/lib/project-access";
import { parseCreatePortalLoginFlag } from "@/lib/create-portal-login-flag";
import {
  provisionVendorUser,
  resetVendorPortalLoginForContactNameChange,
} from "@/lib/provision-linked-user";
import { requireModule, toPermissionUser } from "@/lib/session";
import { normalizeAndValidatePhone } from "@/lib/phone";
import { capitalizeName, capitalizeProper } from "@/lib/text-case";
import { parseFormDateInput } from "@/lib/bulk-import/parse-import-date";
import { getNextVendorShortCode } from "@/lib/vendor-short-code";
import {
  normalizePaymentTermsDays,
  PAYMENT_TERMS_DAYS_OPTIONS,
} from "@/lib/invoice-period";

const ALLOWED_PAYMENT_TERMS_DAYS = new Set<number>(PAYMENT_TERMS_DAYS_OPTIONS);

function parsePaymentTermsDays(formData: FormData): number {
  const raw = Number(formData.get("paymentTermsDays") ?? NaN);
  if (!Number.isFinite(raw) || !ALLOWED_PAYMENT_TERMS_DAYS.has(raw)) {
    return normalizePaymentTermsDays(14);
  }
  return normalizePaymentTermsDays(raw);
}

async function parseOptionalNpwp(formData: FormData): Promise<string | null> {
  const locale = await getServerLocale();
  return parseOptionalNpwpValue(String(formData.get("npwp") ?? ""), locale);
}

async function assertCanManageVendors() {
  const session = await requireModule("vendors");
  if (!canManageVendors(toPermissionUser(session))) {
    throw new Error("You do not have permission to manage vendors.");
  }
}

/** Preview next auto Vendor ID (V001…). Create still allocates via getNextVendorShortCode. */
export async function previewVendorShortCode() {
  await assertCanManageVendors();

  const company = await prisma.company.findFirst();
  if (!company) {
    throw new Error("Company not found.");
  }

  return getNextVendorShortCode(company.id);
}

export async function createVendor(formData: FormData) {
  try {
    await assertCanManageVendors();

    const name = capitalizeProper(String(formData.get("name") ?? "").trim());
    const email = String(formData.get("email") ?? "").trim();
    const phone = normalizeAndValidatePhone(
      String(formData.get("phone") ?? ""),
      "Company phone"
    );
    const address = capitalizeProper(String(formData.get("address") ?? "").trim());
    const npwp = await parseOptionalNpwp(formData);
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
      "Contact person phone"
    );
    const vendorSince =
      parseFormDateInput(formData.get("vendorSince"), {
        fieldLabel: "Vendor since",
      }) ?? new Date();
    const paymentTermsDays = parsePaymentTermsDays(formData);
    const createPortalLogin = parseCreatePortalLoginFlag(
      formData.get("createPortalLogin")
    );

    if (!name) throw new Error("Vendor name is required.");
    if (!contactPersonFirstName) {
      throw new Error("Contact person first name is required.");
    }

    const company = await prisma.company.findFirst();
    if (!company) throw new Error("Company not found.");

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

      if (createPortalLogin) {
        await provisionVendorUser(tx, {
          companyId: company.id,
          vendorId: vendor.id,
          vendorName: name,
          contactPersonFirstName,
          contactPersonLastName: contactPersonLastName || null,
        });
      }
    });

    revalidatePath("/vendors");
    if (createPortalLogin) {
      revalidatePath("/users");
    }
  } catch (error) {
    throw toActionError(error, "Failed to create vendor.");
  }
}

export async function reorderVendors(ids: string[]) {
  try {
    await assertCanManageVendors();

    const company = await prisma.company.findFirst({ select: { id: true } });
    if (!company) throw new Error("Company not found.");

    await persistCompanyScopedReorder("vendor", {
      companyId: company.id,
      ids,
      mismatchError: "One or more vendors are invalid for reorder.",
    });

    revalidatePath("/vendors");
  } catch (error) {
    throw toActionError(error, "Failed to reorder vendors.");
  }
}

export type UpdateVendorResult = {
  portalLoginReset: boolean;
};

/**
 * Updates a vendor. When contact person first/last name parts change, the
 * vendor remains/becomes active, and linked portal User(s) already exist,
 * those users are hard-deleted and a new portal login is provisioned under the
 * new contact name (mustSetPassword + no recovery email → first-login setup).
 * No linked login → contact fields only (no User create/delete). Company-name
 * or other non-name edits never reset. UI should confirm before calling.
 */
export async function updateVendor(
  id: string,
  formData: FormData
): Promise<UpdateVendorResult> {
  try {
    await assertCanManageVendors();

    const name = capitalizeProper(String(formData.get("name") ?? "").trim());
    const email = String(formData.get("email") ?? "").trim();
    const phone = normalizeAndValidatePhone(
      String(formData.get("phone") ?? ""),
      "Company phone"
    );
    const address = capitalizeProper(String(formData.get("address") ?? "").trim());
    const npwp = await parseOptionalNpwp(formData);
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
      "Contact person phone"
    );
    const active = formData.get("active") === "true";
    const vendorSince =
      parseFormDateInput(formData.get("vendorSince"), {
        fieldLabel: "Vendor since",
      }) ?? new Date();
    const paymentTermsDays = parsePaymentTermsDays(formData);

    if (!name) throw new Error("Vendor name is required.");
    if (!contactPersonFirstName) {
      throw new Error("Contact person first name is required.");
    }

    const portalLoginReset = await prisma.$transaction(async (tx) => {
      const existing = await tx.vendor.findUnique({
        where: { id },
        select: {
          companyId: true,
          contactPersonFirstName: true,
          contactPersonLastName: true,
          users: { select: { id: true } },
        },
      });

      if (!existing) {
        throw new Error("Vendor not found.");
      }

      const nameChanged = contactPersonNamePartsChanged(
        {
          firstName: existing.contactPersonFirstName,
          lastName: existing.contactPersonLastName,
        },
        {
          firstName: contactPersonFirstName,
          lastName: contactPersonLastName || null,
        }
      );
      const linkedUserIds = existing.users.map((user) => user.id);
      const shouldResetPortalLogin =
        nameChanged && linkedUserIds.length > 0 && active;

      await tx.vendor.update({
        where: { id },
        data: {
          name,
          email: email || null,
          phone: phone || null,
          address: address || null,
          npwp,
          contactPersonFirstName,
          contactPersonLastName: contactPersonLastName || null,
          contactPersonPosition: contactPersonPosition || null,
          contactPersonEmail: contactPersonEmail || null,
          contactPersonPhone: contactPersonPhone || null,
          vendorSince,
          paymentTermsDays,
          active,
        },
      });

      if (shouldResetPortalLogin) {
        await resetVendorPortalLoginForContactNameChange(tx, {
          companyId: existing.companyId,
          vendorId: id,
          vendorName: name,
          contactPersonFirstName,
          contactPersonLastName: contactPersonLastName || null,
          linkedUserIds,
          provisionReplacement: true,
        });
        return true;
      }

      // Soft-deactivate logins when the vendor is inactive. Never auto-reactivate
      // on active=true — Restore Access is required separately after parent restore.
      if (!active) {
        await softDeactivateVendorLogins(tx, id);
      }
      return false;
    });

    revalidatePath("/vendors");
    revalidatePath("/users");
    return { portalLoginReset };
  } catch (error) {
    throw toActionError(error, "Failed to update vendor.");
  }
}

export async function deactivateVendor(id: string) {
  await assertCanManageVendors();

  const vendor = await prisma.vendor.findUnique({
    where: { id },
    select: { active: true },
  });
  if (!vendor) throw new Error("Vendor not found.");
  if (!vendor.active) throw new Error("Vendor is already deleted.");

  await prisma.$transaction(async (tx) => {
    await tx.vendor.update({
      where: { id },
      data: { active: false },
    });

    // Soft-delete portal logins (credentials kept; vendorId stays linked).
    await softDeactivateVendorLogins(tx, id);
  });

  revalidatePath("/vendors");
  revalidatePath("/users");
}

export async function bulkDeactivateVendors(
  ids: string[]
): Promise<BulkActionResult> {
  await assertCanManageVendors();

  const result = createBulkActionResult();
  const uniqueIds = [...new Set(ids.filter(Boolean))];

  for (const id of uniqueIds) {
    try {
      const vendor = await prisma.vendor.findUnique({
        where: { id },
        select: { active: true },
      });
      if (!vendor) throw new Error("Vendor not found.");
      if (!vendor.active) throw new Error("Vendor is already deleted.");

      await prisma.$transaction(async (tx) => {
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
        error instanceof Error ? error.message : "Failed to delete vendor."
      );
    }
  }

  if (result.successCount > 0) {
    revalidatePath("/vendors");
    revalidatePath("/users");
  }

  return result;
}

async function reactivateVendorRecord(id: string) {
  const vendor = await prisma.vendor.findUnique({
    where: { id },
    select: { active: true },
  });
  if (!vendor) throw new Error("Vendor not found.");
  if (vendor.active) throw new Error("Vendor is already active.");

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
  await assertCanManageVendors();
  await reactivateVendorRecord(id);
  revalidatePath("/vendors");
  revalidatePath("/users");
}

export async function bulkReactivateVendors(
  ids: string[]
): Promise<BulkActionResult> {
  await assertCanManageVendors();

  const result = createBulkActionResult();
  const uniqueIds = [...new Set(ids.filter(Boolean))];

  for (const id of uniqueIds) {
    try {
      await reactivateVendorRecord(id);
      recordBulkSuccess(result);
    } catch (error) {
      recordBulkFailure(
        result,
        error instanceof Error ? error.message : "Failed to restore vendor."
      );
    }
  }

  if (result.successCount > 0) {
    revalidatePath("/vendors");
    revalidatePath("/users");
  }

  return result;
}

/**
 * Provision portal logins for vendors with no linked User (No Portal Login).
 * Uses the same credential template as single create / bulk import.
 */
export async function generateVendorPortalLogins(
  ids: string[]
): Promise<BulkActionResult> {
  await assertCanManageVendors();

  const result = createBulkActionResult();
  const uniqueIds = [...new Set(ids.filter(Boolean))];

  if (uniqueIds.length === 0) {
    return result;
  }

  const company = await prisma.company.findFirst({ select: { id: true } });
  if (!company) {
    throw new Error("Company not found.");
  }

  for (const id of uniqueIds) {
    try {
      const provisioned = await prisma.$transaction(async (tx) => {
        const vendor = await tx.vendor.findUnique({
          where: { id },
          select: {
            id: true,
            name: true,
            active: true,
            contactPersonFirstName: true,
            contactPersonLastName: true,
          },
        });

        if (!vendor) {
          throw new Error("Vendor not found.");
        }

        if (!vendor.active) {
          throw new Error(
            `${vendor.name}: portal login cannot be generated for deleted vendors. Restore the vendor first.`
          );
        }

        const contactPersonFirstName =
          vendor.contactPersonFirstName?.trim() ?? "";
        if (!contactPersonFirstName) {
          throw new Error(
            `${vendor.name}: contact person first name is required.`
          );
        }

        const user = await provisionVendorUser(tx, {
          companyId: company.id,
          vendorId: vendor.id,
          vendorName: vendor.name,
          contactPersonFirstName,
          contactPersonLastName: vendor.contactPersonLastName,
        });

        return Boolean(user);
      });

      if (provisioned) {
        recordBulkSuccess(result);
      }
    } catch (error) {
      recordBulkFailure(
        result,
        error instanceof Error
          ? error.message
          : "Failed to generate portal login."
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
  await assertCanManageVendors();

  const vendor = await prisma.vendor.findUnique({
    where: { id },
    include: {
      users: { select: { id: true } },
    },
  });

  if (!vendor) throw new Error("Vendor not found.");
  if (vendor.active) {
    throw new Error(
      "Only deleted vendors can be permanently deleted. Delete the vendor first."
    );
  }

  const userIds = vendor.users.map((user) => user.id);

  await prisma.$transaction(async (tx) => {
    if (userIds.length > 0) {
      await hardDeleteLinkedUserLogins(tx, userIds);
    }

    await tx.vendor.delete({ where: { id } });
  });

  revalidatePath("/vendors");
  revalidatePath("/users");
}

export async function bulkDeleteVendors(
  ids: string[]
): Promise<BulkActionResult> {
  await assertCanManageVendors();

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

      if (!vendor) throw new Error("Vendor not found.");
      if (vendor.active) {
        throw new Error(
          "Only deleted vendors can be permanently deleted. Delete the vendor first."
        );
      }

      const userIds = vendor.users.map((user) => user.id);

      await prisma.$transaction(async (tx) => {
        if (userIds.length > 0) {
          await hardDeleteLinkedUserLogins(tx, userIds);
        }

        await tx.vendor.delete({ where: { id } });
      });

      recordBulkSuccess(result);
    } catch (error) {
      recordBulkFailure(
        result,
        error instanceof Error ? error.message : "Failed to delete vendor."
      );
    }
  }

  if (result.successCount > 0) {
    revalidatePath("/vendors");
    revalidatePath("/users");
  }

  return result;
}
