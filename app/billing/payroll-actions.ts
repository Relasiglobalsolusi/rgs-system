"use server";

import { revalidatePath } from "next/cache";

import { ensureInternalAttendanceSites } from "@/lib/ensure-internal-attendance-sites";
import {
  inventoryQtyFromDecimal,
  movementTotalCost,
  normalizeInventoryQty,
  toDecimal,
} from "@/lib/inventory";
import { lockInventoryItemRow } from "@/lib/inventory-access";
import { getServerLocale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";
import {
  assertInternalPayrollPeriodUnlocked,
  canUnlockInternalPayroll,
  unlockInternalPayrollPeriod,
} from "@/lib/internal-payroll-lock";
import {
  HEAD_OFFICE_PAYROLL_PROJECT,
  hasHeldSecurityDeposit,
  isManualDeductionType,
  nextDepositHeldAmount,
  nextDepositStatusAfterHold,
} from "@/lib/payroll-deductions";
import { toActionError } from "@/lib/prisma-errors";
import { parseDateInput } from "@/lib/invoice-period";
import { dayShiftHours } from "@/lib/internal-payroll-days";
import { INTERNAL_PAYROLL_WORKING_DAYS_DIVISOR } from "@/lib/internal-payroll-month";
import { utcRangeForPayrollPeriod } from "@/lib/internal-payroll-period";
import { hoursMeetShift } from "@/lib/shift-pay";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/project-billing";
import { requireFinanceChild, toPermissionUser } from "@/lib/session";
import { jakartaYearMonth } from "@/lib/vat";

async function requirePayrollAccess() {
  return requireFinanceChild("payroll");
}

function parseYearMonth(yearRaw: unknown, monthRaw: unknown) {
  const now = jakartaYearMonth();
  const year = Math.max(2000, Math.min(2100, Number(yearRaw) || now.year));
  const month = Math.max(1, Math.min(12, Number(monthRaw) || now.month));
  return { year, month };
}

function parseRupiahAmount(value: unknown, locale: "en" | "id"): number {
  const digits = String(value ?? "").replace(/[^\d]/g, "");
  const amount = Number(digits);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(translate(locale, "pages.payroll.errors.amountRequired"));
  }
  return Math.round(amount);
}

async function resolveLostStockProjectId(
  companyId: string,
  projectIdRaw: string
): Promise<string | null> {
  if (!projectIdRaw || projectIdRaw === HEAD_OFFICE_PAYROLL_PROJECT) {
    const sites = await ensureInternalAttendanceSites(companyId);
    return sites.sites.find((site) => site.kind === "HEAD_OFFICE")?.projectId ?? null;
  }
  const project = await prisma.project.findFirst({
    where: { id: projectIdRaw, companyId },
    select: { id: true },
  });
  return project?.id ?? null;
}

export async function addPayrollDeduction(formData: FormData) {
  const locale = await getServerLocale();
  try {
    const session = await requirePayrollAccess();
    const companyId = session.user.companyId;
    const employeeId = String(formData.get("employeeId") ?? "").trim();
    const { year, month } = parseYearMonth(
      formData.get("year"),
      formData.get("month")
    );
    const typeRaw = String(formData.get("type") ?? "").trim();
    if (!isManualDeductionType(typeRaw)) {
      throw new Error(translate(locale, "pages.payroll.errors.typeRequired"));
    }
    const amount = parseRupiahAmount(formData.get("amount"), locale);
    const reason = String(formData.get("reason") ?? "").trim();
    if (typeRaw === "OTHER" && !reason) {
      throw new Error(translate(locale, "pages.payroll.errors.reasonRequired"));
    }

    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, companyId },
      select: {
        id: true,
        depositHeldAmount: true,
        depositStatus: true,
        securityDepositRequired: true,
      },
    });
    if (!employee) {
      throw new Error(translate(locale, "pages.payroll.errors.employeeNotFound"));
    }

    await assertInternalPayrollPeriodUnlocked(
      companyId,
      year,
      month,
      translate(locale, "pages.payroll.errors.periodLocked")
    );

    if (typeRaw === "SECURITY_DEPOSIT") {
      if (!employee.securityDepositRequired) {
        throw new Error(
          translate(locale, "pages.payroll.errors.securityDepositNotRequired")
        );
      }
      const [holds, returns] = await Promise.all([
        prisma.payrollDeduction.count({
          where: { employeeId: employee.id, type: "SECURITY_DEPOSIT" },
        }),
        prisma.payrollDeduction.count({
          where: {
            employeeId: employee.id,
            type: "RETURN_OF_SECURITY_DEPOSIT",
          },
        }),
      ]);
      if (
        hasHeldSecurityDeposit({
          depositStatus: employee.depositStatus,
          depositHeldAmount: decimalToNumber(employee.depositHeldAmount) ?? 0,
          securityDepositLines: holds,
          returnOfDepositLines: returns,
        })
      ) {
        throw new Error(
          translate(locale, "pages.payroll.errors.securityDepositAlreadyHeld")
        );
      }
    }

    let projectId: string | null = null;
    let inventoryItemId: string | null = null;
    let itemName: string | null = null;
    let quantity: number | null = null;
    let inventoryMovementId: string | null = null;
    let createClientCompensationExpense = false;

    if (typeRaw === "CLIENT_COMPENSATION") {
      if (!reason) {
        throw new Error(translate(locale, "pages.payroll.errors.reasonRequired"));
      }
      const projectRaw = String(formData.get("projectId") ?? "").trim();
      if (!projectRaw || projectRaw === HEAD_OFFICE_PAYROLL_PROJECT) {
        throw new Error(translate(locale, "pages.payroll.errors.projectRequired"));
      }
      const project = await prisma.project.findFirst({
        where: { id: projectRaw, companyId },
        select: { id: true },
      });
      if (!project) {
        throw new Error(translate(locale, "pages.payroll.errors.projectRequired"));
      }
      projectId = project.id;
      createClientCompensationExpense = true;
    }

    if (typeRaw === "LOST_STOCK") {
      inventoryItemId = String(formData.get("inventoryItemId") ?? "").trim() || null;
      itemName = String(formData.get("itemName") ?? "").trim() || null;
      const qtyRaw = String(formData.get("quantity") ?? "").trim();
      quantity = qtyRaw ? normalizeInventoryQty(Number(qtyRaw)) : null;
      const projectRaw = String(formData.get("projectId") ?? "").trim();
      if (!projectRaw) {
        throw new Error(translate(locale, "pages.payroll.errors.projectRequired"));
      }
      projectId = await resolveLostStockProjectId(companyId, projectRaw);
      const alreadyExpensed =
        String(formData.get("alreadyExpensed") ?? "") === "on" ||
        String(formData.get("alreadyExpensed") ?? "") === "true";

      if (!inventoryItemId && !itemName) {
        throw new Error(translate(locale, "pages.payroll.errors.itemRequired"));
      }

      if (inventoryItemId) {
        const item = await prisma.inventoryItem.findFirst({
          where: {
            id: inventoryItemId,
            companyId,
            active: true,
            deletedAt: null,
          },
          select: { id: true, name: true, itemType: true },
        });
        if (!item) {
          throw new Error(translate(locale, "pages.payroll.errors.itemRequired"));
        }
        itemName = itemName || item.name;
        if (quantity == null || quantity < 1) {
          throw new Error(translate(locale, "pages.payroll.errors.quantityRequired"));
        }

        const isEquipment = item.itemType.toLowerCase() === "equipment";
        if (!alreadyExpensed && !isEquipment && projectId) {
          const existingIssue = await prisma.inventoryMovement.findFirst({
            where: {
              companyId,
              itemId: item.id,
              projectId,
              type: "ISSUE_TO_PROJECT",
              voidedAt: null,
              payrollDeduction: null,
            },
            select: { id: true },
            orderBy: { movedAt: "desc" },
          });
          if (!existingIssue) {
            inventoryMovementId = await prisma.$transaction(async (tx) => {
              const locked = await lockInventoryItemRow(tx, item.id);
              if (!locked || !locked.active) {
                throw new Error(translate(locale, "pages.payroll.errors.itemRequired"));
              }
              const currentStock = inventoryQtyFromDecimal(locked.currentStock);
              if (currentStock <= 0 || quantity! > currentStock) {
                throw new Error(
                  translate(locale, "pages.payroll.errors.insufficientStock")
                );
              }
              const unitCost =
                decimalToNumber(locked.avgUnitCost) ??
                decimalToNumber(locked.lastUnitCost) ??
                0;
              const totalCost = movementTotalCost(quantity!, Math.max(0, unitCost));
              const movement = await tx.inventoryMovement.create({
                data: {
                  companyId,
                  itemId: item.id,
                  projectId,
                  type: "ISSUE_TO_PROJECT",
                  quantity: toDecimal(-quantity!),
                  unitCost: toDecimal(Math.max(0, unitCost)),
                  totalCost: toDecimal(totalCost),
                  movedAt: new Date(),
                  notes: "Lost stock — Internal Payroll",
                  createdById: session.user.id,
                },
              });
              const stockUpdate = await tx.inventoryItem.updateMany({
                where: {
                  id: item.id,
                  currentStock: { gte: toDecimal(quantity!) },
                },
                data: {
                  currentStock: toDecimal(
                    normalizeInventoryQty(currentStock - quantity!)
                  ),
                },
              });
              if (stockUpdate.count !== 1) {
                throw new Error(
                  translate(locale, "pages.payroll.errors.insufficientStock")
                );
              }
              return movement.id;
            });
          }
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.payrollDeduction.create({
        data: {
          companyId,
          employeeId: employee.id,
          year,
          month,
          type: typeRaw,
          amount: toDecimal(amount),
          reason: reason || null,
          itemName,
          quantity: quantity != null ? toDecimal(quantity) : null,
          projectId,
          inventoryItemId,
          inventoryMovementId,
          createdById: session.user.id,
        },
      });

      if (createClientCompensationExpense && projectId) {
        await tx.projectExpense.create({
          data: {
            companyId,
            projectId,
            employeeId: employee.id,
            category: "CLIENT_COMPENSATION",
            amount: toDecimal(amount),
            reason,
            createdById: session.user.id,
          },
        });
      }

      if (typeRaw === "SECURITY_DEPOSIT") {
        const held = nextDepositHeldAmount(
          decimalToNumber(employee.depositHeldAmount) ?? 0,
          amount
        );
        await tx.employee.update({
          where: { id: employee.id },
          data: {
            depositHeldAmount: toDecimal(held),
            depositStatus: nextDepositStatusAfterHold(held),
          },
        });
      }
    });

    revalidatePath("/billing/payroll");
    revalidatePath("/billing/financial-report");
    revalidatePath("/employees");
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.payroll.errors.saveFailed")
    );
  }
}

export async function deletePayrollDeduction(formData: FormData) {
  const locale = await getServerLocale();
  try {
    const session = await requirePayrollAccess();
    const companyId = session.user.companyId;
    const id = String(formData.get("id") ?? "").trim();
    if (!id) {
      throw new Error(translate(locale, "pages.payroll.errors.saveFailed"));
    }

    const line = await prisma.payrollDeduction.findFirst({
      where: { id, companyId },
      select: {
        id: true,
        type: true,
        amount: true,
        year: true,
        month: true,
        employeeId: true,
        inventoryMovementId: true,
        employee: {
          select: {
            depositHeldAmount: true,
            depositStatus: true,
          },
        },
      },
    });
    if (!line) {
      throw new Error(translate(locale, "pages.payroll.errors.saveFailed"));
    }

    await assertInternalPayrollPeriodUnlocked(
      companyId,
      line.year,
      line.month,
      translate(locale, "pages.payroll.errors.periodLocked")
    );

    await prisma.$transaction(async (tx) => {
      if (line.inventoryMovementId) {
        const movement = await tx.inventoryMovement.findFirst({
          where: {
            id: line.inventoryMovementId,
            companyId,
            voidedAt: null,
          },
          select: { id: true, itemId: true, quantity: true },
        });
        if (movement) {
          const qty = Math.abs(inventoryQtyFromDecimal(movement.quantity));
          const locked = await lockInventoryItemRow(tx, movement.itemId);
          if (locked) {
            const currentStock = inventoryQtyFromDecimal(locked.currentStock);
            await tx.inventoryItem.update({
              where: { id: movement.itemId },
              data: {
                currentStock: toDecimal(
                  normalizeInventoryQty(currentStock + qty)
                ),
              },
            });
          }
          await tx.inventoryMovement.update({
            where: { id: movement.id },
            data: {
              voidedAt: new Date(),
              voidReason: "Internal Payroll deduction removed",
            },
          });
        }
      }

      await tx.payrollDeduction.delete({ where: { id: line.id } });

      if (line.type === "SECURITY_DEPOSIT") {
        const held = nextDepositHeldAmount(
          decimalToNumber(line.employee.depositHeldAmount) ?? 0,
          -(decimalToNumber(line.amount) ?? 0)
        );
        await tx.employee.update({
          where: { id: line.employeeId },
          data: {
            depositHeldAmount: toDecimal(held),
            depositStatus:
              line.employee.depositStatus === "HELD"
                ? nextDepositStatusAfterHold(held)
                : line.employee.depositStatus,
          },
        });
      }

      if (line.type === "RETURN_OF_SECURITY_DEPOSIT") {
        await tx.employee.update({
          where: { id: line.employeeId },
          data: {
            depositStatus: "HELD",
          },
        });
      }
    });

    revalidatePath("/billing/payroll");
    revalidatePath("/billing/financial-report");
    revalidatePath("/employees");
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.payroll.errors.deleteFailed")
    );
  }
}

export async function unlockInternalPayroll(formData: FormData) {
  const locale = await getServerLocale();
  try {
    const session = await requirePayrollAccess();
    if (!canUnlockInternalPayroll(toPermissionUser(session))) {
      throw new Error(translate(locale, "pages.payroll.errors.unlockHoOnly"));
    }

    const { year, month } = parseYearMonth(
      formData.get("year"),
      formData.get("month")
    );
    const reason = String(formData.get("reason") ?? "").trim();
    if (!reason) {
      throw new Error(translate(locale, "pages.payroll.errors.unlockReasonRequired"));
    }

    await unlockInternalPayrollPeriod({
      companyId: session.user.companyId,
      year,
      month,
      actor: {
        id: session.user.id,
        name: session.user.name?.trim() || session.user.username || "Head Office",
      },
      reason,
    });

    revalidatePath("/billing/payroll");
    revalidatePath("/billing/financial-report");
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.payroll.errors.unlockFailed")
    );
  }
}

export async function decideInternalPayrollDay(formData: FormData) {
  const locale = await getServerLocale();
  try {
    const session = await requirePayrollAccess();
    const companyId = session.user.companyId;
    const employeeId = String(formData.get("employeeId") ?? "").trim();
    const dateKey = String(formData.get("dateKey") ?? "").trim();
    const decisionRaw = String(formData.get("decision") ?? "").trim();
    const { year, month } = parseYearMonth(
      formData.get("year"),
      formData.get("month")
    );

    if (!employeeId) {
      throw new Error(translate(locale, "pages.payroll.errors.employeeNotFound"));
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      throw new Error(translate(locale, "pages.payroll.errors.dayRequired"));
    }
    if (decisionRaw !== "FULL_PAY" && decisionRaw !== "CUSTOM") {
      throw new Error(translate(locale, "pages.payroll.errors.decisionRequired"));
    }

    await assertInternalPayrollPeriodUnlocked(
      companyId,
      year,
      month,
      translate(locale, "pages.payroll.errors.periodLocked")
    );

    const workDate = parseDateInput(dateKey);
    const { start, endExclusive } = utcRangeForPayrollPeriod(year, month);
    if (workDate < start || workDate >= endExclusive) {
      throw new Error(translate(locale, "pages.payroll.errors.dayRequired"));
    }

    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, companyId },
      select: {
        id: true,
        basePay: true,
        cicoExempt: true,
        attendances: {
          where: { date: workDate },
          select: {
            projectId: true,
            checkIn: true,
            checkOut: true,
          },
        },
      },
    });
    if (!employee) {
      throw new Error(translate(locale, "pages.payroll.errors.employeeNotFound"));
    }
    if (employee.cicoExempt) {
      throw new Error(translate(locale, "pages.payroll.errors.exemptNoDayDecision"));
    }

    const doubleShift = await prisma.doubleShiftAssignment.findFirst({
      where: { employeeId: employee.id, date: workDate },
      select: { projectId: true },
    });
    const counted = dayShiftHours(
      employee.attendances.map((row) => ({
        date: workDate,
        checkIn: row.checkIn,
        checkOut: row.checkOut,
        earlyCheckOut: false,
        projectId: row.projectId,
        projectName: null,
      })),
      doubleShift?.projectId
    );
    if (!counted.hasCompleteCico) {
      throw new Error(translate(locale, "pages.payroll.errors.dayNotComplete"));
    }
    const requiredHours = doubleShift ? 18 : 9;
    if (hoursMeetShift(counted.hours, requiredHours)) {
      throw new Error(translate(locale, "pages.payroll.errors.dayAlreadyComplete"));
    }

    const dailyRate = Math.round(
      (decimalToNumber(employee.basePay) ?? 0) /
        INTERNAL_PAYROLL_WORKING_DAYS_DIVISOR
    );
    const paidAmount =
      decisionRaw === "FULL_PAY"
        ? dailyRate * (doubleShift ? 2 : 1)
        : parseRupiahAmount(formData.get("amount"), locale);

    const now = new Date();
    await prisma.internalPayrollDayDecision.upsert({
      where: {
        companyId_employeeId_workDate: {
          companyId,
          employeeId: employee.id,
          workDate,
        },
      },
      create: {
        companyId,
        employeeId: employee.id,
        workDate,
        year,
        month,
        isDoubleShift: Boolean(doubleShift),
        requiredHours,
        hoursWorked: toDecimal(counted.hours),
        status: decisionRaw,
        paidAmount: toDecimal(paidAmount),
        decidedById: session.user.id,
        decidedAt: now,
      },
      update: {
        year,
        month,
        isDoubleShift: Boolean(doubleShift),
        requiredHours,
        hoursWorked: toDecimal(counted.hours),
        status: decisionRaw,
        paidAmount: toDecimal(paidAmount),
        decidedById: session.user.id,
        decidedAt: now,
      },
    });

    revalidatePath("/billing/payroll");
    revalidatePath("/billing/financial-report");
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.payroll.errors.decideFailed")
    );
  }
}

