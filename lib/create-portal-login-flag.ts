/** Gray Excel placeholder for the Portal Login Access column (English template). */
export const CREATE_PORTAL_LOGIN_PLACEHOLDER = "Yes / No";
/** Gray Excel placeholder for the Portal Login Access column (Indonesian template). */
export const CREATE_PORTAL_LOGIN_PLACEHOLDER_ID = "Ya / Tidak";

export function isCreatePortalLoginPlaceholder(value: string): boolean {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
  return (
    normalized === "yes / no" ||
    normalized === "yes/no" ||
    normalized === "yes or no" ||
    normalized === "ya / tidak" ||
    normalized === "ya/tidak" ||
    normalized === "ya atau tidak"
  );
}

/**
 * Parses the Portal Login Access Yes/No (or Ya/Tidak) flag from forms and Excel import.
 * Empty / No / Tidak / placeholder → false (skip provisioning). Yes / Ya → true.
 */
export function parseCreatePortalLoginFlag(raw: unknown): boolean {
  const value = String(raw ?? "")
    .trim()
    .toLowerCase();

  if (
    !value ||
    isCreatePortalLoginPlaceholder(value) ||
    value === "no" ||
    value === "n" ||
    value === "tidak" ||
    value === "t" ||
    value === "false" ||
    value === "0"
  ) {
    return false;
  }

  if (
    value === "yes" ||
    value === "y" ||
    value === "ya" ||
    value === "true" ||
    value === "1"
  ) {
    return true;
  }

  throw new Error("Portal Login Access must be Yes/No or Ya/Tidak.");
}
