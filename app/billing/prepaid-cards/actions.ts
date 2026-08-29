"use server";

import { revalidatePath } from "next/cache";

import { getServerLocale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";
import { parseDateInput } from "@/lib/invoice-period";
import {
  nextPayrollPeriod,
  upcomingWagePayrollPeriod,
} from "@/lib/internal-payroll-period";
import { isOwnerAccount } from "@/lib/permissions";
import {
  allowedSpendKinds,
  canAssignPrepaidCard,
  canMarkPrepaidCardDamaged,
  canReplacePrepaidCard,
  canReportPrepaidCardLost,
  canReturnPrepaidCard,
  canSpendOnPrepaidCard,
  formatPrepaidCardNumber,
  normalizePrepaidCardNumber,
  parsePrepaidCardKind,
  parsePrepaidCardSpendKind,
  parsePrepaidLossRecoveryKind,
  prepaidLostReturnLabel,
  prepaidReplacementFeeLabel,
  splitPrepaidLossIntoTen,
} from "@/lib/prepaid-card";
import {
  assertPrepaidCardNumberAvailable,
  assertVehicleHasNoLiveCard,
  currentPrepaidAssignment,
  recordReplacementFeeOnCard,
  requireActiveEmployee,
  requireOwnedVehicle,
  returnPrepaidCardToStandby,
  startPrepaidAssignment,
  transferPrepaidCardLeftover,
  writePrepaidCardEntry,
} from "@/lib/prepaid-card-lifecycle";
import { decimalToNumber, parseContractPrice } from "@/lib/project-billing";
import { prisma } from "@/lib/prisma";
import { todayDateInput } from "@/lib/project-contract";
import { requireAdvanceCashPrepaidAccess } from "@/lib/session";
import { saveUpload } from "@/lib/upload";
import { nextPettyCashTopUpRef } from "@/lib/petty-cash";
import { getCompanyBankAccount } from "@/lib/company-bank-accounts";
import { formatEmployeeName } from "@/lib/employee-user-link";

function revalidatePrepaidCardPaths() {
  revalidatePath("/billing/petty-cash");
  revalidatePath("/billing/financial-report");
  revalidatePath("/billing/payroll");
}

async function requireOwnerPrepaidCardManage() {
  const session = await requireAdvanceCashPrepaidAccess();
  if (!isOwnerAccount({ username: session.user.username })) {
    const locale = await getServerLocale();
    throw new Error(translate(locale, "pages.pettyCash.cardManageDenied"));
  }
  return session;
}

async function nextOpenPayrollPeriods(
  companyId: string,
  count: number
): Promise<Array<{ year: number; month: number }>> {
  const locks = await prisma.internalPayrollLock.findMany({
    where: { companyId, locked: true },
    select: { year: true, month: true },
  });
  const locked = new Set(locks.map((row) => `${row.year}-${row.month}`));
  const periods: Array<{ year: number; month: number }> = [];
  let period = upcomingWagePayrollPeriod();
  for (let i = 0; i < 36 && periods.length < count; i += 1) {
    if (!locked.has(`${period.year}-${period.month}`)) periods.push(period);
    period = nextPayrollPeriod(period);
  }
  if (periods.length < count) {
    throw new Error("Could not schedule Card recovery on Internal Payroll.");
  }
  return periods;
}

export async function createPrepaidCard(formData: FormData) {
  const session = await requireOwnerPrepaidCardManage();
  const kind = parsePrepaidCardKind(String(formData.get("kind") ?? "").trim());
  const assignNow = String(formData.get("assignNow") ?? "") === "1";
  const vehicleItemId = String(formData.get("vehicleItemId") ?? "").trim();
  const custodianEmployeeId = String(
    formData.get("custodianEmployeeId") ?? ""
  ).trim();
  if (!kind) throw new Error("Choose Vehicle Card or Open Card.");
  const cardNumber = await assertPrepaidCardNumberAvailable(
    prisma,
    session.user.companyId,
    String(formData.get("cardNumber") ?? "")
  );

  if (assignNow && kind === "VEHICLE") {
    await requireOwnedVehicle(prisma, session.user.companyId, vehicleItemId);
    await assertVehicleHasNoLiveCard(
      prisma,
      session.user.companyId,
      vehicleItemId
    );
  }
  if (assignNow && kind === "OPEN") {
    await requireActiveEmployee(
      prisma,
      session.user.companyId,
      custodianEmployeeId
    );
  }

  await prisma.$transaction(async (tx) => {
    const card = await tx.prepaidCard.create({
      data: {
        companyId: session.user.companyId,
        cardNumber,
        kind,
        status: assignNow ? "ACTIVE" : "STANDBY",
        vehicleItemId: assignNow && kind === "VEHICLE" ? vehicleItemId : null,
        custodianEmployeeId:
          assignNow && kind === "OPEN" ? custodianEmployeeId : null,
        currentBalance: 0,
      },
    });
    if (assignNow) {
      await startPrepaidAssignment(tx, {
        prepaidCardId: card.id,
        vehicleItemId: kind === "VEHICLE" ? vehicleItemId : null,
        custodianEmployeeId: kind === "OPEN" ? custodianEmployeeId : null,
      });
    }
  });
  revalidatePrepaidCardPaths();
}

export async function assignPrepaidCard(formData: FormData) {
  const session = await requireOwnerPrepaidCardManage();
  const prepaidCardId = String(formData.get("prepaidCardId") ?? "").trim();
  const vehicleItemId = String(formData.get("vehicleItemId") ?? "").trim();
  const custodianEmployeeId = String(
    formData.get("custodianEmployeeId") ?? ""
  ).trim();
  if (!prepaidCardId) throw new Error("Choose a Card.");

  await prisma.$transaction(async (tx) => {
    const card = await tx.prepaidCard.findFirst({
      where: { id: prepaidCardId, companyId: session.user.companyId },
    });
    if (!card) throw new Error("Card not found.");
    if (!canAssignPrepaidCard(card.status)) {
      throw new Error("Only a Standby Card can be assigned.");
    }
    if (card.kind === "VEHICLE") {
      await requireOwnedVehicle(tx, session.user.companyId, vehicleItemId);
      await assertVehicleHasNoLiveCard(
        tx,
        session.user.companyId,
        vehicleItemId,
        card.id
      );
    } else {
      await requireActiveEmployee(
        tx,
        session.user.companyId,
        custodianEmployeeId
      );
    }
    await startPrepaidAssignment(tx, {
      prepaidCardId: card.id,
      vehicleItemId: card.kind === "VEHICLE" ? vehicleItemId : null,
      custodianEmployeeId: card.kind === "OPEN" ? custodianEmployeeId : null,
    });
    await tx.prepaidCard.update({
      where: { id: card.id },
      data: {
        status: "ACTIVE",
        vehicleItemId: card.kind === "VEHICLE" ? vehicleItemId : null,
        custodianEmployeeId: card.kind === "OPEN" ? custodianEmployeeId : null,
      },
    });
  });
  revalidatePrepaidCardPaths();
}

export async function reassignPrepaidCard(formData: FormData) {
  const session = await requireOwnerPrepaidCardManage();
  const prepaidCardId = String(formData.get("prepaidCardId") ?? "").trim();
  const vehicleItemId = String(formData.get("vehicleItemId") ?? "").trim();
  const custodianEmployeeId = String(
    formData.get("custodianEmployeeId") ?? ""
  ).trim();
  if (!prepaidCardId) throw new Error("Choose a Card.");

  await prisma.$transaction(async (tx) => {
    const card = await tx.prepaidCard.findFirst({
      where: { id: prepaidCardId, companyId: session.user.companyId },
    });
    if (!card) throw new Error("Card not found.");
    if (card.status !== "ACTIVE") {
      throw new Error("Return the Card to the list before assigning it again.");
    }
    if (card.kind === "VEHICLE") {
      await requireOwnedVehicle(tx, session.user.companyId, vehicleItemId);
      if (vehicleItemId !== card.vehicleItemId) {
        await assertVehicleHasNoLiveCard(
          tx,
          session.user.companyId,
          vehicleItemId,
          card.id
        );
      }
    } else {
      await requireActiveEmployee(
        tx,
        session.user.companyId,
        custodianEmployeeId
      );
    }
    await startPrepaidAssignment(tx, {
      prepaidCardId: card.id,
      vehicleItemId: card.kind === "VEHICLE" ? vehicleItemId : null,
      custodianEmployeeId: card.kind === "OPEN" ? custodianEmployeeId : null,
    });
    await tx.prepaidCard.update({
      where: { id: card.id },
      data: {
        vehicleItemId: card.kind === "VEHICLE" ? vehicleItemId : null,
        custodianEmployeeId: card.kind === "OPEN" ? custodianEmployeeId : null,
      },
    });
  });
  revalidatePrepaidCardPaths();
}

export async function returnPrepaidCardToList(formData: FormData) {
  const session = await requireOwnerPrepaidCardManage();
  const prepaidCardId = String(formData.get("prepaidCardId") ?? "").trim();
  if (!prepaidCardId) throw new Error("Choose a Card.");

  await prisma.$transaction(async (tx) => {
    const card = await tx.prepaidCard.findFirst({
      where: { id: prepaidCardId, companyId: session.user.companyId },
    });
    if (!card) throw new Error("Card not found.");
    if (!canReturnPrepaidCard(card.status)) {
      throw new Error("This Card is not assigned.");
    }
    await returnPrepaidCardToStandby(tx, card.id);
  });
  revalidatePrepaidCardPaths();
}

export async function recordPrepaidCardSpend(formData: FormData) {
  const session = await requireAdvanceCashPrepaidAccess();
  const prepaidCardId = String(formData.get("prepaidCardId") ?? "").trim();
  const spendKind = parsePrepaidCardSpendKind(
    String(formData.get("spendKind") ?? "").trim()
  );
  const note = String(formData.get("description") ?? "").trim();
  const amount = parseContractPrice(String(formData.get("amount") ?? ""));
  if (!prepaidCardId) throw new Error("Choose a Card.");
  if (!spendKind) throw new Error("Choose what this bill is for.");
  if (amount == null || amount <= 0) throw new Error("Enter the amount paid.");

  const proof = formData.get("proof");
  if (!(proof instanceof File) || proof.size === 0) {
    throw new Error("Upload the bill or receipt.");
  }
  const proofPath = await saveUpload(proof, "prepaid-card-proofs", {
    fileBaseName: "prepaid_spend",
  });
  const entryDate = parseDateInput(
    String(formData.get("entryDate") ?? todayDateInput())
  );

  await prisma.$transaction(async (tx) => {
    const card = await tx.prepaidCard.findFirst({
      where: { id: prepaidCardId, companyId: session.user.companyId },
    });
    if (!card) throw new Error("Card not found.");
    if (!canSpendOnPrepaidCard(card.status)) {
      throw new Error("Spend is only allowed on an Active Card.");
    }
    if (!allowedSpendKinds(card.kind).includes(spendKind)) {
      throw new Error("Open Cards can only record Other, with a note.");
    }
    if ((card.kind === "OPEN" || spendKind === "OTHER") && !note) {
      throw new Error("Add a note for this Other spend.");
    }
    const assignment = await currentPrepaidAssignment(tx, card.id);
    const description =
      spendKind === "OTHER" ? note : note || spendKind;
    await writePrepaidCardEntry(tx, {
      cardId: card.id,
      kind: "SPEND",
      spendKind,
      amount,
      balanceDelta: -amount,
      entryDate,
      description,
      createdById: session.user.id,
      proofPath,
      assignmentId: assignment?.id ?? null,
    });
  });
  revalidatePrepaidCardPaths();
}

export async function markPrepaidCardDamaged(formData: FormData) {
  const session = await requireOwnerPrepaidCardManage();
  const prepaidCardId = String(formData.get("prepaidCardId") ?? "").trim();
  const assignNew = String(formData.get("assignNew") ?? "") === "1";
  const replacementCardId = String(
    formData.get("replacementCardId") ?? ""
  ).trim();
  if (!prepaidCardId) throw new Error("Choose a Card.");

  await prisma.$transaction(async (tx) => {
    const card = await tx.prepaidCard.findFirst({
      where: { id: prepaidCardId, companyId: session.user.companyId },
    });
    if (!card) throw new Error("Card not found.");
    if (!canMarkPrepaidCardDamaged(card.status)) {
      throw new Error("Only an Active Card can be marked Damaged.");
    }

    if (assignNew) {
      if (!replacementCardId) {
        throw new Error("Choose a Standby Card to assign now.");
      }
      const replacement = await tx.prepaidCard.findFirst({
        where: { id: replacementCardId, companyId: session.user.companyId },
      });
      if (!replacement) throw new Error("Replacement Card not found.");
      if (replacement.kind !== card.kind) {
        throw new Error("Choose a Card of the same type.");
      }
      if (replacement.status !== "STANDBY") {
        throw new Error("Choose a Standby Card.");
      }
      const vehicleItemId = card.vehicleItemId;
      const custodianEmployeeId = card.custodianEmployeeId;
      await returnPrepaidCardToStandby(tx, card.id);
      await tx.prepaidCard.update({
        where: { id: card.id },
        data: { status: "DAMAGED" },
      });
      if (card.kind === "VEHICLE") {
        if (!vehicleItemId) throw new Error("This Vehicle Card has no vehicle.");
        await startPrepaidAssignment(tx, {
          prepaidCardId: replacement.id,
          vehicleItemId,
        });
        await tx.prepaidCard.update({
          where: { id: replacement.id },
          data: { status: "ACTIVE", vehicleItemId },
        });
      } else {
        if (!custodianEmployeeId) {
          throw new Error("This Open Card has no person in charge.");
        }
        await startPrepaidAssignment(tx, {
          prepaidCardId: replacement.id,
          custodianEmployeeId,
        });
        await tx.prepaidCard.update({
          where: { id: replacement.id },
          data: { status: "ACTIVE", custodianEmployeeId },
        });
      }
      return;
    }

    await tx.prepaidCard.update({
      where: { id: card.id },
      data: { status: "DAMAGED" },
    });
  });
  revalidatePrepaidCardPaths();
}

export async function replacePrepaidCard(formData: FormData) {
  const session = await requireOwnerPrepaidCardManage();
  const prepaidCardId = String(formData.get("prepaidCardId") ?? "").trim();
  const continueSame = String(formData.get("continueSame") ?? "") === "1";
  const destinationCardId = String(
    formData.get("destinationCardId") ?? ""
  ).trim();
  const feeFromLeftover =
    String(formData.get("feeSource") ?? "") === "LEFTOVER";
  const fee = parseContractPrice(String(formData.get("fee") ?? "0")) ?? 0;
  const bankAccountId = String(formData.get("bankAccountId") ?? "").trim();
  const entryDate = parseDateInput(
    String(formData.get("entryDate") ?? todayDateInput())
  );
  if (!prepaidCardId) throw new Error("Choose a Card.");
  if (fee < 0) throw new Error("Replacement fee cannot be negative.");
  if (!feeFromLeftover && fee > 0 && !bankAccountId) {
    throw new Error("Choose the company bank account for the fee.");
  }

  await prisma.$transaction(async (tx) => {
    const card = await tx.prepaidCard.findFirst({
      where: { id: prepaidCardId, companyId: session.user.companyId },
    });
    if (!card) throw new Error("Card not found.");
    if (!canReplacePrepaidCard(card.status)) {
      throw new Error("Card replaced is only available while the Card is Damaged.");
    }
    const leftover = decimalToNumber(card.currentBalance) ?? 0;
    if (feeFromLeftover && fee > leftover) {
      throw new Error("The replacement fee is more than the leftover on this Card.");
    }

    let purchaseInvoiceId: string | null = null;
    if (!feeFromLeftover && fee > 0) {
      const bank = await getCompanyBankAccount(
        session.user.companyId,
        bankAccountId
      );
      if (!bank) throw new Error("Choose the company bank account for the fee.");
      const invoiceRef = nextPettyCashTopUpRef().replace(/^PC-/, "CRF-");
      const invoice = await tx.purchaseInvoice.create({
        data: {
          companyId: session.user.companyId,
          supplierName: "Prepaid Card",
          invoiceRef,
          invoiceDate: entryDate,
          amount: fee,
          filePath: "",
          notes: prepaidReplacementFeeLabel(card.cardNumber),
          includesPpn: false,
          purchaseCategory: "SERVICE",
          purpose: "INTERNAL",
          paidAt: new Date(),
          bankAccountId: bank.id,
          createdById: session.user.id,
          prepaidCardId: card.id,
        },
      });
      purchaseInvoiceId = invoice.id;
    }

    await recordReplacementFeeOnCard(tx, {
      cardId: card.id,
      cardNumber: card.cardNumber,
      fee,
      fromLeftover: feeFromLeftover,
      entryDate,
      createdById: session.user.id,
      bankAccountId: feeFromLeftover ? null : bankAccountId || null,
      purchaseInvoiceId,
    });

    if (continueSame) {
      await tx.prepaidCard.update({
        where: { id: card.id },
        data: { status: "ACTIVE" },
      });
      return;
    }

    if (!destinationCardId) {
      throw new Error("Choose the Card that receives the leftover.");
    }
    const destination = await tx.prepaidCard.findFirst({
      where: { id: destinationCardId, companyId: session.user.companyId },
    });
    if (!destination) throw new Error("Destination Card not found.");
    if (destination.id === card.id) {
      throw new Error("Choose a different Card, or continue on this Card.");
    }
    if (destination.kind !== card.kind) {
      throw new Error("Choose a Card of the same type.");
    }
    if (destination.status === "LOST" || destination.status === "REPLACED") {
      throw new Error("That Card number is retired.");
    }

    const remaining = decimalToNumber(
      (await tx.prepaidCard.findUnique({
        where: { id: card.id },
        select: { currentBalance: true },
      }))?.currentBalance
    ) ?? 0;
    await transferPrepaidCardLeftover(tx, {
      fromCardId: card.id,
      toCardId: destination.id,
      amount: remaining,
      entryDate,
      createdById: session.user.id,
      fromNumber: card.cardNumber,
      toNumber: destination.cardNumber,
    });

    const lastAssignment = await tx.prepaidCardAssignment.findFirst({
      where: { prepaidCardId: card.id },
      orderBy: { startedAt: "desc" },
    });
    if (destination.status === "STANDBY") {
      const vehicleItemId = lastAssignment?.vehicleItemId ?? null;
      const custodianEmployeeId = lastAssignment?.custodianEmployeeId ?? null;
      if (destination.kind === "VEHICLE") {
        if (!vehicleItemId) {
          throw new Error("Assign the replacement Card to the vehicle first.");
        }
        await assertVehicleHasNoLiveCard(
          tx,
          session.user.companyId,
          vehicleItemId,
          destination.id
        );
        await startPrepaidAssignment(tx, {
          prepaidCardId: destination.id,
          vehicleItemId,
        });
        await tx.prepaidCard.update({
          where: { id: destination.id },
          data: { status: "ACTIVE", vehicleItemId },
        });
      } else {
        if (!custodianEmployeeId) {
          throw new Error("Assign the replacement Card to the person in charge first.");
        }
        await startPrepaidAssignment(tx, {
          prepaidCardId: destination.id,
          custodianEmployeeId,
        });
        await tx.prepaidCard.update({
          where: { id: destination.id },
          data: { status: "ACTIVE", custodianEmployeeId },
        });
      }
    }

    await tx.prepaidCard.update({
      where: { id: card.id },
      data: {
        status: "REPLACED",
        replacedByCardId: destination.id,
        vehicleItemId: null,
        custodianEmployeeId: null,
      },
    });
    await tx.prepaidCardAssignment.updateMany({
      where: { prepaidCardId: card.id, endedAt: null },
      data: { endedAt: entryDate },
    });
  });
  revalidatePrepaidCardPaths();
}

export async function reportPrepaidCardLost(formData: FormData) {
  const session = await requireOwnerPrepaidCardManage();
  const prepaidCardId = String(formData.get("prepaidCardId") ?? "").trim();
  const employeeCovers = String(formData.get("employeeCovers") ?? "") === "1";
  const recoveryKind = employeeCovers
    ? parsePrepaidLossRecoveryKind(
        String(formData.get("recoveryKind") ?? "").trim()
      )
    : "COMPANY";
  const employeeId = String(formData.get("employeeId") ?? "").trim();
  const bankAccountId = String(formData.get("bankAccountId") ?? "").trim();
  const entryDate = parseDateInput(
    String(formData.get("entryDate") ?? todayDateInput())
  );
  if (!prepaidCardId) throw new Error("Choose a Card.");
  if (!recoveryKind) throw new Error("Choose how the leftover is recovered.");
  if (employeeCovers && recoveryKind === "COMPANY") {
    throw new Error("Choose how the employee will cover the leftover.");
  }
  if (employeeCovers && !employeeId) {
    throw new Error("Choose the employee who will cover the leftover.");
  }
  if (recoveryKind === "PAY_NOW" && !bankAccountId) {
    throw new Error("Choose the company bank account that received the return.");
  }

  await prisma.$transaction(async (tx) => {
    const card = await tx.prepaidCard.findFirst({
      where: { id: prepaidCardId, companyId: session.user.companyId },
    });
    if (!card) throw new Error("Card not found.");
    if (!canReportPrepaidCardLost(card.status)) {
      throw new Error("This Card is already retired.");
    }
    const leftover = decimalToNumber(card.currentBalance) ?? 0;
    let coveringEmployee: { id: string; firstName: string; lastName: string } | null =
      null;
    if (employeeCovers) {
      coveringEmployee = await tx.employee.findFirst({
        where: {
          id: employeeId,
          companyId: session.user.companyId,
          archivedFromDirectory: false,
        },
        select: { id: true, firstName: true, lastName: true },
      });
      if (!coveringEmployee) throw new Error("Choose the employee who will cover the leftover.");
    }
    if (recoveryKind === "PAY_NOW") {
      const bank = await getCompanyBankAccount(
        session.user.companyId,
        bankAccountId
      );
      if (!bank) {
        throw new Error("Choose the company bank account that received the return.");
      }
    }

    const assignment = await currentPrepaidAssignment(tx, card.id);
    const loss =
      leftover > 0
        ? await tx.prepaidCardLoss.create({
            data: {
              companyId: session.user.companyId,
              prepaidCardId: card.id,
              leftoverAmount: leftover,
              recoveryKind,
              employeeId: coveringEmployee?.id ?? null,
              bankAccountId: recoveryKind === "PAY_NOW" ? bankAccountId : null,
              writtenOffAt: entryDate,
            },
          })
        : null;

    if (leftover > 0) {
      const footed =
        recoveryKind === "COMPANY"
          ? "company"
          : coveringEmployee
            ? formatEmployeeName(coveringEmployee)
            : "employee";
      await writePrepaidCardEntry(tx, {
        cardId: card.id,
        kind: "WRITE_OFF",
        amount: leftover,
        balanceDelta: -leftover,
        entryDate,
        description:
          recoveryKind === "COMPANY"
            ? `Written off · company`
            : `Written off · ${footed}`,
        createdById: session.user.id,
        assignmentId: assignment?.id ?? null,
        lossId: loss?.id ?? null,
      });
    }

    if (loss && leftover > 0 && recoveryKind === "PAY_NOW") {
      await tx.prepaidCardLossRecovery.create({
        data: {
          lossId: loss.id,
          source: "PAY_NOW",
          amount: leftover,
          recoveredAt: entryDate,
          bankAccountId,
          description: prepaidLostReturnLabel(card.cardNumber),
        },
      });
    }

    if (loss && leftover > 0 && (recoveryKind === "NEXT_PAY" || recoveryKind === "INSTALLMENTS")) {
      const count = recoveryKind === "INSTALLMENTS" ? 10 : 1;
      const periods = await nextOpenPayrollPeriods(session.user.companyId, count);
      const amounts =
        recoveryKind === "INSTALLMENTS"
          ? splitPrepaidLossIntoTen(leftover)
          : [leftover];
      const reason = `Lost Card ${formatPrepaidCardNumber(card.cardNumber)}`;
      for (let index = 0; index < amounts.length; index += 1) {
        const amount = amounts[index] ?? 0;
        if (amount <= 0) continue;
        const period = periods[index];
        if (!period) throw new Error("Could not schedule Card recovery on Internal Payroll.");
        await tx.payrollDeduction.create({
          data: {
            companyId: session.user.companyId,
            employeeId: coveringEmployee!.id,
            year: period.year,
            month: period.month,
            type: "LOST_STOCK",
            amount,
            reason,
            itemName: `Prepaid Card ${normalizePrepaidCardNumber(card.cardNumber)}`,
            createdById: session.user.id,
            prepaidCardLossId: loss.id,
          },
        });
      }
    }

    await returnPrepaidCardToStandby(tx, card.id, entryDate);
    await tx.prepaidCard.update({
      where: { id: card.id },
      data: { status: "LOST" },
    });
  });
  revalidatePrepaidCardPaths();
}
