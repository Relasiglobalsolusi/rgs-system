import type { InvoicePeriodStatus } from "@prisma/client";

import type { CompanyForPdf } from "@/lib/pdf-letterhead";
import { prisma } from "@/lib/prisma";

export const OPEN_BANK_INVOICE_STATUSES: InvoicePeriodStatus[] = [
  "COMPILING",
  "AWAITING_CLIENT_REVIEW",
  "AWAITING_PAYMENT",
  "PENDING_VERIFICATION",
  "OVERDUE",
];

export type CompanyBankAccountRow = {
  id: string;
  companyId: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  label: string | null;
  sortOrder: number;
  createdAt: Date;
};

export type CompanyBankAccountOption = {
  id: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  label: string | null;
  sortOrder: number;
};

type CompanyBankAccountDelegate = {
  findMany: (args: {
    where?: { companyId?: string; id?: string };
    orderBy?:
      | { sortOrder: "asc" | "desc" }
      | Array<{ sortOrder: "asc" | "desc" } | { createdAt: "asc" | "desc" }>;
    select?: Record<string, boolean>;
  }) => Promise<CompanyBankAccountRow[]>;
  findFirst: (args: {
    where: Record<string, unknown>;
    orderBy?:
      | { sortOrder: "asc" | "desc" }
      | Array<{ sortOrder: "asc" | "desc" } | { createdAt: "asc" | "desc" }>;
  }) => Promise<CompanyBankAccountRow | null>;
  findUnique: (args: {
    where: { id: string };
  }) => Promise<CompanyBankAccountRow | null>;
  create: (args: {
    data: {
      companyId: string;
      bankName: string;
      accountNumber: string;
      accountHolder: string;
      label?: string | null;
      sortOrder?: number;
    };
  }) => Promise<CompanyBankAccountRow>;
  update: (args: {
    where: { id: string };
    data: {
      bankName?: string;
      accountNumber?: string;
      accountHolder?: string;
      label?: string | null;
      sortOrder?: number;
    };
  }) => Promise<CompanyBankAccountRow>;
  delete: (args: { where: { id: string } }) => Promise<CompanyBankAccountRow>;
  count: (args: { where: Record<string, unknown> }) => Promise<number>;
};

export function companyBankAccounts(db: {
  companyBankAccount?: CompanyBankAccountDelegate;
}): CompanyBankAccountDelegate {
  const delegate = db.companyBankAccount;
  if (!delegate) {
    throw new Error(
      "Company bank accounts are not available yet. Apply the database migration first."
    );
  }
  return delegate;
}

export function toBankAccountOption(
  row: CompanyBankAccountRow
): CompanyBankAccountOption {
  return {
    id: row.id,
    bankName: row.bankName,
    accountNumber: row.accountNumber,
    accountHolder: row.accountHolder,
    label: row.label,
    sortOrder: row.sortOrder,
  };
}

export function formatBankAccountOptionLabel(
  account: Pick<
    CompanyBankAccountOption,
    "bankName" | "accountNumber" | "accountHolder" | "label"
  >
): string {
  const core = `${account.bankName} · ${account.accountNumber} · ${account.accountHolder}`;
  const label = account.label?.trim();
  return label ? `${label} — ${core}` : core;
}

export function overlayCompanyBankForPdf(
  company: CompanyForPdf,
  account: Pick<
    CompanyBankAccountRow,
    "bankName" | "accountNumber" | "accountHolder"
  > | null
): CompanyForPdf {
  if (!account) return company;
  return {
    ...company,
    bankName: account.bankName,
    bankAccountNumber: account.accountNumber,
    bankAccountName: account.accountHolder,
  };
}

export async function listCompanyBankAccounts(
  companyId: string
): Promise<CompanyBankAccountRow[]> {
  return companyBankAccounts(prisma).findMany({
    where: { companyId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function getCompanyBankAccount(
  companyId: string,
  bankAccountId: string
): Promise<CompanyBankAccountRow | null> {
  const row = await companyBankAccounts(prisma).findFirst({
    where: { id: bankAccountId, companyId },
  });
  return row;
}

export async function getFirstCompanyBankAccount(
  companyId: string
): Promise<CompanyBankAccountRow | null> {
  return companyBankAccounts(prisma).findFirst({
    where: { companyId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function resolveCompanyBankAccountForDocument(options: {
  companyId: string;
  requestedId?: string | null;
  existingId?: string | null;
  requireExplicit?: boolean;
}): Promise<CompanyBankAccountRow | null> {
  const requested = options.requestedId?.trim() || null;
  if (requested) {
    const row = await getCompanyBankAccount(options.companyId, requested);
    if (!row) {
      throw new Error("BANK_ACCOUNT_NOT_FOUND");
    }
    return row;
  }

  const existing = options.existingId?.trim() || null;
  if (existing) {
    const row = await getCompanyBankAccount(options.companyId, existing);
    if (row) return row;
  }

  if (options.requireExplicit) {
    return null;
  }

  return getFirstCompanyBankAccount(options.companyId);
}

export async function countOpenInvoicesForBankAccount(
  bankAccountId: string
): Promise<{ invoicePeriods: number; unpaidSales: number }> {
  const periods = prisma.projectInvoicePeriod as unknown as {
    count: (args: { where: Record<string, unknown> }) => Promise<number>;
  };
  const sales = prisma.inventorySale as unknown as {
    count: (args: { where: Record<string, unknown> }) => Promise<number>;
  };
  const [invoicePeriods, unpaidSales] = await Promise.all([
    periods.count({
      where: {
        bankAccountId,
        status: { in: [...OPEN_BANK_INVOICE_STATUSES] },
      },
    }),
    sales.count({
      where: {
        bankAccountId,
        paidAt: null,
        movement: { voidedAt: null },
      },
    }),
  ]);
  return { invoicePeriods, unpaidSales };
}

export async function syncCompanyLegacyBankFields(
  companyId: string
): Promise<void> {
  const first = await getFirstCompanyBankAccount(companyId);
  await prisma.company.update({
    where: { id: companyId },
    data: {
      bankName: first?.bankName ?? null,
      bankAccountNumber: first?.accountNumber ?? null,
      bankAccountName: first?.accountHolder ?? null,
    },
  });
}

export function periodBankAccountId(
  period: { bankAccountId?: string | null }
): string | null {
  return period.bankAccountId?.trim() || null;
}

export async function ensureLegacyCompanyBanksMigrated(
  companyId: string
): Promise<void> {
  try {
    const db = companyBankAccounts(prisma);
    const count = await db.count({ where: { companyId } });
    if (count > 0) return;
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        name: true,
        bankName: true,
        bankAccountNumber: true,
        bankAccountName: true,
      },
    });
    const accountNumber = company?.bankAccountNumber?.trim();
    if (!company || !accountNumber) return;
    await db.create({
      data: {
        companyId,
        bankName: company.bankName?.trim() || "Bank",
        accountNumber,
        accountHolder:
          company.bankAccountName?.trim() || company.name,
        sortOrder: 0,
      },
    });
  } catch {
    // Table is missing until prisma db push.
  }
}

export async function listCompanyBankAccountOptions(
  companyId: string
): Promise<CompanyBankAccountOption[]> {
  try {
    await ensureLegacyCompanyBanksMigrated(companyId);
    return (await listCompanyBankAccounts(companyId)).map(toBankAccountOption);
  } catch {
    return [];
  }
}

export async function parseFormCompanyBankAccountId(
  formData: FormData,
  companyId: string,
  options?: {
    requiredWhenAccountsExist?: boolean;
    fieldName?: string;
    requiredMessage?: string;
  }
): Promise<string | null> {
  const fieldName = options?.fieldName ?? "bankAccountId";
  const raw = String(formData.get(fieldName) ?? "").trim();
  if (!raw) {
    if (options?.requiredWhenAccountsExist) {
      const accounts = await listCompanyBankAccounts(companyId);
      if (accounts.length > 0) {
        throw new Error(
          options.requiredMessage ?? "Choose the bank account clients pay to."
        );
      }
    }
    return null;
  }
  const row = await getCompanyBankAccount(companyId, raw);
  if (!row) {
    throw new Error("Bank account not found.");
  }
  return row.id;
}

export async function overlayInvoiceCompanyBank(options: {
  companyId: string;
  company: CompanyForPdf | null | undefined;
  periodBankAccountId?: string | null;
  projectBankAccountId?: string | null;
}): Promise<{
  company: CompanyForPdf | null | undefined;
  bankAccountId: string | null;
}> {
  const account = await resolveCompanyBankAccountForDocument({
    companyId: options.companyId,
    requestedId:
      options.periodBankAccountId?.trim() ||
      options.projectBankAccountId?.trim() ||
      null,
    requireExplicit: true,
  });
  return {
    company: options.company
      ? overlayCompanyBankForPdf(options.company, account)
      : options.company,
    bankAccountId:
      account?.id ??
      options.periodBankAccountId?.trim() ??
      options.projectBankAccountId?.trim() ??
      null,
  };
}
