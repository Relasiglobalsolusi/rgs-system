import type {
  BillingMode,
  BillingPeriodBasis,
  InvoicePeriodStatus,
  ProjectStatus,
  ProjectSubCategory,
} from "@prisma/client";

import { getLocale, type AppLocale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";
import {
  getProjectWorkflowStatusLabel,
  isProjectStatus,
} from "@/lib/project-status";
import { isProjectSubCategory } from "@/lib/project-subcategory";
import type { OperationsTeamKindValue } from "@/lib/operations-team-kind";

/** Localized DB project status label. */
export function localizeProjectStatus(
  value: ProjectStatus | string | null | undefined,
  locale: AppLocale = getLocale()
): string {
  if (!value || !isProjectStatus(value)) return "—";
  return translate(locale, `status.project.${value}`);
}

/**
 * Localized workflow label for directory chips.
 * Logic still uses English keys from `getProjectWorkflowStatusLabel`.
 */
export function localizeWorkflowStatus(
  opts: {
    status: ProjectStatus | string | null | undefined;
    paymentDue?: boolean;
    pendingApproval?: boolean;
    awaitingPayment?: boolean;
  },
  locale: AppLocale = getLocale()
): string {
  const english = getProjectWorkflowStatusLabel(opts);
  return translate(locale, `status.workflow.${english}`);
}

/** Two-line chip for long workflow labels; null for short single-line labels. */
export function localizeWorkflowChipLines(
  englishWorkflowLabel: string,
  locale: AppLocale = getLocale()
): readonly [string, string] | null {
  if (englishWorkflowLabel === "In Progress") {
    return [
      translate(locale, "status.workflowChip.inProgress1"),
      translate(locale, "status.workflowChip.inProgress2"),
    ];
  }
  if (englishWorkflowLabel === "Payment Due") {
    return [
      translate(locale, "status.workflowChip.paymentDue1"),
      translate(locale, "status.workflowChip.paymentDue2"),
    ];
  }
  if (englishWorkflowLabel === "Pending Approval") {
    return [
      translate(locale, "status.workflowChip.pendingApproval1"),
      translate(locale, "status.workflowChip.pendingApproval2"),
    ];
  }
  if (englishWorkflowLabel === "Waiting for Approval") {
    return [
      translate(locale, "status.workflowChip.waitingForApproval1"),
      translate(locale, "status.workflowChip.waitingForApproval2"),
    ];
  }
  if (englishWorkflowLabel === "Awaiting payment") {
    return [
      translate(locale, "status.workflowChip.awaitingPayment1"),
      translate(locale, "status.workflowChip.awaitingPayment2"),
    ];
  }
  return null;
}

function translateKnown(
  locale: AppLocale,
  key: string,
  fallback: string
): string {
  const translated = translate(locale, key);
  return translated === key ? fallback : translated;
}

/** Never returns a dotted i18n key path — missing keys become `fallback`. */
export function localizeKnownKey(
  key: string,
  locale: AppLocale = getLocale(),
  fallback = "—"
): string {
  return translateKnown(locale, key, fallback);
}

export function localizeBillingStatus(
  key:
    | InvoicePeriodStatus
    | "LATE"
    | "ONGOING"
    | "COMPILING"
    | "AWAITING_CLIENT_REVIEW"
    | "AWAITING_PAYMENT"
    | "PENDING_VERIFICATION"
    | "PAID"
    | "OVERDUE",
  locale: AppLocale = getLocale()
): string {
  return translateKnown(locale, `status.billing.${key}`, "—");
}

export function localizeClientReviewStatus(
  status: string | null | undefined,
  locale: AppLocale = getLocale()
): string {
  if (!status || status === "NONE") return "—";
  return translateKnown(locale, `status.clientReview.${status}`, "—");
}

export function localizeClientReviewKind(
  kind: string | null | undefined,
  locale: AppLocale = getLocale()
): string {
  if (!kind) return "—";
  return translateKnown(locale, `status.reviewKind.${kind}`, "—");
}

export function localizeClientReviewChipLines(
  status: string | null | undefined,
  locale: AppLocale = getLocale()
): readonly [string, string] | null {
  if (!status || status === "NONE") return null;
  const first = translate(locale, `status.clientReviewChip.${status}1`);
  const second = translate(locale, `status.clientReviewChip.${status}2`);
  if (first === `status.clientReviewChip.${status}1`) return null;
  return [first, second];
}

export function localizeBillingChipLines(
  kind:
    | "awaitingPayment"
    | "awaitingInvoice"
    | "verifyingPayment"
    | "readyToReconcile"
    | "readyToInvoice"
    | "awaitingClientReview"
    | "taxInvoiceDue"
    | "taxInvoiceDone"
    | "latePayment"
    | "paymentDue"
    | "invoiceDue",
  locale: AppLocale = getLocale()
): readonly [string, string] {
  return [
    translate(locale, `status.billingChip.${kind}1`),
    translate(locale, `status.billingChip.${kind}2`),
  ];
}

export function localizeLeaveStatus(
  status: string,
  locale: AppLocale = getLocale()
): string {
  const key = `status.leave.${status}`;
  const translated = translate(locale, key);
  return translated === key ? status : translated;
}

export function localizeSubCategory(
  value: ProjectSubCategory | string | null | undefined,
  locale: AppLocale = getLocale()
): string {
  if (!value || !isProjectSubCategory(value)) return "—";
  return translate(locale, `status.subcategory.${value}`);
}

export function localizeSubCategoryShort(
  value: ProjectSubCategory | string | null | undefined,
  locale: AppLocale = getLocale()
): string {
  if (!value || !isProjectSubCategory(value)) return "—";
  return translate(locale, `status.subcategory.short.${value}`);
}

export function localizeSubCategoryChipLines(
  value: ProjectSubCategory | string | null | undefined,
  locale: AppLocale = getLocale()
): readonly [string, string] | null {
  if (!value || !isProjectSubCategory(value)) return null;
  const short = localizeSubCategoryShort(value, locale);
  if (value === "INTERNAL") {
    const suffix = translate(locale, "status.subcategory.projectSuffix");
    return locale === "id" ? [suffix, short] : [short, suffix];
  }
  if (
    value === "SECURITY" ||
    value === "ONE_TIME_SECURITY" ||
    value === "PARKING" ||
    value === "PAYROLL_MANAGEMENT"
  ) {
    const suffix = translate(locale, "status.subcategory.serviceSuffix");
    return locale === "id" ? [suffix, short] : [short, suffix];
  }
  if (value === "REGULAR_LANDSCAPING" || value === "ONE_TIME_LANDSCAPING") {
    const suffix = translate(locale, "status.subcategory.landscapingSuffix");
    return locale === "id" ? [suffix, short] : [short, suffix];
  }
  const suffix = translate(locale, "status.subcategory.cleaningSuffix");
  // ID noun-adjective order: "Pembersihan" / "Rutin" (not "Rutin" / "Pembersihan").
  return locale === "id" ? [suffix, short] : [short, suffix];
}

export function localizeBillingMode(
  mode: BillingMode | string | null | undefined,
  locale: AppLocale = getLocale()
): string {
  if (!mode) return "—";
  const key = `status.billingMode.${mode}`;
  const translated = translate(locale, key);
  return translated === key ? String(mode) : translated;
}

export function localizeBillingPeriodBasis(
  basis: BillingPeriodBasis | string | null | undefined,
  locale: AppLocale = getLocale()
): string {
  if (!basis) return "—";
  const key = `status.billingPeriodBasis.${basis}`;
  const translated = translate(locale, key);
  return translated === key ? String(basis) : translated;
}

/** Map English nav section/item labels (stable IDs) to localized display text. */
export function localizeNavLabel(
  englishLabel: string,
  locale: AppLocale = getLocale()
): string {
  const sectionKey = `nav.sections.${englishLabel}`;
  const section = translate(locale, sectionKey);
  if (section !== sectionKey) return section;

  const itemKey = `nav.items.${englishLabel}`;
  const item = translate(locale, itemKey);
  if (item !== itemKey) return item;

  return englishLabel;
}

/** Seed/system department slugs → dictionary keys under `status.department`. */
const SYSTEM_DEPARTMENT_SLUG_KEYS: Record<string, string> = {
  corporate: "corporate",
  "head-office": "headOffice",
  warehouse: "warehouse",
  operations: "operations",
  finance: "finance",
  "cleaning-staff": "cleaningStaff",
  "general-cleaning-staff": "generalCleaning",
  gondola: "gondola",
  unassign: "unassigned",
};

/** Fallback when slug is missing — match known English seed names. */
const SYSTEM_DEPARTMENT_NAME_KEYS: Record<string, string> = {
  corporate: "corporate",
  "head office": "headOffice",
  warehouse: "warehouse",
  gudang: "warehouse",
  operations: "operations",
  finance: "finance",
  "cleaning staff": "cleaningStaff",
  "general cleaning": "generalCleaning",
  "general cleaning staff": "generalCleaning",
  gondola: "gondola",
  "gondola staff": "gondola",
  unassign: "unassigned",
  unassigned: "unassigned",
};

function departmentMessageKey(
  slug: string | null | undefined,
  fallbackName?: string | null
): string | null {
  if (slug) {
    const bySlug = SYSTEM_DEPARTMENT_SLUG_KEYS[slug.trim().toLowerCase()];
    if (bySlug) return bySlug;
  }
  const name = fallbackName?.trim().toLowerCase();
  if (name) {
    return SYSTEM_DEPARTMENT_NAME_KEYS[name] ?? null;
  }
  return null;
}

/** Localized system department label; custom departments keep their DB name. */
export function localizeDepartmentLabel(
  slug: string | null | undefined,
  fallback?: string | null,
  locale: AppLocale = getLocale()
): string {
  const key = departmentMessageKey(slug, fallback);
  if (key) {
    return translate(locale, `status.department.${key}`);
  }
  const label = fallback?.trim();
  return label || "—";
}

/** Known seed/default job titles → `status.jobTitle` keys. Custom titles pass through. */
const KNOWN_JOB_TITLE_KEYS: Record<string, string> = {
  ceo: "ceo",
  "chief executive officer": "ceo",
  "director of operations": "directorOfOperations",
  "operations manager": "operationsManager",
  "area manager": "areaManager",
  "cleaning staff": "cleaningStaff",
  "general cleaning staff": "generalCleaningStaff",
  "gondola staff": "gondolaStaff",
  technician: "technician",
  teknisi: "technician",
  owner: "owner",
  pemilik: "owner",
  "technician / sales": "technicianSales",
  "teknisi / penjualan": "technicianSales",
  "sales manager": "salesManager",
  "manajer penjualan": "salesManager",
  "account executive": "accountExecutive",
  "sales coordinator": "salesCoordinator",
  "koordinator penjualan": "salesCoordinator",
  "key account": "keyAccount",
  "sales supervisor": "salesSupervisor",
  "supervisor penjualan": "salesSupervisor",
  "procurement manager": "procurementManager",
  "manajer pengadaan": "procurementManager",
  "facility manager": "facilityManager",
  "manajer fasilitas": "facilityManager",
  "operations lead": "operationsLead",
  "pimpinan operasi": "operationsLead",
  homeowner: "homeowner",
  "pemilik rumah": "homeowner",
  "building manager": "buildingManager",
  "manajer gedung": "buildingManager",
  "export manager": "exportManager",
  "manajer ekspor": "exportManager",
};

export function localizeOperationsTeamKind(
  kind: OperationsTeamKindValue | string | null | undefined,
  locale: AppLocale = getLocale()
): string {
  if (kind === "FACADE_CLEANING") {
    return translate(locale, "pages.teams.kindFacade");
  }
  if (kind === "LANDSCAPING") {
    return translate(locale, "pages.teams.kindLandscaping");
  }
  if (kind === "GENERAL_CLEANING") {
    return translate(locale, "pages.teams.kindGeneral");
  }
  return translate(locale, "pages.teams.kind");
}

/** Localized known seed job titles; arbitrary custom titles stay as stored. */
export function localizeJobTitle(
  title: string | null | undefined,
  locale: AppLocale = getLocale()
): string {
  const trimmed = title?.trim();
  if (!trimmed) return "";
  const key = KNOWN_JOB_TITLE_KEYS[trimmed.toLowerCase()];
  if (!key) return trimmed;
  return translate(locale, `status.jobTitle.${key}`);
}

/** Inventory catalog type labels live under `pages.inventory.itemTypes`. */
const INVENTORY_ITEM_TYPE_LABEL_KEYS: Record<string, string> = {
  consumable: "Consumable",
  equipment: "Equipment",
  "spare part": "Spare Part",
  sparepart: "Spare Part",
  chemical: "Chemical",
  vehicle: "Vehicle",
  other: "Other",
};

const INVENTORY_ITEM_TYPE_CODE_KEYS: Record<string, string> = {
  CNS: "Consumable",
  CONS: "Consumable",
  EQP: "Equipment",
  VEH: "Vehicle",
  SPR: "Spare Part",
  CHM: "Chemical",
  CHEM: "Chemical",
  OTH: "Other",
};

/**
 * Human inventory item-type label.
 * Accepts stored Title Case, lowercase, or SKU codes (CNS / EQP / SPR).
 * Custom types stay as stored — never the i18n key path.
 */
export function localizeInventoryItemType(
  value: string | null | undefined,
  locale: AppLocale = getLocale()
): string {
  const trimmed = value?.trim();
  if (!trimmed) return "—";
  const preset =
    INVENTORY_ITEM_TYPE_CODE_KEYS[trimmed.toUpperCase()] ??
    INVENTORY_ITEM_TYPE_LABEL_KEYS[trimmed.toLowerCase()];
  if (!preset) return trimmed;
  const key = `pages.inventory.itemTypes.${preset}`;
  const translated = translate(locale, key);
  return translated === key ? trimmed : translated;
}
