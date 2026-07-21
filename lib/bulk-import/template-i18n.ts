import type { AppLocale } from "@/lib/i18n/locale";
import type { ColumnDef } from "@/lib/bulk-import/xlsx";
import {
  CREATE_PORTAL_LOGIN_PLACEHOLDER,
  CREATE_PORTAL_LOGIN_PLACEHOLDER_ID,
} from "@/lib/create-portal-login-flag";
import {
  CONTRACT_DURATION_PRESETS,
  MAX_PROJECT_DURATION_DAYS,
} from "@/lib/project-contract";

export type LocalizedHeader = {
  en: string;
  id: string;
  /** Extra aliases beyond the en/id headers (already normalized keys). */
  aliases?: string[];
};

/** Yes/No dropdown labels for the active ERP locale. */
export function yesNoDropdown(locale: AppLocale): [string, string] {
  return locale === "id" ? ["Ya", "Tidak"] : ["Yes", "No"];
}

export function yesNoPlaceholder(locale: AppLocale): string {
  return locale === "id"
    ? CREATE_PORTAL_LOGIN_PLACEHOLDER_ID
    : CREATE_PORTAL_LOGIN_PLACEHOLDER;
}

export function dataSheetName(): string {
  /** Keep stable for import parsers (both locales). */
  return "Data";
}

export function localizeColumnHeader(
  locale: AppLocale,
  labels: LocalizedHeader
): string {
  return locale === "id" ? labels.id : labels.en;
}

/** Merge bilingual headers into ColumnDef aliases so either template imports. */
export function withBilingualAliases(
  column: ColumnDef,
  labels: LocalizedHeader
): ColumnDef {
  const bilingual = [labels.en, labels.id, ...(labels.aliases ?? [])];
  const existing = column.aliases ?? [];
  const seen = new Set<string>();
  const aliases: string[] = [];
  for (const value of [...existing, ...bilingual]) {
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    aliases.push(value);
  }
  return { ...column, aliases };
}

export function applyLocalizedHeaders(
  columns: ColumnDef[],
  locale: AppLocale,
  labelsByKey: Record<string, LocalizedHeader>
): ColumnDef[] {
  return columns.map((column) => {
    const labels = labelsByKey[column.key];
    if (!labels) return column;
    return withBilingualAliases(
      { ...column, header: localizeColumnHeader(locale, labels) },
      labels
    );
  });
}

/** Date columns use dd/mm/yyyy format only — no header comment / DV tips. */
export function withDateColumnHeaderNotes(
  columns: ColumnDef[],
  _locale: AppLocale
): ColumnDef[] {
  return columns;
}

/**
 * Comment on Country Code / Kode negara headers — Excel DV lists often ignore
 * the mouse wheel; keyboard / scrollbar still work (Excel limitation).
 */
export function countryCodeColumnHeaderNote(locale: AppLocale): string {
  return locale === "id"
    ? "Tip: gunakan ↑↓ atau Page Up/Down untuk menelusuri kode negara (Excel mungkin tidak menggulir daftar ini dengan roda mouse)."
    : "Tip: use ↑↓ or Page Up/Down to move through country codes (Excel may not scroll this list with the mouse wheel).";
}

// ── Client ──────────────────────────────────────────────────────────────────

export const CLIENT_HEADER_LABELS: Record<string, LocalizedHeader> = {
  clientType: {
    en: "Client Type",
    id: "Tipe Klien",
    aliases: [
      "client type",
      "type",
      "tipe klien",
      "tipe",
      "company or individual",
      "perusahaan atau perorangan",
    ],
  },
  name: {
    en: "Client Name",
    id: "Nama Klien",
    aliases: [
      "name",
      "company name",
      "organization",
      "client",
      "nama perusahaan",
      "full name",
      "nama lengkap",
    ],
  },
  email: {
    en: "Company Email",
    id: "Email Perusahaan",
    aliases: [
      "email",
      "organization email",
      "company email",
      "company e-mail",
      "client email",
    ],
  },
  countryCode: {
    en: "Country Code",
    id: "Kode Negara",
    aliases: [
      "country code",
      "kode negara",
      "dial code",
      "phone country code",
      "company country code",
    ],
  },
  phone: {
    en: "Company Phone",
    id: "Telepon Perusahaan",
    aliases: [
      "phone",
      "organization phone",
      "company phone",
      "telephone",
      "office phone",
    ],
  },
  address: {
    en: "Company Address",
    id: "Alamat Perusahaan",
    aliases: ["address", "company address", "office address", "client address"],
  },
  npwp: {
    en: "Company Tax ID",
    id: "NPWP Perusahaan",
    aliases: [
      "tax id",
      "company tax id",
      "npwp",
      "npwp / tax id",
      "company tax id (npwp)",
      "client npwp or nik",
      "npwp or nik",
      "npwp / nik",
      "nik",
    ],
  },
  clientSince: {
    en: "Client Since",
    id: "Klien Sejak",
    aliases: [
      "client since",
      "member since",
      "joined",
      "join date",
      "client join date",
    ],
  },
  paymentTermsDays: {
    en: "Payment terms",
    id: "Syarat Pembayaran",
    aliases: [
      "payment terms",
      "payment terms days",
      "syarat pembayaran",
      "net days",
      "terms",
    ],
  },
  contactPersonFirstName: {
    en: "Contact Person First Name",
    id: "Nama Depan Narahubung",
    aliases: [
      "contact first name",
      "first name",
      "contact person first name",
      "contact first",
    ],
  },
  contactPersonLastName: {
    en: "Contact Person Last Name",
    id: "Nama Belakang Narahubung",
    aliases: [
      "contact last name",
      "last name",
      "contact person last name",
      "contact last",
    ],
  },
  contactPersonPosition: {
    en: "Position",
    id: "Jabatan",
    aliases: [
      "position",
      "contact position",
      "contact person position",
      "title",
      "jabatan narahubung",
    ],
  },
  contactPersonEmail: {
    en: "Contact Person Email",
    id: "Email Narahubung",
    aliases: [
      "contact email",
      "contact person email",
      "contact e-mail",
    ],
  },
  contactPersonCountryCode: {
    en: "Contact Person Country Code",
    id: "Kode negara Narahubung",
    aliases: [
      "contact country code",
      "contact person country code",
      "kode negara narahubung",
      "contact dial code",
    ],
  },
  contactPersonPhone: {
    en: "Contact Person Phone",
    id: "Telepon Narahubung",
    aliases: [
      "contact phone",
      "contact person phone",
      "contact mobile",
      "contact cellphone",
    ],
  },
};

export function clientTemplateTitle(locale: AppLocale): string {
  return locale === "id"
    ? "RGS ONE — Impor Klien"
    : "RGS ONE — Client Import";
}

/** Short note on the Data sheet title cell (no Instructions tab). */
export function clientTemplateHeaderNote(locale: AppLocale): string {
  return locale === "id"
    ? "Isi satu klien per baris mulai baris 3. Kolom bertanda * wajib. Tipe Klien: Perusahaan atau Perorangan. Untuk Perorangan, narahubung tidak wajib (klien = dirinya sendiri; isi Nama Klien atau Nama Depan). Login ID portal selalu dibuat. Tanggal DD/MM/YYYY. Telepon: nomor nasional saja (kode negara di kolom terpisah). Syarat pembayaran mencakup Tunai. Unggah di RGS ONE lalu Konfirmasi tambah."
    : "Enter one client per row from row 3. Columns marked * are required. Client Type: Company or Individual. For Individual, Contact Person is not required (the client is themselves; use Client Name or First Name). A portal Login ID is always created. Dates: DD/MM/YYYY. Phone: national number only (country code in its own column). Payment Terms include Cash. Upload in RGS ONE, then Confirm add.";
}

export function clientTypeDropdown(locale: AppLocale): [string, string] {
  return locale === "id"
    ? ["Perusahaan", "Perorangan"]
    : ["Company", "Individual"];
}

// ── Vendor ──────────────────────────────────────────────────────────────────

export const VENDOR_HEADER_LABELS: Record<string, LocalizedHeader> = {
  name: {
    en: "Vendor Name",
    id: "Nama Pemasok",
    aliases: [
      "name",
      "company name",
      "organization",
      "vendor",
      "supplier",
      "pemasok",
      "nama perusahaan",
    ],
  },
  email: {
    en: "Company Email",
    id: "Email Perusahaan",
    aliases: ["email", "organization email", "company email", "company e-mail"],
  },
  countryCode: {
    en: "Country Code",
    id: "Kode Negara",
    aliases: [
      "country code",
      "kode negara",
      "dial code",
      "phone country code",
      "company country code",
    ],
  },
  phone: {
    en: "Company Phone",
    id: "Telepon Perusahaan",
    aliases: [
      "phone",
      "organization phone",
      "company phone",
      "telephone",
      "office phone",
    ],
  },
  address: {
    en: "Company Address",
    id: "Alamat Perusahaan",
    aliases: ["address", "company address", "office address"],
  },
  npwp: {
    en: "Company Tax ID",
    id: "NPWP Perusahaan",
    aliases: [
      "tax id",
      "company tax id",
      "npwp",
      "npwp / tax id",
      "company tax id (npwp)",
    ],
  },
  vendorSince: {
    en: "Vendor Since",
    id: "Pemasok Sejak",
    aliases: [
      "vendor since",
      "supplier since",
      "member since",
      "joined",
      "join date",
      "vendor join date",
      "pemasok sejak",
    ],
  },
  paymentTermsDays: {
    en: "Payment terms",
    id: "Syarat Pembayaran",
    aliases: [
      "payment terms",
      "payment terms days",
      "syarat pembayaran",
      "net days",
      "terms",
    ],
  },
  contactPersonFirstName: {
    en: "Contact Person First Name",
    id: "Nama Depan Narahubung",
    aliases: [
      "contact first name",
      "first name",
      "contact person first name",
      "contact first",
    ],
  },
  contactPersonLastName: {
    en: "Contact Person Last Name",
    id: "Nama Belakang Narahubung",
    aliases: [
      "contact last name",
      "last name",
      "contact person last name",
      "contact last",
    ],
  },
  contactPersonPosition: {
    en: "Position",
    id: "Jabatan",
    aliases: [
      "position",
      "contact position",
      "contact person position",
      "title",
      "jabatan narahubung",
    ],
  },
  contactPersonEmail: {
    en: "Contact Person Email",
    id: "Email Narahubung",
    aliases: ["contact email", "contact person email", "contact e-mail"],
  },
  contactPersonCountryCode: {
    en: "Contact Person Country Code",
    id: "Kode negara Narahubung",
    aliases: [
      "contact country code",
      "contact person country code",
      "kode negara narahubung",
      "contact dial code",
    ],
  },
  contactPersonPhone: {
    en: "Contact Person Phone",
    id: "Telepon Narahubung",
    aliases: [
      "contact phone",
      "contact person phone",
      "contact mobile",
      "contact cellphone",
    ],
  },
  createPortalLogin: {
    en: "Portal Login Access",
    id: "Akses Login Portal",
    aliases: [
      "portal login",
      "portal login access",
      "create portal login",
      "create login",
      "portal access",
      "create portal login access",
      "buat akses login portal",
    ],
  },
};

export function vendorTemplateTitle(locale: AppLocale): string {
  return locale === "id"
    ? "RGS ONE — Impor Pemasok"
    : "RGS ONE — Vendor Import";
}

/** Short note on the Data sheet title cell (no Instructions tab). */
export function vendorTemplateHeaderNote(locale: AppLocale): string {
  return locale === "id"
    ? "Isi satu pemasok per baris mulai baris 3. Kolom bertanda * wajib. Tanggal DD/MM/YYYY. Telepon: nomor nasional saja (kode negara di kolom terpisah). Syarat pembayaran mencakup Tunai. Unggah di RGS ONE lalu Konfirmasi tambah."
    : "Enter one vendor per row from row 3. Columns marked * are required. Dates: DD/MM/YYYY. Phone: national number only (country code in its own column). Payment terms include Cash. Upload in RGS ONE, then Confirm add.";
}

// ── Employee ────────────────────────────────────────────────────────────────

export const EMPLOYEE_HEADER_LABELS: Record<string, LocalizedHeader> = {
  department: {
    en: "Department",
    id: "Departemen",
    aliases: ["department name", "category", "department prefix", "prefix"],
  },
  firstName: {
    en: "First Name",
    id: "Nama Depan",
    aliases: ["first name", "given name"],
  },
  lastName: {
    en: "Last Name",
    id: "Nama Belakang",
    aliases: ["last name", "family name", "surname"],
  },
  position: {
    en: "Position",
    id: "Jabatan",
    aliases: ["role", "job title", "title"],
  },
  employmentType: {
    en: "Employment Type",
    id: "Jenis Karyawan",
    aliases: [
      "employment type",
      "employee type",
      "work type",
      "jenis karyawan",
    ],
  },
  placement: {
    en: "Placement",
    id: "Penempatan",
    aliases: [
      "placement",
      "penempatan",
      "assignment scope",
      "cakupan penugasan",
      "scope",
      "assignment",
    ],
  },
  hiredAt: {
    en: "Start Date",
    id: "Tanggal Mulai",
    aliases: ["hired at", "hire date", "join date", "start date"],
  },
  email: {
    en: "Contact Email",
    id: "Email Kontak",
    aliases: ["email", "work email", "contact email"],
  },
  countryCode: {
    en: "Country Code",
    id: "Kode Negara",
    aliases: [
      "country code",
      "kode negara",
      "dial code",
      "phone country code",
    ],
  },
  phone: {
    en: "Phone Number",
    id: "Nomor Telepon",
    aliases: ["phone", "mobile", "telephone", "phone number"],
  },
  projectNames: {
    en: "Project Names",
    id: "Nama Proyek",
    aliases: ["projects", "sites", "assigned sites", "project name", "lokasi"],
  },
  createPortalLogin: {
    en: "Portal Login Access",
    id: "Akses Login Portal",
    aliases: [
      "portal login",
      "create portal login",
      "create login",
      "erp login",
      "create erp login",
      "portal access",
      "create portal login access",
      "portal login access",
      "buat akses login portal",
    ],
  },
};

export function employeeTemplateTitle(locale: AppLocale): string {
  return locale === "id"
    ? "RGS ONE — Impor Karyawan"
    : "RGS ONE — Employee Import";
}

/** Short note on the Data sheet title cell (no Instructions tab). */
export function employeeTemplateHeaderNote(locale: AppLocale): string {
  return locale === "id"
    ? "Isi satu karyawan per baris mulai baris 3. Kolom bertanda * wajib. Gunakan dropdown Departemen / Jabatan / Jenis Karyawan / Proyek. Tanggal DD/MM/YYYY. Nomor karyawan dibuat otomatis. Proyek mengatur penempatan Di proyek; tanpa proyek: Corporate menjadi Kantor pusat, nilai lama Field menjadi Lapangan, dan lainnya Tersedia. Akses login portal dapat dipilih Ya/Tidak. Unggah di RGS ONE lalu Konfirmasi tambah."
    : "Enter one employee per row from row 3. Columns marked * are required. Use the Department / Position / Employment Type / Project dropdowns. Dates: DD/MM/YYYY. Employee numbers are auto-assigned. Projects set placement to On project; without projects Corporate is Head Office, legacy Field is Field, and everyone else is Available. Choose Yes/No for portal login access. Upload in RGS ONE, then Confirm add.";
}

// ── Project ─────────────────────────────────────────────────────────────────

export const PROJECT_HEADER_LABELS: Record<string, LocalizedHeader> = {
  name: {
    en: "Project Name",
    id: "Nama Proyek",
    aliases: ["project", "project name", "name", "site name"],
  },
  client: {
    en: "Client",
    id: "Klien",
    aliases: ["client name", "customer", "company", "nama klien"],
  },
  startingStage: {
    en: "Starting Stage",
    id: "Tahap Awal",
    aliases: ["stage", "status", "initial status", "planning stage"],
  },
  subCategory: {
    en: "Subcategory",
    id: "Subkategori",
    aliases: ["sub category", "type", "project type", "cleaning type"],
  },
  companyTaxId: {
    en: "Company Tax ID",
    id: "NPWP Perusahaan",
    aliases: [
      "tax id",
      "company tax id",
      "npwp",
      "npwp / tax id",
      "company tax id (npwp)",
      "tax invoice",
      "faktur pajak",
    ],
  },
  estimatedStartDate: {
    en: "Contract Start Date",
    id: "Tanggal Mulai Kontrak",
    aliases: [
      "estimated contract start date",
      "estimated start",
      "estimated start date",
      "contract start",
      "contract start date",
      "start date",
      "job start date",
      "perkiraan tanggal mulai kontrak",
    ],
  },
  durationMonths: {
    en: "Duration",
    id: "Durasi",
    aliases: [
      "estimated duration (months)",
      "estimated duration",
      "duration months",
      "duration (months)",
      "duration (days)",
      "duration days",
      "contract duration",
      "months",
      "perkiraan durasi (bulan)",
      "perkiraan durasi",
    ],
  },
  estimatedEndDate: {
    en: "Contract End Date",
    id: "Tanggal Akhir Kontrak",
    aliases: [
      "estimated contract end date",
      "estimated end",
      "estimated end date",
      "perkiraan tanggal selesai kontrak",
      "contract end",
      "contract end date",
      "end date",
      "expected completion",
    ],
  },
  coordinates: {
    en: "Gmaps Coordinates",
    id: "Koordinat Gmaps",
    aliases: [
      "coordinates",
      "gmaps",
      "google maps",
      "lat lng",
      "latitude longitude",
      "map coordinates",
      "site address",
      "location",
      "alamat lokasi",
    ],
  },
  billingMode: {
    en: "Billing Mode",
    id: "Mode Penagihan",
    aliases: ["billing", "payment mode", "invoice mode"],
  },
  milestonePayments: {
    en: "Milestone payments (1–10)",
    id: "Bayar bertahap (1–10)",
    aliases: [
      "payments",
      "payment count",
      "installments",
      "milestone payments",
      "number of payments",
      "jumlah pembayaran",
      "jumlah cicilan",
    ],
  },
  department: {
    en: "Department",
    id: "Departemen",
    aliases: [
      "staff department",
      "employee department",
      "category",
      "department name",
    ],
  },
  staffAssigned: {
    en: "Staff Assigned",
    id: "Staf Ditugaskan",
    aliases: [
      "staff",
      "employees",
      "assigned staff",
      "employee numbers",
      "employee names",
      "team",
    ],
  },
};

/** Localized dropdown values for project template (parsers accept both). */
export function projectStartingStageLabels(
  locale: AppLocale
): readonly [string, string] {
  return locale === "id"
    ? ["Perencanaan", "Berjalan"]
    : ["Planning", "In Progress"];
}

export function projectBillingModeLabels(
  locale: AppLocale
): readonly [string, string, string] {
  return locale === "id"
    ? ["Bulanan", "Saat selesai", "Bertahap"]
    : ["Monthly", "On completion", "Milestone"];
}

/** Billing choices for General / Facade only (excludes Monthly). */
export function projectMilestoneBillingModeLabels(
  locale: AppLocale
): readonly [string, string] {
  const all = projectBillingModeLabels(locale);
  return [all[1], all[2]];
}

/** Auto-filled Tax ID when the selected client has no NPWP. */
export function projectNoneTaxIdLabel(locale: AppLocale): string {
  return locale === "id" ? "Tidak ada" : "None";
}

/** Department / Staff / non-milestone payments placeholder. */
export function projectNotApplicableLabel(locale: AppLocale): string {
  return locale === "id" ? "Tidak berlaku" : "Not applicable";
}

/** Shared N/A token for employee project/site cells (mirrors project template). */
export function employeeNotApplicableLabel(locale: AppLocale): string {
  return projectNotApplicableLabel(locale);
}

/** True when a cell means “no value / not applicable” for import parsers. */
export function isNotApplicableImportValue(raw: string): boolean {
  const value = raw.trim().toLowerCase().replace(/\s+/g, " ");
  return (
    !value ||
    value === "n/a" ||
    value === "na" ||
    value === "not applicable" ||
    value === "tidak berlaku" ||
    value === "tidak ada" ||
    value === "none" ||
    value === "-"
  );
}

/**
 * Milestone payments column header (import + template).
 * Monthly / On completion / Regular Cleaning auto-fill Not applicable; Milestone picks 1–10.
 */
export function projectMilestonePaymentPickHeader(locale: AppLocale): string {
  return localizeColumnHeader(locale, PROJECT_HEADER_LABELS.milestonePayments!);
}

/** Stacked subline under contract start / end headers (matches UI timeline note). */
export function projectPlanningStageFieldNote(locale: AppLocale): string {
  return locale === "id"
    ? "(Perkiraan untuk proyek tahap perencanaan)"
    : "(Estimated for projects in planning stage)";
}

/** Regular Cleaning duration dropdown labels (e.g. "6 months" / "6 bulan"). */
export function projectDurationMonthsLabels(locale: AppLocale): string[] {
  const unit = locale === "id" ? "bulan" : "months";
  return CONTRACT_DURATION_PRESETS.map((months) => `${months} ${unit}`);
}

/** General/Facade duration dropdown labels (e.g. "3 days" / "3 hari"). */
export function projectDurationDaysLabels(locale: AppLocale): string[] {
  const unit = locale === "id" ? "hari" : "days";
  return Array.from(
    { length: MAX_PROJECT_DURATION_DAYS },
    (_, index) => `${index + 1} ${unit}`
  );
}

/** Duration column — months for Regular Cleaning, days for General/Facade. */
export function projectDurationColumnNote(locale: AppLocale): string {
  const monthSamples = projectDurationMonthsLabels(locale).join(", ");
  const daySamples = projectDurationDaysLabels(locale);
  const dayRange =
    daySamples.length >= 2
      ? `${daySamples[0]}, ${daySamples[1]}, … ${daySamples[daySamples.length - 1]}`
      : daySamples.join(", ");
  return locale === "id"
    ? `Regular Cleaning: ${monthSamples}. General/Facade: ${dayRange}.`
    : `Regular Cleaning: ${monthSamples}. General/Facade: ${dayRange}.`;
}

export function projectTemplateTitle(locale: AppLocale): string {
  return locale === "id"
    ? "RGS ONE — Impor Proyek"
    : "RGS ONE — Project Import";
}

/** Short note on the Data sheet title cell (no Instructions tab). */
export function projectTemplateHeaderNote(locale: AppLocale): string {
  return locale === "id"
    ? "Isi satu proyek per baris mulai baris 3. Kolom bertanda * wajib. Tanggal DD/MM/YYYY. NPWP terisi dari klien. Staf (Berjalan) mengikuti departemen; boleh kosong dan ditugaskan nanti. Unggah di RGS ONE lalu Konfirmasi tambah."
    : "Enter one project per row from row 3. Columns marked * are required. Dates: DD/MM/YYYY. Tax ID auto-fills from client. Staff (In Progress) follows department; leave blank to assign later. Upload in RGS ONE, then Confirm add.";
}
