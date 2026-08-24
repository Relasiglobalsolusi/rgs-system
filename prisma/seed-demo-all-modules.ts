/**
 * Demo rows for every product module (tables, chips, period rows, teams,
 * inventory, finance). Idempotent by stable ids / invoice refs / usernames.
 *
 * Usage: npx tsx prisma/seed-demo-all-modules.ts
 *
 * Local only. Does not overwrite owner login `vicko`.
 * Pay model: 9h = 1×, 18h double = 2×. No overtime. No Landscaping Manager.
 */
import {
  PrismaClient,
  Prisma,
  UserRole,
  EmployeeType,
  EmploymentType,
  Placement,
  ProjectStatus,
  ProjectSubCategory,
  ServiceArea,
  EmploymentStatus,
  BillingMode,
  BillingPeriodBasis,
  InvoicePeriodStatus,
  ClientReviewKind,
  ClientReviewStatus,
  ClientType,
  VendorType,
  PurchaseCategory,
  PurchasePurpose,
  PurchaseOrigin,
  CommercialTaxKind,
  GovernmentTaxKind,
  LeaveType,
  ApprovalStatus,
  InventoryMovementType,
  EquipmentAssetStatus,
  FactoryReturnIntent,
  FactoryReturnStatus,
  MaterialRequestStatus,
  TransferOrderStatus,
  PettyCashEntryKind,
  PettyCashEntryStatus,
  PayrollDeductionType,
  ThrPaymentStatus,
  PayrollManagementPeriodStatus,
  InternalHomeSite,
  OperationsTeamKind,
  ProgressReportStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

import { normalizeClientName } from "../lib/client-login-id";
import { getNextClientShortCode } from "../lib/client-short-code";
import { mintEquipmentAssets, retireEquipmentAssetsForSale } from "../lib/equipment-asset";
import { ensureInternalAttendanceSites } from "../lib/ensure-internal-attendance-sites";
import {
  inventoryQtyFromDecimal,
  movementTotalCost,
  nextWeightedAvgUnitCost,
  normalizeInventoryQty,
  toDecimal,
} from "../lib/inventory";
import { getNextInventorySku } from "../lib/inventory-sku";
import { invoicingDayFromContractStart } from "../lib/invoice-period";
import {
  getClientModuleOverrides,
  getEmployeeModuleOverrides,
} from "../lib/permissions";
import {
  ensureWorkforceDepartments,
  normalizePositionTitleCase,
  retireFinanceDepartments,
} from "../lib/positions";
import {
  SYSTEM_AREA_SEEDS,
} from "../lib/project-service-catalog";
import {
  applyExclusiveVat,
  DEFAULT_SOLD_OFF_PPN_RATE_PERCENT,
  ppnRateFromPercent,
} from "../lib/vat";
import { getNextVendorShortCode } from "../lib/vendor-short-code";

import { termMonthlyInstallment } from "../lib/bank-loan";

import { seedDemoImportEquipment } from "./seed-demo-import-equipment";
import { seedDemoPendingTransferOrders } from "./seed-demo-pending-transfer-orders";
import { seedSampleVendors } from "./seed-vendors";

const DEMO_PDF = Buffer.from(
  "%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n",
  "utf8"
);

function utcDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

/** Asia/Jakarta (UTC+7) wall clock → Date. */
function wib(year: number, month: number, day: number, hour: number, minute = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour - 7, minute));
}

async function writeUpload(
  folder: string,
  filename: string
): Promise<string> {
  const dir = path.join(process.cwd(), "public", "uploads", folder);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), DEMO_PDF);
  return `/uploads/${folder}/${filename}`;
}

type Db = PrismaClient;

async function ensureCatalog(prisma: Db, companyId: string) {
  for (const area of SYSTEM_AREA_SEEDS) {
    const areaRow = await prisma.projectServiceAreaCatalog.upsert({
      where: { companyId_slug: { companyId, slug: area.slug } },
      update: {
        nameEn: area.nameEn,
        nameId: area.nameId,
        isSystem: true,
        systemArea: area.systemArea,
        allowsOneTime: area.allowsOneTime,
        sortOrder: area.sortOrder,
      },
      create: {
        companyId,
        slug: area.slug,
        nameEn: area.nameEn,
        nameId: area.nameId,
        sortOrder: area.sortOrder,
        isSystem: true,
        systemArea: area.systemArea,
        allowsOneTime: area.allowsOneTime,
      },
    });
    for (const sub of area.subcategories) {
      await prisma.projectSubcategoryCatalog.upsert({
        where: { areaId_slug: { areaId: areaRow.id, slug: sub.slug } },
        update: {
          nameEn: sub.nameEn,
          nameId: sub.nameId,
          isSystem: true,
          systemSubCategory: sub.systemSubCategory,
          billingKind: sub.billingKind,
          sortOrder: sub.sortOrder,
        },
        create: {
          areaId: areaRow.id,
          slug: sub.slug,
          nameEn: sub.nameEn,
          nameId: sub.nameId,
          sortOrder: sub.sortOrder,
          isSystem: true,
          systemSubCategory: sub.systemSubCategory,
          billingKind: sub.billingKind,
        },
      });
    }
  }
}

async function catalogMap(prisma: Db, companyId: string) {
  const areas = await prisma.projectServiceAreaCatalog.findMany({
    where: { companyId },
    include: { subcategories: true },
  });
  const bySlug = Object.fromEntries(areas.map((a) => [a.slug, a]));
  return bySlug;
}

async function ensureClient(
  prisma: Db,
  companyId: string,
  row: {
    id: string;
    name: string;
    clientType: ClientType;
    email: string;
    phone: string;
    address: string;
    npwp: string | null;
    contactPersonFirstName: string;
    contactPersonLastName: string;
    contactPersonPosition: string;
    contactPersonEmail: string;
    contactPersonPhone: string;
  }
) {
  const existing = await prisma.client.findUnique({ where: { id: row.id } });
  const shortCode = existing?.shortCode ?? (await getNextClientShortCode(companyId, prisma));
  return prisma.client.upsert({
    where: { id: row.id },
    update: {
      name: row.name,
      nameNormalized: normalizeClientName(row.name),
      clientType: row.clientType,
      email: row.email,
      phone: row.phone,
      address: row.address,
      npwp: row.npwp,
      contactPersonFirstName: row.contactPersonFirstName,
      contactPersonLastName: row.contactPersonLastName,
      contactPersonPosition: row.contactPersonPosition,
      contactPersonEmail: row.contactPersonEmail,
      contactPersonPhone: row.contactPersonPhone,
      active: true,
    },
    create: {
      id: row.id,
      companyId,
      shortCode,
      name: row.name,
      nameNormalized: normalizeClientName(row.name),
      clientType: row.clientType,
      email: row.email,
      phone: row.phone,
      address: row.address,
      npwp: row.npwp,
      contactPersonFirstName: row.contactPersonFirstName,
      contactPersonLastName: row.contactPersonLastName,
      contactPersonPosition: row.contactPersonPosition,
      contactPersonEmail: row.contactPersonEmail,
      contactPersonPhone: row.contactPersonPhone,
      clientSince: utcDate(2024, 3, 1),
      active: true,
    },
  });
}

async function ensureVendor(
  prisma: Db,
  companyId: string,
  row: {
    name: string;
    vendorType: VendorType;
    email: string | null;
    phone: string | null;
    address: string | null;
    npwp: string | null;
    contactPersonFirstName: string;
    contactPersonLastName: string;
    contactPersonPosition: string;
  }
) {
  const existing = await prisma.vendor.findFirst({
    where: { companyId, name: row.name },
  });
  if (existing) {
    return prisma.vendor.update({
      where: { id: existing.id },
      data: {
        vendorType: row.vendorType,
        email: row.email,
        phone: row.phone,
        address: row.address,
        npwp: row.npwp,
        active: true,
      },
    });
  }
  return prisma.vendor.create({
    data: {
      companyId,
      name: row.name,
      shortCode: await getNextVendorShortCode(companyId, prisma),
      vendorType: row.vendorType,
      email: row.email,
      phone: row.phone,
      address: row.address,
      npwp: row.npwp,
      contactPersonFirstName: row.contactPersonFirstName,
      contactPersonLastName: row.contactPersonLastName,
      contactPersonPosition: row.contactPersonPosition,
      vendorSince: utcDate(2024, 6, 1),
      paymentTermsDays: 14,
      active: true,
    },
  });
}

async function ensureUser(
  prisma: Db,
  opts: {
    username: string;
    name: string;
    email: string;
    passwordHash: string;
    companyId: string;
    clientId?: string | null;
    moduleOverrides: Prisma.InputJsonValue | typeof Prisma.DbNull;
  }
) {
  const existing = await prisma.user.findUnique({
    where: { username: opts.username },
  });
  if (opts.username === "vicko") {
    if (existing) return existing;
    return prisma.user.create({
      data: {
        name: opts.name,
        username: "vicko",
        email: opts.email,
        passwordHash: opts.passwordHash,
        mustSetPassword: false,
        role: UserRole.ADMIN,
        companyId: opts.companyId,
        moduleOverrides: Prisma.DbNull,
      },
    });
  }
  return prisma.user.upsert({
    where: { username: opts.username },
    update: {
      name: opts.name,
      email: opts.email,
      passwordHash: opts.passwordHash,
      mustSetPassword: false,
      role: UserRole.ADMIN,
      active: true,
      clientId: opts.clientId ?? null,
      moduleOverrides: opts.moduleOverrides,
    },
    create: {
      name: opts.name,
      username: opts.username,
      email: opts.email,
      passwordHash: opts.passwordHash,
      mustSetPassword: false,
      role: UserRole.ADMIN,
      companyId: opts.companyId,
      clientId: opts.clientId ?? null,
      moduleOverrides: opts.moduleOverrides,
    },
  });
}

type PositionRow = { id: string; name: string; slug: string };

async function ensureEmployee(
  prisma: Db,
  row: {
    employeeNo: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string;
    companyId: string;
    categoryId: string;
    position: PositionRow;
    employmentType: EmploymentType;
    employeeType: EmployeeType;
    placement: Placement;
    userId: string | null;
    portalAccessRequested: boolean;
    basePay: number | null;
    bpjs: boolean;
    securityDepositRequired: boolean;
    cicoExempt?: boolean;
    progressExempt?: boolean;
    internalHomeSite?: InternalHomeSite;
    omApprovalAreas?: ServiceArea[];
    manageAllProjects?: boolean;
  }
) {
  const data = {
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone,
    employeeType: row.employeeType,
    employmentType: row.employmentType,
    placement: row.placement,
    portalAccessRequested: row.portalAccessRequested,
    categoryId: row.categoryId,
    positionId: row.position.id,
    position: row.position.name,
    status: EmploymentStatus.ACTIVE,
    archivedFromDirectory: false,
    userId: row.userId,
    hiredAt: utcDate(2024, 4, 1),
    basePay: row.basePay != null ? toDecimal(row.basePay) : null,
    bpjsKesehatanEnabled: row.bpjs,
    bpjsKetenagakerjaanEnabled: row.bpjs,
    jhtEnabled: row.bpjs,
    jpEnabled: row.bpjs,
    jkkEnabled: row.bpjs,
    jkmEnabled: row.bpjs,
    jkkPercent: row.bpjs ? toDecimal("0.24") : null,
    securityDepositRequired: row.securityDepositRequired,
    cicoExempt: row.cicoExempt ?? false,
    progressExempt: row.progressExempt ?? false,
    internalHomeSite: row.internalHomeSite ?? InternalHomeSite.NONE,
    omApprovalAreas: row.omApprovalAreas ?? [],
    manageAllProjects: row.manageAllProjects ?? false,
    bankName: "BCA",
    bankAccountNumber: `888${row.employeeNo.replace(/\D/g, "").padStart(7, "0")}`,
    bankAccountName: `${row.firstName} ${row.lastName}`,
    city: "Jakarta",
    country: "Indonesia",
  };
  return prisma.employee.upsert({
    where: { employeeNo: row.employeeNo },
    update: data,
    create: {
      employeeNo: row.employeeNo,
      companyId: row.companyId,
      ...data,
    },
  });
}

async function ensureProject(
  prisma: Db,
  row: {
    id: string;
    companyId: string;
    clientId: string | null;
    name: string;
    description: string;
    location: string;
    latitude: number;
    longitude: number;
    status: ProjectStatus;
    subCategory: ProjectSubCategory;
    serviceArea: ServiceArea;
    areaCatalogId?: string | null;
    subcategoryCatalogId?: string | null;
    billingMode: BillingMode;
    billingPeriodBasis?: BillingPeriodBasis | null;
    contractPrice: number | null;
    requiresTaxInvoice?: boolean;
    chargedTaxKind?: CommercialTaxKind | null;
    estimatedStartDate?: Date | null;
    startDate?: Date | null;
    endDate?: Date | null;
    invoicingDay?: number;
    paymentTermsDays?: number;
    shiftCount?: number;
    setupCost?: number | null;
    profitSharePercent?: number | null;
    monthlyClientFee?: number | null;
    memberParkingUnitFee?: number | null;
    memberParkingUnitCount?: number | null;
    parkingTaxPercent?: number | null;
    serviceFeePercent?: number | null;
    payrollCutoffStartDay?: number | null;
    payrollCutoffEndDay?: number | null;
    payrollTaxPercent?: number | null;
    progress?: number;
  }
) {
  const contractUrl = await writeUpload(
    "contracts",
    `${row.id}-contract.pdf`
  );
  const start = row.startDate ?? null;
  const data = {
    name: row.name,
    description: row.description,
    location: row.location,
    latitude: row.latitude,
    longitude: row.longitude,
    locationRadiusMeters: 60,
    clientId: row.clientId,
    status: row.status,
    subCategory: row.subCategory,
    serviceArea: row.serviceArea,
    areaCatalogId: row.areaCatalogId ?? null,
    subcategoryCatalogId: row.subcategoryCatalogId ?? null,
    billingMode: row.billingMode,
    billingPeriodBasis: row.billingPeriodBasis ?? null,
    contractPrice: row.contractPrice != null ? toDecimal(row.contractPrice) : null,
    requiresTaxInvoice: row.requiresTaxInvoice ?? false,
    chargedTaxKind: row.chargedTaxKind ?? null,
    estimatedStartDate: row.estimatedStartDate ?? start,
    startDate: start,
    endDate: row.endDate ?? null,
    invoicingDay:
      row.invoicingDay ??
      (start ? invoicingDayFromContractStart(start) : 1),
    paymentTermsDays: row.paymentTermsDays ?? 14,
    shiftCount: row.shiftCount ?? 1,
    setupCost: row.setupCost != null ? toDecimal(row.setupCost) : null,
    profitSharePercent:
      row.profitSharePercent != null ? toDecimal(row.profitSharePercent) : null,
    monthlyClientFee:
      row.monthlyClientFee != null ? toDecimal(row.monthlyClientFee) : null,
    memberParkingUnitFee:
      row.memberParkingUnitFee != null
        ? toDecimal(row.memberParkingUnitFee)
        : null,
    memberParkingUnitCount: row.memberParkingUnitCount ?? null,
    parkingTaxPercent:
      row.parkingTaxPercent != null ? toDecimal(row.parkingTaxPercent) : null,
    serviceFeePercent:
      row.serviceFeePercent != null ? toDecimal(row.serviceFeePercent) : null,
    payrollCutoffStartDay: row.payrollCutoffStartDay ?? null,
    payrollCutoffEndDay: row.payrollCutoffEndDay ?? null,
    payrollTaxPercent:
      row.payrollTaxPercent != null ? toDecimal(row.payrollTaxPercent) : null,
    progress: row.progress ?? (row.status === ProjectStatus.IN_PROGRESS ? 25 : 0),
    contractDocumentUrl:
      row.status === ProjectStatus.PLANNED ? null : contractUrl,
  };
  return prisma.project.upsert({
    where: { id: row.id },
    update: data,
    create: { id: row.id, companyId: row.companyId, ...data },
  });
}

async function ensureShift(
  prisma: Db,
  projectId: string,
  number: number,
  startTime: string,
  endTime: string
) {
  return prisma.projectShift.upsert({
    where: { projectId_number: { projectId, number } },
    update: { startTime, endTime },
    create: { projectId, number, startTime, endTime },
  });
}

async function ensureAssignment(
  prisma: Db,
  row: {
    projectId: string;
    employeeId: string;
    shiftId?: string | null;
    shiftStart: string;
    shiftEnd: string;
    isBackup?: boolean;
    coveredEmployeeId?: string | null;
    dailyRate?: number | null;
    backupStart?: Date | null;
    backupEnd?: Date | null;
  }
) {
  return prisma.projectAssignment.upsert({
    where: {
      projectId_employeeId: {
        projectId: row.projectId,
        employeeId: row.employeeId,
      },
    },
    update: {
      shiftId: row.shiftId ?? null,
      shiftStart: row.shiftStart,
      shiftEnd: row.shiftEnd,
      isBackup: row.isBackup ?? false,
      coveredEmployeeId: row.coveredEmployeeId ?? null,
      dailyRate: row.dailyRate != null ? toDecimal(row.dailyRate) : null,
      backupStartDate: row.backupStart ?? null,
      backupEndDate: row.backupEnd ?? null,
    },
    create: {
      projectId: row.projectId,
      employeeId: row.employeeId,
      shiftId: row.shiftId ?? null,
      shiftStart: row.shiftStart,
      shiftEnd: row.shiftEnd,
      isBackup: row.isBackup ?? false,
      coveredEmployeeId: row.coveredEmployeeId ?? null,
      dailyRate: row.dailyRate != null ? toDecimal(row.dailyRate) : null,
      backupStartDate: row.backupStart ?? null,
      backupEndDate: row.backupEnd ?? null,
    },
  });
}

async function ensurePeriod(
  prisma: Db,
  row: {
    projectId: string;
    periodStart: Date;
    periodEnd: Date;
    label: string;
    status: InvoicePeriodStatus;
    amount: number;
    compiledById?: string | null;
    clientReviewKind?: ClientReviewKind | null;
    clientReviewStatus?: ClientReviewStatus;
    submittedAt?: Date | null;
    dueAt?: Date | null;
    paidAt?: Date | null;
    taxInvoiceRequired?: boolean;
    taxInvoiceDoneAt?: Date | null;
    taxInvoiceDoneById?: string | null;
    reviewSentToClientAt?: Date | null;
  }
) {
  const invoicePdf =
    row.status === InvoicePeriodStatus.AWAITING_PAYMENT ||
    row.status === InvoicePeriodStatus.PAID
      ? await writeUpload(
          "invoices",
          `${row.projectId}-${row.label.replace(/\s+/g, "-")}.pdf`
        )
      : null;
  const reviewPdf =
    row.status === InvoicePeriodStatus.AWAITING_CLIENT_REVIEW
      ? await writeUpload(
          "review-reports",
          `${row.projectId}-${row.label.replace(/\s+/g, "-")}-review.pdf`
        )
      : null;
  return prisma.projectInvoicePeriod.upsert({
    where: {
      projectId_periodStart_periodEnd: {
        projectId: row.projectId,
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
      },
    },
    update: {
      label: row.label,
      status: row.status,
      amount: toDecimal(row.amount),
      compiledById: row.compiledById ?? null,
      clientReviewKind: row.clientReviewKind ?? null,
      clientReviewStatus: row.clientReviewStatus ?? ClientReviewStatus.NONE,
      submittedAt: row.submittedAt ?? null,
      dueAt: row.dueAt ?? null,
      paidAt: row.paidAt ?? null,
      taxInvoiceRequired: row.taxInvoiceRequired ?? false,
      taxInvoiceDoneAt: row.taxInvoiceDoneAt ?? null,
      taxInvoiceDoneById: row.taxInvoiceDoneById ?? null,
      reviewSentToClientAt: row.reviewSentToClientAt ?? null,
      invoicePdfPath: invoicePdf,
      reviewReportPdfPath: reviewPdf,
      reportCount: 2,
    },
    create: {
      projectId: row.projectId,
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      label: row.label,
      status: row.status,
      amount: toDecimal(row.amount),
      compiledById: row.compiledById ?? null,
      clientReviewKind: row.clientReviewKind ?? null,
      clientReviewStatus: row.clientReviewStatus ?? ClientReviewStatus.NONE,
      submittedAt: row.submittedAt ?? null,
      dueAt: row.dueAt ?? null,
      paidAt: row.paidAt ?? null,
      taxInvoiceRequired: row.taxInvoiceRequired ?? false,
      taxInvoiceDoneAt: row.taxInvoiceDoneAt ?? null,
      taxInvoiceDoneById: row.taxInvoiceDoneById ?? null,
      reviewSentToClientAt: row.reviewSentToClientAt ?? null,
      invoicePdfPath: invoicePdf,
      reviewReportPdfPath: reviewPdf,
      reportCount: 2,
    },
  });
}

async function ensureItem(
  prisma: Db,
  companyId: string,
  row: { id: string; name: string; itemType: string; unit: string; minStock: number }
) {
  const existing = await prisma.inventoryItem.findUnique({ where: { id: row.id } });
  if (existing) {
    return prisma.inventoryItem.update({
      where: { id: row.id },
      data: {
        name: row.name,
        itemType: row.itemType,
        unit: row.unit,
        minStock: toDecimal(row.minStock),
        active: true,
        deletedAt: null,
        tracksStock: true,
      },
    });
  }
  return prisma.inventoryItem.create({
    data: {
      id: row.id,
      companyId,
      sku: await getNextInventorySku(companyId, row.itemType, prisma),
      name: row.name,
      itemType: row.itemType,
      unit: row.unit,
      minStock: toDecimal(row.minStock),
      currentStock: toDecimal(0),
      tracksStock: true,
      active: true,
    },
  });
}

async function stockInIfMissing(
  prisma: Db,
  opts: {
    movementId: string;
    purchaseId: string;
    invoiceId: string;
    companyId: string;
    itemId: string;
    vendorId: string;
    createdById: string;
    qty: number;
    unitPrice: number;
    purchasedAt: Date;
    invoiceNo: string;
    notes: string;
    freeOfCharge?: boolean;
    freeOfChargeReason?: string | null;
    supplierName: string;
    purpose?: PurchasePurpose;
    includesPpn?: boolean;
    projectId?: string | null;
  }
) {
  const existing = await prisma.inventoryMovement.findUnique({
    where: { id: opts.movementId },
  });
  if (existing) return;

  const item = await prisma.inventoryItem.findUniqueOrThrow({
    where: { id: opts.itemId },
  });
  const currentStock = inventoryQtyFromDecimal(item.currentStock);
  const avgUnitCost = Number(item.avgUnitCost ?? 0) || null;
  const newAvg = nextWeightedAvgUnitCost({
    currentStock,
    avgUnitCost,
    purchaseQty: opts.qty,
    purchaseUnitPrice: opts.unitPrice,
  });
  const filePath = await writeUpload(
    "purchase-invoices",
    `${opts.invoiceNo}.pdf`
  );
  const total = movementTotalCost(opts.qty, opts.unitPrice);

  await prisma.$transaction(async (tx) => {
    const invoice = await tx.purchaseInvoice.create({
      data: {
        id: opts.invoiceId,
        companyId: opts.companyId,
        supplierName: opts.supplierName,
        vendorId: opts.vendorId,
        invoiceRef: opts.invoiceNo,
        invoiceDate: opts.purchasedAt,
        amount: toDecimal(opts.freeOfCharge ? 0 : total),
        filePath,
        notes: opts.notes,
        includesPpn: opts.includesPpn ?? true,
        includedTaxKind: opts.includesPpn === false ? null : CommercialTaxKind.PPN,
        ppnRatePercent: opts.includesPpn === false ? null : toDecimal(11),
        purchaseCategory: PurchaseCategory.PRODUCT,
        purpose: opts.purpose ?? PurchasePurpose.STOCK,
        projectId: opts.projectId ?? null,
        origin: PurchaseOrigin.LOCAL,
        freeOfCharge: opts.freeOfCharge ?? false,
        freeOfChargeReason: opts.freeOfChargeReason ?? null,
        paymentTermsDays: opts.freeOfCharge ? 0 : 14,
        paidAt: opts.freeOfCharge ? opts.purchasedAt : null,
        createdById: opts.createdById,
      },
    });
    const line = await tx.purchaseInvoiceLine.create({
      data: {
        purchaseInvoiceId: invoice.id,
        itemId: opts.itemId,
        unit: item.unit,
        quantity: toDecimal(opts.qty),
        unitPrice: toDecimal(opts.unitPrice),
        totalPrice: toDecimal(opts.freeOfCharge ? 0 : total),
        sortOrder: 0,
      },
    });
    const movement = await tx.inventoryMovement.create({
      data: {
        id: opts.movementId,
        companyId: opts.companyId,
        itemId: opts.itemId,
        type: InventoryMovementType.PURCHASE,
        quantity: toDecimal(opts.qty),
        unitCost: toDecimal(opts.unitPrice),
        totalCost: toDecimal(total),
        movedAt: opts.purchasedAt,
        notes: opts.notes,
        createdById: opts.createdById,
      },
    });
    await tx.inventoryPurchase.create({
      data: {
        id: opts.purchaseId,
        companyId: opts.companyId,
        itemId: opts.itemId,
        vendorId: opts.vendorId,
        purchasedAt: opts.purchasedAt,
        quantity: toDecimal(opts.qty),
        unitPrice: toDecimal(opts.unitPrice),
        totalPrice: toDecimal(opts.freeOfCharge ? 0 : total),
        invoiceNo: opts.invoiceNo,
        receiptUrl: filePath,
        notes: opts.notes,
        movementId: movement.id,
        purchaseInvoiceLineId: line.id,
        createdById: opts.createdById,
      },
    });
    await tx.inventoryItem.update({
      where: { id: opts.itemId },
      data: {
        currentStock: toDecimal(normalizeInventoryQty(currentStock + opts.qty)),
        lastUnitCost: toDecimal(opts.unitPrice),
        avgUnitCost: toDecimal(newAvg),
      },
    });
  });
}

export async function seedDemoAllModules(prisma: Db) {
  console.log("🌱 Demo all-modules seed…");

  const company = await prisma.company.upsert({
    where: { id: "rgs-company" },
    update: {
      name: "Relasi Global Solusi",
      email: "contact@rgs.co.id",
      phone: "+62 21 2295 2228",
      address:
        "Jl. Daan Mogot KM 14.5 Ruko Point 8, Blok F6\nRT 002 | RW 014, Jakarta Barat 11750",
      website: "https://www.rgs.co.id",
      bankName: "Bank Central Asia",
      bankAccountNumber: "0888123456",
      bankAccountName: "PT Relasi Global Solusi",
    },
    create: {
      id: "rgs-company",
      name: "Relasi Global Solusi",
      email: "contact@rgs.co.id",
      phone: "+62 21 2295 2228",
      address:
        "Jl. Daan Mogot KM 14.5 Ruko Point 8, Blok F6\nRT 002 | RW 014, Jakarta Barat 11750",
      website: "https://www.rgs.co.id",
      bankName: "Bank Central Asia",
      bankAccountNumber: "0888123456",
      bankAccountName: "PT Relasi Global Solusi",
      cashAtBankOpening: toDecimal(250_000_000),
      cashAtBankOpeningAsOf: utcDate(2026, 1, 1),
    },
  });

  await retireFinanceDepartments(prisma);
  await ensureWorkforceDepartments(prisma, company.id);
  await normalizePositionTitleCase(prisma, company.id);
  await ensureCatalog(prisma, company.id);

  const categories = Object.fromEntries(
    (
      await prisma.employeeCategory.findMany({
        where: { companyId: company.id },
      })
    ).map((c) => [c.slug, c])
  );
  const positions = await prisma.position.findMany({
    where: { companyId: company.id },
  });
  const pos = (categorySlug: string, slug: string) => {
    const category = categories[categorySlug];
    const found = positions.find(
      (p) => p.slug === slug && p.categoryId === category?.id
    );
    if (!found) throw new Error(`Missing position ${categorySlug}/${slug}`);
    return found;
  };

  const areas = await catalogMap(prisma, company.id);
  const sub = (areaSlug: string, subSlug: string) => {
    const area = areas[areaSlug];
    const found = area?.subcategories.find((s) => s.slug === subSlug);
    if (!found || !area) throw new Error(`Missing catalog ${areaSlug}/${subSlug}`);
    return { area, sub: found };
  };

  const adminHash = await bcrypt.hash("admin123", 12);
  const staffHash = await bcrypt.hash("staff123", 12);
  const clientHash = await bcrypt.hash("client123", 12);
  const managerHash = await bcrypt.hash("manager123", 12);

  const vicko = await ensureUser(prisma, {
    username: "vicko",
    name: "Vicko Liem",
    email: "vicko@rgs.co.id",
    passwordHash: adminHash,
    companyId: company.id,
    moduleOverrides: Prisma.DbNull,
  });

  const gedung = await ensureClient(prisma, company.id, {
    id: "client-gedung-sejahtera",
    name: "PT Gedung Sejahtera",
    clientType: ClientType.COMPANY,
    email: "contact@gedungsejahtera.co.id",
    phone: "+62 21 5551234",
    address: "Jl. Thamrin No. 88, Jakarta Pusat",
    npwp: "012345678901000",
    contactPersonFirstName: "Budi",
    contactPersonLastName: "Santoso",
    contactPersonPosition: "Procurement Manager",
    contactPersonEmail: "budi.santoso@gedungsejahtera.co.id",
    contactPersonPhone: "+62 812 3456 7890",
  });
  const nusantara = await ensureClient(prisma, company.id, {
    id: "client-demo-nusantara-properti",
    name: "Demo — PT Nusantara Properti",
    clientType: ClientType.COMPANY,
    email: "procurement@nusantaraproperti.co.id",
    phone: "+62 21 2928 4500",
    address: "Jl. Gatot Subroto Kav. 18, Jakarta Selatan",
    npwp: "109876543210000",
    contactPersonFirstName: "Dewi",
    contactPersonLastName: "Lestari",
    contactPersonPosition: "Facility Manager",
    contactPersonEmail: "dewi.lestari@nusantaraproperti.co.id",
    contactPersonPhone: "+62 811 2233 4455",
  });
  const mandiri = await ensureClient(prisma, company.id, {
    id: "client-demo-mandiri-facility",
    name: "Demo — CV Mandiri Facility",
    clientType: ClientType.COMPANY,
    email: "ops@mandirifacility.id",
    phone: "+62 31 5482 1100",
    address: "Jl. Basuki Rahmat No. 45, Surabaya",
    npwp: null,
    contactPersonFirstName: "Andi",
    contactPersonLastName: "Prasetyo",
    contactPersonPosition: "Operations Lead",
    contactPersonEmail: "andi.prasetyo@mandirifacility.id",
    contactPersonPhone: "+62 813 7788 9900",
  });
  const sariClient = await ensureClient(prisma, company.id, {
    id: "client-demo-mod-sari-wulandari",
    name: "Sari Wulandari",
    clientType: ClientType.INDIVIDUAL,
    email: "sari.wulandari@example.com",
    phone: "+62 812 7000 1100",
    address: "Jl. Kemang Raya No. 12, Jakarta Selatan",
    npwp: "3175094501850001",
    contactPersonFirstName: "Sari",
    contactPersonLastName: "Wulandari",
    contactPersonPosition: "Homeowner",
    contactPersonEmail: "sari.wulandari@example.com",
    contactPersonPhone: "+62 812 7000 1100",
  });
  const plazaClient = await ensureClient(prisma, company.id, {
    id: "client-demo-mod-plaza-hijau",
    name: "PT Plaza Hijau Sentosa",
    clientType: ClientType.COMPANY,
    email: "ops@plazahijau.co.id",
    phone: "+62 21 2990 8800",
    address: "Jl. Asia Afrika No. 8, Jakarta Pusat",
    npwp: "091122334455000",
    contactPersonFirstName: "Maya",
    contactPersonLastName: "Putri",
    contactPersonPosition: "Building Manager",
    contactPersonEmail: "maya.putri@plazahijau.co.id",
    contactPersonPhone: "+62 811 9000 2211",
  });

  await seedSampleVendors(prisma, company.id);
  const vendorCompany = await ensureVendor(prisma, company.id, {
    name: "CV Mandiri Chemical",
    vendorType: VendorType.COMPANY,
    email: "sales@mandirichemical.co.id",
    phone: "+62 21 7890123",
    address: "Jl. Industri Raya No. 45, Cikarang, Bekasi",
    npwp: "018765432109000",
    contactPersonFirstName: "Budi",
    contactPersonLastName: "Santoso",
    contactPersonPosition: "Sales Manager",
  });
  const vendorIndividual = await ensureVendor(prisma, company.id, {
    name: "Slamet Wijaya",
    vendorType: VendorType.INDIVIDUAL,
    email: "slamet.sparepart@gmail.com",
    phone: "+62 878 3300 2211",
    address: "Pasar Senen Blok B No. 4, Jakarta Pusat",
    npwp: "3174011201780002",
    contactPersonFirstName: "Slamet",
    contactPersonLastName: "Wijaya",
    contactPersonPosition: "Owner",
  });
  const vendorOverseas = await ensureVendor(prisma, company.id, {
    name: "Guangzhou Facility Goods Ltd.",
    vendorType: VendorType.OVERSEAS,
    email: "export@gzfacility.example",
    phone: "+86 20 8888 0000",
    address: "Panyu District, Guangzhou, China",
    npwp: null,
    contactPersonFirstName: "Li",
    contactPersonLastName: "Wei",
    contactPersonPosition: "Export Manager",
  });
  const vendorBank = await ensureVendor(prisma, company.id, {
    name: "PT Bank Central Asia Tbk",
    vendorType: VendorType.COMPANY,
    email: "corporate@bca.co.id",
    phone: "+62 21 2358 8000",
    address: "Menara BCA, Jl. MH Thamrin No. 1, Jakarta",
    npwp: "013280091032000",
    contactPersonFirstName: "Andi",
    contactPersonLastName: "Kredit",
    contactPersonPosition: "Relationship Manager",
  });

  const clientOverrides = getClientModuleOverrides();
  const siteOverrides = getEmployeeModuleOverrides({
    placement: Placement.ON_PROJECT,
    employeeType: EmployeeType.PROJECT_SITE,
    jobPosition: pos("operations", "cleaning-staff"),
  });
  const omOverrides = getEmployeeModuleOverrides({
    placement: Placement.ON_PROJECT,
    employeeType: EmployeeType.PROJECT_SITE,
    jobPosition: pos("operations", "operations-manager"),
  });
  const amOverrides = getEmployeeModuleOverrides({
    placement: Placement.ON_PROJECT,
    employeeType: EmployeeType.PROJECT_SITE,
    jobPosition: pos("operations", "area-manager"),
  });
  const techOverrides = getEmployeeModuleOverrides({
    placement: Placement.ON_PROJECT,
    employeeType: EmployeeType.PROJECT_SITE,
    jobPosition: pos("operations", "technician"),
  });
  const whOverrides = getEmployeeModuleOverrides({
    placement: Placement.HEAD_OFFICE,
    employeeType: EmployeeType.HEAD_OFFICE,
    jobPosition: pos("warehouse", "warehouse-supervisor"),
  });
  const officeOverrides = getEmployeeModuleOverrides({
    placement: Placement.HEAD_OFFICE,
    employeeType: EmployeeType.HEAD_OFFICE,
    jobPosition: pos("corporate", "accountant"),
  });

  const managerUser = await ensureUser(prisma, {
    username: "manager",
    name: "Rina Operations",
    email: "manager@rgs.co.id",
    passwordHash: managerHash,
    companyId: company.id,
    moduleOverrides: omOverrides,
  });
  const officeUser = await ensureUser(prisma, {
    username: "office",
    name: "Rina Wijaya",
    email: "office@rgs.co.id",
    passwordHash: staffHash,
    companyId: company.id,
    moduleOverrides: officeOverrides,
  });
  const siteUser = await ensureUser(prisma, {
    username: "site",
    name: "Budi Santoso",
    email: "site@rgs.co.id",
    passwordHash: staffHash,
    companyId: company.id,
    moduleOverrides: siteOverrides,
  });
  const site2User = await ensureUser(prisma, {
    username: "site2",
    name: "Siti Aminah",
    email: "site2@rgs.co.id",
    passwordHash: staffHash,
    companyId: company.id,
    moduleOverrides: getEmployeeModuleOverrides({
      placement: Placement.ON_PROJECT,
      employeeType: EmployeeType.PROJECT_SITE,
      jobPosition: pos("operations", "gc-staff"),
    }),
  });
  const amUser = await ensureUser(prisma, {
    username: "am",
    name: "Andi Pratama",
    email: "am@rgs.co.id",
    passwordHash: staffHash,
    companyId: company.id,
    moduleOverrides: amOverrides,
  });
  const techUser = await ensureUser(prisma, {
    username: "tech",
    name: "Eko Technician",
    email: "tech@rgs.co.id",
    passwordHash: staffHash,
    companyId: company.id,
    moduleOverrides: techOverrides,
  });
  const warehouseUser = await ensureUser(prisma, {
    username: "warehouse",
    name: "Joko Gudang",
    email: "warehouse@rgs.co.id",
    passwordHash: staffHash,
    companyId: company.id,
    moduleOverrides: whOverrides,
  });
  const ptUser = await ensureUser(prisma, {
    username: "ptcrew",
    name: "Lina Part Time",
    email: "ptcrew@rgs.co.id",
    passwordHash: staffHash,
    companyId: company.id,
    moduleOverrides: siteOverrides,
  });
  await ensureUser(prisma, {
    username: "client",
    name: "Portal PT Gedung Sejahtera",
    email: "client@rgs.co.id",
    passwordHash: clientHash,
    companyId: company.id,
    clientId: gedung.id,
    moduleOverrides: clientOverrides,
  });
  await ensureUser(prisma, {
    username: "sari",
    name: "Portal Sari Wulandari",
    email: "sari.portal@rgs.co.id",
    passwordHash: clientHash,
    companyId: company.id,
    clientId: sariClient.id,
    moduleOverrides: clientOverrides,
  });

  const empVicko = await ensureEmployee(prisma, {
    employeeNo: "COR-001",
    firstName: "Vicko",
    lastName: "Liem",
    email: "vicko@rgs.co.id",
    phone: "+62 812 0000 0003",
    companyId: company.id,
    categoryId: categories.corporate.id,
    position: pos("corporate", "director"),
    employmentType: EmploymentType.FULL_TIME,
    employeeType: EmployeeType.HEAD_OFFICE,
    placement: Placement.HEAD_OFFICE,
    userId: vicko.id,
    portalAccessRequested: true,
    basePay: 25_000_000,
    bpjs: true,
    securityDepositRequired: false,
    cicoExempt: true,
    progressExempt: true,
    internalHomeSite: InternalHomeSite.HEAD_OFFICE_OPERATIONS,
    manageAllProjects: true,
  });
  const empOffice = await ensureEmployee(prisma, {
    employeeNo: "COR-002",
    firstName: "Rina",
    lastName: "Wijaya",
    email: "office@rgs.co.id",
    phone: "+62 812 0000 0012",
    companyId: company.id,
    categoryId: categories.corporate.id,
    position: pos("corporate", "accountant"),
    employmentType: EmploymentType.FULL_TIME,
    employeeType: EmployeeType.HEAD_OFFICE,
    placement: Placement.HEAD_OFFICE,
    userId: officeUser.id,
    portalAccessRequested: true,
    basePay: 8_500_000,
    bpjs: true,
    securityDepositRequired: false,
    cicoExempt: true,
    progressExempt: true,
    internalHomeSite: InternalHomeSite.HEAD_OFFICE_OPERATIONS,
  });
  await ensureEmployee(prisma, {
    employeeNo: "COR-003",
    firstName: "Tono",
    lastName: "Inhouse",
    email: null,
    phone: "+62 812 0000 0013",
    companyId: company.id,
    categoryId: categories.corporate.id,
    position: pos("corporate", "in-house-cleaning-staff"),
    employmentType: EmploymentType.FULL_TIME,
    employeeType: EmployeeType.HEAD_OFFICE,
    placement: Placement.HEAD_OFFICE,
    userId: null,
    portalAccessRequested: false,
    basePay: 4_800_000,
    bpjs: true,
    securityDepositRequired: true,
    internalHomeSite: InternalHomeSite.HEAD_OFFICE_OPERATIONS,
  });
  await ensureEmployee(prisma, {
    employeeNo: "COR-004",
    firstName: "Mira",
    lastName: "Finance",
    email: null,
    phone: "+62 812 0000 0014",
    companyId: company.id,
    categoryId: categories.corporate.id,
    position: pos("corporate", "finance-admin"),
    employmentType: EmploymentType.FULL_TIME,
    employeeType: EmployeeType.HEAD_OFFICE,
    placement: Placement.HEAD_OFFICE,
    userId: null,
    portalAccessRequested: false,
    basePay: 7_200_000,
    bpjs: true,
    securityDepositRequired: false,
    cicoExempt: true,
    progressExempt: true,
    internalHomeSite: InternalHomeSite.HEAD_OFFICE_OPERATIONS,
  });

  const empWh = await ensureEmployee(prisma, {
    employeeNo: "WRH-001",
    firstName: "Joko",
    lastName: "Gudang",
    email: "warehouse@rgs.co.id",
    phone: "+62 812 0000 0021",
    companyId: company.id,
    categoryId: categories.warehouse.id,
    position: pos("warehouse", "warehouse-supervisor"),
    employmentType: EmploymentType.FULL_TIME,
    employeeType: EmployeeType.HEAD_OFFICE,
    placement: Placement.HEAD_OFFICE,
    userId: warehouseUser.id,
    portalAccessRequested: true,
    basePay: 6_800_000,
    bpjs: true,
    securityDepositRequired: false,
    progressExempt: true,
    internalHomeSite: InternalHomeSite.WAREHOUSE,
  });
  await ensureEmployee(prisma, {
    employeeNo: "WRH-002",
    firstName: "Agus",
    lastName: "Rak",
    email: null,
    phone: "+62 812 0000 0022",
    companyId: company.id,
    categoryId: categories.warehouse.id,
    position: pos("warehouse", "warehouse-staff"),
    employmentType: EmploymentType.FULL_TIME,
    employeeType: EmployeeType.HEAD_OFFICE,
    placement: Placement.HEAD_OFFICE,
    userId: null,
    portalAccessRequested: false,
    basePay: 4_600_000,
    bpjs: true,
    securityDepositRequired: false,
    progressExempt: true,
    internalHomeSite: InternalHomeSite.WAREHOUSE,
  });

  const empSite = await ensureEmployee(prisma, {
    employeeNo: "OPR-001",
    firstName: "Budi",
    lastName: "Santoso",
    email: "site@rgs.co.id",
    phone: "+62 812 0000 0001",
    companyId: company.id,
    categoryId: categories.operations.id,
    position: pos("operations", "cleaning-staff"),
    employmentType: EmploymentType.FULL_TIME,
    employeeType: EmployeeType.PROJECT_SITE,
    placement: Placement.ON_PROJECT,
    userId: siteUser.id,
    portalAccessRequested: true,
    basePay: 4_500_000,
    bpjs: true,
    securityDepositRequired: true,
  });
  const empSite2 = await ensureEmployee(prisma, {
    employeeNo: "OPR-002",
    firstName: "Siti",
    lastName: "Aminah",
    email: "site2@rgs.co.id",
    phone: "+62 812 0000 0002",
    companyId: company.id,
    categoryId: categories.operations.id,
    position: pos("operations", "gc-staff"),
    employmentType: EmploymentType.FULL_TIME,
    employeeType: EmployeeType.PROJECT_SITE,
    placement: Placement.ON_PROJECT,
    userId: site2User.id,
    portalAccessRequested: true,
    basePay: 4_700_000,
    bpjs: true,
    securityDepositRequired: true,
  });
  const empOm = await ensureEmployee(prisma, {
    employeeNo: "OPR-010",
    firstName: "Rina",
    lastName: "Operations",
    email: "manager@rgs.co.id",
    phone: "+62 812 0000 0010",
    companyId: company.id,
    categoryId: categories.operations.id,
    position: pos("operations", "operations-manager"),
    employmentType: EmploymentType.FULL_TIME,
    employeeType: EmployeeType.PROJECT_SITE,
    placement: Placement.ON_PROJECT,
    userId: managerUser.id,
    portalAccessRequested: true,
    basePay: 12_000_000,
    bpjs: true,
    securityDepositRequired: false,
    progressExempt: true,
    manageAllProjects: true,
    omApprovalAreas: [
      ServiceArea.CLEANING,
      ServiceArea.LANDSCAPING,
      ServiceArea.SECURITY,
      ServiceArea.PARKING,
      ServiceArea.PAYROLL_MANAGEMENT,
      ServiceArea.OTHER,
    ],
  });
  const empAm = await ensureEmployee(prisma, {
    employeeNo: "OPR-011",
    firstName: "Andi",
    lastName: "Pratama",
    email: "am@rgs.co.id",
    phone: "+62 812 0000 0011",
    companyId: company.id,
    categoryId: categories.operations.id,
    position: pos("operations", "area-manager"),
    employmentType: EmploymentType.FULL_TIME,
    employeeType: EmployeeType.PROJECT_SITE,
    placement: Placement.ON_PROJECT,
    userId: amUser.id,
    portalAccessRequested: true,
    basePay: 9_000_000,
    bpjs: true,
    securityDepositRequired: false,
    progressExempt: true,
    manageAllProjects: false,
  });
  const empTech = await ensureEmployee(prisma, {
    employeeNo: "OPR-012",
    firstName: "Eko",
    lastName: "Technician",
    email: "tech@rgs.co.id",
    phone: "+62 812 0000 0015",
    companyId: company.id,
    categoryId: categories.operations.id,
    position: pos("operations", "technician"),
    employmentType: EmploymentType.FULL_TIME,
    employeeType: EmployeeType.PROJECT_SITE,
    placement: Placement.ON_PROJECT,
    userId: techUser.id,
    portalAccessRequested: true,
    basePay: 5_500_000,
    bpjs: true,
    securityDepositRequired: false,
    progressExempt: true,
  });
  const empPt = await ensureEmployee(prisma, {
    employeeNo: "OPR-013",
    firstName: "Lina",
    lastName: "Part Time",
    email: "ptcrew@rgs.co.id",
    phone: "+62 812 0000 0016",
    companyId: company.id,
    categoryId: categories.operations.id,
    position: pos("operations", "cleaning-staff"),
    employmentType: EmploymentType.PART_TIME,
    employeeType: EmployeeType.PROJECT_SITE,
    placement: Placement.ON_PROJECT,
    userId: ptUser.id,
    portalAccessRequested: true,
    basePay: null,
    bpjs: false,
    securityDepositRequired: false,
  });
  const empPt2 = await ensureEmployee(prisma, {
    employeeNo: "OPR-014",
    firstName: "Dedi",
    lastName: "Sore",
    email: null,
    phone: "+62 812 0000 0017",
    companyId: company.id,
    categoryId: categories.operations.id,
    position: pos("operations", "cleaning-staff"),
    employmentType: EmploymentType.PART_TIME,
    employeeType: EmployeeType.PROJECT_SITE,
    placement: Placement.AVAILABLE,
    userId: null,
    portalAccessRequested: false,
    basePay: null,
    bpjs: false,
    securityDepositRequired: false,
  });
  const empSec = await ensureEmployee(prisma, {
    employeeNo: "OPR-015",
    firstName: "Rahmat",
    lastName: "Security",
    email: null,
    phone: "+62 812 0000 0018",
    companyId: company.id,
    categoryId: categories.operations.id,
    position: pos("operations", "security-staff"),
    employmentType: EmploymentType.FULL_TIME,
    employeeType: EmployeeType.PROJECT_SITE,
    placement: Placement.ON_PROJECT,
    userId: null,
    portalAccessRequested: false,
    basePay: 4_400_000,
    bpjs: true,
    securityDepositRequired: true,
    progressExempt: true,
  });
  const empPark = await ensureEmployee(prisma, {
    employeeNo: "OPR-016",
    firstName: "Yudi",
    lastName: "Parkir",
    email: null,
    phone: "+62 812 0000 0019",
    companyId: company.id,
    categoryId: categories.operations.id,
    position: pos("operations", "parking-staff"),
    employmentType: EmploymentType.FULL_TIME,
    employeeType: EmployeeType.PROJECT_SITE,
    placement: Placement.ON_PROJECT,
    userId: null,
    portalAccessRequested: false,
    basePay: 4_300_000,
    bpjs: true,
    securityDepositRequired: true,
    progressExempt: true,
    cicoExempt: true,
  });
  const empLand = await ensureEmployee(prisma, {
    employeeNo: "OPR-017",
    firstName: "Wawan",
    lastName: "Taman",
    email: null,
    phone: "+62 812 0000 0020",
    companyId: company.id,
    categoryId: categories.operations.id,
    position: pos("operations", "gc-staff"),
    employmentType: EmploymentType.FULL_TIME,
    employeeType: EmployeeType.PROJECT_SITE,
    placement: Placement.ON_PROJECT,
    userId: null,
    portalAccessRequested: false,
    basePay: 4_600_000,
    bpjs: true,
    securityDepositRequired: true,
  });
  const empFacade = await ensureEmployee(prisma, {
    employeeNo: "OPR-018",
    firstName: "Fajar",
    lastName: "Gondola",
    email: null,
    phone: "+62 812 0000 0023",
    companyId: company.id,
    categoryId: categories.operations.id,
    position: pos("operations", "gc-staff"),
    employmentType: EmploymentType.FULL_TIME,
    employeeType: EmployeeType.PROJECT_SITE,
    placement: Placement.ON_PROJECT,
    userId: null,
    portalAccessRequested: false,
    basePay: 5_000_000,
    bpjs: true,
    securityDepositRequired: true,
  });

  const internals = await ensureInternalAttendanceSites(company.id);
  const hoProjectId = internals.sites.find((s) => s.kind === "HEAD_OFFICE")?.projectId;
  const whProjectId = internals.sites.find((s) => s.kind === "WAREHOUSE")?.projectId;

  const cleaningReg = sub("CLEANING", "REGULAR_CLEANING");
  const cleaningGc = sub("CLEANING", "CONTRACT_GENERAL_CLEANING");
  const cleaningFac = sub("CLEANING", "CONTRACT_FACADE_CLEANING");
  const landReg = sub("LANDSCAPING", "REGULAR_LANDSCAPING");
  const landOt = sub("LANDSCAPING", "ONE_TIME_LANDSCAPING");
  const secReg = sub("SECURITY", "SECURITY");
  const secOt = sub("SECURITY", "ONE_TIME_SECURITY");
  const parkCat = sub("PARKING", "PARKING");
  const payCat = sub("PAYROLL_MANAGEMENT", "PAYROLL_MANAGEMENT");

  const periodProject = await ensureProject(prisma, {
    id: "project-demo-mod-period-rows",
    companyId: company.id,
    clientId: gedung.id,
    name: "Demo — Twin Period Tower",
    description: "Regular contract used to show two Pending Approval and two Payment Due period rows",
    location: "Jl. Sudirman Kav. 52, Jakarta",
    latitude: -6.224,
    longitude: 106.809,
    status: ProjectStatus.IN_PROGRESS,
    subCategory: ProjectSubCategory.REGULAR_CLEANING,
    serviceArea: ServiceArea.CLEANING,
    areaCatalogId: cleaningReg.area.id,
    subcategoryCatalogId: cleaningReg.sub.id,
    billingMode: BillingMode.MONTHLY,
    billingPeriodBasis: BillingPeriodBasis.CONTRACT_CYCLE,
    contractPrice: 32_000_000,
    requiresTaxInvoice: true,
    chargedTaxKind: CommercialTaxKind.PPN,
    startDate: utcDate(2026, 3, 16),
    endDate: utcDate(2027, 3, 15),
    invoicingDay: 16,
    shiftCount: 2,
    progress: 40,
  });
  const pGcContract = await ensureProject(prisma, {
    id: "project-demo-mod-gc-contract",
    companyId: company.id,
    clientId: plazaClient.id,
    name: "Demo — Plaza Hijau General Contract",
    description: "Contract general cleaning — multi-visit building",
    location: "Plaza Hijau, Jakarta Pusat",
    latitude: -6.195,
    longitude: 106.823,
    status: ProjectStatus.IN_PROGRESS,
    subCategory: ProjectSubCategory.CONTRACT_GENERAL_CLEANING,
    serviceArea: ServiceArea.CLEANING,
    areaCatalogId: cleaningGc.area.id,
    subcategoryCatalogId: cleaningGc.sub.id,
    billingMode: BillingMode.MONTHLY,
    billingPeriodBasis: BillingPeriodBasis.CALENDAR_MONTH,
    contractPrice: 55_000_000,
    requiresTaxInvoice: true,
    chargedTaxKind: CommercialTaxKind.PPN,
    startDate: utcDate(2026, 6, 1),
    endDate: utcDate(2026, 12, 31),
  });
  const pFacContract = await ensureProject(prisma, {
    id: "project-demo-mod-facade-contract",
    companyId: company.id,
    clientId: nusantara.id,
    name: "Demo — Nusantara Facade Contract",
    description: "Contract facade cleaning",
    location: "Menara Nusantara, Jakarta Selatan",
    latitude: -6.23,
    longitude: 106.83,
    status: ProjectStatus.IN_PROGRESS,
    subCategory: ProjectSubCategory.CONTRACT_FACADE_CLEANING,
    serviceArea: ServiceArea.CLEANING,
    areaCatalogId: cleaningFac.area.id,
    subcategoryCatalogId: cleaningFac.sub.id,
    billingMode: BillingMode.MONTHLY,
    contractPrice: 80_000_000,
    requiresTaxInvoice: true,
    chargedTaxKind: CommercialTaxKind.PPN,
    startDate: utcDate(2026, 5, 1),
    endDate: utcDate(2026, 11, 30),
  });
  const pGcOne = await ensureProject(prisma, {
    id: "project-demo-mod-gc-onetime",
    companyId: company.id,
    clientId: sariClient.id,
    name: "Demo — Sari Residence Deep Clean",
    description: "One time general cleaning for an individual client",
    location: "Jl. Kemang Raya No. 12, Jakarta Selatan",
    latitude: -6.26,
    longitude: 106.813,
    status: ProjectStatus.IN_PROGRESS,
    subCategory: ProjectSubCategory.GENERAL_CLEANING,
    serviceArea: ServiceArea.CLEANING,
    areaCatalogId: cleaningReg.area.id,
    subcategoryCatalogId: null,
    billingMode: BillingMode.ON_COMPLETION,
    contractPrice: 8_500_000,
    requiresTaxInvoice: false,
    startDate: utcDate(2026, 8, 10),
    endDate: utcDate(2026, 8, 22),
  });
  const pFacOne = await ensureProject(prisma, {
    id: "project-demo-mod-facade-onetime",
    companyId: company.id,
    clientId: plazaClient.id,
    name: "Demo — Plaza Glass Wash",
    description: "One time facade wash",
    location: "Plaza Hijau podium, Jakarta",
    latitude: -6.196,
    longitude: 106.824,
    status: ProjectStatus.PLANNED,
    subCategory: ProjectSubCategory.FACADE_CLEANING,
    serviceArea: ServiceArea.CLEANING,
    areaCatalogId: cleaningFac.area.id,
    subcategoryCatalogId: null,
    billingMode: BillingMode.ON_COMPLETION,
    contractPrice: 18_000_000,
    estimatedStartDate: utcDate(2026, 9, 5),
    startDate: null,
  });
  const pLandReg = await ensureProject(prisma, {
    id: "project-demo-mod-land-regular",
    companyId: company.id,
    clientId: plazaClient.id,
    name: "Demo — Plaza Garden Care",
    description: "Regular landscaping — garden and planter maintenance",
    location: "Plaza Hijau gardens, Jakarta",
    latitude: -6.1948,
    longitude: 106.8225,
    status: ProjectStatus.IN_PROGRESS,
    subCategory: ProjectSubCategory.REGULAR_LANDSCAPING,
    serviceArea: ServiceArea.LANDSCAPING,
    areaCatalogId: landReg.area.id,
    subcategoryCatalogId: landReg.sub.id,
    billingMode: BillingMode.MONTHLY,
    contractPrice: 12_000_000,
    requiresTaxInvoice: true,
    chargedTaxKind: CommercialTaxKind.PPN,
    startDate: utcDate(2026, 4, 1),
    endDate: utcDate(2027, 3, 31),
  });
  const pLandOt = await ensureProject(prisma, {
    id: "project-demo-mod-land-onetime",
    companyId: company.id,
    clientId: mandiri.id,
    name: "Demo — Surabaya Courtyard Replant",
    description: "One time landscaping replant",
    location: "Kawasan Industri Rungkut, Surabaya",
    latitude: -7.258,
    longitude: 112.753,
    status: ProjectStatus.PLANNED,
    subCategory: ProjectSubCategory.ONE_TIME_LANDSCAPING,
    serviceArea: ServiceArea.LANDSCAPING,
    areaCatalogId: landOt.area.id,
    subcategoryCatalogId: landOt.sub.id,
    billingMode: BillingMode.ON_COMPLETION,
    contractPrice: 22_000_000,
    estimatedStartDate: utcDate(2026, 9, 12),
    startDate: null,
  });
  const pSec = await ensureProject(prisma, {
    id: "project-demo-mod-security",
    companyId: company.id,
    clientId: gedung.id,
    name: "Demo — Gedung Sejahtera Security",
    description: "Monthly security service",
    location: "Jl. Thamrin No. 88, Jakarta Pusat",
    latitude: -6.194,
    longitude: 106.823,
    status: ProjectStatus.IN_PROGRESS,
    subCategory: ProjectSubCategory.SECURITY,
    serviceArea: ServiceArea.SECURITY,
    areaCatalogId: secReg.area.id,
    subcategoryCatalogId: secReg.sub.id,
    billingMode: BillingMode.MONTHLY,
    contractPrice: 18_000_000,
    requiresTaxInvoice: true,
    chargedTaxKind: CommercialTaxKind.PPN,
    startDate: utcDate(2026, 2, 1),
    endDate: utcDate(2027, 1, 31),
  });
  const pSecOt = await ensureProject(prisma, {
    id: "project-demo-mod-security-onetime",
    companyId: company.id,
    clientId: nusantara.id,
    name: "Demo — Event Security Night",
    description: "One time security coverage for a lobby event",
    location: "Menara Nusantara Lobby",
    latitude: -6.2299,
    longitude: 106.8296,
    status: ProjectStatus.IN_PROGRESS,
    subCategory: ProjectSubCategory.ONE_TIME_SECURITY,
    serviceArea: ServiceArea.SECURITY,
    areaCatalogId: secOt.area.id,
    subcategoryCatalogId: secOt.sub.id,
    billingMode: BillingMode.ON_COMPLETION,
    contractPrice: 6_500_000,
    startDate: utcDate(2026, 8, 18),
    endDate: utcDate(2026, 8, 20),
  });
  const pPark = await ensureProject(prisma, {
    id: "project-demo-mod-parking",
    companyId: company.id,
    clientId: plazaClient.id,
    name: "Demo — Plaza Hijau Parking",
    description: "Parking management — member + casual traffic",
    location: "Plaza Hijau basement, Jakarta",
    latitude: -6.1955,
    longitude: 106.8235,
    status: ProjectStatus.IN_PROGRESS,
    subCategory: ProjectSubCategory.PARKING,
    serviceArea: ServiceArea.PARKING,
    areaCatalogId: parkCat.area.id,
    subcategoryCatalogId: parkCat.sub.id,
    billingMode: BillingMode.MONTHLY,
    contractPrice: null,
    startDate: utcDate(2026, 3, 1),
    setupCost: 45_000_000,
    profitSharePercent: 20,
    monthlyClientFee: 8_000_000,
    memberParkingUnitFee: 350_000,
    memberParkingUnitCount: 40,
    parkingTaxPercent: 10,
  });
  const pPay = await ensureProject(prisma, {
    id: "project-demo-mod-payroll",
    companyId: company.id,
    clientId: nusantara.id,
    name: "Demo — Nusantara Payroll Management",
    description: "Client payroll management — RGS pays staff first",
    location: "Menara Nusantara, Jakarta Selatan",
    latitude: -6.2297,
    longitude: 106.8295,
    status: ProjectStatus.IN_PROGRESS,
    subCategory: ProjectSubCategory.PAYROLL_MANAGEMENT,
    serviceArea: ServiceArea.PAYROLL_MANAGEMENT,
    areaCatalogId: payCat.area.id,
    subcategoryCatalogId: payCat.sub.id,
    billingMode: BillingMode.MONTHLY,
    contractPrice: null,
    startDate: utcDate(2026, 5, 1),
    serviceFeePercent: 8,
    payrollCutoffStartDay: 21,
    payrollCutoffEndDay: 20,
    payrollTaxPercent: 11,
  });
  const pGcMulti = await ensureProject(prisma, {
    id: "project-demo-mod-gc-multivisit",
    companyId: company.id,
    clientId: plazaClient.id,
    name: "Demo — Plaza Lobby Recurring Visits",
    description: "Multiple visits general cleaning — crew assigned per visit",
    location: "Plaza Hijau lobby, Jakarta Pusat",
    latitude: -6.1952,
    longitude: 106.8232,
    status: ProjectStatus.IN_PROGRESS,
    subCategory: ProjectSubCategory.GENERAL_CLEANING,
    serviceArea: ServiceArea.CLEANING,
    areaCatalogId: cleaningGc.area.id,
    subcategoryCatalogId: cleaningGc.sub.id,
    billingMode: BillingMode.MULTI_VISIT,
    contractPrice: 12_000_000,
    requiresTaxInvoice: true,
    chargedTaxKind: CommercialTaxKind.PPN,
    startDate: utcDate(2026, 8, 10),
    endDate: utcDate(2026, 9, 3),
    progress: 55,
  });

  const shift1 = await ensureShift(prisma, periodProject.id, 1, "07:00", "16:00");
  const shift2 = await ensureShift(prisma, periodProject.id, 2, "13:00", "22:00");

  await ensureAssignment(prisma, {
    projectId: periodProject.id,
    employeeId: empSite.id,
    shiftId: shift1.id,
    shiftStart: "07:00",
    shiftEnd: "16:00",
  });
  await ensureAssignment(prisma, {
    projectId: periodProject.id,
    employeeId: empSite2.id,
    shiftId: shift2.id,
    shiftStart: "13:00",
    shiftEnd: "22:00",
  });
  await ensureAssignment(prisma, {
    projectId: periodProject.id,
    employeeId: empPt.id,
    shiftId: shift1.id,
    shiftStart: "07:00",
    shiftEnd: "16:00",
    isBackup: true,
    coveredEmployeeId: empSite.id,
    dailyRate: 180_000,
    backupStart: utcDate(2026, 8, 10),
    backupEnd: utcDate(2026, 8, 20),
  });
  await ensureAssignment(prisma, {
    projectId: pGcContract.id,
    employeeId: empSite2.id,
    shiftStart: "08:00",
    shiftEnd: "17:00",
  });
  await ensureAssignment(prisma, {
    projectId: pFacContract.id,
    employeeId: empFacade.id,
    shiftStart: "08:00",
    shiftEnd: "17:00",
  });
  await ensureAssignment(prisma, {
    projectId: pGcOne.id,
    employeeId: empSite.id,
    shiftStart: "08:00",
    shiftEnd: "17:00",
  });
  await ensureAssignment(prisma, {
    projectId: pLandReg.id,
    employeeId: empLand.id,
    shiftStart: "07:00",
    shiftEnd: "16:00",
  });
  await ensureAssignment(prisma, {
    projectId: pSec.id,
    employeeId: empSec.id,
    shiftStart: "07:00",
    shiftEnd: "16:00",
  });
  await ensureAssignment(prisma, {
    projectId: pPark.id,
    employeeId: empPark.id,
    shiftStart: "07:00",
    shiftEnd: "16:00",
  });
  await ensureAssignment(prisma, {
    projectId: pGcContract.id,
    employeeId: empTech.id,
    shiftStart: "08:00",
    shiftEnd: "17:00",
  });
  if (hoProjectId) {
    await ensureAssignment(prisma, {
      projectId: hoProjectId,
      employeeId: empOffice.id,
      shiftStart: "08:00",
      shiftEnd: "17:00",
    });
  }
  if (whProjectId) {
    await ensureAssignment(prisma, {
      projectId: whProjectId,
      employeeId: empWh.id,
      shiftStart: "08:00",
      shiftEnd: "17:00",
    });
  }

  await prisma.areaManagerProject.upsert({
    where: {
      employeeId_projectId: {
        employeeId: empAm.id,
        projectId: periodProject.id,
      },
    },
    update: {},
    create: { employeeId: empAm.id, projectId: periodProject.id },
  });
  await prisma.areaManagerProject.upsert({
    where: {
      employeeId_projectId: {
        employeeId: empAm.id,
        projectId: pGcContract.id,
      },
    },
    update: {},
    create: { employeeId: empAm.id, projectId: pGcContract.id },
  });

  const existingDouble = await prisma.doubleShiftAssignment.findUnique({
    where: {
      employeeId_date: { employeeId: empSite.id, date: utcDate(2026, 8, 19) },
    },
  });
  if (!existingDouble) {
    await prisma.doubleShiftAssignment.create({
      data: {
        projectId: periodProject.id,
        employeeId: empSite.id,
        coveringShiftId: shift2.id,
        coveredEmployeeId: empSite2.id,
        date: utcDate(2026, 8, 19),
        assignedById: vicko.id,
      },
    });
  }

  async function ensureTeam(opts: {
    id: string;
    name: string;
    kind: OperationsTeamKind | null;
    areaId: string;
    memberIds: string[];
    projectIds: string[];
  }) {
    const team = await prisma.operationsTeam.upsert({
      where: { id: opts.id },
      update: {
        name: opts.name,
        kind: opts.kind,
        serviceAreaCatalogId: opts.areaId,
      },
      create: {
        id: opts.id,
        companyId: company.id,
        name: opts.name,
        kind: opts.kind,
        serviceAreaCatalogId: opts.areaId,
      },
    });
    for (const employeeId of opts.memberIds) {
      const already = await prisma.operationsTeamMember.findUnique({
        where: { employeeId },
      });
      if (already && already.teamId !== team.id) continue;
      await prisma.operationsTeamMember.upsert({
        where: { employeeId },
        update: { teamId: team.id },
        create: { teamId: team.id, employeeId },
      });
    }
    for (const projectId of opts.projectIds) {
      await prisma.operationsTeamProject.upsert({
        where: { teamId_projectId: { teamId: team.id, projectId } },
        update: {},
        create: { teamId: team.id, projectId },
      });
    }
    return team;
  }

  await ensureTeam({
    id: "demo-mod-team-gc",
    name: "GC Team Alpha",
    kind: OperationsTeamKind.GENERAL_CLEANING,
    areaId: cleaningGc.area.id,
    memberIds: [empSite2.id],
    projectIds: [pGcContract.id, pGcOne.id, pGcMulti.id],
  });
  await ensureTeam({
    id: "demo-mod-team-facade",
    name: "Facade Team One",
    kind: OperationsTeamKind.FACADE_CLEANING,
    areaId: cleaningFac.area.id,
    memberIds: [empFacade.id],
    projectIds: [pFacContract.id, pFacOne.id],
  });
  await ensureTeam({
    id: "demo-mod-team-land",
    name: "Garden Crew",
    kind: OperationsTeamKind.LANDSCAPING,
    areaId: landReg.area.id,
    memberIds: [empLand.id],
    projectIds: [pLandReg.id, pLandOt.id],
  });
  await ensureTeam({
    id: "demo-mod-team-sec",
    name: "Security Detail A",
    kind: null,
    areaId: secReg.area.id,
    memberIds: [empSec.id],
    projectIds: [pSec.id, pSecOt.id],
  });

  const dueSoon = utcDate(2026, 8, 27);
  const dueLater = utcDate(2026, 9, 10);
  const sentAt = wib(2026, 8, 12, 10);

  const pending1 = await ensurePeriod(prisma, {
    projectId: periodProject.id,
    periodStart: utcDate(2026, 6, 16),
    periodEnd: utcDate(2026, 7, 15),
    label: "16 Jun – 15 Jul 2026",
    status: InvoicePeriodStatus.AWAITING_CLIENT_REVIEW,
    amount: 32_000_000,
    compiledById: vicko.id,
    clientReviewKind: ClientReviewKind.RECONCILIATION,
    clientReviewStatus: ClientReviewStatus.AWAITING_CLIENT,
    reviewSentToClientAt: sentAt,
    taxInvoiceRequired: true,
  });
  const pending2 = await ensurePeriod(prisma, {
    projectId: periodProject.id,
    periodStart: utcDate(2026, 7, 16),
    periodEnd: utcDate(2026, 8, 15),
    label: "16 Jul – 15 Aug 2026",
    status: InvoicePeriodStatus.AWAITING_CLIENT_REVIEW,
    amount: 32_000_000,
    compiledById: vicko.id,
    clientReviewKind: ClientReviewKind.RECONCILIATION,
    clientReviewStatus: ClientReviewStatus.CLIENT_REVISED,
    reviewSentToClientAt: wib(2026, 8, 16, 9),
    taxInvoiceRequired: true,
  });
  await ensurePeriod(prisma, {
    projectId: periodProject.id,
    periodStart: utcDate(2026, 4, 16),
    periodEnd: utcDate(2026, 5, 15),
    label: "16 Apr – 15 May 2026",
    status: InvoicePeriodStatus.AWAITING_PAYMENT,
    amount: 32_000_000,
    compiledById: vicko.id,
    clientReviewKind: ClientReviewKind.RECONCILIATION,
    clientReviewStatus: ClientReviewStatus.CLIENT_APPROVED,
    submittedAt: utcDate(2026, 5, 16),
    dueAt: dueSoon,
    taxInvoiceRequired: true,
  });
  await ensurePeriod(prisma, {
    projectId: periodProject.id,
    periodStart: utcDate(2026, 5, 16),
    periodEnd: utcDate(2026, 6, 15),
    label: "16 May – 15 Jun 2026",
    status: InvoicePeriodStatus.AWAITING_PAYMENT,
    amount: 32_000_000,
    compiledById: vicko.id,
    clientReviewKind: ClientReviewKind.RECONCILIATION,
    clientReviewStatus: ClientReviewStatus.CLIENT_APPROVED,
    submittedAt: utcDate(2026, 6, 16),
    dueAt: dueLater,
    taxInvoiceRequired: true,
    taxInvoiceDoneAt: utcDate(2026, 6, 20),
    taxInvoiceDoneById: vicko.id,
  });

  for (const period of [pending1, pending2]) {
    const eventId = `demo-mod-review-${period.id}`;
    const exists = await prisma.billingClientReviewEvent.findUnique({
      where: { id: eventId },
    });
    if (!exists) {
      await prisma.billingClientReviewEvent.create({
        data: {
          id: eventId,
          invoicePeriodId: period.id,
          actorRole: "HO",
          userId: vicko.id,
          action: "SENT_TO_CLIENT",
          note: "Demo seed — period sent for client review.",
          statusAfter: ClientReviewStatus.AWAITING_CLIENT,
        },
      });
    }
  }

  await ensurePeriod(prisma, {
    projectId: pGcContract.id,
    periodStart: utcDate(2026, 7, 1),
    periodEnd: utcDate(2026, 7, 31),
    label: "July 2026",
    status: InvoicePeriodStatus.ONGOING,
    amount: 55_000_000,
  });
  await ensurePeriod(prisma, {
    projectId: pFacContract.id,
    periodStart: utcDate(2026, 7, 1),
    periodEnd: utcDate(2026, 7, 31),
    label: "July 2026",
    status: InvoicePeriodStatus.ONGOING,
    amount: 80_000_000,
  });
  await ensurePeriod(prisma, {
    projectId: pGcOne.id,
    periodStart: utcDate(2026, 8, 10),
    periodEnd: utcDate(2026, 8, 22),
    label: "Completion invoice",
    status: InvoicePeriodStatus.ONGOING,
    amount: 8_500_000,
  });
  await ensurePeriod(prisma, {
    projectId: pLandReg.id,
    periodStart: utcDate(2026, 7, 1),
    periodEnd: utcDate(2026, 7, 31),
    label: "July 2026",
    status: InvoicePeriodStatus.ONGOING,
    amount: 12_000_000,
  });
  await ensurePeriod(prisma, {
    projectId: pSec.id,
    periodStart: utcDate(2026, 7, 1),
    periodEnd: utcDate(2026, 7, 31),
    label: "July 2026",
    status: InvoicePeriodStatus.AWAITING_PAYMENT,
    amount: 18_000_000,
    compiledById: vicko.id,
    submittedAt: utcDate(2026, 8, 1),
    dueAt: dueSoon,
    taxInvoiceRequired: true,
  });
  await prisma.parkingMonthlyLog.upsert({
    where: {
      projectId_year_month: { projectId: pPark.id, year: 2026, month: 6 },
    },
    update: { revenueAmount: toDecimal(62_000_000), notes: "Demo June casual + members" },
    create: {
      projectId: pPark.id,
      year: 2026,
      month: 6,
      revenueAmount: toDecimal(62_000_000),
      notes: "Demo June casual + members",
      createdById: vicko.id,
    },
  });
  await prisma.parkingMonthlyLog.upsert({
    where: {
      projectId_year_month: { projectId: pPark.id, year: 2026, month: 7 },
    },
    update: { revenueAmount: toDecimal(71_500_000), notes: "Demo July peak" },
    create: {
      projectId: pPark.id,
      year: 2026,
      month: 7,
      revenueAmount: toDecimal(71_500_000),
      notes: "Demo July peak",
      createdById: vicko.id,
    },
  });

  const payPeriod = await prisma.payrollManagementPeriod.upsert({
    where: {
      projectId_year_month: { projectId: pPay.id, year: 2026, month: 7 },
    },
    update: {
      status: PayrollManagementPeriodStatus.AWAITING_CLIENT,
      serviceFeePercent: toDecimal(8),
      wagesTotal: toDecimal(36_000_000),
      feeAmount: toDecimal(2_880_000),
      taxRatePercent: toDecimal(11),
      taxAmount: toDecimal(316_800),
      clientBillAmount: toDecimal(39_196_800),
      notes: "Demo July payroll list",
    },
    create: {
      projectId: pPay.id,
      year: 2026,
      month: 7,
      status: PayrollManagementPeriodStatus.AWAITING_CLIENT,
      serviceFeePercent: toDecimal(8),
      wagesTotal: toDecimal(36_000_000),
      feeAmount: toDecimal(2_880_000),
      taxRatePercent: toDecimal(11),
      taxAmount: toDecimal(316_800),
      clientBillAmount: toDecimal(39_196_800),
      notes: "Demo July payroll list",
      createdById: vicko.id,
    },
  });
  const payLines = [
    { name: "Client Staff A", amount: 12_000_000, account: "1234567890" },
    { name: "Client Staff B", amount: 12_000_000, account: "1234567891" },
    { name: "Client Staff C", amount: 12_000_000, account: "1234567892" },
  ];
  const existingPayLines = await prisma.payrollManagementLine.count({
    where: { periodId: payPeriod.id },
  });
  if (existingPayLines === 0) {
    await prisma.payrollManagementLine.createMany({
      data: payLines.map((line, index) => ({
        periodId: payPeriod.id,
        employeeName: line.name,
        amount: toDecimal(line.amount),
        accountNumber: line.account,
        sortOrder: index,
      })),
    });
  }

  const itemEqp = await ensureItem(prisma, company.id, {
    id: "demo-mod-item-scrubber",
    name: "Demo Compact Floor Scrubber",
    itemType: "Equipment",
    unit: "pcs",
    minStock: 1,
  });
  const itemChem = await ensureItem(prisma, company.id, {
    id: "demo-mod-item-chem",
    name: "Demo Floor Cleaner 20L",
    itemType: "Chemical",
    unit: "pail",
    minStock: 4,
  });
  const itemCons = await ensureItem(prisma, company.id, {
    id: "demo-mod-item-cloth",
    name: "Demo Microfiber Cloth",
    itemType: "Consumable",
    unit: "pcs",
    minStock: 20,
  });
  const itemSpare = await ensureItem(prisma, company.id, {
    id: "demo-mod-item-motor",
    name: "Demo Vacuum Motor",
    itemType: "Spare Part",
    unit: "pcs",
    minStock: 1,
  });

  await stockInIfMissing(prisma, {
    movementId: "demo-mod-mv-buy-scrubber",
    purchaseId: "demo-mod-ip-scrubber",
    invoiceId: "demo-mod-pi-scrubber",
    companyId: company.id,
    itemId: itemEqp.id,
    vendorId: vendorOverseas.id,
    createdById: vicko.id,
    qty: 6,
    unitPrice: 8_500_000,
    purchasedAt: utcDate(2026, 6, 10),
    invoiceNo: "DEMO-MOD-EQP-001",
    notes: "Demo equipment stock — sealed boxes stay uncoded",
    supplierName: vendorOverseas.name,
    includesPpn: false,
  });
  await stockInIfMissing(prisma, {
    movementId: "demo-mod-mv-buy-chem",
    purchaseId: "demo-mod-ip-chem",
    invoiceId: "demo-mod-pi-chem",
    companyId: company.id,
    itemId: itemChem.id,
    vendorId: vendorCompany.id,
    createdById: vicko.id,
    qty: 20,
    unitPrice: 285_000,
    purchasedAt: utcDate(2026, 7, 2),
    invoiceNo: "DEMO-MOD-CHM-001",
    notes: "Demo chemical drums",
    supplierName: vendorCompany.name,
  });
  await stockInIfMissing(prisma, {
    movementId: "demo-mod-mv-buy-cloth",
    purchaseId: "demo-mod-ip-cloth",
    invoiceId: "demo-mod-pi-cloth",
    companyId: company.id,
    itemId: itemCons.id,
    vendorId: vendorCompany.id,
    createdById: vicko.id,
    qty: 80,
    unitPrice: 12_500,
    purchasedAt: utcDate(2026, 7, 4),
    invoiceNo: "DEMO-MOD-CNS-001",
    notes: "Demo microfiber cloths",
    supplierName: vendorCompany.name,
  });
  await stockInIfMissing(prisma, {
    movementId: "demo-mod-mv-buy-spare",
    purchaseId: "demo-mod-ip-spare",
    invoiceId: "demo-mod-pi-spare",
    companyId: company.id,
    itemId: itemSpare.id,
    vendorId: vendorIndividual.id,
    createdById: vicko.id,
    qty: 4,
    unitPrice: 450_000,
    purchasedAt: utcDate(2026, 7, 8),
    invoiceNo: "DEMO-MOD-SPR-001",
    notes: "Demo spare motors",
    supplierName: vendorIndividual.name,
    includesPpn: false,
  });
  await stockInIfMissing(prisma, {
    movementId: "demo-mod-mv-buy-spare-foc",
    purchaseId: "demo-mod-ip-spare-foc",
    invoiceId: "demo-mod-pi-spare-foc",
    companyId: company.id,
    itemId: itemSpare.id,
    vendorId: vendorIndividual.id,
    createdById: vicko.id,
    qty: 1,
    unitPrice: 0,
    purchasedAt: utcDate(2026, 7, 18),
    invoiceNo: "DEMO-MOD-SPR-FOC",
    notes: "Warranty replacement motor",
    supplierName: vendorIndividual.name,
    freeOfCharge: true,
    freeOfChargeReason: "Under warranty — replacement motor",
    includesPpn: false,
  });

  const issueExisting = await prisma.inventoryMovement.findUnique({
    where: { id: "demo-mod-mv-issue-scrubber" },
  });
  if (!issueExisting) {
    await prisma.$transaction(async (tx) => {
      const locked = await tx.inventoryItem.findUniqueOrThrow({
        where: { id: itemEqp.id },
      });
      const stock = inventoryQtyFromDecimal(locked.currentStock);
      const unitCost =
        Number(locked.avgUnitCost ?? locked.lastUnitCost ?? 8_500_000) || 8_500_000;
      const movement = await tx.inventoryMovement.create({
        data: {
          id: "demo-mod-mv-issue-scrubber",
          companyId: company.id,
          itemId: itemEqp.id,
          projectId: periodProject.id,
          type: InventoryMovementType.ISSUE_TO_PROJECT,
          quantity: toDecimal(-2),
          unitCost: toDecimal(unitCost),
          totalCost: toDecimal(movementTotalCost(2, unitCost)),
          movedAt: utcDate(2026, 8, 4),
          notes: "Demo issue — mint codes on send",
          createdById: vicko.id,
        },
      });
      await mintEquipmentAssets(tx, company.id, itemEqp.id, 2, {
        unitCost,
        status: "AVAILABLE",
        projectId: periodProject.id,
        issueMovementId: movement.id,
        assignedAt: utcDate(2026, 8, 4),
      });
      await tx.equipmentAsset.updateMany({
        where: { issueMovementId: movement.id },
        data: {
          status: EquipmentAssetStatus.ON_PROJECT,
          projectId: periodProject.id,
          assignedAt: utcDate(2026, 8, 4),
        },
      });
      await tx.inventoryItem.update({
        where: { id: itemEqp.id },
        data: { currentStock: toDecimal(normalizeInventoryQty(stock - 2)) },
      });
    });
  }

  const chemIssue = await prisma.inventoryMovement.findUnique({
    where: { id: "demo-mod-mv-issue-chem" },
  });
  if (!chemIssue) {
    await prisma.$transaction(async (tx) => {
      const locked = await tx.inventoryItem.findUniqueOrThrow({
        where: { id: itemChem.id },
      });
      const stock = inventoryQtyFromDecimal(locked.currentStock);
      const unitCost = Number(locked.avgUnitCost ?? 285_000) || 285_000;
      await tx.inventoryMovement.create({
        data: {
          id: "demo-mod-mv-issue-chem",
          companyId: company.id,
          itemId: itemChem.id,
          projectId: periodProject.id,
          type: InventoryMovementType.ISSUE_TO_PROJECT,
          quantity: toDecimal(-3),
          unitCost: toDecimal(unitCost),
          totalCost: toDecimal(movementTotalCost(3, unitCost)),
          movedAt: utcDate(2026, 8, 5),
          notes: "Demo chemical issue",
          createdById: vicko.id,
        },
      });
      await tx.inventoryItem.update({
        where: { id: itemChem.id },
        data: { currentStock: toDecimal(normalizeInventoryQty(stock - 3)) },
      });
    });
  }

  const writeOff = await prisma.inventoryMovement.findUnique({
    where: { id: "demo-mod-mv-writeoff-chem" },
  });
  if (!writeOff) {
    await prisma.$transaction(async (tx) => {
      const locked = await tx.inventoryItem.findUniqueOrThrow({
        where: { id: itemChem.id },
      });
      const stock = inventoryQtyFromDecimal(locked.currentStock);
      const unitCost = Number(locked.avgUnitCost ?? 285_000) || 285_000;
      await tx.inventoryMovement.create({
        data: {
          id: "demo-mod-mv-writeoff-chem",
          companyId: company.id,
          itemId: itemChem.id,
          type: InventoryMovementType.WRITE_OFF,
          quantity: toDecimal(-1),
          unitCost: toDecimal(unitCost),
          totalCost: toDecimal(movementTotalCost(1, unitCost)),
          movedAt: utcDate(2026, 8, 8),
          notes: "Leaking pail — unusable",
          createdById: vicko.id,
        },
      });
      await tx.inventoryItem.update({
        where: { id: itemChem.id },
        data: { currentStock: toDecimal(normalizeInventoryQty(stock - 1)) },
      });
    });
  }

  const saleNew = await prisma.inventoryMovement.findUnique({
    where: { id: "demo-mod-mv-sale-new" },
  });
  if (!saleNew) {
    const unitPrice = 9_800_000;
    const vat = applyExclusiveVat(
      unitPrice,
      ppnRateFromPercent(DEFAULT_SOLD_OFF_PPN_RATE_PERCENT)
    );
    const invoiceUrl = await writeUpload("inventory", "demo-mod-sale-new-invoice.pdf");
    const proofUrl = await writeUpload("inventory", "demo-mod-sale-new-proof.pdf");
    const taxUrl = await writeUpload("inventory", "demo-mod-sale-new-faktur.pdf");
    await prisma.$transaction(async (tx) => {
      const locked = await tx.inventoryItem.findUniqueOrThrow({
        where: { id: itemEqp.id },
      });
      const stock = inventoryQtyFromDecimal(locked.currentStock);
      const unitCost = Number(locked.avgUnitCost ?? 8_500_000) || 8_500_000;
      const movement = await tx.inventoryMovement.create({
        data: {
          id: "demo-mod-mv-sale-new",
          companyId: company.id,
          itemId: itemEqp.id,
          type: InventoryMovementType.SOLD_OFF,
          quantity: toDecimal(-1),
          unitCost: toDecimal(unitCost),
          totalCost: toDecimal(movementTotalCost(1, unitCost)),
          movedAt: utcDate(2026, 8, 11),
          notes: "Buyer: PT Plaza Hijau Sentosa — new uncoded unit",
          createdById: vicko.id,
        },
      });
      await tx.inventorySale.create({
        data: {
          id: "demo-mod-sale-new",
          companyId: company.id,
          itemId: itemEqp.id,
          soldAt: utcDate(2026, 8, 11),
          quantity: toDecimal(1),
          unitPrice: toDecimal(unitPrice),
          totalPrice: toDecimal(vat.gross),
          subtotal: toDecimal(vat.dpp),
          taxAmount: toDecimal(vat.ppn),
          taxRatePercent: toDecimal(DEFAULT_SOLD_OFF_PPN_RATE_PERCENT),
          buyer: plazaClient.name,
          buyerType: ClientType.COMPANY,
          buyerPicName: "Maya Putri",
          buyerPhone: "+62 811 9000 2211",
          buyerTaxId: "091122334455000",
          buyerIdentityDocUrl: taxUrl,
          invoiceUrl,
          paymentProofUrl: proofUrl,
          paidAt: utcDate(2026, 8, 11),
          clientId: plazaClient.id,
          notes: "New uncoded warehouse unit",
          movementId: movement.id,
          createdById: vicko.id,
        },
      });
      await tx.inventoryItem.update({
        where: { id: itemEqp.id },
        data: { currentStock: toDecimal(normalizeInventoryQty(stock - 1)) },
      });
    });
  }

  const saleIssued = await prisma.inventoryMovement.findUnique({
    where: { id: "demo-mod-mv-sale-issued" },
  });
  if (!saleIssued) {
    const issuedAsset = await prisma.equipmentAsset.findFirst({
      where: {
        itemId: itemEqp.id,
        status: EquipmentAssetStatus.ON_PROJECT,
        projectId: periodProject.id,
      },
    });
    if (issuedAsset) {
      const unitPrice = 7_200_000;
      const vat = applyExclusiveVat(
        unitPrice,
        ppnRateFromPercent(DEFAULT_SOLD_OFF_PPN_RATE_PERCENT)
      );
      const invoiceUrl = await writeUpload(
        "inventory",
        "demo-mod-sale-issued-invoice.pdf"
      );
      const proofUrl = await writeUpload(
        "inventory",
        "demo-mod-sale-issued-proof.pdf"
      );
      await prisma.$transaction(async (tx) => {
        const unitCost = Number(issuedAsset.unitCost ?? 8_500_000) || 8_500_000;
        const movement = await tx.inventoryMovement.create({
          data: {
            id: "demo-mod-mv-sale-issued",
            companyId: company.id,
            itemId: itemEqp.id,
            type: InventoryMovementType.SOLD_OFF,
            quantity: toDecimal(-1),
            unitCost: toDecimal(unitCost),
            totalCost: toDecimal(movementTotalCost(1, unitCost)),
            movedAt: utcDate(2026, 8, 14),
            notes: "Buyer: Sari Wulandari — issued coded unit",
            createdById: vicko.id,
          },
        });
        await tx.inventorySale.create({
          data: {
            id: "demo-mod-sale-issued",
            companyId: company.id,
            itemId: itemEqp.id,
            soldAt: utcDate(2026, 8, 14),
            quantity: toDecimal(1),
            unitPrice: toDecimal(unitPrice),
            totalPrice: toDecimal(vat.gross),
            subtotal: toDecimal(vat.dpp),
            taxAmount: toDecimal(vat.ppn),
            taxRatePercent: toDecimal(DEFAULT_SOLD_OFF_PPN_RATE_PERCENT),
            buyer: sariClient.name,
            buyerType: ClientType.INDIVIDUAL,
            buyerPicName: "Sari Wulandari",
            buyerPhone: "+62 812 7000 1100",
            buyerIdNumber: "3175094501850001",
            invoiceUrl,
            paymentProofUrl: proofUrl,
            paidAt: utcDate(2026, 8, 14),
            clientId: sariClient.id,
            notes: "Issued coded unit sold from site",
            movementId: movement.id,
            createdById: vicko.id,
          },
        });
        await retireEquipmentAssetsForSale(
          tx,
          company.id,
          itemEqp.id,
          1,
          "Issued coded unit sold from site",
          { soldOffMovementId: movement.id, assetIds: [issuedAsset.id] }
        );
      });
    }
  }

  const factoryExisting = await prisma.equipmentFactoryReturn.findUnique({
    where: { id: "demo-mod-factory-return-1" },
  });
  if (!factoryExisting) {
    await prisma.$transaction(async (tx) => {
      const locked = await tx.inventoryItem.findUniqueOrThrow({
        where: { id: itemEqp.id },
      });
      const stock = inventoryQtyFromDecimal(locked.currentStock);
      const unitCost = Number(locked.avgUnitCost ?? 8_500_000) || 8_500_000;
      const movement = await tx.inventoryMovement.create({
        data: {
          id: "demo-mod-mv-factory",
          companyId: company.id,
          itemId: itemEqp.id,
          type: InventoryMovementType.RETURN_TO_FACTORY,
          quantity: toDecimal(-1),
          unitCost: toDecimal(unitCost),
          totalCost: toDecimal(movementTotalCost(1, unitCost)),
          movedAt: utcDate(2026, 8, 15),
          notes: "Return To Vendor: Motor noise on unused boxed unit",
          createdById: vicko.id,
        },
      });
      await tx.inventoryItem.update({
        where: { id: itemEqp.id },
        data: { currentStock: toDecimal(normalizeInventoryQty(stock - 1)) },
      });
      await tx.equipmentFactoryReturn.create({
        data: {
          id: "demo-mod-factory-return-1",
          companyId: company.id,
          itemId: itemEqp.id,
          quantity: toDecimal(1),
          sentAt: utcDate(2026, 8, 15),
          originalIntent: FactoryReturnIntent.REPAIR,
          status: FactoryReturnStatus.WAITING,
          reason: "Motor noise on unused boxed unit",
          vendorId: vendorOverseas.id,
          sendMovementId: movement.id,
          createdById: vicko.id,
        },
      });
    });
  }

  const govExisting = await prisma.purchaseInvoice.findUnique({
    where: { id: "demo-mod-pi-gov-ppn" },
  });
  if (!govExisting) {
    const filePath = await writeUpload(
      "purchase-invoices",
      "demo-mod-gov-ppn.pdf"
    );
    await prisma.purchaseInvoice.create({
      data: {
        id: "demo-mod-pi-gov-ppn",
        companyId: company.id,
        supplierName: "Direktorat Jenderal Pajak",
        invoiceRef: "BILLING-PPN-202607",
        governmentTaxKind: GovernmentTaxKind.PPN,
        invoiceDate: utcDate(2026, 8, 10),
        amount: toDecimal(4_250_000),
        filePath,
        notes: "Demo PPN Kurang Bayar July 2026",
        includesPpn: false,
        purchaseCategory: PurchaseCategory.GOVERNMENT,
        purpose: PurchasePurpose.INTERNAL,
        paidAt: utcDate(2026, 8, 10),
        paidById: vicko.id,
        createdById: vicko.id,
      },
    });
  }

  const serviceExisting = await prisma.purchaseInvoice.findUnique({
    where: { id: "demo-mod-pi-service" },
  });
  if (!serviceExisting) {
    const filePath = await writeUpload(
      "purchase-invoices",
      "demo-mod-service.pdf"
    );
    const taxPath = await writeUpload("tax-invoices", "demo-mod-service-faktur.pdf");
    await prisma.purchaseInvoice.create({
      data: {
        id: "demo-mod-pi-service",
        companyId: company.id,
        supplierName: vendorCompany.name,
        vendorId: vendorCompany.id,
        invoiceRef: "MC-SVC-2026-081",
        invoiceDate: utcDate(2026, 8, 3),
        amount: toDecimal(3_300_000),
        filePath,
        taxInvoiceFilePath: taxPath,
        taxInvoiceUploadedAt: utcDate(2026, 8, 4),
        taxInvoiceSerial: "0100000000000001",
        taxInvoiceIssuedAt: utcDate(2026, 8, 3),
        notes: "Demo project-tagged chemical consulting",
        includesPpn: true,
        includedTaxKind: CommercialTaxKind.PPN,
        ppnRatePercent: toDecimal(11),
        purchaseCategory: PurchaseCategory.SERVICE,
        purpose: PurchasePurpose.PROJECT,
        projectId: periodProject.id,
        paymentTermsDays: 14,
        createdById: vicko.id,
      },
    });
  }

  const pettyPurchase = await prisma.purchaseInvoice.findUnique({
    where: { id: "demo-mod-pi-petty" },
  });
  if (!pettyPurchase) {
    const filePath = await writeUpload(
      "purchase-invoices",
      "demo-mod-petty-topup.pdf"
    );
    await prisma.purchaseInvoice.create({
      data: {
        id: "demo-mod-pi-petty",
        companyId: company.id,
        supplierName: "Petty Cash Float",
        invoiceRef: "PC-TOPUP-2026-08",
        invoiceDate: utcDate(2026, 8, 1),
        amount: toDecimal(5_000_000),
        filePath,
        notes: "Demo field float top-up",
        includesPpn: false,
        purchaseCategory: PurchaseCategory.PETTY_CASH,
        purpose: PurchasePurpose.PETTY_CASH,
        paidAt: utcDate(2026, 8, 1),
        paidById: vicko.id,
        createdById: vicko.id,
      },
    });
  }
  const pettyProof = await writeUpload("petty-cash", "demo-mod-spend-proof.pdf");
  await prisma.pettyCashEntry.upsert({
    where: { id: "demo-mod-pc-topup" },
    update: {},
    create: {
      id: "demo-mod-pc-topup",
      companyId: company.id,
      kind: PettyCashEntryKind.TOP_UP,
      status: PettyCashEntryStatus.POSTED,
      amount: toDecimal(5_000_000),
      entryDate: utcDate(2026, 8, 1),
      description: "Field float top-up",
      purchaseInvoiceId: "demo-mod-pi-petty",
      createdById: vicko.id,
      postedAt: utcDate(2026, 8, 1),
    },
  });
  await prisma.pettyCashEntry.upsert({
    where: { id: "demo-mod-pc-spend" },
    update: {},
    create: {
      id: "demo-mod-pc-spend",
      companyId: company.id,
      kind: PettyCashEntryKind.SPEND,
      status: PettyCashEntryStatus.POSTED,
      amount: toDecimal(185_000),
      entryDate: utcDate(2026, 8, 12),
      description: "Site drinking water and trash bags",
      projectId: periodProject.id,
      createdById: vicko.id,
      postedAt: utcDate(2026, 8, 12),
      proofPath: pettyProof,
    },
  });
  await prisma.pettyCashEntry.upsert({
    where: { id: "demo-mod-pc-ptpay" },
    update: {},
    create: {
      id: "demo-mod-pc-ptpay",
      companyId: company.id,
      kind: PettyCashEntryKind.PART_TIME_PAY,
      status: PettyCashEntryStatus.POSTED,
      amount: toDecimal(180_000),
      entryDate: utcDate(2026, 8, 13),
      description: "Part-time daily pay — Lina",
      projectId: periodProject.id,
      employeeId: empPt.id,
      createdById: vicko.id,
      postedAt: utcDate(2026, 8, 13),
    },
  });

  await prisma.projectExpense.upsert({
    where: { id: "demo-mod-exp-comp" },
    update: {},
    create: {
      id: "demo-mod-exp-comp",
      companyId: company.id,
      projectId: periodProject.id,
      employeeId: empSite.id,
      category: "CLIENT_COMPENSATION",
      amount: toDecimal(750_000),
      reason: "Replaced a cracked lobby planter paid to the client",
      incurredAt: utcDate(2026, 8, 6),
      createdById: vicko.id,
    },
  });

  await prisma.leaveRequest.upsert({
    where: { id: "demo-mod-leave-pending" },
    update: {},
    create: {
      id: "demo-mod-leave-pending",
      employeeId: empSite2.id,
      type: LeaveType.SICK,
      startDate: utcDate(2026, 8, 21),
      endDate: utcDate(2026, 8, 21),
      reason: "Fever — waiting for OM review",
      status: ApprovalStatus.PENDING,
    },
  });
  await prisma.leaveRequest.upsert({
    where: { id: "demo-mod-leave-approved" },
    update: {},
    create: {
      id: "demo-mod-leave-approved",
      employeeId: empLand.id,
      type: LeaveType.PERMISSION,
      startDate: utcDate(2026, 8, 7),
      endDate: utcDate(2026, 8, 7),
      reason: "Family administration at kelurahan",
      status: ApprovalStatus.APPROVED,
      reviewedById: managerUser.id,
      reviewedAt: utcDate(2026, 8, 6),
    },
  });
  await prisma.leaveRequest.upsert({
    where: { id: "demo-mod-leave-rejected" },
    update: {},
    create: {
      id: "demo-mod-leave-rejected",
      employeeId: empPt.id,
      type: LeaveType.PERMISSION,
      startDate: utcDate(2026, 8, 18),
      endDate: utcDate(2026, 8, 18),
      reason: "Personal errand — site already short",
      status: ApprovalStatus.REJECTED,
      reviewNote: "Need coverage on the double-shift week.",
      reviewedById: managerUser.id,
      reviewedAt: utcDate(2026, 8, 17),
    },
  });

  const cicoDays = [12, 13, 14, 15, 18];
  for (const day of cicoDays) {
    await prisma.attendance.upsert({
      where: {
        employeeId_date_projectId: {
          employeeId: empSite.id,
          date: utcDate(2026, 8, day),
          projectId: periodProject.id,
        },
      },
      update: {
        checkIn: wib(2026, 8, day, 7),
        checkOut: wib(2026, 8, day, 16),
        checkInLat: -6.224,
        checkInLng: 106.809,
        checkOutLat: -6.2241,
        checkOutLng: 106.8091,
        checkInDistanceMeters: 12,
        checkOutDistanceMeters: 15,
      },
      create: {
        employeeId: empSite.id,
        projectId: periodProject.id,
        date: utcDate(2026, 8, day),
        checkIn: wib(2026, 8, day, 7),
        checkOut: wib(2026, 8, day, 16),
        checkInLat: -6.224,
        checkInLng: 106.809,
        checkOutLat: -6.2241,
        checkOutLng: 106.8091,
        checkInDistanceMeters: 12,
        checkOutDistanceMeters: 15,
      },
    });
    await prisma.progressReport.upsert({
      where: { id: `demo-mod-progress-${day}` },
      update: {},
      create: {
        id: `demo-mod-progress-${day}`,
        projectId: periodProject.id,
        employeeId: empSite.id,
        reportDate: utcDate(2026, 8, day),
        stageLabel: "Lobby and lift lobby",
        notes: "Daily regular clean complete. List cards have no photos.",
        status: ProgressReportStatus.SUBMITTED,
      },
    });
  }
  await prisma.attendance.upsert({
    where: {
      employeeId_date_projectId: {
        employeeId: empSite.id,
        date: utcDate(2026, 8, 19),
        projectId: periodProject.id,
      },
    },
    update: {
      checkIn: wib(2026, 8, 19, 5),
      checkOut: wib(2026, 8, 19, 23),
      note: "Double shift — 18 hours = 2× daily rate",
    },
    create: {
      employeeId: empSite.id,
      projectId: periodProject.id,
      date: utcDate(2026, 8, 19),
      checkIn: wib(2026, 8, 19, 5),
      checkOut: wib(2026, 8, 19, 23),
      note: "Double shift — 18 hours = 2× daily rate",
      checkInLat: -6.224,
      checkInLng: 106.809,
      checkOutLat: -6.224,
      checkOutLng: 106.809,
    },
  });

  const mrRequested = await prisma.materialRequest.upsert({
    where: { id: "demo-mod-mr-requested" },
    update: {},
    create: {
      id: "demo-mod-mr-requested",
      companyId: company.id,
      projectId: periodProject.id,
      requestedById: empSite.id,
      status: MaterialRequestStatus.REQUESTED,
      notes: "Need more cloths for next week",
    },
  });
  if (
    (await prisma.materialRequestLine.count({
      where: { materialRequestId: mrRequested.id },
    })) === 0
  ) {
    await prisma.materialRequestLine.create({
      data: {
        materialRequestId: mrRequested.id,
        itemId: itemCons.id,
        quantity: toDecimal(12),
      },
    });
  }

  const mrApproved = await prisma.materialRequest.upsert({
    where: { id: "demo-mod-mr-approved" },
    update: {},
    create: {
      id: "demo-mod-mr-approved",
      companyId: company.id,
      projectId: pGcContract.id,
      requestedById: empSite2.id,
      status: MaterialRequestStatus.APPROVED,
      notes: "Chemical top-up after deep clean",
      reviewedById: managerUser.id,
      reviewedAt: utcDate(2026, 8, 9),
    },
  });
  if (
    (await prisma.materialRequestLine.count({
      where: { materialRequestId: mrApproved.id },
    })) === 0
  ) {
    await prisma.materialRequestLine.create({
      data: {
        materialRequestId: mrApproved.id,
        itemId: itemChem.id,
        quantity: toDecimal(2),
      },
    });
  }
  const toSent = await prisma.transferOrder.upsert({
    where: { id: "demo-mod-to-sent" },
    update: {},
    create: {
      id: "demo-mod-to-sent",
      companyId: company.id,
      projectId: pGcContract.id,
      materialRequestId: mrApproved.id,
      status: TransferOrderStatus.SENT,
      notes: "Sent from warehouse",
      sentAt: utcDate(2026, 8, 10),
      sentById: warehouseUser.id,
    },
  });
  if (
    (await prisma.transferOrderLine.count({
      where: { transferOrderId: toSent.id },
    })) === 0
  ) {
    await prisma.transferOrderLine.create({
      data: {
        transferOrderId: toSent.id,
        itemId: itemChem.id,
        quantity: toDecimal(2),
      },
    });
  }

  const mrReceived = await prisma.materialRequest.upsert({
    where: { id: "demo-mod-mr-received" },
    update: {},
    create: {
      id: "demo-mod-mr-received",
      companyId: company.id,
      projectId: pLandReg.id,
      requestedById: empLand.id,
      status: MaterialRequestStatus.APPROVED,
      notes: "Cloths for garden wipe-down",
      reviewedById: managerUser.id,
      reviewedAt: utcDate(2026, 8, 5),
    },
  });
  if (
    (await prisma.materialRequestLine.count({
      where: { materialRequestId: mrReceived.id },
    })) === 0
  ) {
    await prisma.materialRequestLine.create({
      data: {
        materialRequestId: mrReceived.id,
        itemId: itemCons.id,
        quantity: toDecimal(8),
      },
    });
  }
  const toReceived = await prisma.transferOrder.upsert({
    where: { id: "demo-mod-to-received" },
    update: {},
    create: {
      id: "demo-mod-to-received",
      companyId: company.id,
      projectId: pLandReg.id,
      materialRequestId: mrReceived.id,
      status: TransferOrderStatus.RECEIVED,
      sentAt: utcDate(2026, 8, 6),
      sentById: warehouseUser.id,
      receivedAt: utcDate(2026, 8, 7),
      receivedById: empLand.id,
    },
  });
  if (
    (await prisma.transferOrderLine.count({
      where: { transferOrderId: toReceived.id },
    })) === 0
  ) {
    await prisma.transferOrderLine.create({
      data: {
        transferOrderId: toReceived.id,
        itemId: itemCons.id,
        quantity: toDecimal(8),
      },
    });
  }

  await prisma.payrollDeduction.upsert({
    where: { id: "demo-mod-pd-deposit" },
    update: {},
    create: {
      id: "demo-mod-pd-deposit",
      companyId: company.id,
      employeeId: empSite.id,
      projectId: periodProject.id,
      year: 2026,
      month: 8,
      type: PayrollDeductionType.SECURITY_DEPOSIT,
      amount: toDecimal(200_000),
      reason: "Monthly security deposit withhold",
      createdById: vicko.id,
    },
  });
  await prisma.thrPayment.upsert({
    where: { employeeId_year: { employeeId: empSite.id, year: 2026 } },
    update: { amount: toDecimal(4_500_000), status: ThrPaymentStatus.GENERATED },
    create: {
      companyId: company.id,
      employeeId: empSite.id,
      year: 2026,
      hariRayaDate: utcDate(2026, 3, 20),
      amount: toDecimal(4_500_000),
      basePaySnapshot: toDecimal(4_500_000),
      tenureMonths: 26,
      status: ThrPaymentStatus.GENERATED,
    },
  });

  const extensionProof = await writeUpload(
    "contracts",
    "demo-mod-period-extension.pdf"
  );
  await prisma.clientContractExtension.upsert({
    where: { id: "demo-mod-ext-period" },
    update: {},
    create: {
      id: "demo-mod-ext-period",
      projectId: periodProject.id,
      extendedOn: utcDate(2026, 7, 1),
      previousEndDate: utcDate(2026, 9, 15),
      newEndDate: utcDate(2027, 3, 15),
      proofUrl: extensionProof,
      notes: "Client renewed the tower contract through March 2027.",
    },
  });

  const visitSpecs = [
    {
      id: "demo-mod-visit-gc-1",
      visitIndex: 1,
      startDate: utcDate(2026, 8, 10),
      endDate: utcDate(2026, 8, 12),
      amount: 4_000_000,
      teamId: "demo-mod-team-gc",
    },
    {
      id: "demo-mod-visit-gc-2",
      visitIndex: 2,
      startDate: utcDate(2026, 8, 18),
      endDate: utcDate(2026, 8, 19),
      amount: 4_000_000,
      employeeId: empSite2.id,
    },
    {
      id: "demo-mod-visit-gc-3",
      visitIndex: 3,
      startDate: utcDate(2026, 9, 2),
      endDate: utcDate(2026, 9, 3),
      amount: 4_000_000,
    },
  ] as const;
  for (const spec of visitSpecs) {
    const visit = await prisma.projectVisit.upsert({
      where: {
        projectId_visitIndex: {
          projectId: pGcMulti.id,
          visitIndex: spec.visitIndex,
        },
      },
      update: {
        startDate: spec.startDate,
        endDate: spec.endDate,
        amount: toDecimal(spec.amount),
      },
      create: {
        id: spec.id,
        projectId: pGcMulti.id,
        visitIndex: spec.visitIndex,
        startDate: spec.startDate,
        endDate: spec.endDate,
        amount: toDecimal(spec.amount),
      },
    });
    const teamId = "teamId" in spec ? spec.teamId : undefined;
    const employeeId = "employeeId" in spec ? spec.employeeId : undefined;
    if (teamId || employeeId) {
      await prisma.projectVisitAssignment.upsert({
        where: { visitId: visit.id },
        update: {
          teamId: teamId ?? null,
          employeeId: employeeId ?? null,
        },
        create: {
          id: `${spec.id}-crew`,
          visitId: visit.id,
          teamId: teamId ?? null,
          employeeId: employeeId ?? null,
        },
      });
    }
  }
  await prisma.progressReport.upsert({
    where: { id: "demo-mod-progress-multivisit-1" },
    update: {},
    create: {
      id: "demo-mod-progress-multivisit-1",
      projectId: pGcMulti.id,
      employeeId: empSite2.id,
      reportDate: utcDate(2026, 8, 11),
      stageLabel: "Main lobby and reception",
      notes: "Visit 1 deep clean of the lobby floor and glass doors.",
      status: ProgressReportStatus.SUBMITTED,
    },
  });
  await prisma.progressReport.upsert({
    where: { id: "demo-mod-progress-multivisit-2" },
    update: {},
    create: {
      id: "demo-mod-progress-multivisit-2",
      projectId: pGcMulti.id,
      employeeId: empSite2.id,
      reportDate: utcDate(2026, 8, 18),
      stageLabel: "Lift lobby and washrooms",
      notes: "Visit 2 washroom restock and lift-lobby wipe-down.",
      status: ProgressReportStatus.SUBMITTED,
    },
  });

  await prisma.bpjsRemittance.upsert({
    where: { id: "demo-mod-bpjs-kes-202607" },
    update: {},
    create: {
      id: "demo-mod-bpjs-kes-202607",
      companyId: company.id,
      year: 2026,
      month: 7,
      program: "KESEHATAN",
      amount: toDecimal(8_400_000),
      companyShareAmount: toDecimal(6_720_000),
      paidAt: utcDate(2026, 8, 10),
      reference: "VA-KES-202607",
      notes: "Demo July Kesehatan remittance",
      createdById: vicko.id,
    },
  });
  await prisma.bpjsRemittance.upsert({
    where: { id: "demo-mod-bpjs-tk-202607" },
    update: {},
    create: {
      id: "demo-mod-bpjs-tk-202607",
      companyId: company.id,
      year: 2026,
      month: 7,
      program: "KETENAGAKERJAAN",
      amount: toDecimal(11_250_000),
      companyShareAmount: toDecimal(7_875_000),
      paidAt: utcDate(2026, 8, 11),
      reference: "VA-TK-202607",
      notes: "Demo July Ketenagakerjaan remittance",
      createdById: vicko.id,
    },
  });

  let operatingBank = await prisma.companyBankAccount.findFirst({
    where: { companyId: company.id },
    orderBy: { sortOrder: "asc" },
  });
  if (!operatingBank) {
    operatingBank = await prisma.companyBankAccount.create({
      data: {
        id: "demo-mod-bank-bca",
        companyId: company.id,
        bankName: "BCA",
        accountNumber: "0888123456",
        accountHolder: "PT Relasi Global Solusi",
        label: "Operating",
        sortOrder: 0,
      },
    });
  }
  const loanProof = await writeUpload(
    "purchase-invoices",
    "demo-mod-loan-proof.pdf"
  );
  const termInstallment = termMonthlyInstallment(
    2_400_000_000,
    12,
    36,
    "ANNUAL"
  );
  const shareholderInstallment = termMonthlyInstallment(
    500_000_000,
    0,
    24,
    "ANNUAL"
  );
  const existingStandby = await prisma.loanFacility.findUnique({
    where: { id: "demo-mod-loan-standby" },
    select: { id: true },
  });
  if (!existingStandby) {
    await prisma.loanFacility.create({
      data: {
        id: "demo-mod-loan-standby",
        companyId: company.id,
        source: "BANK",
        kind: "STANDBY",
        name: "Demo — BCA Standby Facility",
        lenderName: vendorBank.name,
        vendorId: vendorBank.id,
        bankAccountId: operatingBank.id,
        facilityLimit: toDecimal(10_000_000_000),
        chargesInterest: true,
        interestRateBasis: "ANNUAL",
        annualRatePercent: toDecimal(12),
        startDate: utcDate(2026, 6, 1),
        notes: "Demo KRK-style standby. Daily outstanding, Actual/360.",
        createdById: vicko.id,
        movements: {
          create: [
            {
              id: "demo-mod-loan-standby-draw-1",
              kind: "DRAW",
              movementDate: utcDate(2026, 6, 1),
              amount: toDecimal(1_000_000_000),
              principalAmount: toDecimal(1_000_000_000),
              interestAmount: toDecimal(0),
              bankAccountId: operatingBank.id,
              notes: "First draw — 1 June",
              filePath: loanProof,
              createdById: vicko.id,
            },
            {
              id: "demo-mod-loan-standby-draw-2",
              kind: "DRAW",
              movementDate: utcDate(2026, 6, 20),
              amount: toDecimal(3_000_000_000),
              principalAmount: toDecimal(3_000_000_000),
              interestAmount: toDecimal(0),
              bankAccountId: operatingBank.id,
              notes: "Second draw — 20 June",
              filePath: loanProof,
              createdById: vicko.id,
            },
          ],
        },
      },
    });
  }
  const existingTerm = await prisma.loanFacility.findUnique({
    where: { id: "demo-mod-loan-term" },
    select: { id: true },
  });
  if (!existingTerm) {
    await prisma.loanFacility.create({
      data: {
        id: "demo-mod-loan-term",
        companyId: company.id,
        source: "BANK",
        kind: "TERM",
        name: "Demo — Mandiri Term Loan",
        lenderName: vendorBank.name,
        vendorId: vendorBank.id,
        bankAccountId: operatingBank.id,
        principal: toDecimal(2_400_000_000),
        chargesInterest: true,
        interestRateBasis: "ANNUAL",
        annualRatePercent: toDecimal(12),
        tenorMonths: 36,
        monthlyInstallment: toDecimal(termInstallment),
        startDate: utcDate(2026, 5, 1),
        notes: "Demo term loan. Pay installment or Settle Early.",
        createdById: vicko.id,
        movements: {
          create: {
            id: "demo-mod-loan-term-draw",
            kind: "DRAW",
            movementDate: utcDate(2026, 5, 1),
            amount: toDecimal(2_400_000_000),
            principalAmount: toDecimal(2_400_000_000),
            interestAmount: toDecimal(0),
            bankAccountId: operatingBank.id,
            notes: "Initial term draw",
            filePath: loanProof,
            createdById: vicko.id,
          },
        },
      },
    });
  }
  const existingShareholder = await prisma.loanFacility.findUnique({
    where: { id: "demo-mod-loan-shareholder" },
    select: { id: true },
  });
  if (!existingShareholder) {
    await prisma.loanFacility.create({
      data: {
        id: "demo-mod-loan-shareholder",
        companyId: company.id,
        source: "SHAREHOLDER",
        kind: "TERM",
        name: "Demo — Shareholder Advance",
        lenderName: "Shareholder — Family Advance",
        bankAccountId: operatingBank.id,
        principal: toDecimal(500_000_000),
        chargesInterest: false,
        interestRateBasis: "ANNUAL",
        annualRatePercent: toDecimal(0),
        tenorMonths: 24,
        monthlyInstallment: toDecimal(shareholderInstallment),
        startDate: utcDate(2026, 4, 1),
        notes: "Demo interest-free shareholder term advance.",
        createdById: vicko.id,
        movements: {
          create: [
            {
              id: "demo-mod-loan-shareholder-draw",
              kind: "DRAW",
              movementDate: utcDate(2026, 4, 1),
              amount: toDecimal(500_000_000),
              principalAmount: toDecimal(500_000_000),
              interestAmount: toDecimal(0),
              bankAccountId: operatingBank.id,
              notes: "Shareholder cash in",
              filePath: loanProof,
              createdById: vicko.id,
            },
            {
              id: "demo-mod-loan-shareholder-repay",
              kind: "REPAYMENT",
              movementDate: utcDate(2026, 7, 1),
              amount: toDecimal(shareholderInstallment),
              principalAmount: toDecimal(shareholderInstallment),
              interestAmount: toDecimal(0),
              bankAccountId: operatingBank.id,
              notes: "July installment return",
              filePath: loanProof,
              createdById: vicko.id,
            },
          ],
        },
      },
    });
  }

  await seedDemoImportEquipment(prisma);
  await seedDemoPendingTransferOrders(prisma);

  console.log("✅ Demo all-modules seed complete");
  console.log("");
  console.log("Owner login unchanged: vicko");
  console.log("Linked demo logins: manager, office, site, site2, am, tech, warehouse, ptcrew");
  console.log("Client portals: client (Gedung), sari (individual)");
  console.log("Passwords: admin123 / manager123 / staff123 / client123");
  console.log("");
  console.log("Period-row project: Demo — Twin Period Tower");
  console.log("  • 2× Pending Approval (Awaiting Client + Client Revised)");
  console.log("  • 2× Payment Due");
  console.log("Newer modules: loans (bank + shareholder), multi-visit crew, BPJS remittances");
  console.log("Re-run: npx tsx prisma/seed-demo-all-modules.ts");
}

const isDirectRun =
  typeof process.argv[1] === "string" &&
  process.argv[1].replace(/\\/g, "/").endsWith("prisma/seed-demo-all-modules.ts");

if (isDirectRun) {
  const prisma = new PrismaClient();
  seedDemoAllModules(prisma)
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
