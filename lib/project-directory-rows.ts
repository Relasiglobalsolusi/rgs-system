import {
  listPaymentDuePeriods,
  listPendingApprovalPeriods,
} from "@/lib/billing";
import { formatDisplayDate } from "@/lib/format-date";
import { decimalToNumber } from "@/lib/project-billing";
import { PROJECT_SITE_WORK_STATUSES } from "@/lib/project-status";

export type ProjectDirectoryView =
  | "planning"
  | "in-progress"
  | "pending-approval"
  | "payment-due"
  | "completed"
  | undefined;

export type ProjectDirectoryRowKind =
  | "planning"
  | "in-progress"
  | "pending-approval"
  | "payment-due"
  | "completed"
  | "other";

type DirectoryPeriodBase = {
  id: string;
  status: string;
  clientReviewStatus?: string | null;
  dueAt?: Date | string | null;
  periodStart?: Date | string | null;
  periodEnd?: Date | string | null;
  label?: string | null;
};

type DirectoryProjectBase = {
  id: string;
  status: string;
  invoicePeriods: DirectoryPeriodBase[];
};

type Decimalish = Parameters<typeof decimalToNumber>[0];

/**
 * Known Prisma Decimal columns on directory payloads:
 * - Project: contractPrice, pphRatePercent, setupCost, profitSharePercent,
 *   monthlyClientFee, serviceFeePercent, payrollTaxPercent,
 *   memberParkingUnitFee, parkingTaxPercent
 * - Invoice period: amount, revisedInvoiceAmount, ppnRatePercent
 */
function isPrismaDecimalLike(value: unknown): boolean {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  if (value instanceof Date) return false;
  if (
    (value as { [Symbol.toStringTag]?: string })[Symbol.toStringTag] ===
    "Decimal"
  ) {
    return true;
  }
  const name = (value as { constructor?: { name?: string } }).constructor?.name;
  if (name === "Decimal") return true;
  const candidate = value as {
    toNumber?: unknown;
    d?: unknown;
    e?: unknown;
    s?: unknown;
  };
  return (
    typeof candidate.toNumber === "function" &&
    Array.isArray(candidate.d) &&
    typeof candidate.e === "number" &&
    typeof candidate.s === "number"
  );
}

/** Prisma Decimal → number for RSC → Client Component props (nested). */
export function serializeDirectoryDecimals<T>(value: T): T {
  if (isPrismaDecimalLike(value)) {
    return decimalToNumber(value as Decimalish) as T;
  }
  if (value == null || typeof value !== "object") return value;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) {
    return value.map((item) => serializeDirectoryDecimals(item)) as T;
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    return value;
  }
  const next: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as object)) {
    next[key] = serializeDirectoryDecimals(nested);
  }
  return next as T;
}

/** Period payload: amount / revisedInvoiceAmount / ppnRatePercent → number. */
export function serializeDirectoryPeriod<P extends object>(period: P): P {
  const row: Record<string, unknown> = {
    ...(period as Record<string, unknown>),
  };
  for (const key of ["amount", "revisedInvoiceAmount", "ppnRatePercent"]) {
    if (key in row) {
      row[key] = decimalToNumber(row[key] as Decimalish);
    }
  }
  return serializeDirectoryDecimals(row as P);
}

/**
 * Strip Prisma Decimals from a directory project, including nested
 * invoicePeriods.
 */
export function serializeDirectoryProject<P extends DirectoryProjectBase>(
  project: P
): P {
  const row = project as P & {
    contractPrice?: Decimalish;
    pphRatePercent?: Decimalish;
    setupCost?: Decimalish;
    profitSharePercent?: Decimalish;
    monthlyClientFee?: Decimalish;
    serviceFeePercent?: Decimalish;
    payrollTaxPercent?: Decimalish;
    memberParkingUnitFee?: Decimalish;
    parkingTaxPercent?: Decimalish;
  };
  return serializeDirectoryDecimals({
    ...row,
    contractPrice: decimalToNumber(row.contractPrice),
    pphRatePercent: decimalToNumber(row.pphRatePercent),
    setupCost: decimalToNumber(row.setupCost),
    profitSharePercent: decimalToNumber(row.profitSharePercent),
    monthlyClientFee: decimalToNumber(row.monthlyClientFee),
    serviceFeePercent: decimalToNumber(row.serviceFeePercent),
    payrollTaxPercent: decimalToNumber(row.payrollTaxPercent),
    memberParkingUnitFee: decimalToNumber(row.memberParkingUnitFee),
    parkingTaxPercent: decimalToNumber(row.parkingTaxPercent),
    invoicePeriods: project.invoicePeriods.map((period) =>
      serializeDirectoryPeriod(period)
    ),
  });
}

export type ProjectDirectoryItem<P extends DirectoryProjectBase> = {
  key: string;
  project: P;
  kind: ProjectDirectoryRowKind;
  focusPeriod: P["invoicePeriods"][number] | null;
};

export function isDirectoryPeriodRow(
  kind: ProjectDirectoryRowKind
): boolean {
  return kind === "pending-approval" || kind === "payment-due";
}

export function invoicePeriodElementId(periodId: string): string {
  return `invoice-period-${periodId}`;
}

export function projectDetailHref(
  projectId: string,
  periodId?: string | null
): string {
  if (!periodId) return `/projects/${projectId}`;
  return `/projects/${projectId}?period=${encodeURIComponent(periodId)}`;
}

/** Dedicated page for one billing cycle (reports, amount, approval, tax). */
export function projectPeriodHref(
  projectId: string,
  periodId: string
): string {
  return `/projects/${projectId}/periods/${encodeURIComponent(periodId)}`;
}

export function projectBillingHref(
  clientId: string,
  projectId: string,
  periodId?: string | null
): string {
  const base = `/billing/${clientId}/${projectId}`;
  if (!periodId) return base;
  return `${base}?period=${encodeURIComponent(periodId)}`;
}

/** Period dates for directory line 2 / Timeline (UTC date-only). */
export function formatDirectoryDateRange(
  start: Date | string | null | undefined,
  end: Date | string | null | undefined,
  locale: string
): string | null {
  if (start == null || end == null) return null;
  const from = formatDisplayDate(start, { timeZone: "UTC" }, locale);
  const to = formatDisplayDate(end, { timeZone: "UTC" }, locale);
  if (!from || !to) return null;
  return `${from} → ${to}`;
}

function isLiveContractStatus(status: string): boolean {
  return (PROJECT_SITE_WORK_STATUSES as readonly string[]).includes(status);
}

function kindForProjectStatus(status: string): ProjectDirectoryRowKind {
  if (status === "PLANNED") return "planning";
  if (status === "COMPLETED") return "completed";
  if (isLiveContractStatus(status)) return "in-progress";
  return "other";
}

/**
 * Locked Projects directory rows:
 * - In Progress / live contract: one row per project (full contract dates).
 * - Pending Approval: one row per real period awaiting approval.
 * - Payment Due: one row per real unpaid issued period.
 * Same project may appear in all three at once. One Time / Internal stay one
 * row unless they already have a matching period record.
 */
export function buildProjectDirectoryItems<P extends DirectoryProjectBase>(
  projects: P[],
  view: ProjectDirectoryView
): ProjectDirectoryItem<P>[] {
  const items: ProjectDirectoryItem<P>[] = [];

  for (const project of projects) {
    const pending = listPendingApprovalPeriods(project.invoicePeriods);
    const paymentDue = listPaymentDuePeriods(project.invoicePeriods);

    if (view === "pending-approval") {
      for (const period of pending) {
        items.push({
          key: `${project.id}:${period.id}`,
          project,
          kind: "pending-approval",
          focusPeriod: period,
        });
      }
      continue;
    }

    if (view === "payment-due") {
      if (paymentDue.length > 0) {
        for (const period of paymentDue) {
          items.push({
            key: `${project.id}:${period.id}`,
            project,
            kind: "payment-due",
            focusPeriod: period,
          });
        }
        continue;
      }
      items.push({
        key: project.id,
        project,
        kind: "payment-due",
        focusPeriod: null,
      });
      continue;
    }

    if (view === "in-progress") {
      items.push({
        key: project.id,
        project,
        kind: "in-progress",
        focusPeriod: null,
      });
      continue;
    }

    if (view === "planning") {
      items.push({
        key: project.id,
        project,
        kind: "planning",
        focusPeriod: null,
      });
      continue;
    }

    if (view === "completed") {
      items.push({
        key: project.id,
        project,
        kind: "completed",
        focusPeriod: null,
      });
      continue;
    }

    items.push({
      key: project.id,
      project,
      kind: kindForProjectStatus(project.status),
      focusPeriod: null,
    });
    for (const period of pending) {
      items.push({
        key: `${project.id}:pending:${period.id}`,
        project,
        kind: "pending-approval",
        focusPeriod: period,
      });
    }
    for (const period of paymentDue) {
      items.push({
        key: `${project.id}:due:${period.id}`,
        project,
        kind: "payment-due",
        focusPeriod: period,
      });
    }
  }

  return items;
}
