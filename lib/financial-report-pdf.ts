import PDFDocument from "pdfkit";

import {
  LIVE_PROJECT_EXPENSE_WHERE,
  liveInvoiceIncomeWhereFor,
} from "@/lib/books-open";
import { ensureCompanyForPdf } from "@/lib/company-for-pdf";
import { formatEmployeeName } from "@/lib/employee-user-link";
import {
  commercialPeriodGross,
  recognizedIncomeAmount,
  soldOffIncomeAmount,
} from "@/lib/financial-report";
import { getFinancialReportOverviewData } from "@/lib/financial-report-overview";
import {
  bankAccountWhere,
  FINANCIAL_REPORT_ALL_BANKS,
  financialReportCalendarRange,
  financialReportWageRange,
  matchesBankAccount,
  prismaDateFilter,
  purchaseBankAccountWhere,
  type FinancialReportSelection,
} from "@/lib/financial-report-query";
import { formatDisplayDate } from "@/lib/format-date";
import {
  DEFAULT_LOCALE,
  localeToBcp47,
  type AppLocale,
} from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";
import { excludeEquipmentFromProjectInventoryCost } from "@/lib/inventory";
import {
  emptyFinancialReportPnlStairs,
  financialReportPnlGroupTitle,
  type FinancialReportPnlStairs,
  type FinancialReportPnlSubcategoryGroup,
} from "@/lib/financial-report-pnl";
import { isCapitalVehicleExpenseKind } from "@/lib/vehicle-expense";
import {
  allocateLockedCompanyWages,
  listLockedPayrollRunsInRange,
} from "@/lib/locked-payroll-pnl";
import {
  listInternalWageSiteKeys,
  OVERHEAD_WAGE_BUCKET,
} from "@/lib/internal-payroll-wages";
import { isPayrollPayableType, PAYROLL_DEDUCTION_LABEL_KEY } from "@/lib/payroll-deductions";
import { isSetupMonth, parkingDealFromProject, parkingLogCreditDate, parkingMemberRevenue, parkingPeriodKey } from "@/lib/parking-economics";
import {
  BOTTOM_SAFE,
  CONTENT_WIDTH,
  PAGE_MARGIN,
  PDF_BRAND as BRAND,
  drawLetterheadHeader,
  drawPdfPageFooter,
  letterheadFromCompany,
  loadBrandLogoBuffer,
  type CompanyForPdf,
} from "@/lib/pdf-letterhead";
import { prisma } from "@/lib/prisma";
import { decimalToNumber, formatContractPrice } from "@/lib/project-billing";
import { operatingPurchaseAmount } from "@/lib/purchase-operating-cost";
import {
  rankLeasePaymentsByVehicle,
  vehicleExpenseNarrative,
} from "@/lib/vehicle-expense";
import { jakartaYearMonth } from "@/lib/vat";
import {
  isPettyCashTopUpInvoice,
  isPrepaidCardReplacementFeeInvoice,
  isPrepaidCardTopUpInvoice,
  isPrepaidOpenCardTopUpInvoice,
} from "@/lib/advance-cash-expense";
import { formatPrepaidCardNumber } from "@/lib/prepaid-card";

const JAKARTA_TZ = "Asia/Jakarta";
const ROW_H = 22;
const HEADER_H = 24;
const SUMMARY_ROW_H = 18;

const OUTSTANDING_INVOICE_STATUSES = [
  "AWAITING_PAYMENT",
  "PENDING_VERIFICATION",
  "OVERDUE",
] as const;

export type FinancialReportSource =
  | "paidInvoice"
  | "sale"
  | "payrollManagement"
  | "parking"
  | "parkingFee"
  | "parkingShare"
  | "parkingTax"
  | "parkingSetup"
  | "depositKept"
  | "importIncome"
  | "purchase"
  | "inventory"
  | "wages"
  | "overheadWages"
  | "overheadStock"
  | "thr"
  | "pettyCashTopUp"
  | "prepaidCardTopUp"
  | "prepaidVehicleCardTopUp"
  | "prepaidOpenCardTopUp"
  | "prepaidCardReplacementFee"
  | "prepaidCardReturn"
  | "transferFee"
  | "incident"
  | "depositReturned"
  | "importExpense"
  | "payrollAdjustment"
  | "loanDraw"
  | "loanReturn"
  | "cashWithdraw"
  | "receivable"
  | "payable";

export type FinancialReportPdfLine = {
  date: Date | null;
  source: FinancialReportSource;
  detail: string;
  amount: number;
};

export type FinancialReportPdfInput = {
  periodLabel: string;
  periodNet: number;
  moneyIn: number;
  moneyOut: number;
  pnl: FinancialReportPnlStairs;
  tree: FinancialReportPnlSubcategoryGroup[];
  arUnpaid: number;
  apUnpaid: number;
  cashAtHand: number;
  moneyInLines: FinancialReportPdfLine[];
  moneyOutLines: FinancialReportPdfLine[];
  fundingLines: FinancialReportPdfLine[];
  arLines: FinancialReportPdfLine[];
  apLines: FinancialReportPdfLine[];
  company?: CompanyForPdf | null;
  locale?: AppLocale;
};

type PdfDoc = InstanceType<typeof PDFDocument>;

const COLS = {
  date: { x: 0, w: 78 },
  source: { x: 78, w: 128 },
  detail: { x: 206, w: 176 },
  amount: { x: 382, w: CONTENT_WIDTH - 382 },
} as const;

const PURCHASE_SELECT = {
  id: true,
  paidAt: true,
  supplierName: true,
  invoiceRef: true,
  purpose: true,
  amount: true,
  purchaseCategory: true,
  vehicleExpenseKind: true,
  vehiclePlate: true,
  vehicleOtherCostDescription: true,
  isVehicleLease: true,
  leaseTenorMonths: true,
  vehicleAssetId: true,
  lines: { select: { item: { select: { name: true } } }, take: 1 },
  vehicleAsset: {
    select: {
      assetCode: true,
      leaseTenorMonths: true,
      isVehicleLease: true,
      item: { select: { name: true } },
    },
  },
  governmentTaxKind: true,
  governmentOperatingAmount: true,
  origin: true,
  includesPpn: true,
  ppnRatePercent: true,
  importPpnAmountIdr: true,
  importValueIdr: true,
  pph22AmountIdr: true,
  transferFeeIdr: true,
  loanInterestAmount: true,
  loanPenaltyAmount: true,
  loanAdminFeeAmount: true,
  loanProvisionAmount: true,
  project: { select: { name: true } },
  prepaidCard: { select: { cardNumber: true, kind: true } },
  employee: { select: { firstName: true, lastName: true } },
  paidWithCash: true,
} as const;

function inUtcRange(
  date: Date | null | undefined,
  from?: Date,
  toExclusive?: Date
): boolean {
  if (!date) return false;
  if (from && date.getTime() < from.getTime()) return false;
  if (toExclusive && date.getTime() >= toExclusive.getTime()) return false;
  return true;
}

function sortLines(rows: FinancialReportPdfLine[]) {
  return [...rows].sort((left, right) => {
    const leftTime = left.date?.getTime() ?? 0;
    const rightTime = right.date?.getTime() ?? 0;
    if (leftTime !== rightTime) return leftTime - rightTime;
    return left.detail.localeCompare(right.detail);
  });
}

function joinDetail(...parts: Array<string | null | undefined>) {
  return parts.map((part) => part?.trim()).filter(Boolean).join(" · ") || "—";
}

function purchaseAmount(invoice: {
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
}) {
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

function purchaseLineSource(invoice: {
  purpose?: string | null;
  purchaseCategory?: string | null;
  supplierName?: string | null;
  invoiceRef?: string | null;
  prepaidCard?: { kind?: string | null } | null;
}): FinancialReportSource {
  if (isPrepaidCardReplacementFeeInvoice(invoice)) {
    return "prepaidCardReplacementFee";
  }
  if (isPrepaidOpenCardTopUpInvoice(invoice)) return "prepaidOpenCardTopUp";
  if (isPrepaidCardTopUpInvoice(invoice)) return "prepaidVehicleCardTopUp";
  if (isPettyCashTopUpInvoice(invoice)) return "pettyCashTopUp";
  return "purchase";
}

function pushPurchaseLines(
  target: FinancialReportPdfLine[],
  invoices: Array<{
    id?: string;
    paidAt: Date | null;
    supplierName: string;
    invoiceRef: string | null;
    purpose?: string | null;
    purchaseCategory?: string | null;
    vehicleExpenseKind?: string | null;
    vehiclePlate?: string | null;
    vehicleOtherCostDescription?: string | null;
    isVehicleLease?: boolean;
    leaseTenorMonths?: number | null;
    vehicleAssetId?: string | null;
    lines?: Array<{ item: { name: string } | null }>;
    vehicleAsset?: {
      assetCode: string;
      leaseTenorMonths: number | null;
      isVehicleLease: boolean;
      item: { name: string } | null;
    } | null;
    project: { name: string } | null;
    prepaidCard?: { cardNumber: string; kind: string } | null;
    employee?: { firstName: string; lastName: string } | null;
    paidWithCash?: boolean;
  } & Parameters<typeof purchaseAmount>[0]>,
  options?: {
    locale?: AppLocale;
    leaseRanks?: Map<string, number>;
  }
) {
  const locale = options?.locale ?? DEFAULT_LOCALE;
  for (const invoice of invoices) {
    if (isCapitalVehicleExpenseKind(invoice.vehicleExpenseKind)) continue;
    const amount = purchaseAmount(invoice);
    if (amount === 0) continue;
    const source = purchaseLineSource(invoice);
    const cardNumber = invoice.prepaidCard?.cardNumber
      ? formatPrepaidCardNumber(invoice.prepaidCard.cardNumber)
      : null;
    const holderName = invoice.employee
      ? formatEmployeeName(invoice.employee)
      : null;
    const plate =
      invoice.vehicleAsset?.assetCode ?? invoice.vehiclePlate ?? "";
    const vehicleName =
      invoice.vehicleAsset?.item?.name ??
      invoice.lines?.[0]?.item?.name ??
      "";
    const vehicleDetail =
      invoice.purchaseCategory === "VEHICLE" && (plate || vehicleName)
        ? vehicleExpenseNarrative({
            locale,
            kind: invoice.vehicleExpenseKind,
            isLease:
              invoice.isVehicleLease ||
              invoice.vehicleAsset?.isVehicleLease === true,
            vehicleName,
            plate,
            otherDescription: invoice.vehicleOtherCostDescription,
            installmentNumber: invoice.id
              ? options?.leaseRanks?.get(invoice.id) ?? null
              : null,
            tenorMonths:
              invoice.leaseTenorMonths ??
              invoice.vehicleAsset?.leaseTenorMonths ??
              null,
          })
        : null;
    const cashLabel = invoice.paidWithCash
      ? translate(locale, "pages.financialReport.filterBankCash")
      : null;
    target.push({
      date: invoice.paidAt,
      source,
      detail:
        source === "prepaidVehicleCardTopUp" ||
        source === "prepaidOpenCardTopUp" ||
        source === "prepaidCardReplacementFee"
          ? joinDetail(cardNumber, invoice.invoiceRef)
          : source === "pettyCashTopUp"
            ? joinDetail(holderName, invoice.invoiceRef)
            : vehicleDetail
              ? joinDetail(vehicleDetail, invoice.invoiceRef, cashLabel)
              : joinDetail(
                  invoice.supplierName,
                  invoice.invoiceRef,
                  invoice.project?.name,
                  cashLabel
                ),
      amount,
    });
  }
}

async function listParkingLines(
  companyId: string,
  from: Date,
  toExclusive: Date,
  bank: string
): Promise<{ moneyIn: FinancialReportPdfLine[]; moneyOut: FinancialReportPdfLine[] }> {
  const [projects, logs] = await Promise.all([
    prisma.project.findMany({
      where: { companyId, subCategory: "PARKING" },
      select: {
        id: true,
        name: true,
        startDate: true,
        createdAt: true,
        endDate: true,
        setupCost: true,
        profitSharePercent: true,
        monthlyClientFee: true,
        memberParkingUnitFee: true,
        memberParkingUnitCount: true,
        parkingTaxPercent: true,
        client: { select: { name: true } },
      },
    }),
    prisma.parkingMonthlyLog.findMany({
      where: { project: { companyId, subCategory: "PARKING" } },
      select: {
        year: true,
        month: true,
        revenueAmount: true,
        creditedAt: true,
        bankAccountId: true,
        projectId: true,
      },
    }),
  ]);

  const moneyIn: FinancialReportPdfLine[] = [];
  const moneyOut: FinancialReportPdfLine[] = [];
  for (const project of projects) {
    const deal = parkingDealFromProject(project);
    const projectLabel = joinDetail(project.client?.name, project.name);
    for (const log of logs.filter((row) => row.projectId === project.id)) {
      if (!matchesBankAccount(log.bankAccountId, bank)) continue;
      const credited = parkingLogCreditDate(log);
      if (!credited) continue;
      if (!inUtcRange(credited, from, toExclusive)) continue;
      const casual = decimalToNumber(log.revenueAmount) ?? 0;
      const memberRevenue = parkingMemberRevenue(deal);
      const revenue = casual + memberRevenue;
      const period = parkingPeriodKey(log.year, log.month);
      if (revenue !== 0) {
        moneyIn.push({
          date: credited,
          source: "parking",
          detail: joinDetail(
            projectLabel,
            `Parking Income For ${period}`,
            `Credited ${formatDisplayDate(credited)}`
          ),
          amount: revenue,
        });
      }
    }
    for (const log of logs.filter((row) => row.projectId === project.id)) {
      if (!log.creditedAt) continue;
      if (!matchesBankAccount(log.bankAccountId, bank)) continue;
      const credited = log.creditedAt;
      if (!inUtcRange(credited, from, toExclusive)) continue;
      const casual = decimalToNumber(log.revenueAmount) ?? 0;
      const period = parkingPeriodKey(log.year, log.month);
      if (deal.monthlyClientFee > 0) {
        moneyOut.push({
          date: credited,
          source: "parkingFee",
          detail: joinDetail(projectLabel, period),
          amount: deal.monthlyClientFee,
        });
      }
      if (deal.profitSharePercent > 0 && casual > 0) {
        moneyOut.push({
          date: credited,
          source: "parkingShare",
          detail: joinDetail(projectLabel, period),
          amount: Math.round((casual * deal.profitSharePercent) / 100),
        });
      }
      if (deal.parkingTaxPercent > 0 && casual > 0) {
        moneyOut.push({
          date: credited,
          source: "parkingTax",
          detail: joinDetail(projectLabel, period),
          amount: Math.round((casual * deal.parkingTaxPercent) / 100),
        });
      }
      if (deal.setupCost > 0 && isSetupMonth(project, log.year, log.month)) {
        moneyOut.push({
          date: credited,
          source: "parkingSetup",
          detail: joinDetail(projectLabel, period),
          amount: deal.setupCost,
        });
      }
    }
  }
  return { moneyIn, moneyOut };
}

export async function loadFinancialReportPdfData(
  companyId: string,
  selection: FinancialReportSelection,
  locale: AppLocale
): Promise<Omit<FinancialReportPdfInput, "company" | "locale" | "periodLabel">> {
  const calendar = financialReportCalendarRange(selection);
  const wage = financialReportWageRange(selection);
  const bank = selection.bank ?? FINANCIAL_REPORT_ALL_BANKS;
  const allBanks = bank === FINANCIAL_REPORT_ALL_BANKS;
  const calendarPaidAt = prismaDateFilter(calendar.from, calendar.toExclusive);
  const calendarMovedAt = prismaDateFilter(calendar.from, calendar.toExclusive);
  const liveIncome = await liveInvoiceIncomeWhereFor(companyId);
  // Deductions and overtime follow the wage gate: locked runs, payable in range.
  const lockedRuns = await listLockedPayrollRunsInRange({
    companyId,
    from: calendar.from,
    toExclusive: calendar.toExclusive,
  });

  const [
    overview,
    paidInvoices,
    sales,
    payrollPeriods,
    parking,
    keptDeposits,
    importFx,
    projectPurchases,
    internalPurchases,
    inventoryIssues,
    internalStock,
    wages,
    thrPaid,
    incidents,
    linkedExpensePurchases,
    payrollAdj,
    loanMoves,
    arPeriods,
    apInvoices,
    pettyCashPurchases,
    prepaidReturns,
  ] = await Promise.all([
    getFinancialReportOverviewData(companyId, selection),
    prisma.projectInvoicePeriod.findMany({
      where: {
        status: "PAID",
        ...liveIncome,
        project: { companyId, subCategory: { not: "INTERNAL" } },
        ...bankAccountWhere(bank),
        ...(calendarPaidAt ? { paidAt: calendarPaidAt } : {}),
      },
      select: {
        paidAt: true,
        label: true,
        amount: true,
        revisedInvoiceAmount: true,
        ppnRatePercent: true,
        project: { select: { name: true, client: { select: { name: true } } } },
      },
      orderBy: [{ paidAt: "asc" }],
    }),
    // Sold-off income lands on the paid date; an unpaid sale is not income yet.
    prisma.inventorySale.findMany({
      where: {
        companyId,
        movement: { voidedAt: null },
        ...bankAccountWhere(bank),
        paidAt: {
          not: null,
          ...(calendar.from ? { gte: calendar.from } : {}),
          ...(calendar.toExclusive ? { lt: calendar.toExclusive } : {}),
        },
      },
      select: {
        soldAt: true,
        paidAt: true,
        totalPrice: true,
        subtotal: true,
        taxAmount: true,
        buyer: true,
        item: { select: { name: true } },
      },
      orderBy: [{ paidAt: "asc" }],
    }),
    allBanks
      ? prisma.payrollManagementPeriod.findMany({
          where: { project: { companyId } },
          select: {
            year: true,
            month: true,
            status: true,
            pdfLocked: true,
            wagesTotal: true,
            feeAmount: true,
            taxAmount: true,
            clientBillAmount: true,
            wagesPaidAt: true,
            reimbursedAt: true,
            invoicePeriod: { select: { status: true, paidAt: true } },
            project: {
              select: { name: true, client: { select: { name: true } } },
            },
          },
        })
      : Promise.resolve([]),
    listParkingLines(companyId, calendar.from, calendar.toExclusive, bank),
    allBanks
      ? prisma.employee.findMany({
          where: { companyId, depositStatus: "KEPT_BY_COMPANY" },
          select: {
            firstName: true,
            lastName: true,
            employeeNo: true,
            depositHeldAmount: true,
            lastWorkingDay: true,
            resignedAt: true,
            depositSourceProjectId: true,
          },
        })
      : Promise.resolve([]),
    prisma.purchaseInvoice.findMany({
      where: {
        companyId,
        origin: "IMPORT",
        reversedAt: null,
        ...purchaseBankAccountWhere(bank),
        paidAt: {
          not: null,
          ...(calendar.from ? { gte: calendar.from } : {}),
          ...(calendar.toExclusive ? { lt: calendar.toExclusive } : {}),
        },
        importFxDifferenceIdr: { not: null },
      },
      select: {
        supplierName: true,
        invoiceRef: true,
        paidAt: true,
        importFxDifferenceIdr: true,
      },
      orderBy: { paidAt: "asc" },
    }),
    prisma.purchaseInvoice.findMany({
      where: {
        companyId,
        purpose: "PROJECT",
        purchaseCategory: { not: "VEHICLE" },
        reversedAt: null,
        ...purchaseBankAccountWhere(bank),
        paidAt: {
          not: null,
          ...(calendar.from ? { gte: calendar.from } : {}),
          ...(calendar.toExclusive ? { lt: calendar.toExclusive } : {}),
        },
      },
      select: PURCHASE_SELECT,
      orderBy: { paidAt: "asc" },
    }),
    prisma.purchaseInvoice.findMany({
      where: {
        companyId,
        purpose: "INTERNAL",
        purchaseCategory: { not: "VEHICLE" },
        reversedAt: null,
        ...purchaseBankAccountWhere(bank),
        paidAt: {
          not: null,
          ...(calendar.from ? { gte: calendar.from } : {}),
          ...(calendar.toExclusive ? { lt: calendar.toExclusive } : {}),
        },
      },
      select: PURCHASE_SELECT,
      orderBy: { paidAt: "asc" },
    }),
    allBanks
      ? prisma.inventoryMovement.findMany({
      where: {
        companyId,
        type: "ISSUE_TO_PROJECT",
        voidedAt: null,
        project: { subCategory: { not: "INTERNAL" } },
        ...excludeEquipmentFromProjectInventoryCost,
        ...(calendarMovedAt ? { movedAt: calendarMovedAt } : {}),
      },
      select: {
        movedAt: true,
        totalCost: true,
        quantity: true,
        item: { select: { name: true } },
        project: { select: { name: true } },
      },
      orderBy: { movedAt: "asc" },
    })
      : Promise.resolve([]),
    allBanks
      ? prisma.inventoryMovement.findMany({
      where: {
        companyId,
        type: "ISSUE_TO_PROJECT",
        voidedAt: null,
        project: { subCategory: "INTERNAL" },
        ...excludeEquipmentFromProjectInventoryCost,
        ...(calendarMovedAt ? { movedAt: calendarMovedAt } : {}),
      },
      select: {
        movedAt: true,
        totalCost: true,
        item: { select: { name: true } },
        project: { select: { name: true } },
      },
      orderBy: { movedAt: "asc" },
    })
      : Promise.resolve([]),
    allocateLockedCompanyWages({
      companyId,
      from: calendar.from,
      toExclusive: calendar.toExclusive,
      bank,
    }),
    allBanks
      ? prisma.thrPayment.findMany({
      where: {
        companyId,
        status: "PAID",
        paidAt: {
          not: null,
          ...(calendar.from ? { gte: calendar.from } : {}),
          ...(calendar.toExclusive ? { lt: calendar.toExclusive } : {}),
        },
      },
      select: {
        paidAt: true,
        amount: true,
        year: true,
        employee: { select: { firstName: true, lastName: true, employeeNo: true } },
      },
      orderBy: { paidAt: "asc" },
    })
      : Promise.resolve([]),
    prisma.projectExpense.findMany({
      where: {
        ...LIVE_PROJECT_EXPENSE_WHERE,
        companyId,
        ...(calendarMovedAt ? { incurredAt: calendarMovedAt } : {}),
        ...bankAccountWhere(bank),
      },
      select: {
        incurredAt: true,
        amount: true,
        reason: true,
        project: { select: { name: true } },
      },
      orderBy: { incurredAt: "asc" },
    }),
    prisma.purchaseInvoice.findMany({
      where: {
        companyId,
        purchaseCategory: "VEHICLE",
        reversedAt: null,
        ...purchaseBankAccountWhere(bank),
        paidAt: {
          not: null,
          ...(calendar.from ? { gte: calendar.from } : {}),
          ...(calendar.toExclusive ? { lt: calendar.toExclusive } : {}),
        },
      },
      select: PURCHASE_SELECT,
      orderBy: { paidAt: "asc" },
    }),
    allBanks && lockedRuns.length > 0
      ? prisma.payrollDeduction.findMany({
      where: {
        companyId,
        type: { not: "SECURITY_DEPOSIT" },
        OR: lockedRuns.map((lock) => ({
          year: lock.year,
          month: lock.month,
          run: lock.run,
        })),
      },
      select: {
        type: true,
        amount: true,
        year: true,
        month: true,
        reason: true,
        employee: { select: { firstName: true, lastName: true, employeeNo: true } },
        project: { select: { name: true } },
      },
      orderBy: [{ year: "asc" }, { month: "asc" }],
    })
      : Promise.resolve([]),
    prisma.loanMovement.findMany({
      where: {
        facility: { companyId },
        reversedAt: null,
        ...(calendarMovedAt ? { movementDate: calendarMovedAt } : {}),
        ...(allBanks ? {} : bankAccountWhere(bank)),
      },
      select: {
        kind: true,
        movementDate: true,
        amount: true,
        principalAmount: true,
        facility: { select: { name: true, lenderName: true } },
      },
      orderBy: { movementDate: "asc" },
    }),
    prisma.projectInvoicePeriod.findMany({
      where: {
        project: { companyId, subCategory: { not: "INTERNAL" } },
        status: { in: [...OUTSTANDING_INVOICE_STATUSES] },
      },
      select: {
        dueAt: true,
        label: true,
        amount: true,
        revisedInvoiceAmount: true,
        project: { select: { name: true, client: { select: { name: true } } } },
      },
      orderBy: [{ dueAt: "asc" }],
    }),
    prisma.purchaseInvoice.findMany({
      where: {
        companyId,
        paidAt: null,
        reversedAt: null,
        freeOfCharge: false,
        purpose: { not: "PETTY_CASH" },
        purchaseCategory: { notIn: ["GOVERNMENT", "BANK_LOAN"] },
      },
      select: {
        invoiceDate: true,
        supplierName: true,
        invoiceRef: true,
        amount: true,
      },
      orderBy: [{ invoiceDate: "asc" }],
    }),
    prisma.purchaseInvoice.findMany({
      where: {
        companyId,
        purpose: "PETTY_CASH",
        reversedAt: null,
        ...purchaseBankAccountWhere(bank),
        paidAt: {
          not: null,
          ...(calendar.from ? { gte: calendar.from } : {}),
          ...(calendar.toExclusive ? { lt: calendar.toExclusive } : {}),
        },
      },
      select: PURCHASE_SELECT,
      orderBy: { paidAt: "asc" },
    }),
    prisma.prepaidCardLossRecovery.findMany({
      where: {
        loss: { companyId },
        source: "PAY_NOW",
        ...bankAccountWhere(bank),
        recoveredAt: {
          ...(calendar.from ? { gte: calendar.from } : {}),
          ...(calendar.toExclusive ? { lt: calendar.toExclusive } : {}),
        },
      },
      select: {
        recoveredAt: true,
        amount: true,
        description: true,
        loss: {
          select: {
            prepaidCard: { select: { cardNumber: true } },
          },
        },
      },
      orderBy: { recoveredAt: "asc" },
    }),
  ]);

  const leaseHistory = await prisma.purchaseInvoice.findMany({
    where: {
      companyId,
      vehicleExpenseKind: "LEASE_PAYMENT",
      reversedAt: null,
    },
    select: {
      id: true,
      invoiceDate: true,
      vehicleAssetId: true,
      vehiclePlate: true,
    },
    orderBy: [{ invoiceDate: "asc" }, { id: "asc" }],
  });
  const leaseRanks = rankLeasePaymentsByVehicle(leaseHistory);
  const purchaseLineOptions = { locale, leaseRanks };

  const moneyInLines: FinancialReportPdfLine[] = [];
  const moneyOutLines: FinancialReportPdfLine[] = [];
  const fundingLines: FinancialReportPdfLine[] = [];

  for (const period of paidInvoices) {
    const amount = recognizedIncomeAmount({
      amount: period.amount,
      revisedInvoiceAmount: period.revisedInvoiceAmount,
      ppnRatePercent: period.ppnRatePercent,
    });
    if (amount === 0) continue;
    moneyInLines.push({
      date: period.paidAt,
      source: "paidInvoice",
      detail: joinDetail(
        period.project.client?.name,
        period.project.name,
        period.label
      ),
      amount,
    });
  }

  for (const sale of sales) {
    const amount = soldOffIncomeAmount(sale);
    if (amount === 0) continue;
    moneyInLines.push({
      date: sale.paidAt ?? sale.soldAt,
      source: "sale",
      detail: joinDetail(sale.item.name, sale.buyer),
      amount,
    });
  }

  for (const period of payrollPeriods) {
    const wagesTotal = decimalToNumber(period.wagesTotal) ?? 0;
    const fee = decimalToNumber(period.feeAmount) ?? 0;
    const tax = decimalToNumber(period.taxAmount) ?? 0;
    const clientBill = decimalToNumber(period.clientBillAmount) ?? 0;
    const label = joinDetail(
      period.project.client?.name,
      period.project.name,
      `${period.year}-${String(period.month).padStart(2, "0")}`
    );
    // Wages book only once the sheet is locked, same rule as Internal Payroll.
    if (
      period.pdfLocked &&
      period.wagesPaidAt &&
      inUtcRange(period.wagesPaidAt, calendar.from, calendar.toExclusive)
    ) {
      moneyOutLines.push({
        date: period.wagesPaidAt,
        source: "payrollManagement",
        detail: label,
        amount: wagesTotal,
      });
    }
    const paidAt = period.invoicePeriod?.paidAt ?? period.reimbursedAt;
    const paid =
      period.invoicePeriod?.status === "PAID" || period.status === "REIMBURSED";
    if (paid && paidAt && inUtcRange(paidAt, calendar.from, calendar.toExclusive)) {
      moneyInLines.push({
        date: paidAt,
        source: "payrollManagement",
        detail: label,
        amount: Math.max(0, (clientBill || wagesTotal + fee + tax) - tax),
      });
    }
  }

  moneyInLines.push(...parking.moneyIn);
  moneyOutLines.push(...parking.moneyOut);

  for (const row of keptDeposits) {
    if (row.depositSourceProjectId) continue;
    const when = row.lastWorkingDay ?? row.resignedAt;
    if (!inUtcRange(when, wage.from, wage.toExclusive)) continue;
    const amount = decimalToNumber(row.depositHeldAmount) ?? 0;
    if (amount === 0) continue;
    moneyInLines.push({
      date: when,
      source: "depositKept",
      detail: joinDetail(formatEmployeeName(row), row.employeeNo),
      amount,
    });
  }

  for (const row of prepaidReturns) {
    const amount = decimalToNumber(row.amount) ?? 0;
    if (amount === 0) continue;
    moneyInLines.push({
      date: row.recoveredAt,
      source: "prepaidCardReturn",
      detail: joinDetail(
        formatPrepaidCardNumber(row.loss.prepaidCard.cardNumber),
        row.description
      ),
      amount,
    });
  }

  for (const invoice of importFx) {
    const value = decimalToNumber(invoice.importFxDifferenceIdr) ?? 0;
    if (value === 0) continue;
    const line: FinancialReportPdfLine = {
      date: invoice.paidAt,
      source: value > 0 ? "importExpense" : "importIncome",
      detail: joinDetail(invoice.supplierName, invoice.invoiceRef),
      amount: Math.abs(value),
    };
    if (value > 0) moneyOutLines.push(line);
    else moneyInLines.push(line);
  }

  pushPurchaseLines(moneyOutLines, projectPurchases, purchaseLineOptions);
  pushPurchaseLines(moneyOutLines, internalPurchases, purchaseLineOptions);
  pushPurchaseLines(moneyOutLines, linkedExpensePurchases, purchaseLineOptions);
  pushPurchaseLines(moneyOutLines, pettyCashPurchases, purchaseLineOptions);

  for (const row of inventoryIssues) {
    const amount = decimalToNumber(row.totalCost) ?? 0;
    if (amount === 0) continue;
    moneyOutLines.push({
      date: row.movedAt,
      source: "inventory",
      detail: joinDetail(row.item.name, row.project?.name),
      amount,
    });
  }

  for (const row of internalStock) {
    const amount = decimalToNumber(row.totalCost) ?? 0;
    if (amount === 0) continue;
    moneyOutLines.push({
      date: row.movedAt,
      source: "overheadStock",
      detail: joinDetail(row.item.name, row.project?.name),
      amount,
    });
  }

  const wageProjectIds = [...wages.keys()].filter(
    (key) => key !== OVERHEAD_WAGE_BUCKET
  );
  const wageProjects =
    wageProjectIds.length === 0
      ? []
      : await prisma.project.findMany({
          where: { id: { in: wageProjectIds } },
          select: { id: true, name: true, client: { select: { name: true } } },
        });
  const wageProjectName = new Map(
    wageProjects.map((project) => [
      project.id,
      joinDetail(project.client?.name, project.name),
    ])
  );
  // Internal sites keep their own line, but the cost is Head Office overhead.
  const internalSiteKeys = await listInternalWageSiteKeys(companyId);
  for (const [site, rows] of wages) {
    const isStandby = site === OVERHEAD_WAGE_BUCKET;
    const source: FinancialReportSource =
      isStandby || internalSiteKeys.has(site) ? "overheadWages" : "wages";
    const siteLabel = isStandby
      ? translate(locale, "pages.financialReport.detail.overheadWages")
      : wageProjectName.get(site);
    for (const row of rows) {
      if (row.wageCost === 0) continue;
      moneyOutLines.push({
        date: null,
        source,
        detail: joinDetail(
          row.name,
          row.employeeNo,
          siteLabel,
          `${row.daysWorked}`
        ),
        amount: row.wageCost,
      });
    }
  }

  for (const row of thrPaid) {
    const amount = decimalToNumber(row.amount) ?? 0;
    if (amount === 0) continue;
    moneyOutLines.push({
      date: row.paidAt,
      source: "thr",
      detail: joinDetail(
        formatEmployeeName(row.employee),
        row.employee.employeeNo,
        String(row.year)
      ),
      amount,
    });
  }

  for (const row of incidents) {
    const amount = decimalToNumber(row.amount) ?? 0;
    if (amount === 0) continue;
    moneyOutLines.push({
      date: row.incurredAt,
      source: "incident",
      detail: joinDetail(row.project.name, row.reason),
      amount,
    });
  }

  for (const row of payrollAdj) {
    const raw = decimalToNumber(row.amount) ?? 0;
    const amount = isPayrollPayableType(row.type) ? raw : -raw;
    if (amount === 0) continue;
    moneyOutLines.push({
      date: new Date(Date.UTC(row.year, row.month - 1, 1)),
      source:
        row.type === "RETURN_OF_SECURITY_DEPOSIT"
          ? "depositReturned"
          : "payrollAdjustment",
      detail: joinDetail(
        formatEmployeeName(row.employee),
        row.employee.employeeNo,
        translate(locale, PAYROLL_DEDUCTION_LABEL_KEY[row.type]),
        row.project?.name,
        row.reason
      ),
      amount,
    });
  }

  for (const row of loanMoves) {
    if (row.kind === "DRAW") {
      const amount = decimalToNumber(row.amount) ?? 0;
      if (amount === 0) continue;
      fundingLines.push({
        date: row.movementDate,
        source: "loanDraw",
        detail: joinDetail(row.facility.name, row.facility.lenderName),
        amount,
      });
      continue;
    }
    const amount = decimalToNumber(row.principalAmount) ?? decimalToNumber(row.amount) ?? 0;
    if (amount === 0) continue;
    fundingLines.push({
      date: row.movementDate,
      source: "loanReturn",
      detail: joinDetail(row.facility.name, row.facility.lenderName),
      amount,
    });
  }

  const arLines: FinancialReportPdfLine[] = arPeriods.map((period) => ({
    date: period.dueAt,
    source: "receivable",
    detail: joinDetail(
      period.project.client?.name,
      period.project.name,
      period.label
    ),
    amount: commercialPeriodGross({
      amount: period.amount,
      revisedInvoiceAmount: period.revisedInvoiceAmount,
    }),
  }));

  const apLines: FinancialReportPdfLine[] = apInvoices.map((invoice) => ({
    date: invoice.invoiceDate,
    source: "payable",
    detail: joinDetail(invoice.supplierName, invoice.invoiceRef),
    amount: decimalToNumber(invoice.amount) ?? 0,
  }));

  return {
    periodNet: overview.pnl.netProfit,
    moneyIn: overview.period.moneyIn,
    moneyOut: overview.period.moneyOut,
    pnl: overview.pnl,
    tree: [],
    arUnpaid: overview.clientsOwe.unpaid,
    apUnpaid: overview.vendorsOwe.unpaid,
    cashAtHand: overview.cashAtHand,
    moneyInLines: sortLines(moneyInLines.filter((row) => row.amount !== 0)),
    moneyOutLines: sortLines(moneyOutLines.filter((row) => row.amount !== 0)),
    fundingLines: sortLines(fundingLines.filter((row) => row.amount !== 0)),
    arLines: sortLines(arLines.filter((row) => row.amount !== 0)),
    apLines: sortLines(apLines.filter((row) => row.amount !== 0)),
  };
}

function sourceLabel(locale: AppLocale, source: FinancialReportSource) {
  return translate(locale, `pages.financialReport.reportSources.${source}`);
}

function drawTitleBlock(
  doc: PdfDoc,
  input: FinancialReportPdfInput,
  titleY: number
) {
  const locale = input.locale ?? DEFAULT_LOCALE;
  doc
    .font("Helvetica-Bold")
    .fontSize(16)
    .fillColor(BRAND.ink)
    .text(translate(locale, "pages.financialReport.title"), PAGE_MARGIN, titleY, {
      width: CONTENT_WIDTH,
    });
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(BRAND.body)
    .text(input.periodLabel, PAGE_MARGIN, doc.y + 4, {
      width: CONTENT_WIDTH,
    });
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(BRAND.muted)
    .text(translate(locale, "pages.financialReport.reportHint"), PAGE_MARGIN, doc.y + 2, {
      width: CONTENT_WIDTH,
    });
  doc.moveDown(1);
}

function ensureSpace(doc: PdfDoc, needed: number, onNewPage?: () => void) {
  if (doc.y + needed <= BOTTOM_SAFE) return;
  doc.addPage();
  onNewPage?.();
}

function drawSummary(doc: PdfDoc, input: FinancialReportPdfInput) {
  const locale = input.locale ?? DEFAULT_LOCALE;
  const pnl = input.pnl ?? emptyFinancialReportPnlStairs();
  const lines: Array<[string, number, boolean]> = [
    [translate(locale, "pages.financialReport.pnlRevenue"), pnl.revenue, false],
    [translate(locale, "pages.financialReport.pnlCostOfSales"), pnl.costOfSales, false],
    [translate(locale, "pages.financialReport.pnlGrossProfit"), pnl.grossProfit, true],
    [translate(locale, "pages.financialReport.pnlOtherIncome"), pnl.otherIncome, false],
    [translate(locale, "pages.financialReport.pnlHeadOffice"), pnl.headOffice, false],
    [translate(locale, "pages.financialReport.pnlOperatingProfit"), pnl.operatingProfit, true],
    [translate(locale, "pages.financialReport.pnlFinanceCosts"), pnl.financeCosts, false],
    [translate(locale, "pages.financialReport.pnlProfitBeforeTax"), pnl.profitBeforeTax, true],
    [
      pnl.incomeTaxRatePercent != null
        ? translate(locale, "pages.financialReport.pnlIncomeTax", {
            percent: pnl.incomeTaxRatePercent,
          })
        : translate(locale, "pages.financialReport.pnlIncomeTaxMixed"),
      pnl.incomeTax,
      false,
    ],
    [translate(locale, "pages.financialReport.pnlNetProfit"), pnl.netProfit, true],
    [translate(locale, "pages.financialReport.clientsStillOwe"), input.arUnpaid, false],
    [translate(locale, "pages.financialReport.weStillOweVendors"), input.apUnpaid, false],
    [translate(locale, "pages.financialReport.cashAtHand"), input.cashAtHand, false],
  ];

  for (const [label, value, bold] of lines) {
    ensureSpace(doc, SUMMARY_ROW_H);
    const y = doc.y;
    const color = value < 0 ? BRAND.expense : bold ? BRAND.ink : BRAND.body;
    doc
      .font(bold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(9)
      .fillColor(BRAND.body)
      .text(label, PAGE_MARGIN, y, {
        width: CONTENT_WIDTH - 160,
      });
    doc
      .font(bold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(9)
      .fillColor(color)
      .text(formatContractPrice(value), PAGE_MARGIN + CONTENT_WIDTH - 160, y, {
        width: 160,
        align: "right",
      });
    doc.y = y + SUMMARY_ROW_H;
  }
  doc.moveDown(0.6);
}

function drawPnlTree(doc: PdfDoc, input: FinancialReportPdfInput) {
  const locale = input.locale ?? DEFAULT_LOCALE;
  const tree = input.tree ?? [];
  drawSectionTitle(
    doc,
    translate(locale, "pages.financialReport.pnlTreeTitle"),
    translate(locale, "pages.financialReport.pnlTreeHint")
  );
  if (tree.length === 0) {
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(BRAND.body)
      .text(translate(locale, "pages.financialReport.pnlEmptyTree"), PAGE_MARGIN, doc.y, {
        width: CONTENT_WIDTH,
      });
    doc.moveDown(1);
    return;
  }

  const colW = {
    label: CONTENT_WIDTH - 240,
    rev: 80,
    cos: 80,
    gp: 80,
  };

  const drawCols = (
    label: string,
    revenue: number,
    costOfSales: number,
    grossProfit: number,
    opts: { indent?: number; bold?: boolean; header?: boolean }
  ) => {
    ensureSpace(doc, 16);
    const y = doc.y;
    const indent = opts.indent ?? 0;
    doc
      .font(opts.bold || opts.header ? "Helvetica-Bold" : "Helvetica")
      .fontSize(opts.header ? 9 : 8)
      .fillColor(opts.header ? BRAND.ink : BRAND.body)
      .text(label, PAGE_MARGIN + indent, y, {
        width: colW.label - indent,
        lineBreak: false,
        ellipsis: true,
      });
    if (!opts.header) {
      const amounts = [
        { x: PAGE_MARGIN + colW.label, v: revenue },
        { x: PAGE_MARGIN + colW.label + colW.rev, v: costOfSales },
        { x: PAGE_MARGIN + colW.label + colW.rev + colW.cos, v: grossProfit },
      ];
      for (const cell of amounts) {
        doc
          .fillColor(cell.v < 0 ? BRAND.expense : BRAND.ink)
          .text(formatContractPrice(cell.v), cell.x, y, {
            width: 80,
            align: "right",
            lineBreak: false,
          });
      }
    } else {
      const headers = [
        { x: PAGE_MARGIN + colW.label, t: translate(locale, "pages.financialReport.pnlRevenue") },
        {
          x: PAGE_MARGIN + colW.label + colW.rev,
          t: translate(locale, "pages.financialReport.pnlCostOfSales"),
        },
        {
          x: PAGE_MARGIN + colW.label + colW.rev + colW.cos,
          t: translate(locale, "pages.financialReport.pnlGrossProfit"),
        },
      ];
      for (const cell of headers) {
        doc.text(cell.t, cell.x, y, {
          width: 80,
          align: "right",
          lineBreak: false,
        });
      }
    }
    doc.y = y + 16;
  };

  drawCols("", 0, 0, 0, { header: true });
  for (const group of tree) {
    drawCols(financialReportPnlGroupTitle(group.key, locale), group.revenue, group.costOfSales, group.grossProfit, {
      bold: true,
    });
    for (const client of group.clients) {
      drawCols(client.name, client.revenue, client.costOfSales, client.grossProfit, {
        indent: 10,
        bold: true,
      });
      for (const project of client.projects) {
        drawCols(project.name, project.revenue, project.costOfSales, project.grossProfit, {
          indent: 20,
        });
      }
    }
  }
  doc.moveDown(0.6);
}

function drawSectionTitle(doc: PdfDoc, title: string, hint?: string) {
  ensureSpace(doc, hint ? 42 : 28);
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(BRAND.ink)
    .text(title, PAGE_MARGIN, doc.y, { width: CONTENT_WIDTH });
  if (hint) {
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(BRAND.muted)
      .text(hint, PAGE_MARGIN, doc.y + 2, { width: CONTENT_WIDTH });
  }
  doc.moveDown(0.35);
}

function drawTableHeader(doc: PdfDoc, locale: AppLocale) {
  const y = doc.y;
  doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, HEADER_H).fill(BRAND.tableHeaderBg);
  const labels = [
    { col: COLS.date, text: translate(locale, "pages.financialReport.reportDate") },
    { col: COLS.source, text: translate(locale, "pages.financialReport.reportSource") },
    { col: COLS.detail, text: translate(locale, "pages.financialReport.reportDetail") },
    {
      col: COLS.amount,
      text: translate(locale, "pages.financialReport.reportAmount"),
      align: "right" as const,
    },
  ];
  doc.font("Helvetica-Bold").fontSize(7).fillColor(BRAND.white);
  for (const label of labels) {
    doc.text(label.text, PAGE_MARGIN + label.col.x + 4, y + 8, {
      width: label.col.w - 8,
      lineBreak: false,
      align: label.align,
    });
  }
  doc.y = y + HEADER_H;
}

function drawAmountTable(
  doc: PdfDoc,
  locale: AppLocale,
  rows: FinancialReportPdfLine[],
  emptyKey: string,
  tone: "income" | "expense" | "neutral"
) {
  const bcp47 = localeToBcp47(locale);
  if (rows.length === 0) {
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(BRAND.body)
      .text(translate(locale, emptyKey), PAGE_MARGIN, doc.y, {
        width: CONTENT_WIDTH,
      });
    doc.moveDown(1);
    return;
  }

  drawTableHeader(doc, locale);
  let total = 0;
  rows.forEach((row, index) => {
    ensureSpace(doc, ROW_H, () => drawTableHeader(doc, locale));
    const y = doc.y;
    if (index % 2 === 0) {
      doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, ROW_H).fill(BRAND.panelBg);
    }
    total += row.amount;
    const amountColor =
      tone === "neutral"
        ? BRAND.ink
        : row.amount < 0
          ? tone === "expense"
            ? BRAND.income
            : BRAND.expense
          : tone === "income"
            ? BRAND.income
            : BRAND.expense;
    doc.font("Helvetica").fontSize(8).fillColor(BRAND.ink);
    const cells = [
      {
        col: COLS.date,
        text: row.date
          ? formatDisplayDate(row.date, { timeZone: JAKARTA_TZ }, bcp47)
          : "—",
      },
      { col: COLS.source, text: sourceLabel(locale, row.source) },
      { col: COLS.detail, text: row.detail || "—" },
      {
        col: COLS.amount,
        text: formatContractPrice(row.amount),
        align: "right" as const,
        color: amountColor,
      },
    ];
    for (const cell of cells) {
      doc
        .fillColor("color" in cell && cell.color ? cell.color : BRAND.ink)
        .text(cell.text, PAGE_MARGIN + cell.col.x + 4, y + 6, {
          width: cell.col.w - 8,
          lineBreak: false,
          ellipsis: true,
          align: cell.align,
        });
    }
    doc.y = y + ROW_H;
  });

  ensureSpace(doc, ROW_H + 8);
  const totalY = doc.y + 6;
  const totalColor =
    tone === "income" ? BRAND.income : tone === "expense" ? BRAND.expense : BRAND.ink;
  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(BRAND.ink)
    .text(translate(locale, "pages.financialReport.reportTotal"), PAGE_MARGIN, totalY, {
      width: COLS.amount.x - 8,
    });
  doc
    .fillColor(totalColor)
    .text(formatContractPrice(total), PAGE_MARGIN + COLS.amount.x, totalY, {
      width: COLS.amount.w,
      align: "right",
      lineBreak: false,
    });
  doc.y = totalY + ROW_H;
}

export async function buildFinancialReportPdfBuffer(
  input: FinancialReportPdfInput
): Promise<Buffer> {
  const letterhead = letterheadFromCompany(
    await ensureCompanyForPdf(input.company)
  );
  const logoBuffer = await loadBrandLogoBuffer();
  const locale = input.locale ?? DEFAULT_LOCALE;

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      margin: PAGE_MARGIN,
      size: "A4",
      info: {
        Title: `${translate(locale, "pages.financialReport.title")} — ${input.periodLabel}`,
        Author: letterhead.name,
        Subject: `${letterhead.name} financial report`,
      },
      bufferPages: true,
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const titleY = drawLetterheadHeader(doc, logoBuffer, letterhead);
    drawTitleBlock(doc, input, titleY);
    drawSummary(doc, input);
    drawPnlTree(doc, input);

    drawSectionTitle(doc, translate(locale, "pages.financialReport.moneyIn"));
    drawAmountTable(
      doc,
      locale,
      input.moneyInLines,
      "pages.financialReport.reportEmptyMoneyIn",
      "income"
    );

    drawSectionTitle(doc, translate(locale, "pages.financialReport.moneyOut"));
    drawAmountTable(
      doc,
      locale,
      input.moneyOutLines,
      "pages.financialReport.reportEmptyMoneyOut",
      "expense"
    );

    drawSectionTitle(
      doc,
      translate(locale, "pages.financialReport.reportFunding"),
      translate(locale, "pages.financialReport.reportFundingHint")
    );
    drawAmountTable(
      doc,
      locale,
      input.fundingLines,
      "pages.financialReport.reportEmptyFunding",
      "neutral"
    );

    drawSectionTitle(doc, translate(locale, "pages.financialReport.clientsStillOwe"));
    drawAmountTable(
      doc,
      locale,
      input.arLines,
      "pages.financialReport.reportEmptyAr",
      "income"
    );

    drawSectionTitle(doc, translate(locale, "pages.financialReport.weStillOweVendors"));
    drawAmountTable(
      doc,
      locale,
      input.apLines,
      "pages.financialReport.reportEmptyAp",
      "expense"
    );

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      drawPdfPageFooter(
        doc,
        `${translate(locale, "pages.financialReport.title")}  ·  Page ${i + 1} of ${range.count}`,
        letterhead
      );
    }

    doc.end();
  });
}
