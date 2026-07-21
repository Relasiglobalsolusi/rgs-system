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
  getLeaveTypeLabel,
  type LeaveRequestType,
} from "@/lib/i18n/leave-type";
import {
  getProjectWorkflowStatusLabel,
  isProjectStatus,
} from "@/lib/project-status";
import { isProjectSubCategory } from "@/lib/project-subcategory";

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
  opts: { status: ProjectStatus | string | null | undefined; paymentDue?: boolean },
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
  return null;
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
  return translate(locale, `status.billing.${key}`);
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

export function localizeLeaveType(
  type: string,
  locale: AppLocale = getLocale()
): string {
  return getLeaveTypeLabel(type as LeaveRequestType, locale);
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

export function localizeModuleLabel(
  moduleKey: string,
  locale: AppLocale = getLocale()
): string {
  const key = `modules.${moduleKey}`;
  const translated = translate(locale, key);
  return translated === key ? moduleKey : translated;
}

/** Seed/system department slugs → dictionary keys under `status.department`. */
const SYSTEM_DEPARTMENT_SLUG_KEYS: Record<string, string> = {
  corporate: "corporate",
  "head-office": "headOffice",
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
  "cleaning staff": "cleaningStaff",
  "general cleaning staff": "generalCleaningStaff",
  "gondola staff": "gondolaStaff",
};

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
