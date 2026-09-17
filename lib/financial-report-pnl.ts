import type { ProjectStatus, ProjectSubCategory } from "@prisma/client";

import {
  CORPORATE_INCOME_TAX_RATE_PERCENT,
  corporateIncomeTaxOnProfitBeforeTax,
} from "@/lib/corporate-income-tax";
import { localizeSubCategory } from "@/lib/i18n/labels";
import type { AppLocale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";

/**
 * Company P&L stairs (by function) and the job tree under them.
 *
 * Assets (equipment, vehicles bought) never expense here — purchase or
 * issue is warehouse/location only. Cost of sales is consumables used on
 * the job (chemicals, wages, tagged services). Selling an asset is other
 * income on the paid date. Corporate tax follows Tax Rates (PPh Badan)
 * on each date in the period.
 */

export type FinancialReportPnlStairs = {
  revenue: number;
  costOfSales: number;
  grossProfit: number;
  otherIncome: number;
  headOffice: number;
  operatingProfit: number;
  financeCosts: number;
  profitBeforeTax: number;
  incomeTax: number;
  /** Null when more than one PPh Badan rate applies in the period. */
  incomeTaxRatePercent: number | null;
  netProfit: number;
};

export type FinancialReportPnlProjectNode = {
  id: string;
  name: string;
  location: string | null;
  status: ProjectStatus;
  subCategory: ProjectSubCategory;
  contractValue: number | null;
  revenue: number;
  costOfSales: number;
  grossProfit: number;
};

export type FinancialReportPnlClientNode = {
  id: string;
  name: string;
  projectCount: number;
  revenue: number;
  costOfSales: number;
  grossProfit: number;
  projects: FinancialReportPnlProjectNode[];
};

export type FinancialReportPnlSubcategoryGroup = {
  key: string;
  clients: FinancialReportPnlClientNode[];
  revenue: number;
  costOfSales: number;
  grossProfit: number;
};

export const FINANCIAL_REPORT_PNL_SUBCATEGORY_ORDER: ProjectSubCategory[] = [
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
];

export function buildFinancialReportPnlStairs(input: {
  revenue: number;
  costOfSales: number;
  otherIncome: number;
  headOffice: number;
  financeCosts: number;
  incomeTaxRatePercent?: number | null;
  incomeTax?: number;
}): FinancialReportPnlStairs {
  const revenue = input.revenue;
  const costOfSales = input.costOfSales;
  const grossProfit = revenue - costOfSales;
  const otherIncome = input.otherIncome;
  const headOffice = input.headOffice;
  const operatingProfit = grossProfit + otherIncome - headOffice;
  const financeCosts = input.financeCosts;
  const profitBeforeTax = operatingProfit - financeCosts;
  const incomeTaxRatePercent =
    input.incomeTaxRatePercent === undefined
      ? CORPORATE_INCOME_TAX_RATE_PERCENT
      : input.incomeTaxRatePercent;
  const incomeTax =
    input.incomeTax != null
      ? Math.max(0, Math.round(input.incomeTax))
      : corporateIncomeTaxOnProfitBeforeTax(
          profitBeforeTax,
          (incomeTaxRatePercent ?? 0) / 100
        );
  return {
    revenue,
    costOfSales,
    grossProfit,
    otherIncome,
    headOffice,
    operatingProfit,
    financeCosts,
    profitBeforeTax,
    incomeTax,
    incomeTaxRatePercent,
    netProfit: profitBeforeTax - incomeTax,
  };
}

export function emptyFinancialReportPnlStairs(): FinancialReportPnlStairs {
  return buildFinancialReportPnlStairs({
    revenue: 0,
    costOfSales: 0,
    otherIncome: 0,
    headOffice: 0,
    financeCosts: 0,
  });
}

/** Job-level P&L. Deposits, sold-off, and asset issues stay off this row. */
export function projectJobPnl(input: {
  subCategory: string;
  paidInvoiceRevenue: number;
  inventoryOut: number;
  wagesOut: number;
  purchasesOut: number;
  parking?: { moneyIn: number; dealOut: number } | null;
  payroll?: { moneyIn: number; moneyOut: number } | null;
  incidents?: number;
}): { revenue: number; costOfSales: number; grossProfit: number } {
  const incidents = input.incidents ?? 0;
  if (input.subCategory === "PARKING") {
    const revenue = input.parking?.moneyIn ?? 0;
    const costOfSales =
      (input.parking?.dealOut ?? 0) +
      input.purchasesOut +
      input.wagesOut +
      incidents;
    return { revenue, costOfSales, grossProfit: revenue - costOfSales };
  }
  if (input.subCategory === "PAYROLL_MANAGEMENT") {
    const revenue = input.payroll?.moneyIn ?? 0;
    const costOfSales = (input.payroll?.moneyOut ?? 0) + incidents;
    return { revenue, costOfSales, grossProfit: revenue - costOfSales };
  }
  const revenue = input.paidInvoiceRevenue;
  const costOfSales =
    input.inventoryOut + input.wagesOut + input.purchasesOut + incidents;
  return { revenue, costOfSales, grossProfit: revenue - costOfSales };
}

export function financialReportPnlGroupTitle(
  key: string,
  locale: AppLocale
): string {
  const name = localizeSubCategory(key, locale);
  if (key === "CONTRACT_GENERAL_CLEANING" || key === "CONTRACT_FACADE_CLEANING") {
    return translate(locale, "pages.financialReport.pnlGroupContract", { name });
  }
  if (key === "GENERAL_CLEANING" || key === "FACADE_CLEANING") {
    return translate(locale, "pages.financialReport.pnlGroupOneTime", { name });
  }
  return name;
}

export function groupFinancialReportPnlTree(
  clients: Array<{
    id: string;
    name: string;
    projects: FinancialReportPnlProjectNode[];
  }>
): FinancialReportPnlSubcategoryGroup[] {
  const bySub = new Map<
    string,
    Map<string, { name: string; projects: FinancialReportPnlProjectNode[] }>
  >();

  for (const client of clients) {
    for (const project of client.projects) {
      let clientsMap = bySub.get(project.subCategory);
      if (!clientsMap) {
        clientsMap = new Map();
        bySub.set(project.subCategory, clientsMap);
      }
      let bucket = clientsMap.get(client.id);
      if (!bucket) {
        bucket = { name: client.name, projects: [] };
        clientsMap.set(client.id, bucket);
      }
      bucket.projects.push(project);
    }
  }

  const orderedKeys = [
    ...FINANCIAL_REPORT_PNL_SUBCATEGORY_ORDER.filter((key) => bySub.has(key)),
    ...[...bySub.keys()]
      .filter(
        (key) =>
          !(FINANCIAL_REPORT_PNL_SUBCATEGORY_ORDER as readonly string[]).includes(
            key
          )
      )
      .sort(),
  ];

  return orderedKeys.map((key) => {
    const clientsMap = bySub.get(key)!;
    const groupedClients: FinancialReportPnlClientNode[] = [
      ...clientsMap.entries(),
    ].map(([id, row]) => {
      const revenue = row.projects.reduce((sum, project) => sum + project.revenue, 0);
      const costOfSales = row.projects.reduce(
        (sum, project) => sum + project.costOfSales,
        0
      );
      return {
        id,
        name: row.name,
        projectCount: row.projects.length,
        revenue,
        costOfSales,
        grossProfit: revenue - costOfSales,
        projects: row.projects,
      };
    });
    const revenue = groupedClients.reduce((sum, client) => sum + client.revenue, 0);
    const costOfSales = groupedClients.reduce(
      (sum, client) => sum + client.costOfSales,
      0
    );
    return {
      key,
      clients: groupedClients,
      revenue,
      costOfSales,
      grossProfit: revenue - costOfSales,
    };
  });
}
