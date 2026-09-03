import type { PayrollDeductionType } from "@prisma/client";
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
} from "@/lib/financial-report";
import { getFinancialReportOverviewData } from "@/lib/financial-report-overview";
import {
  bankAccountWhere,
  FINANCIAL_REPORT_ALL_BANKS,
  financialReportCalendarRange,
  financialReportWageRange,
  prismaDateFilter,
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
  allocateCompanyWages,
  OVERHEAD_WAGE_BUCKET,
} from "@/lib/internal-payroll-wages";
import { payrollPeriodsInUtcRange } from "@/lib/internal-payroll-period";
import { isSetupMonth, parkingDealFromProject } from "@/lib/parking-economics";
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

const DEDUCTION_LABEL: Record<PayrollDeductionType, string> = {
  SECURITY_DEPOSIT: "pages.payroll.deductionTypes.securityDeposit",
  LOST_STOCK: "pages.payroll.deductionTypes.lostStock",
  PENALTY: "pages.payroll.deductionTypes.penalty",
  OTHER: "pages.payroll.deductionTypes.other",
  RETURN_OF_SECURITY_DEPOSIT:
    "pages.payroll.deductionTypes.returnOfSecurityDeposit",
  CLIENT_COMPENSATION: "pages.payroll.deductionTypes.clientCompensation",
  FORFEITED_WAGES: "pages.payroll.deductionTypes.forfeitedWages",
  CASH_ADVANCE: "pages.payroll.deductionTypes.cashAdvance",
  SICK_LEAVE: "pages.payroll.deductionTypes.sickLeave",
  PREPAID_MISUSE: "pages.payroll.deductionTypes.prepaidMisuse",
};

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
  arUnpaid: number;
  apUnpaid: number;
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
  } & Parameters<typeof purchaseAmount>[0]>,
  options?: {
    locale?: AppLocale;
    leaseRanks?: Map<string, number>;
  }
) {
  const locale = options?.locale ?? DEFAULT_LOCALE;
  for (const invoice of invoices) {
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
              ? joinDetail(vehicleDetail, invoice.invoiceRef)
              : joinDetail(
                  invoice.supplierName,
                  invoice.invoiceRef,
                  invoice.project?.name
                ),
      amount,
    });
  }
}

async function listParkingLines(
  companyId: string,
  from: Date,
  toExclusive: Date
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
        projectId: true,
      },
    }),
  ]);

  const moneyIn: FinancialReportPdfLine[] = [];
  const moneyOut: FinancialReportPdfLine[] = [];
  const now = jakartaYearMonth();
  for (const project of projects) {
    const deal = parkingDealFromProject(project);
    const startYm = jakartaYearMonth(project.startDate ?? project.createdAt);
    const endYm = project.endDate ? jakartaYearMonth(project.endDate) : now;
    const last =
      endYm.year > now.year ||
      (endYm.year === now.year && endYm.month > now.month)
        ? now
        : endYm;
    const revenueByMonth = new Map<string, number>(
      logs
        .filter((log) => log.projectId === project.id)
        .map((log) => [
          `${log.year}-${log.month}`,
          decimalToNumber(log.revenueAmount) ?? 0,
        ])
    );
    let year = startYm.year;
    let month = startYm.month;
    const projectLabel = joinDetail(project.client?.name, project.name);
    while (year < last.year || (year === last.year && month <= last.month)) {
      const monthStart = new Date(Date.UTC(year, month - 1, 1));
      if (inUtcRange(monthStart, from, toExclusive)) {
        const casual = revenueByMonth.get(`${year}-${month}`) ?? 0;
        const memberRevenue =
          (deal.memberParkingUnitFee ?? 0) * (deal.memberParkingUnitCount ?? 0);
        const revenue = casual + memberRevenue;
        const period = `${year}-${String(month).padStart(2, "0")}`;
        if (revenue !== 0) {
          moneyIn.push({
            date: monthStart,
            source: "parking",
            detail: joinDetail(projectLabel, period),
            amount: revenue,
          });
        }
        if (deal.monthlyClientFee > 0) {
          moneyOut.push({
            date: monthStart,
            source: "parkingFee",
            detail: joinDetail(projectLabel, period),
            amount: deal.monthlyClientFee,
          });
        }
        if (deal.profitSharePercent > 0 && casual > 0) {
          moneyOut.push({
            date: monthStart,
            source: "parkingShare",
            detail: joinDetail(projectLabel, period),
            amount: Math.round((casual * deal.profitSharePercent) / 100),
          });
        }
        if (deal.parkingTaxPercent > 0 && casual > 0) {
          moneyOut.push({
            date: monthStart,
            source: "parkingTax",
            detail: joinDetail(projectLabel, period),
            amount: Math.round((casual * deal.parkingTaxPercent) / 100),
          });
        }
        if (deal.setupCost > 0 && isSetupMonth(project, year, month)) {
          moneyOut.push({
            date: monthStart,
            source: "parkingSetup",
            detail: joinDetail(projectLabel, period),
            amount: deal.setupCost,
          });
        }
      }
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
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
  const wagePeriods = payrollPeriodsInUtcRange(wage.from, wage.toExclusive);
  const liveIncome = await liveInvoiceIncomeWhereFor(companyId);

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
    prisma.inventorySale.findMany({
      where: {
        companyId,
        movement: { voidedAt: null },
        ...bankAccountWhere(bank),
        ...(calendarMovedAt ? { soldAt: calendarMovedAt } : {}),
      },
      select: {
        soldAt: true,
        totalPrice: true,
        buyer: true,
        item: { select: { name: true } },
      },
      orderBy: [{ soldAt: "asc" }],
    }),
    allBanks
      ? prisma.payrollManagementPeriod.findMany({
          where: { project: { companyId } },
          select: {
            year: true,
            month: true,
            status: true,
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
    allBanks
      ? listParkingLines(companyId, calendar.from, calendar.toExclusive)
      : Promise.resolve({
          moneyIn: [] as FinancialReportPdfLine[],
          moneyOut: [] as FinancialReportPdfLine[],
        }),
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
        paidAt: {
          not: null,
          ...(calendar.from ? { gte: calendar.from } : {}),
          ...(calendar.toExclusive ? { lt: calendar.toExclusive } : {}),
        },
      },
      select: PURCHASE_SELECT,
      orderBy: { paidAt: "asc" },
    }),
    prisma.inventoryMovement.findMany({
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
    }),
    prisma.inventoryMovement.findMany({
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
    }),
    allocateCompanyWages({
      companyId,
      from: wage.from,
      toExclusive: wage.toExclusive,
    }),
    prisma.thrPayment.findMany({
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
    }),
    prisma.projectExpense.findMany({
      where: {
        ...LIVE_PROJECT_EXPENSE_WHERE,
        companyId,
        ...(calendarMovedAt ? { incurredAt: calendarMovedAt } : {}),
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
        paidAt: {
          not: null,
          ...(calendar.from ? { gte: calendar.from } : {}),
          ...(calendar.toExclusive ? { lt: calendar.toExclusive } : {}),
        },
      },
      select: PURCHASE_SELECT,
      orderBy: { paidAt: "asc" },
    }),
    prisma.payrollDeduction.findMany({
      where: {
        companyId,
        type: { not: "SECURITY_DEPOSIT" },
        ...(wagePeriods.length > 0
          ? {
              OR: wagePeriods.map((period) => ({
                year: period.year,
                month: period.month,
              })),
            }
          : {}),
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
    }),
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
    const amount = decimalToNumber(sale.totalPrice) ?? 0;
    if (amount === 0) continue;
    moneyInLines.push({
      date: sale.soldAt,
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
    if (
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
  for (const [site, rows] of wages) {
    const source: FinancialReportSource =
      site === OVERHEAD_WAGE_BUCKET ? "overheadWages" : "wages";
    const siteLabel =
      site === OVERHEAD_WAGE_BUCKET
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
    const amount =
      row.type === "RETURN_OF_SECURITY_DEPOSIT" ? raw : -raw;
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
        translate(locale, DEDUCTION_LABEL[row.type]),
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
    periodNet: overview.period.net,
    moneyIn: overview.period.moneyIn,
    moneyOut: overview.period.moneyOut,
    arUnpaid: overview.clientsOwe.unpaid,
    apUnpaid: overview.vendorsOwe.unpaid,
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
  const lines = [
    [translate(locale, "pages.financialReport.periodNet"), input.periodNet, input.periodNet >= 0 ? BRAND.income : BRAND.expense],
    [translate(locale, "pages.financialReport.moneyIn"), input.moneyIn, BRAND.income],
    [translate(locale, "pages.financialReport.moneyOut"), input.moneyOut, BRAND.expense],
    [translate(locale, "pages.financialReport.clientsStillOwe"), input.arUnpaid, BRAND.income],
    [translate(locale, "pages.financialReport.weStillOweVendors"), input.apUnpaid, BRAND.expense],
  ] as const;

  for (const [label, value, color] of lines) {
    ensureSpace(doc, SUMMARY_ROW_H);
    const y = doc.y;
    doc.font("Helvetica").fontSize(9).fillColor(BRAND.body).text(label, PAGE_MARGIN, y, {
      width: CONTENT_WIDTH - 160,
    });
    doc
      .font("Helvetica-Bold")
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
