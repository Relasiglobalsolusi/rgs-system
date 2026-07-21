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
  ensureClientLoginsStayInactive,
  softDeactivateClientLogins,
} from "@/lib/linked-login-lifecycle";
import {
  nextCompanyScopedSortOrder,
  persistCompanyScopedReorder,
} from "@/lib/persist-reorder";
import { prisma } from "@/lib/prisma";
import { toActionError } from "@/lib/prisma-errors";
import { parseOptionalNpwpValue } from "@/lib/npwp";
import { getServerLocale } from "@/lib/i18n/locale";
import { canManageClients } from "@/lib/project-access";
import { provisionClientUser } from "@/lib/provision-linked-user";
import { requireModule, toPermissionUser } from "@/lib/session";
import { normalizeAndValidatePhone } from "@/lib/phone";
import { capitalizeName, capitalizeProper } from "@/lib/text-case";
import { parseFormDateInput } from "@/lib/bulk-import/parse-import-date";
import { getNextClientShortCode } from "@/lib/client-short-code";
import {
  normalizePaymentTermsDays,
  PAYMENT_TERMS_DAYS_OPTIONS,
} from "@/lib/invoice-period";
import { formatContactPersonName } from "@/lib/contact-person";
import { assertClientNameAvailable } from "@/lib/client-name";
import { assertClientCanBeSoftDeleted } from "@/lib/client-soft-delete";

const ALLOWED_PAYMENT_TERMS_DAYS = new Set<number>(PAYMENT_TERMS_DAYS_OPTIONS);

type ClientTypeValue = "COMPANY" | "INDIVIDUAL";

function parsePaymentTermsDays(formData: FormData): number {
  const raw = Number(formData.get("paymentTermsDays") ?? NaN);
  if (!Number.isFinite(raw) || !ALLOWED_PAYMENT_TERMS_DAYS.has(raw)) {
    return normalizePaymentTermsDays(14);
  }
  return normalizePaymentTermsDays(raw);
}

function parseClientType(formData: FormData): ClientTypeValue {
  const clientTypeRaw = String(formData.get("clientType") ?? "COMPANY")
    .trim()
    .toUpperCase();
  return clientTypeRaw === "INDIVIDUAL" ? "INDIVIDUAL" : "COMPANY";
}

/**
 * Company: client name + separate contact person.
 * Individual: first/last are the client; contactPerson* mirrors self (schema).
 */
function resolveClientFormIdentity(formData: FormData, clientType: ClientTypeValue) {
  const contactPersonFirstName = capitalizeName(
    String(formData.get("contactPersonFirstName") ?? "").trim()
  );
  const contactPersonLastName = capitalizeName(
    String(formData.get("contactPersonLastName") ?? "").trim()
  );
  const email = String(formData.get("email") ?? "").trim();
  const phoneLabel =
    clientType === "INDIVIDUAL" ? "Phone" : "Company phone";
  const phone = normalizeAndValidatePhone(
    String(formData.get("phone") ?? ""),
    phoneLabel
  );

  if (clientType === "INDIVIDUAL") {
    if (!contactPersonFirstName) {
      throw new Error("First name is required.");
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
    "Contact person phone"
  );

  if (!name) throw new Error("Client name is required.");
  if (!contactPersonFirstName) {
    throw new Error("Contact person first name is required.");
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

async function parseOptionalNpwp(
  formData: FormData,
  clientType: ClientTypeValue
): Promise<string | null> {
  const locale = await getServerLocale();
  return parseOptionalNpwpValue(
    String(formData.get("npwp") ?? ""),
    locale,
    clientType === "INDIVIDUAL" ? "client" : "company"
  );
}

async function assertCanManageClients() {
  const session = await requireModule("clients");
  if (!canManageClients(toPermissionUser(session))) {
    throw new Error("You do not have permission to manage clients.");
  }
}

/** Preview next auto Client ID (C001…). Create still allocates via getNextClientShortCode. */
export async function previewClientShortCode() {
  await assertCanManageClients();

  const company = await prisma.company.findFirst();
  if (!company) {
    throw new Error("Company not found.");
  }

  return getNextClientShortCode(company.id);
}

export async function createClient(formData: FormData) {
  try {
    await assertCanManageClients();

    const clientType = parseClientType(formData);
    const identity = resolveClientFormIdentity(formData, clientType);
    const address = capitalizeProper(String(formData.get("address") ?? "").trim());
    const npwp = await parseOptionalNpwp(formData, clientType);
    const clientSince =
      parseFormDateInput(formData.get("clientSince"), {
        fieldLabel: "Client since",
      }) ?? new Date();
    const paymentTermsDays = parsePaymentTermsDays(formData);
    const preferredLoginId = String(formData.get("loginId") ?? "").trim();
    const multiProjectAccess =
      String(formData.get("multiProjectAccess") ?? "").toLowerCase() ===
        "yes" ||
      String(formData.get("multiProjectAccess") ?? "") === "true";

    const company = await prisma.company.findFirst();
    if (!company) throw new Error("Company not found.");

    const sortOrder = await nextCompanyScopedSortOrder("client", company.id);

    await prisma.$transaction(async (tx) => {
      const nameNormalized = await assertClientNameAvailable(
        { companyId: company.id, name: identity.name },
        tx
      );
      const shortCode = await getNextClientShortCode(company.id, tx);
      const client = await tx.client.create({
        data: {
          name: identity.name,
          nameNormalized,
          clientType,
          shortCode,
          email: identity.email || null,
          phone: identity.phone || null,
          address: address || null,
          npwp,
          contactPersonFirstName: identity.contactPersonFirstName,
          contactPersonLastName: identity.contactPersonLastName,
          contactPersonPosition: identity.contactPersonPosition,
          contactPersonEmail: identity.contactPersonEmail,
          contactPersonPhone: identity.contactPersonPhone,
          clientSince,
          paymentTermsDays,
          multiProjectAccess,
          multiProjectSecurityMode: multiProjectAccess
            ? "MASTER_AND_GROUP"
            : null,
          companyId: company.id,
          active: true,
          sortOrder,
        },
      });

      // Always create portal Login ID; revoke later in Users if needed.
      await provisionClientUser(tx, {
        companyId: company.id,
        clientId: client.id,
        clientName: identity.name,
        contactPersonFirstName: identity.contactPersonFirstName,
        contactPersonLastName: identity.contactPersonLastName,
        preferredLoginId: preferredLoginId || null,
      });
    });

    revalidatePath("/clients");
    revalidatePath("/billing");
    revalidatePath("/users");
  } catch (error) {
    throw toActionError(error, "Failed to create client.");
  }
}

export async function reorderClients(ids: string[]) {
  try {
    await assertCanManageClients();

    const company = await prisma.company.findFirst({ select: { id: true } });
    if (!company) throw new Error("Company not found.");

    await persistCompanyScopedReorder("client", {
      companyId: company.id,
      ids,
      mismatchError: "One or more clients are invalid for reorder.",
    });

    revalidatePath("/clients");
    revalidatePath("/billing");
  } catch (error) {
    throw toActionError(error, "Failed to reorder clients.");
  }
}

/**
 * Updates a client. Contact person rename does not reset Login ID.
 * Soft-deactivate portal logins when the client is marked inactive.
 */
export async function updateClient(id: string, formData: FormData) {
  try {
    await assertCanManageClients();

    const clientType = parseClientType(formData);
    const identity = resolveClientFormIdentity(formData, clientType);
    const address = capitalizeProper(String(formData.get("address") ?? "").trim());
    const npwp = await parseOptionalNpwp(formData, clientType);
    const active = formData.get("active") === "true";
    const clientSince =
      parseFormDateInput(formData.get("clientSince"), {
        fieldLabel: "Client since",
      }) ?? new Date();
    const paymentTermsDays = parsePaymentTermsDays(formData);

    await prisma.$transaction(async (tx) => {
      const existing = await tx.client.findUnique({
        where: { id },
        select: { id: true, companyId: true, active: true },
      });

      if (!existing) {
        throw new Error("Client not found.");
      }

      if (existing.active && !active) {
        await assertClientCanBeSoftDeleted(id, tx);
      }

      const nameNormalized = await assertClientNameAvailable(
        {
          companyId: existing.companyId,
          name: identity.name,
          excludeId: id,
        },
        tx
      );

      await tx.client.update({
        where: { id },
        data: {
          name: identity.name,
          nameNormalized,
          clientType,
          email: identity.email || null,
          phone: identity.phone || null,
          address: address || null,
          npwp,
          contactPersonFirstName: identity.contactPersonFirstName,
          contactPersonLastName: identity.contactPersonLastName,
          contactPersonPosition: identity.contactPersonPosition,
          contactPersonEmail: identity.contactPersonEmail,
          contactPersonPhone: identity.contactPersonPhone,
          clientSince,
          paymentTermsDays,
          active,
        },
      });

      // Soft-deactivate logins when the client is inactive. Never auto-reactivate
      // on active=true — Restore Access is required separately after parent restore.
      if (!active) {
        await softDeactivateClientLogins(tx, id);
      }
    });

    revalidatePath("/clients");
    revalidatePath("/billing");
    revalidatePath("/users");
  } catch (error) {
    throw toActionError(error, "Failed to update client.");
  }
}

export async function deactivateClient(id: string) {
  try {
    await assertCanManageClients();

    const client = await prisma.client.findUnique({
      where: { id },
      select: { active: true },
    });
    if (!client) throw new Error("Client not found.");
    if (!client.active) throw new Error("Client is already deleted.");

    await prisma.$transaction(async (tx) => {
      await assertClientCanBeSoftDeleted(id, tx);

      await tx.client.update({
        where: { id },
        data: { active: false },
      });

      // Soft-delete portal logins (credentials kept; clientId stays linked).
      await softDeactivateClientLogins(tx, id);
    });

    revalidatePath("/clients");
    revalidatePath("/billing");
    revalidatePath("/users");
  } catch (error) {
    throw toActionError(error, "Failed to delete client.");
  }
}

export async function bulkDeactivateClients(
  ids: string[]
): Promise<BulkActionResult> {
  await assertCanManageClients();

  const result = createBulkActionResult();
  const uniqueIds = [...new Set(ids.filter(Boolean))];

  for (const id of uniqueIds) {
    try {
      const client = await prisma.client.findUnique({
        where: { id },
        select: { active: true },
      });
      if (!client) throw new Error("Client not found.");
      if (!client.active) throw new Error("Client is already deleted.");

      await prisma.$transaction(async (tx) => {
        await assertClientCanBeSoftDeleted(id, tx);

        await tx.client.update({
          where: { id },
          data: { active: false },
        });

        await softDeactivateClientLogins(tx, id);
      });

      recordBulkSuccess(result);
    } catch (error) {
      recordBulkFailure(
        result,
        error instanceof Error ? error.message : "Failed to delete client."
      );
    }
  }

  if (result.successCount > 0) {
    revalidatePath("/clients");
    revalidatePath("/billing");
    revalidatePath("/users");
  }

  return result;
}

async function reactivateClientRecord(id: string) {
  const client = await prisma.client.findUnique({
    where: { id },
    select: { active: true },
  });
  if (!client) throw new Error("Client not found.");
  if (client.active) throw new Error("Client is already active.");

  // Restore parent only — linked portal logins stay inactive (Revoked Access)
  // until an admin uses Users → Revoked Access → Restore Access.
  await prisma.$transaction(async (tx) => {
    await tx.client.update({
      where: { id },
      data: { active: true },
    });
    await ensureClientLoginsStayInactive(tx, id);
  });
}

export async function reactivateClient(id: string) {
  await assertCanManageClients();
  await reactivateClientRecord(id);
  revalidatePath("/clients");
  revalidatePath("/users");
}

export async function bulkReactivateClients(
  ids: string[]
): Promise<BulkActionResult> {
  await assertCanManageClients();

  const result = createBulkActionResult();
  const uniqueIds = [...new Set(ids.filter(Boolean))];

  for (const id of uniqueIds) {
    try {
      await reactivateClientRecord(id);
      recordBulkSuccess(result);
    } catch (error) {
      recordBulkFailure(
        result,
        error instanceof Error ? error.message : "Failed to restore client."
      );
    }
  }

  if (result.successCount > 0) {
    revalidatePath("/clients");
    revalidatePath("/users");
  }

  return result;
}

/**
 * Provision portal logins for clients with no linked User (No Portal Login).
 * Uses the same credential template as single create / bulk import.
 * Clients that already have a linked login (active or revoked) are skipped
 * or, if inactive, reactivated as a safety net — the Users No Portal Login
 * list only surfaces never-had-login rows.
 */
export async function generateClientPortalLogins(
  ids: string[]
): Promise<BulkActionResult> {
  await assertCanManageClients();

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
        const client = await tx.client.findUnique({
          where: { id },
          select: {
            id: true,
            name: true,
            active: true,
            contactPersonFirstName: true,
            contactPersonLastName: true,
          },
        });

        if (!client) {
          throw new Error("Client not found.");
        }

        if (!client.active) {
          throw new Error(
            `${client.name}: portal login cannot be generated for deleted clients. Restore the client first.`
          );
        }

        const contactPersonFirstName =
          client.contactPersonFirstName?.trim() ?? "";
        if (!contactPersonFirstName) {
          throw new Error(
            `${client.name}: contact person first name is required.`
          );
        }

        const user = await provisionClientUser(tx, {
          companyId: company.id,
          clientId: client.id,
          clientName: client.name,
          contactPersonFirstName,
          contactPersonLastName: client.contactPersonLastName,
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
    revalidatePath("/clients");
    revalidatePath("/users");
  }

  return result;
}

/** Permanent delete — only for deleted (soft-deleted) clients. Unlinks projects; hard-deletes portal users. */
export async function deleteClient(id: string) {
  await assertCanManageClients();

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      users: { select: { id: true } },
    },
  });

  if (!client) throw new Error("Client not found.");
  if (client.active) {
    throw new Error(
      "Only deleted clients can be permanently deleted. Delete the client first."
    );
  }

  const userIds = client.users.map((user) => user.id);

  await prisma.$transaction(async (tx) => {
    await tx.project.updateMany({
      where: { clientId: id },
      data: { clientId: null },
    });

    // Forever delete: portal logins are permanently removed and cannot be restored.
    if (userIds.length > 0) {
      await hardDeleteLinkedUserLogins(tx, userIds);
    }

    await tx.client.delete({ where: { id } });
  });

  revalidatePath("/clients");
  revalidatePath("/users");
  revalidatePath("/projects");
}

export async function bulkDeleteClients(
  ids: string[]
): Promise<BulkActionResult> {
  await assertCanManageClients();

  const result = createBulkActionResult();
  const uniqueIds = [...new Set(ids.filter(Boolean))];

  for (const id of uniqueIds) {
    try {
      const client = await prisma.client.findUnique({
        where: { id },
        include: {
          users: { select: { id: true } },
        },
      });

      if (!client) throw new Error("Client not found.");
      if (client.active) {
        throw new Error(
          "Only deleted clients can be permanently deleted. Delete the client first."
        );
      }

      const userIds = client.users.map((user) => user.id);

      await prisma.$transaction(async (tx) => {
        await tx.project.updateMany({
          where: { clientId: id },
          data: { clientId: null },
        });

        if (userIds.length > 0) {
          await hardDeleteLinkedUserLogins(tx, userIds);
        }

        await tx.client.delete({ where: { id } });
      });

      recordBulkSuccess(result);
    } catch (error) {
      recordBulkFailure(
        result,
        error instanceof Error ? error.message : "Failed to delete client."
      );
    }
  }

  if (result.successCount > 0) {
    revalidatePath("/clients");
    revalidatePath("/users");
    revalidatePath("/projects");
  }

  return result;
}
