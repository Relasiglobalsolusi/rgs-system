import type { ProjectSubCategory } from "@prisma/client";

import { exclusivePricePlusChargedTax, isCommercialTaxKind } from "@/lib/commercial-tax";
import { recognizedIncomeAmount } from "@/lib/financial-report";
import { decimalToNumber } from "@/lib/project-billing";
import { operatingPurchaseAmount } from "@/lib/purchase-operating-cost";

export const EXPENSE_REPORT_UNASSIGNED_KEY = "__unassigned__";

const SUBCATEGORY_ORDER: ProjectSubCategory[] = [
  "REGULAR_CLEANING",
  "CONTRACT_GENERAL_CLEANING",
  "CONTRACT_FACADE_CLEANING",
  "GENERAL_CLEANING",
  "FACADE_CLEANING",
  "REGULAR_LANDSCAPING",
  "ONE_TIME_LANDSCAPING",
  "SECURITY",
  "ONE_TIME_SECURITY",
  "PARKING",
  "PAYROLL_MANAGEMENT",
  "INTERNAL",
];

export type ExpenseReportLineKind = "INCOME" | "EXPENSE";

export type ExpenseReportTaxLines = {
  ppn: number;
  pph: number;
  gross: number;
};

export type ExpenseReportLine = {
  date: Date;
  kind: ExpenseReportLineKind;
  projectId: string | null;
  projectName: string | null;
  clientName: string | null;
  subCategory: string | null;
  detail: string;
  reference: string | null;
  statusLabel: string;
  amount: number;
  payFromLabel?: string | null;
  payToLabel?: string | null;
  tax?: ExpenseReportTaxLines | null;
};

export type ExpenseReportProjectGroup = {
  projectId: string;
  projectName: string;
  clientName: string | null;
  lines: ExpenseReportLine[];
  incomeDpp: number;
  expenseTotal: number;
  net: number;
};

export type ExpenseReportSubcategoryGroup = {
  key: string;
  title: string;
  projects: ExpenseReportProjectGroup[];
  incomeDpp: number;
  expenseTotal: number;
  net: number;
};

export type ExpenseReportGrouped = {
  groups: ExpenseReportSubcategoryGroup[];
  incomeDpp: number;
  expenseTotal: number;
  net: number;
};

export function purchaseExpenseAmount(invoice: {
  amount: Parameters<typeof decimalToNumber>[0];
  purchaseCategory: string | null;
  governmentTaxKind: string | null;
  governmentOperatingAmount: Parameters<typeof decimalToNumber>[0];
  origin: "LOCAL" | "IMPORT" | null;
  includesPpn: boolean;
  ppnRatePercent: Parameters<typeof decimalToNumber>[0];
  importPpnAmountIdr: Parameters<typeof decimalToNumber>[0];
  importValueIdr: Parameters<typeof decimalToNumber>[0];
  pph22AmountIdr: Parameters<typeof decimalToNumber>[0];
  transferFeeIdr: Parameters<typeof decimalToNumber>[0];
  loanInterestAmount: Parameters<typeof decimalToNumber>[0];
  loanPenaltyAmount: Parameters<typeof decimalToNumber>[0];
  loanAdminFeeAmount: Parameters<typeof decimalToNumber>[0];
  loanProvisionAmount: Parameters<typeof decimalToNumber>[0];
}): number {
  return operatingPurchaseAmount({
    amount: decimalToNumber(invoice.amount) ?? 0,
    purchaseCategory: invoice.purchaseCategory,
    governmentTaxKind: invoice.governmentTaxKind,
    governmentOperatingAmount: decimalToNumber(
      invoice.governmentOperatingAmount
    ),
    origin: invoice.origin,
    includesPpn: invoice.includesPpn,
    ppnRatePercent: decimalToNumber(invoice.ppnRatePercent),
    importPpnAmountIdr: decimalToNumber(invoice.importPpnAmountIdr),
    importValueIdr: decimalToNumber(invoice.importValueIdr),
    pph22AmountIdr: decimalToNumber(invoice.pph22AmountIdr),
    transferFeeIdr: decimalToNumber(invoice.transferFeeIdr),
    loanInterestAmount: decimalToNumber(invoice.loanInterestAmount),
    loanPenaltyAmount: decimalToNumber(invoice.loanPenaltyAmount),
    loanAdminFeeAmount: decimalToNumber(invoice.loanAdminFeeAmount),
    loanProvisionAmount: decimalToNumber(invoice.loanProvisionAmount),
  });
}

export function invoiceIncomeTaxLines(input: {
  amount: Parameters<typeof decimalToNumber>[0];
  revisedInvoiceAmount: Parameters<typeof decimalToNumber>[0];
  ppnRatePercent: Parameters<typeof decimalToNumber>[0];
  chargedTaxKind?: string | null;
  requiresTaxInvoice?: boolean | null;
  pphRatePercent?: Parameters<typeof decimalToNumber>[0];
  isGovernmentContract?: boolean | null;
}): { dpp: number; tax: ExpenseReportTaxLines | null } {
  const dpp = recognizedIncomeAmount({
    amount: input.amount,
    revisedInvoiceAmount: input.revisedInvoiceAmount,
    ppnRatePercent: input.ppnRatePercent,
  });
  if (dpp <= 0) return { dpp: 0, tax: null };
  const tax = exclusivePricePlusChargedTax({
    exclusiveAmount: dpp,
    chargedTaxKind: isCommercialTaxKind(input.chargedTaxKind)
      ? input.chargedTaxKind
      : null,
    requiresTaxInvoice: input.requiresTaxInvoice,
    ppnRatePercent: decimalToNumber(input.ppnRatePercent),
    pphRatePercent: decimalToNumber(input.pphRatePercent),
    isGovernmentContract: input.isGovernmentContract,
  });
  if (tax.ppn <= 0 && tax.pph <= 0) return { dpp, tax: null };
  return {
    dpp,
    tax: { ppn: tax.ppn, pph: tax.pph, gross: tax.gross },
  };
}

function subcategoryRank(subCategory: string | null): number {
  if (!subCategory) return SUBCATEGORY_ORDER.length + 1;
  const index = SUBCATEGORY_ORDER.indexOf(subCategory as ProjectSubCategory);
  return index === -1 ? SUBCATEGORY_ORDER.length : index;
}

function compareLines(left: ExpenseReportLine, right: ExpenseReportLine) {
  const leftTime = left.date.getTime();
  const rightTime = right.date.getTime();
  if (leftTime !== rightTime) return leftTime - rightTime;
  if (left.kind !== right.kind) return left.kind === "EXPENSE" ? -1 : 1;
  return left.detail.localeCompare(right.detail);
}

function totalsOf(lines: ExpenseReportLine[]) {
  let incomeDpp = 0;
  let expenseTotal = 0;
  for (const line of lines) {
    if (line.kind === "INCOME") incomeDpp += line.amount;
    else expenseTotal += line.amount;
  }
  return {
    incomeDpp,
    expenseTotal,
    net: incomeDpp - expenseTotal,
  };
}

export function groupExpenseReportLines(
  lines: ExpenseReportLine[],
  opts: {
    unassignedTitle: string;
    subcategoryTitle: (subCategory: string | null) => string;
  }
): ExpenseReportGrouped {
  const usable = lines.filter((line) => line.amount > 0);
  const byProject = new Map<string, ExpenseReportLine[]>();

  for (const line of usable) {
    const projectId = line.projectId ?? EXPENSE_REPORT_UNASSIGNED_KEY;
    const bucket = byProject.get(projectId);
    if (bucket) bucket.push(line);
    else byProject.set(projectId, [line]);
  }

  const projects: ExpenseReportProjectGroup[] = [];
  for (const [projectId, projectLines] of byProject) {
    const sorted = [...projectLines].sort(compareLines);
    const sample = sorted[0];
    const isUnassigned = projectId === EXPENSE_REPORT_UNASSIGNED_KEY;
    projects.push({
      projectId,
      projectName: isUnassigned
        ? opts.unassignedTitle
        : sample?.projectName?.trim() || opts.unassignedTitle,
      clientName: isUnassigned ? null : sample?.clientName ?? null,
      lines: sorted,
      ...totalsOf(sorted),
    });
  }

  projects.sort((left, right) => {
    const leftUnassigned = left.projectId === EXPENSE_REPORT_UNASSIGNED_KEY;
    const rightUnassigned = right.projectId === EXPENSE_REPORT_UNASSIGNED_KEY;
    if (leftUnassigned !== rightUnassigned) return leftUnassigned ? 1 : -1;
    const client = (left.clientName ?? "").localeCompare(right.clientName ?? "");
    if (client !== 0) return client;
    return left.projectName.localeCompare(right.projectName);
  });

  const bySub = new Map<string, ExpenseReportProjectGroup[]>();
  const subTitle = new Map<string, string>();
  for (const project of projects) {
    const sample = project.lines[0];
    const key =
      project.projectId === EXPENSE_REPORT_UNASSIGNED_KEY
        ? EXPENSE_REPORT_UNASSIGNED_KEY
        : sample?.subCategory ?? EXPENSE_REPORT_UNASSIGNED_KEY;
    const bucket = bySub.get(key);
    if (bucket) bucket.push(project);
    else bySub.set(key, [project]);
    if (!subTitle.has(key)) {
      subTitle.set(
        key,
        key === EXPENSE_REPORT_UNASSIGNED_KEY
          ? opts.unassignedTitle
          : opts.subcategoryTitle(sample?.subCategory ?? null)
      );
    }
  }

  const groups = [...bySub.entries()]
    .sort(([left], [right]) => {
      if (left === EXPENSE_REPORT_UNASSIGNED_KEY) return 1;
      if (right === EXPENSE_REPORT_UNASSIGNED_KEY) return -1;
      return subcategoryRank(left) - subcategoryRank(right);
    })
    .map(([key, groupedProjects]) => {
      const rolled = totalsOf(groupedProjects.flatMap((project) => project.lines));
      return {
        key,
        title: subTitle.get(key) ?? opts.unassignedTitle,
        projects: groupedProjects,
        ...rolled,
      };
    });

  return {
    groups,
    ...totalsOf(usable),
  };
}
