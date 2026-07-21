import { normalizeImportPhoneWithCountryCode } from "@/lib/phone-normalize";
import { capitalizeName, titleCaseWords } from "@/lib/text-case";
import { parseImportDate } from "@/lib/bulk-import/parse-import-date";
import { isNotApplicableImportValue } from "@/lib/bulk-import/template-i18n";
import { parseCreatePortalLoginFlag } from "@/lib/create-portal-login-flag";
import {
  parseEmploymentTypeImportValue,
  parsePlacementImportValue,
} from "@/lib/placement";
import type { AppLocale } from "@/lib/i18n/locale";
import { DEFAULT_LOCALE } from "@/lib/i18n/locale";
import type { SpreadsheetRow } from "@/lib/bulk-import/xlsx";

export type ParsedEmployeeImportRow = {
  firstName: string;
  lastName: string;
  department: string;
  position: string;
  employmentType: "FULL_TIME" | "PART_TIME";
  legacyPlacement: "AVAILABLE" | "ON_PROJECT" | "HEAD_OFFICE" | "FIELD" | null;
  portalAccessRequested: boolean | null;
  email: string | null;
  phone: string | null;
  hiredAt: Date | null;
  projectNames: string[];
};

export function parseEmployeeImportRow(
  values: SpreadsheetRow,
  locale: AppLocale = DEFAULT_LOCALE,
  options?: { forceEmploymentType?: "FULL_TIME" | "PART_TIME" }
): ParsedEmployeeImportRow {
  const firstName = capitalizeName(values.firstName?.trim() ?? "");
  const lastName = capitalizeName(values.lastName?.trim() ?? "");
  const department = values.department?.trim() ?? "";
  const position = values.position?.trim()
    ? titleCaseWords(values.position.trim())
    : "";
  const email = values.email?.trim().toLowerCase() || null;

  if (!firstName) throw new Error("First Name is required.");
  if (!lastName) throw new Error("Last Name is required.");
  if (!department) throw new Error("Department is required.");
  if (!position) throw new Error("Position is required.");
  const employmentType =
    options?.forceEmploymentType ??
    parseEmploymentTypeImportValue(values.employmentType ?? "");
  if (!employmentType) {
    throw new Error(
      locale === "id"
        ? "Jenis Karyawan harus Penuh Waktu atau Paruh Waktu."
        : "Employment Type must be Full Time or Part Time."
    );
  }

  const legacyPlacementRaw = values.placement?.trim() ?? "";
  const legacyPlacement = parsePlacementImportValue(legacyPlacementRaw);
  if (legacyPlacementRaw && !legacyPlacement) {
    throw new Error(
      "Legacy Assignment Scope / Placement must be Available, On project, Head Office, or Field."
    );
  }

  const hiredAt = parseImportDate(values.hiredAt ?? "", "Start Date");
  const phone =
    normalizeImportPhoneWithCountryCode(
      values.countryCode,
      values.phone,
      "Phone"
    ) || null;

  let projectNames = (values.projectNames ?? "")
    .split(/[,;|]/)
    .map((name) => name.trim())
    .filter((name) => name && !isNotApplicableImportValue(name));

  return {
    firstName,
    lastName,
    department,
    position,
    employmentType,
    legacyPlacement,
    portalAccessRequested: values.createPortalLogin?.trim()
      ? parseCreatePortalLoginFlag(values.createPortalLogin)
      : null,
    email,
    phone,
    hiredAt,
    projectNames,
  };
}
