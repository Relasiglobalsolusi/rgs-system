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
import { parseRequiredClientNpwpValue } from "@/lib/npwp";
import type { AppLocale } from "@/lib/i18n/locale";
import { getServerLocale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";
import { canManageClients } from "@/lib/project-access";
import { provisionClientUser } from "@/lib/provision-linked-user";
import { requireModule, toPermissionUser } from "@/lib/session";
import { normalizeAndValidatePhone } from "@/lib/phone";
import { capitalizeName, capitalizeProper } from "@/lib/text-case";
import { parseFormDateInput } from "@/lib/bulk-import/parse-import-date";
import { getNextClientShortCode } from "@/lib/client-short-code";
import {
  formatContactPersonName,
} from "@/lib/contact-person";
import { persistClientProjectGroupMembership } from "@/app/clients/multi-project-actions";
import { assertClientNameAvailable } from "@/lib/client-name";
import {
  assertClientCanBeSoftDeleted,
  formatClientSoftDeleteBlockers,
  getClientSoftDeleteBlockers,
} from "@/lib/client-soft-delete";
import {
  bulkLineFile,
  lineFormData,
  parseBulkLineCount,
} from "@/lib/bulk-create";
import { SORT_ORDER_STEP } from "@/lib/reorder";
import { deleteLocalUpload, saveUpload } from "@/lib/upload";

type ClientTypeValue = "COMPANY" | "INDIVIDUAL";

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
function resolveClientFormIdentity(
  formData: FormData,
  clientType: ClientTypeValue,
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
    clientType === "INDIVIDUAL"
      ? translate(locale, "pages.clients.form.phone")
      : translate(locale, "pages.clients.form.companyPhone");
  const phone = normalizeAndValidatePhone(
    String(formData.get("phone") ?? ""),
    phoneLabel,
    translate(locale, "validation.fieldInvalid", { field: phoneLabel })
  );

  if (clientType === "INDIVIDUAL") {
    if (!contactPersonFirstName) {
      throw new Error(translate(locale, "pages.clients.firstNameRequired"));
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
  const contactPhoneLabel = translate(
    locale,
    "pages.clients.form.contactPhone"
  );
  const contactPersonPhone = normalizeAndValidatePhone(
    String(formData.get("contactPersonPhone") ?? ""),
    contactPhoneLabel,
    translate(locale, "validation.fieldInvalid", { field: contactPhoneLabel })
  );

  if (!name) {
    throw new Error(translate(locale, "pages.clients.clientNameRequired"));
  }
  if (!contactPersonFirstName) {
    throw new Error(
      translate(locale, "pages.clients.contactFirstNameRequired")
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

async function parseRequiredClientNpwp(
  formData: FormData,
  clientType: ClientTypeValue,
  locale: AppLocale
): Promise<string> {
  return parseRequiredClientNpwpValue(
    String(formData.get("npwp") ?? ""),
    locale,
    clientType === "INDIVIDUAL" ? "client" : "company"
  );
}

function taxIdDocumentMissingMessage(
  clientType: ClientTypeValue,
  locale: AppLocale
): string {
  return translate(
    locale,
    clientType === "INDIVIDUAL"
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

  const prefix = options?.fileBasePrefix ?? "Tax-ID";
  const code = options?.shortCode?.trim();
  const fileBaseName = code ? `${prefix}_${code}` : prefix;

  return saveUpload(file, "uploads/clients", {
    fileBaseName,
  });
}

async function assertCanManageClients(locale?: AppLocale) {
  const session = await requireModule("clients");
  if (!canManageClients(toPermissionUser(session))) {
    throw new Error(
      translate(
        locale ?? (await getServerLocale()),
        "pages.clients.permissionDenied"
      )
    );
  }
}

/** Preview next auto Client ID (C001…). Create still allocates via getNextClientShortCode. */
export async function previewClientShortCode() {
  const locale = await getServerLocale();
  await assertCanManageClients(locale);

  const company = await prisma.company.findFirst();
  if (!company) {
    throw new Error(translate(locale, "pages.clients.companyNotFound"));
  }

  return getNextClientShortCode(company.id);
}

export async function createClient(formData: FormData) {
  const locale = await getServerLocale();
  try {
    await assertCanManageClients(locale);

    const clientType = parseClientType(formData);
    const identity = resolveClientFormIdentity(formData, clientType, locale);
    const address = capitalizeProper(String(formData.get("address") ?? "").trim());
    const npwp = await parseRequiredClientNpwp(formData, clientType, locale);
    const clientSince =
      parseFormDateInput(formData.get("clientSince"), {
        fieldLabel: translate(locale, "pages.clients.form.clientSince"),
      }) ?? new Date();
    const preferredLoginId = String(formData.get("loginId") ?? "").trim();
    const hasPortalAccess =
      String(formData.get("hasPortalAccess") ?? "yes").toLowerCase() !== "no";
    const multiProjectAccess =
      hasPortalAccess &&
      (String(formData.get("multiProjectAccess") ?? "").toLowerCase() ===
        "yes" ||
        String(formData.get("multiProjectAccess") ?? "") === "true");

    const company = await prisma.company.findFirst();
    if (!company) {
      throw new Error(translate(locale, "pages.clients.companyNotFound"));
    }

    const taxIdDocumentUrl = await saveTaxIdDocument(formData, {
      fileBasePrefix: clientType === "INDIVIDUAL" ? "NPWP-NIK" : "NPWP",
    });
    if (!taxIdDocumentUrl) {
      throw new Error(taxIdDocumentMissingMessage(clientType, locale));
    }

    const sortOrder = await nextCompanyScopedSortOrder("client", company.id);

    await prisma.$transaction(async (tx) => {
      const nameNormalized = await assertClientNameAvailable(
        { companyId: company.id, name: identity.name, locale },
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
          taxIdDocumentUrl,
          contactPersonFirstName: identity.contactPersonFirstName,
          contactPersonLastName: identity.contactPersonLastName,
          contactPersonPosition: identity.contactPersonPosition,
          contactPersonEmail: identity.contactPersonEmail,
          contactPersonPhone: identity.contactPersonPhone,
          clientSince,
          hasPortalAccess,
          multiProjectAccess,
          multiProjectSecurityMode: multiProjectAccess
            ? "MASTER_AND_GROUP"
            : null,
          companyId: company.id,
          active: true,
          sortOrder,
        },
      });

      if (hasPortalAccess) {
        await provisionClientUser(tx, {
          companyId: company.id,
          clientId: client.id,
          clientName: identity.name,
          contactPersonFirstName: identity.contactPersonFirstName,
          contactPersonLastName: identity.contactPersonLastName,
          preferredLoginId: preferredLoginId || null,
        });
      }
    });

    revalidatePath("/clients");
    revalidatePath("/billing");
    revalidatePath("/users");
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.clients.createFailed")
    );
  }
}

const CLIENT_LINE_FIELDS = [
  "name",
  "contactPersonFirstName",
  "contactPersonLastName",
  "contactPersonPosition",
  "contactPersonEmail",
  "contactPersonPhone",
  "email",
  "phone",
  "address",
  "npwp",
  "clientType",
  "clientSince",
  "multiProjectAccess",
  "hasPortalAccess",
];

export async function createClientsInBulk(formData: FormData) {
  const locale = await getServerLocale();
  const uploaded: string[] = [];
  try {
    await assertCanManageClients(locale);

    const company = await prisma.company.findFirst();
    if (!company) {
      throw new Error(translate(locale, "pages.clients.companyNotFound"));
    }

    const lineCount = parseBulkLineCount(formData);
    const rows: Array<{
      identity: ReturnType<typeof resolveClientFormIdentity>;
      clientType: ClientTypeValue;
      address: string;
      npwp: string;
      taxIdDocumentUrl: string;
      clientSince: Date;
      multiProjectAccess: boolean;
      hasPortalAccess: boolean;
    }> = [];
    const seenNames = new Set<string>();

    for (let index = 0; index < lineCount; index += 1) {
      const row = lineFormData(formData, index, CLIENT_LINE_FIELDS);
      const clientType = parseClientType(row);
      let identity: ReturnType<typeof resolveClientFormIdentity>;
      let address: string;
      let npwp: string;
      let clientSince: Date;
      let multiProjectAccess: boolean;
      let hasPortalAccess: boolean;
      try {
        identity = resolveClientFormIdentity(row, clientType, locale);
        address = capitalizeProper(String(row.get("address") ?? "").trim());
        npwp = await parseRequiredClientNpwp(row, clientType, locale);
        clientSince =
          parseFormDateInput(row.get("clientSince"), {
            fieldLabel: translate(locale, "pages.clients.form.clientSince"),
          }) ?? new Date();
        hasPortalAccess =
          String(row.get("hasPortalAccess") ?? "yes").toLowerCase() !== "no";
        multiProjectAccess =
          hasPortalAccess &&
          clientType !== "INDIVIDUAL" &&
          (String(row.get("multiProjectAccess") ?? "").toLowerCase() ===
            "yes" ||
            String(row.get("multiProjectAccess") ?? "") === "true");
      } catch (error) {
        throw new Error(
          translate(locale, "bulkCreate.lineError", {
            n: String(index + 1),
            message:
              error instanceof Error ? error.message : "Invalid client line.",
          })
        );
      }
      const key = identity.name.trim().toLowerCase();
      if (seenNames.has(key)) {
        throw new Error(
          translate(locale, "bulkCreate.lineError", {
            n: String(index + 1),
            message: translate(locale, "pages.clients.nameAlreadyExists", {
              name: identity.name,
            }),
          })
        );
      }
      seenNames.add(key);

      const file = bulkLineFile(formData, index, "taxIdDocument");
      if (!file) {
        throw new Error(
          translate(locale, "bulkCreate.lineError", {
            n: String(index + 1),
            message: taxIdDocumentMissingMessage(clientType, locale),
          })
        );
      }
      const taxIdDocumentUrl = await saveUpload(file, "uploads/clients", {
        fileBaseName: clientType === "INDIVIDUAL" ? "NPWP-NIK" : "NPWP",
      });
      uploaded.push(taxIdDocumentUrl);
      rows.push({
        identity,
        clientType,
        address,
        npwp,
        taxIdDocumentUrl,
        clientSince,
        multiProjectAccess,
        hasPortalAccess,
      });
    }

    if (rows.length === 0) {
      throw new Error(translate(locale, "bulkCreate.emptyLines"));
    }

    let sortOrder = await nextCompanyScopedSortOrder("client", company.id);

    await prisma.$transaction(async (tx) => {
      for (const row of rows) {
        const nameNormalized = await assertClientNameAvailable(
          { companyId: company.id, name: row.identity.name, locale },
          tx
        );
        const shortCode = await getNextClientShortCode(company.id, tx);
        const client = await tx.client.create({
          data: {
            name: row.identity.name,
            nameNormalized,
            clientType: row.clientType,
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
            clientSince: row.clientSince,
            hasPortalAccess: row.hasPortalAccess,
            multiProjectAccess: row.multiProjectAccess,
            multiProjectSecurityMode: row.multiProjectAccess
              ? "MASTER_AND_GROUP"
              : null,
            companyId: company.id,
            active: true,
            sortOrder,
          },
        });

        if (row.hasPortalAccess) {
          await provisionClientUser(tx, {
            companyId: company.id,
            clientId: client.id,
            clientName: row.identity.name,
            contactPersonFirstName: row.identity.contactPersonFirstName,
            contactPersonLastName: row.identity.contactPersonLastName,
            preferredLoginId: null,
          });
        }

        sortOrder += SORT_ORDER_STEP;
      }
    });

    revalidatePath("/clients");
    revalidatePath("/billing");
    revalidatePath("/users");
  } catch (error) {
    await Promise.all(uploaded.map((path) => deleteLocalUpload(path)));
    throw toActionError(
      error,
      translate(locale, "pages.clients.createFailed")
    );
  }
}

export async function reorderClients(ids: string[]) {
  const locale = await getServerLocale();
  try {
    await assertCanManageClients(locale);

    const company = await prisma.company.findFirst({ select: { id: true } });
    if (!company) {
      throw new Error(translate(locale, "pages.clients.companyNotFound"));
    }

    await persistCompanyScopedReorder("client", {
      companyId: company.id,
      ids,
      mismatchError: translate(locale, "pages.clients.reorderInvalid"),
    });

    revalidatePath("/clients");
    revalidatePath("/billing");
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.clients.reorderFailed")
    );
  }
}

/**
 * Updates a client. Login ID stays company-based (not contact-derived).
 * Contact person rename syncs linked portal display names only.
 * Soft-deactivate portal logins when the client is marked inactive.
 */
export async function updateClient(id: string, formData: FormData) {
  const locale = await getServerLocale();
  try {
    await assertCanManageClients(locale);

    const clientType = parseClientType(formData);
    const identity = resolveClientFormIdentity(formData, clientType, locale);
    const address = capitalizeProper(String(formData.get("address") ?? "").trim());
    const npwp = await parseRequiredClientNpwp(formData, clientType, locale);
    const clientSince =
      parseFormDateInput(formData.get("clientSince"), {
        fieldLabel: translate(locale, "pages.clients.form.clientSince"),
      }) ?? new Date();

    const hasPortalAccess =
      String(formData.get("hasPortalAccess") ?? "yes").toLowerCase() !== "no";
    const preferredLoginId = String(formData.get("loginId") ?? "").trim();

    const existing = await prisma.client.findUnique({
      where: { id },
      select: {
        id: true,
        companyId: true,
        shortCode: true,
        taxIdDocumentUrl: true,
        _count: { select: { users: true } },
      },
    });

    if (!existing) {
      throw new Error(translate(locale, "pages.clients.notFound"));
    }

    const uploadedTaxIdDocumentUrl = await saveTaxIdDocument(formData, {
      shortCode: existing.shortCode,
      fileBasePrefix: clientType === "INDIVIDUAL" ? "NPWP-NIK" : "NPWP",
    });
    const taxIdDocumentUrl =
      uploadedTaxIdDocumentUrl !== undefined
        ? uploadedTaxIdDocumentUrl
        : existing.taxIdDocumentUrl;
    if (!taxIdDocumentUrl) {
      throw new Error(taxIdDocumentMissingMessage(clientType, locale));
    }

    const contactDisplay =
      formatContactPersonName(
        identity.contactPersonFirstName,
        identity.contactPersonLastName
      ) ?? identity.name;

    await prisma.$transaction(async (tx) => {
      const nameNormalized = await assertClientNameAvailable(
        {
          companyId: existing.companyId,
          name: identity.name,
          excludeId: id,
          locale,
        },
        tx
      );

      // Soft-delete only via Delete dialog / deactivateClient — never via edit.
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
          ...(uploadedTaxIdDocumentUrl !== undefined
            ? { taxIdDocumentUrl: uploadedTaxIdDocumentUrl }
            : {}),
          contactPersonFirstName: identity.contactPersonFirstName,
          contactPersonLastName: identity.contactPersonLastName,
          contactPersonPosition: identity.contactPersonPosition,
          contactPersonEmail: identity.contactPersonEmail,
          contactPersonPhone: identity.contactPersonPhone,
          clientSince,
          hasPortalAccess,
          multiProjectAccess: hasPortalAccess
            ? undefined
            : false,
          multiProjectSecurityMode: hasPortalAccess ? undefined : null,
        },
      });

      // Login ID is company-based — keep username; sync display name only.
      await tx.user.updateMany({
        where: { clientId: id },
        data: { name: contactDisplay },
      });

      if (hasPortalAccess) {
        await tx.user.updateMany({
          where: { clientId: id },
          data: { active: true },
        });
        if (existing._count.users === 0) {
          await provisionClientUser(tx, {
            companyId: existing.companyId,
            clientId: id,
            clientName: identity.name,
            contactPersonFirstName: identity.contactPersonFirstName,
            contactPersonLastName: identity.contactPersonLastName,
            preferredLoginId: preferredLoginId || null,
          });
        }
      } else {
        await softDeactivateClientLogins(tx, id);
      }
    });

    await persistClientProjectGroupMembership(id, formData);

    if (
      uploadedTaxIdDocumentUrl &&
      existing.taxIdDocumentUrl &&
      existing.taxIdDocumentUrl !== uploadedTaxIdDocumentUrl
    ) {
      await deleteLocalUpload(existing.taxIdDocumentUrl);
    }

    revalidatePath("/clients");
    revalidatePath("/billing");
    revalidatePath("/users");
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.clients.updateFailed")
    );
  }
}

/** Translated soft-delete blockers for the Delete dialog (shown before confirm). */
export async function fetchClientSoftDeleteBlockers(
  clientId: string
): Promise<string[]> {
  const locale = await getServerLocale();
  await assertCanManageClients(locale);
  const blockers = await getClientSoftDeleteBlockers(clientId);
  return formatClientSoftDeleteBlockers(blockers, locale);
}

export async function deactivateClient(id: string) {
  const locale = await getServerLocale();
  try {
    await assertCanManageClients(locale);

    const client = await prisma.client.findUnique({
      where: { id },
      select: { active: true },
    });
    if (!client) {
      throw new Error(translate(locale, "pages.clients.notFound"));
    }
    if (!client.active) {
      throw new Error(translate(locale, "pages.clients.alreadyDeleted"));
    }

    await prisma.$transaction(async (tx) => {
      await assertClientCanBeSoftDeleted(id, tx, locale);

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
    throw toActionError(
      error,
      translate(locale, "pages.clients.deleteFailed")
    );
  }
}

export async function bulkDeactivateClients(
  ids: string[]
): Promise<BulkActionResult> {
  const locale = await getServerLocale();
  await assertCanManageClients(locale);

  const result = createBulkActionResult();
  const uniqueIds = [...new Set(ids.filter(Boolean))];

  for (const id of uniqueIds) {
    try {
      const client = await prisma.client.findUnique({
        where: { id },
        select: { active: true },
      });
      if (!client) {
        throw new Error(translate(locale, "pages.clients.notFound"));
      }
      if (!client.active) {
        throw new Error(translate(locale, "pages.clients.alreadyDeleted"));
      }

      await prisma.$transaction(async (tx) => {
        await assertClientCanBeSoftDeleted(id, tx, locale);

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
        error instanceof Error
          ? error.message
          : translate(locale, "pages.clients.deleteFailed")
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

async function reactivateClientRecord(id: string, locale: AppLocale) {
  const client = await prisma.client.findUnique({
    where: { id },
    select: { active: true },
  });
  if (!client) {
    throw new Error(translate(locale, "pages.clients.notFound"));
  }
  if (client.active) {
    throw new Error(translate(locale, "pages.clients.alreadyActive"));
  }

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
  const locale = await getServerLocale();
  await assertCanManageClients(locale);
  await reactivateClientRecord(id, locale);
  revalidatePath("/clients");
  revalidatePath("/billing");
  revalidatePath("/users");
}

export async function bulkReactivateClients(
  ids: string[]
): Promise<BulkActionResult> {
  const locale = await getServerLocale();
  await assertCanManageClients(locale);

  const result = createBulkActionResult();
  const uniqueIds = [...new Set(ids.filter(Boolean))];

  for (const id of uniqueIds) {
    try {
      await reactivateClientRecord(id, locale);
      recordBulkSuccess(result);
    } catch (error) {
      recordBulkFailure(
        result,
        error instanceof Error
          ? error.message
          : translate(locale, "pages.clients.restoreFailed")
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

/**
 * Provision portal logins for clients with no linked User (No Portal Login).
 * Uses the same credential template as single create / bulk import.
 * Clients that already have a linked login (active or revoked) are skipped —
 * Restore Access is the only path for revoked credentials. Soft-deleted
 * parents are rejected (Generate stays off under No Portal Login).
 */
export async function generateClientPortalLogins(
  ids: string[]
): Promise<BulkActionResult> {
  const locale = await getServerLocale();
  await assertCanManageClients(locale);

  const result = createBulkActionResult();
  const uniqueIds = [...new Set(ids.filter(Boolean))];

  if (uniqueIds.length === 0) {
    return result;
  }

  const company = await prisma.company.findFirst({ select: { id: true } });
  if (!company) {
    throw new Error(translate(locale, "pages.clients.companyNotFound"));
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
            _count: { select: { users: true } },
          },
        });

        if (!client) {
          throw new Error(translate(locale, "pages.clients.notFound"));
        }

        if (!client.active) {
          throw new Error(
            translate(locale, "pages.clients.portalLoginDeletedClient", {
              name: client.name,
            })
          );
        }

        // Already linked (active or revoked) — do not reactivate via Generate.
        if (client._count.users > 0) {
          return false;
        }

        const contactPersonFirstName =
          client.contactPersonFirstName?.trim() ?? "";
        if (!contactPersonFirstName) {
          throw new Error(
            translate(locale, "pages.clients.portalLoginContactRequired", {
              name: client.name,
            })
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
          : translate(locale, "pages.clients.generatePortalFailed")
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
 * Permanent delete — only for soft-deleted clients with zero linked projects.
 * Hard-deletes portal users. Does not unlink/orphan projects (blocked when any remain).
 */
async function permanentlyDeleteClientRecord(id: string, locale: AppLocale) {
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      users: { select: { id: true } },
    },
  });

  if (!client) {
    throw new Error(translate(locale, "pages.clients.notFound"));
  }
  if (client.active) {
    throw new Error(
      translate(locale, "pages.clients.permanentDeleteRequiresDeleted")
    );
  }

  const linkedProjects = await prisma.project.count({
    where: { clientId: id },
  });
  if (linkedProjects > 0) {
    throw new Error(
      translate(locale, "pages.clients.permanentDeleteBlockedByProjects")
    );
  }

  const userIds = client.users.map((user) => user.id);
  const taxIdDocumentUrl = client.taxIdDocumentUrl;

  await prisma.$transaction(async (tx) => {
    // Forever delete: portal logins are permanently removed and cannot be restored.
    if (userIds.length > 0) {
      await hardDeleteLinkedUserLogins(tx, userIds);
    }

    await tx.client.delete({ where: { id } });
  });

  await deleteLocalUpload(taxIdDocumentUrl);
}

function revalidateAfterClientPermanentDelete() {
  revalidatePath("/clients");
  revalidatePath("/billing");
  revalidatePath("/users");
  revalidatePath("/projects");
}

export async function deleteClient(id: string) {
  const locale = await getServerLocale();
  await assertCanManageClients(locale);
  await permanentlyDeleteClientRecord(id, locale);
  revalidateAfterClientPermanentDelete();
}

export async function bulkDeleteClients(
  ids: string[]
): Promise<BulkActionResult> {
  const locale = await getServerLocale();
  await assertCanManageClients(locale);

  const result = createBulkActionResult();
  const uniqueIds = [...new Set(ids.filter(Boolean))];

  for (const id of uniqueIds) {
    try {
      await permanentlyDeleteClientRecord(id, locale);
      recordBulkSuccess(result);
    } catch (error) {
      recordBulkFailure(
        result,
        error instanceof Error
          ? error.message
          : translate(locale, "pages.clients.deleteFailed")
      );
    }
  }

  if (result.successCount > 0) {
    revalidateAfterClientPermanentDelete();
  }

  return result;
}
