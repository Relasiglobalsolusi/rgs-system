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
  getInternalPayrollLockRecord,
  lockInternalPayrollPeriod,
  unlockInternalPayrollPeriod,
} from "@/lib/internal-payroll-lock";
import {
  INTERNAL_PAYROLL_WORKING_DAYS_DIVISOR,
  loadInternalPayrollMonth,
} from "@/lib/internal-payroll-month";
import {
  isPayrollPeriodReconciled,
  utcRangeForPayrollPeriod,
  parsePayrollRunKind,
} from "@/lib/internal-payroll-period";
import {
  HEAD_OFFICE_PAYROLL_PROJECT,
  hasHeldSecurityDeposit,
  isManualDeductionType,
  nextDepositHeldAmount,
  nextDepositStatusAfterHold,
} from "@/lib/payroll-deductions";
import { formatEmployeeName } from "@/lib/employee-user-link";
import { recordInternalPayrollChange } from "@/lib/internal-payroll-audit";
import { formatContractPrice } from "@/lib/project-billing";
import { toActionError } from "@/lib/prisma-errors";
import { parseDateInput } from "@/lib/invoice-period";
import { dayShiftHours } from "@/lib/internal-payroll-days";
import { hoursMeetShift } from "@/lib/shift-pay";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/project-billing";
import { isOperationsManagerPosition } from "@/lib/positions";
import { isOwnerAccount } from "@/lib/permissions";
import { jakartaYearMonth } from "@/lib/vat";
import { requireFinanceChild, requireModule } from "@/lib/session";

async function requirePayrollAccess() {
  return requireFinanceChild("payroll");
}

function parseYearMonth(yearRaw: unknown, monthRaw: unknown) {
  const now = jakartaYearMonth();
  const year = Math.max(2000, Math.min(2100, Number(yearRaw) || now.year));
  const month = Math.max(1, Math.min(12, Number(monthRaw) || now.month));
  return { year, month };
}

function parseRun(raw: unknown) {
  return parsePayrollRunKind(raw);
}

function payrollActorName(user: {
  name?: string | null;
  username?: string | null;
}): string {
  return user.name?.trim() || user.username?.trim() || "User";
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

function revalidateInternalPayroll() {
  revalidatePath("/billing/payroll");
  revalidatePath("/billing/financial-report");
  revalidatePath("/employees");
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
    if (typeRaw !== "OVERTIME" && !isManualDeductionType(typeRaw)) {
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
        firstName: true,
        lastName: true,
        depositHeldAmount: true,
        depositStatus: true,
        securityDepositRequired: true,
        overtimeEnabled: true,
        payrollRun: true,
      },
    });
    if (!employee) {
      throw new Error(translate(locale, "pages.payroll.errors.employeeNotFound"));
    }
    if (typeRaw === "OVERTIME" && !employee.overtimeEnabled) {
      throw new Error(
        translate(locale, "pages.payroll.errors.overtimeNotEnabled")
      );
    }
    if (typeRaw === "OVERTIME") {
      const actor = await prisma.employee.findFirst({
        where: {
          companyId,
          userId: session.user.id,
        },
        select: {
          jobPosition: { select: { slug: true, name: true } },
        },
      });
      const canAddOvertime =
        isOwnerAccount(session.user) ||
        isOperationsManagerPosition(actor?.jobPosition ?? {});
      if (!canAddOvertime) {
        throw new Error(
          translate(locale, "pages.payroll.errors.overtimeOmOnly")
        );
      }
    }

    await assertInternalPayrollPeriodUnlocked(
      companyId,
      year,
      month,
      translate(locale, "pages.payroll.errors.periodLocked"),
      employee.payrollRun
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
          run: employee.payrollRun,
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

    // Permanent record of who changed this period and what changed.
    await recordInternalPayrollChange({
      companyId,
      userId: session.user.id,
      year,
      month,
      run: employee.payrollRun,
      action: "PAYROLL_LINE_ADDED",
      description: `${typeRaw} ${formatContractPrice(amount)} for ${formatEmployeeName(employee)}${
        reason ? ` — ${reason}` : ""
      }`,
      newValue: { type: typeRaw, amount, employeeId: employee.id },
    });

    revalidateInternalPayroll();
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
        run: true,
        employeeId: true,
        inventoryMovementId: true,
        employee: {
          select: {
            firstName: true,
            lastName: true,
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
      translate(locale, "pages.payroll.errors.periodLocked"),
      line.run
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

    // Permanent record of who changed this period and what changed.
    await recordInternalPayrollChange({
      companyId,
      userId: session.user.id,
      year: line.year,
      month: line.month,
      run: line.run,
      action: "PAYROLL_LINE_REMOVED",
      description: `${line.type} ${formatContractPrice(
        decimalToNumber(line.amount) ?? 0
      )} removed for ${formatEmployeeName(line.employee)}`,
      oldValue: {
        type: line.type,
        amount: decimalToNumber(line.amount) ?? 0,
        employeeId: line.employeeId,
      },
    });

    revalidateInternalPayroll();
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.payroll.errors.deleteFailed")
    );
  }
}

export async function requestInternalPayrollUnlock(formData: FormData) {
  const locale = await getServerLocale();
  try {
    const session = await requirePayrollAccess();
    const { year, month } = parseYearMonth(
      formData.get("year"),
      formData.get("month")
    );
    const run = parseRun(formData.get("run"));
    const reason = String(formData.get("reason") ?? "").trim();
    if (!reason) {
      throw new Error(translate(locale, "pages.payroll.errors.unlockReasonRequired"));
    }
    const companyId = session.user.companyId;
    const actorName = payrollActorName(session.user);

    await prisma.$transaction(async (tx) => {
      const lock = await tx.internalPayrollLock.findUnique({
        where: {
          companyId_year_month_run: { companyId, year, month, run },
        },
        select: { locked: true },
      });
      if (!lock?.locked) {
        throw new Error(
          translate(locale, "pages.payroll.errors.unlockRequestLockedOnly")
        );
      }
      const pendingRequest = await tx.payrollUnlockRequest.findFirst({
        where: { companyId, year, month, run, status: "PENDING" },
        select: { id: true },
      });
      if (pendingRequest) {
        throw new Error(
          translate(locale, "pages.payroll.errors.unlockRequestAlreadyPending")
        );
      }
      await tx.payrollUnlockRequest.create({
        data: {
          companyId,
          year,
          month,
          run,
          reason,
          requestedById: session.user.id,
          requestedByName: actorName,
        },
      });
      await recordInternalPayrollChange({
        companyId,
        userId: session.user.id,
        year,
        month,
        run,
        action: "PAYROLL_UNLOCK_REQUESTED",
        description: `${actorName} requested an unlock. Reason: ${reason}`,
        newValue: { reason, requestedByName: actorName },
        db: tx,
      });
    });

    revalidatePath("/billing/payroll");
    revalidatePath("/approvals");
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.payroll.errors.unlockRequestFailed")
    );
  }
}

export async function cancelInternalPayrollUnlock(formData: FormData) {
  const locale = await getServerLocale();
  try {
    const session = await requirePayrollAccess();
    const id = String(formData.get("id") ?? "").trim();
    if (!id) {
      throw new Error(
        translate(locale, "pages.payroll.errors.unlockRequestNotFound")
      );
    }
    const companyId = session.user.companyId;
    const actorName = payrollActorName(session.user);

    await prisma.$transaction(async (tx) => {
      const request = await tx.payrollUnlockRequest.findFirst({
        where: {
          id,
          companyId,
          requestedById: session.user.id,
          status: "PENDING",
        },
      });
      if (!request) {
        throw new Error(
          translate(locale, "pages.payroll.errors.unlockRequestNotFound")
        );
      }
      const cancelled = await tx.payrollUnlockRequest.updateMany({
        where: {
          id: request.id,
          companyId,
          requestedById: session.user.id,
          status: "PENDING",
        },
        data: {
          status: "CANCELLED",
          decidedById: session.user.id,
          decidedByName: actorName,
          decidedAt: new Date(),
          decisionNote: "Withdrawn by requester",
        },
      });
      if (cancelled.count !== 1) {
        throw new Error(
          translate(locale, "pages.payroll.errors.unlockRequestNotFound")
        );
      }
      await recordInternalPayrollChange({
        companyId,
        userId: session.user.id,
        year: request.year,
        month: request.month,
        run: request.run,
        action: "PAYROLL_UNLOCK_CANCELLED",
        description: `${actorName} withdrew their unlock request.`,
        oldValue: { reason: request.reason, status: request.status },
        newValue: { status: "CANCELLED" },
        db: tx,
      });
    });

    revalidatePath("/billing/payroll");
    revalidatePath("/approvals");
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.payroll.errors.unlockCancelFailed")
    );
  }
}

export async function decideInternalPayrollUnlock(formData: FormData) {
  const locale = await getServerLocale();
  try {
    const session = await requireModule("approvals");
    if (!isOwnerAccount(session.user)) {
      throw new Error(
        translate(locale, "pages.payroll.errors.unlockOwnerApprovalOnly")
      );
    }
    const id = String(formData.get("id") ?? "").trim();
    const decision = String(formData.get("decision") ?? "")
      .trim()
      .toUpperCase();
    const decisionNote =
      String(formData.get("decisionNote") ?? "").trim() || null;
    if (!id || (decision !== "APPROVE" && decision !== "REJECT")) {
      throw new Error(
        translate(locale, "pages.payroll.errors.unlockRequestNotFound")
      );
    }
    const companyId = session.user.companyId;
    const actorName = payrollActorName(session.user);

    await prisma.$transaction(async (tx) => {
      const request = await tx.payrollUnlockRequest.findFirst({
        where: { id, companyId, status: "PENDING" },
      });
      if (!request) {
        throw new Error(
          translate(locale, "pages.payroll.errors.unlockRequestNotFound")
        );
      }

      if (decision === "APPROVE") {
        const lock = await tx.internalPayrollLock.findUnique({
          where: {
            companyId_year_month_run: {
              companyId,
              year: request.year,
              month: request.month,
              run: request.run,
            },
          },
          select: { locked: true },
        });
        if (!lock?.locked) {
          throw new Error(
            translate(locale, "pages.payroll.errors.unlockRequestAlreadyOpen")
          );
        }
        await unlockInternalPayrollPeriod(
          {
            companyId,
            year: request.year,
            month: request.month,
            run: request.run,
            actor: { id: session.user.id, name: actorName },
            reason: request.reason,
          },
          tx
        );
      }

      const updated = await tx.payrollUnlockRequest.updateMany({
        where: { id: request.id, companyId, status: "PENDING" },
        data: {
          status: decision === "APPROVE" ? "APPROVED" : "REJECTED",
          decidedById: session.user.id,
          decidedByName: actorName,
          decidedAt: new Date(),
          decisionNote,
        },
      });
      if (updated.count !== 1) {
        throw new Error(
          translate(locale, "pages.payroll.errors.unlockRequestNotFound")
        );
      }
      await recordInternalPayrollChange({
        companyId,
        userId: session.user.id,
        year: request.year,
        month: request.month,
        run: request.run,
        action:
          decision === "APPROVE"
            ? "PAYROLL_UNLOCK_APPROVED"
            : "PAYROLL_UNLOCK_REJECTED",
        description: `${actorName} ${
          decision === "APPROVE" ? "approved" : "rejected"
        } the unlock request.${decisionNote ? ` Note: ${decisionNote}` : ""}`,
        oldValue: { status: request.status, reason: request.reason },
        newValue: {
          status: decision === "APPROVE" ? "APPROVED" : "REJECTED",
          decisionNote,
        },
        db: tx,
      });
    });

    revalidatePath("/billing/payroll");
    revalidatePath("/billing/financial-report");
    revalidatePath("/approvals");
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.payroll.errors.unlockDecisionFailed")
    );
  }
}

export async function generateAndLockInternalPayroll(formData: FormData) {
  const locale = await getServerLocale();
  try {
    const session = await requirePayrollAccess();
    const companyId = session.user.companyId;
    if (!companyId) {
      throw new Error(translate(locale, "pages.payroll.errors.exportFailed"));
    }
    if (String(formData.get("confirmLock") ?? "") !== "1") {
      throw new Error(translate(locale, "pages.payroll.errors.lockConfirmRequired"));
    }
    const { year, month } = parseYearMonth(
      formData.get("year"),
      formData.get("month")
    );
    const run = parseRun(formData.get("run"));
    const existing = await getInternalPayrollLockRecord(
      companyId,
      year,
      month,
      run
    );
    if (existing?.locked) return;

    if (!isPayrollPeriodReconciled(year, month, new Date(), run)) {
      throw new Error(translate(locale, "pages.payroll.errors.periodNotFinished"));
    }

    const rows = await loadInternalPayrollMonth({
      companyId,
      year,
      month,
      run,
    });
    await lockInternalPayrollPeriod({
      companyId,
      year,
      month,
      run,
      actor: {
        id: session.user.id,
        name: payrollActorName(session.user),
      },
      snapshot: rows,
    });
    revalidatePath("/billing/payroll");
    revalidatePath("/billing/financial-report");
  } catch (error) {
    throw toActionError(
      error,
      translate(locale, "pages.payroll.errors.exportFailed")
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

    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, companyId },
      select: {
        id: true,
        basePay: true,
        cicoExempt: true,
        payrollRun: true,
        attendances: {
          where: { date: parseDateInput(dateKey) },
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

    await assertInternalPayrollPeriodUnlocked(
      companyId,
      year,
      month,
      translate(locale, "pages.payroll.errors.periodLocked"),
      employee.payrollRun
    );

    const workDate = parseDateInput(dateKey);
    const { start, endExclusive } = utcRangeForPayrollPeriod(
      year,
      month,
      employee.payrollRun
    );
    if (workDate < start || workDate >= endExclusive) {
      throw new Error(translate(locale, "pages.payroll.errors.dayRequired"));
    }
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
    const existingDecision = await prisma.internalPayrollDayDecision.findUnique({
      where: {
        companyId_employeeId_workDate: {
          companyId,
          employeeId: employee.id,
          workDate,
        },
      },
      select: { paidAmount: true, status: true },
    });
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

    // Permanent record of who changed this period and what changed.
    await recordInternalPayrollChange({
      companyId,
      userId: session.user.id,
      year,
      month,
      run: employee.payrollRun,
      action: "PAYROLL_DAY_PAY_SET",
      description: `${dateKey} set to ${
        decisionRaw === "FULL_PAY" ? "full pay" : "custom amount"
      } ${formatContractPrice(paidAmount)}`,
      oldValue: existingDecision
        ? {
            employeeId: employee.id,
            dateKey,
            status: existingDecision.status,
            paidAmount: decimalToNumber(existingDecision.paidAmount),
          }
        : { employeeId: employee.id, dateKey },
      newValue: {
        employeeId: employee.id,
        dateKey,
        status: decisionRaw,
        paidAmount,
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

