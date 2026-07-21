import { Prisma } from "@prisma/client";

const MULTI_PROJECT_SCHEMA_HINT =
  "Multi-Project Access needs a database update. Stop the Next.js server (next dev), then run: npx prisma migrate deploy && npx prisma generate";

const SCHEMA_DRIFT_HINT =
  "Database schema is out of date. Stop the Next.js server (next dev), then run: npx prisma migrate deploy && npx prisma generate";

function looksLikeMultiProjectSchemaGap(message: string): boolean {
  return (
    /multiProjectAccess|multiProjectSecurityMode|ClientProjectGroup|ClientSecurityCode|ClientContractExtension|groupId/i.test(
      message
    ) &&
    /does not exist|Unknown arg|Unknown field|Unknown model|column|table/i.test(
      message
    )
  );
}

/**
 * Map Prisma / unknown failures to short user-facing Error messages.
 * Keeps intentional validation Error messages (NPWP, required fields, etc.).
 */
export function toActionError(error: unknown, fallback: string): Error {
  if (error instanceof Prisma.PrismaClientValidationError) {
    if (looksLikeMultiProjectSchemaGap(error.message)) {
      return new Error(MULTI_PROJECT_SCHEMA_HINT);
    }

    const unknownArg = error.message.match(
      /Unknown arg(?:ument)? [`'](\w+)[`']/i
    );
    if (unknownArg?.[1]) {
      const field = unknownArg[1];
      if (field === "npwp") {
        return new Error(
          "Company Tax ID (NPWP) could not be saved because the app database client is out of date. Restart the server after running: npx prisma generate"
        );
      }
      if (field === "estimatedStartDate") {
        return new Error(
          "Estimated start date could not be saved because the app database client is out of date. Restart the server after running: npx prisma generate"
        );
      }
      if (
        field === "multiProjectAccess" ||
        field === "multiProjectSecurityMode" ||
        field === "projectGroups" ||
        field === "securityCodes" ||
        field === "groupId"
      ) {
        return new Error(MULTI_PROJECT_SCHEMA_HINT);
      }
      return new Error(
        `Could not save — the app database client is out of date (unknown field: ${field}). Restart the server after running: npx prisma generate`
      );
    }

    const invalidArg = error.message.match(
      /Argument [`'](\w+)[`']:\s*Invalid value/i
    );
    if (invalidArg?.[1]) {
      return new Error(
        `Could not save — invalid value for "${invalidArg[1]}". Check the form and try again.`
      );
    }

    return new Error(
      "Could not save — the data sent to the database was invalid. Check the form and try again."
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const fields = Array.isArray(error.meta?.target)
        ? (error.meta?.target as string[]).join(", ")
        : null;
      return new Error(
        fields
          ? `A record with this ${fields} already exists.`
          : "A record with this value already exists."
      );
    }
    if (error.code === "P2025") {
      return new Error("Record not found.");
    }
    // Missing table (migration not applied).
    if (error.code === "P2021") {
      const meta = error.meta as { table?: string } | undefined;
      if (
        meta?.table &&
        /ClientProjectGroup|ClientSecurityCode|ClientContractExtension/i.test(
          meta.table
        )
      ) {
        return new Error(MULTI_PROJECT_SCHEMA_HINT);
      }
      return new Error(SCHEMA_DRIFT_HINT);
    }
    // Missing column (migration not applied).
    if (error.code === "P2022") {
      const meta = error.meta as { column?: string } | undefined;
      if (
        meta?.column &&
        /multiProjectAccess|multiProjectSecurityMode|groupId/i.test(
          meta.column
        )
      ) {
        return new Error(MULTI_PROJECT_SCHEMA_HINT);
      }
      return new Error(SCHEMA_DRIFT_HINT);
    }
  }

  if (error instanceof Error) {
    if (looksLikeMultiProjectSchemaGap(error.message)) {
      return new Error(MULTI_PROJECT_SCHEMA_HINT);
    }
    if (error.message.includes("Invalid `prisma.")) {
      return new Error(fallback);
    }
    return error;
  }

  return new Error(fallback);
}
