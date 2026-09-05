"use server";

import { revalidatePath } from "next/cache";

import { getServerLocale } from "@/lib/i18n/locale";
import { translate, type TranslateParams } from "@/lib/i18n/translate";
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
import { formFiles, saveAndSerializeUploads } from "@/lib/upload-paths";
import {
  parseLitres,
  parseOdometerKm,
  recordVehicleOdometerReading,
  resolveVehicleAssetForPrepaidFuel,
} from "@/lib/vehicle-odometer";
import { nextPettyCashTopUpRef } from "@/lib/petty-cash";
import { getCompanyBankAccount } from "@/lib/company-bank-accounts";
import { formatEmployeeName } from "@/lib/employee-user-link";

async function prepaidError(
  key: string,
  params?: TranslateParams
): Promise<string> {
  const locale = await getServerLocale();
  return translate(locale, `pages.pettyCash.${key}`, params);
}

function revalidatePrepaidCardPaths() {
  revalidatePath("/billing/petty-cash");
  revalidatePath("/billing/financial-report");
  revalidatePath("/billing/payroll");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
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
    throw new Error(await prepaidError("payrollScheduleFailed"));
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
  if (!kind) throw new Error(await prepaidError("cardKindRequired"));
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
  if (!prepaidCardId) throw new Error(await prepaidError("cardRequired"));

  await prisma.$transaction(async (tx) => {
    const card = await tx.prepaidCard.findFirst({
      where: { id: prepaidCardId, companyId: session.user.companyId },
    });
    if (!card) throw new Error(await prepaidError("cardNotFound"));
    if (!canAssignPrepaidCard(card.status)) {
      throw new Error(await prepaidError("standbyAssignOnly"));
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
  if (!prepaidCardId) throw new Error(await prepaidError("cardRequired"));

  await prisma.$transaction(async (tx) => {
    const card = await tx.prepaidCard.findFirst({
      where: { id: prepaidCardId, companyId: session.user.companyId },
    });
    if (!card) throw new Error(await prepaidError("cardNotFound"));
    if (card.status !== "ACTIVE") {
      throw new Error(await prepaidError("returnBeforeReassign"));
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
  if (!prepaidCardId) throw new Error(await prepaidError("cardRequired"));

  await prisma.$transaction(async (tx) => {
    const card = await tx.prepaidCard.findFirst({
      where: { id: prepaidCardId, companyId: session.user.companyId },
    });
    if (!card) throw new Error(await prepaidError("cardNotFound"));
    if (!canReturnPrepaidCard(card.status)) {
      throw new Error(await prepaidError("cardNotAssigned"));
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
  if (!prepaidCardId) throw new Error(await prepaidError("cardRequired"));
  if (!spendKind) throw new Error(await prepaidError("spendKindRequired"));
  if (amount == null || amount <= 0) throw new Error(await prepaidError("amountPaidRequired"));

  const proofs = formFiles(formData, "proof");
  if (proofs.length === 0) {
    throw new Error(await prepaidError("proofRequired"));
  }
  const proofPath = await saveAndSerializeUploads(
    proofs,
    "prepaid-card-proofs",
    { fileBaseName: "prepaid_spend" }
  );
  const entryDate = parseDateInput(
    String(formData.get("entryDate") ?? todayDateInput())
  );

  await prisma.$transaction(async (tx) => {
    const card = await tx.prepaidCard.findFirst({
      where: { id: prepaidCardId, companyId: session.user.companyId },
    });
    if (!card) throw new Error(await prepaidError("cardNotFound"));
    if (!canSpendOnPrepaidCard(card.status)) {
      throw new Error(await prepaidError("spendActiveOnly"));
    }
    if (!allowedSpendKinds(card.kind).includes(spendKind)) {
      throw new Error(await prepaidError("openCardOtherOnly"));
    }
    if ((card.kind === "OPEN" || spendKind === "OTHER") && !note) {
      throw new Error(await prepaidError("otherNoteRequired"));
    }
    const assignment = await currentPrepaidAssignment(tx, card.id);
    const description =
      spendKind === "OTHER" ? note : note || spendKind;
    const entry = await writePrepaidCardEntry(tx, {
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
    if (spendKind === "FUEL") {
      const readingKm = parseOdometerKm(formData.get("odometerKm"));
      const litresFilled = parseLitres(formData.get("litresFilled"));
      if (readingKm == null) {
        throw new Error(await prepaidError("odometerRequired"));
      }
      if (litresFilled == null) {
        throw new Error(await prepaidError("litresRequired"));
      }
      const vehicle = await resolveVehicleAssetForPrepaidFuel(tx, {
        companyId: session.user.companyId,
        vehicleItemId: card.vehicleItemId,
        vehicleAssetId: String(formData.get("vehicleAssetId") ?? "").trim(),
      });
      try {
        await recordVehicleOdometerReading(tx, {
          companyId: session.user.companyId,
          vehicleAssetId: vehicle.id,
          readingKm,
          litresFilled,
          source: "PREPAID",
          recordedAt: entryDate,
          createdById: session.user.id,
          prepaidCardEntryId: entry.id,
        });
      } catch (error) {
        if (error instanceof Error && error.message === "ODOMETER_WENT_BACK") {
          throw new Error(await prepaidError("odometerWentBack"));
        }
        throw error;
      }
    }
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
  if (!prepaidCardId) throw new Error(await prepaidError("cardRequired"));

  await prisma.$transaction(async (tx) => {
    const card = await tx.prepaidCard.findFirst({
      where: { id: prepaidCardId, companyId: session.user.companyId },
    });
    if (!card) throw new Error(await prepaidError("cardNotFound"));
    if (!canMarkPrepaidCardDamaged(card.status)) {
      throw new Error(await prepaidError("damagedActiveOnly"));
    }

    if (assignNew) {
      if (!replacementCardId) {
        throw new Error(await prepaidError("standbyAssignNow"));
      }
      const replacement = await tx.prepaidCard.findFirst({
        where: { id: replacementCardId, companyId: session.user.companyId },
      });
      if (!replacement) throw new Error(await prepaidError("replacementNotFound"));
      if (replacement.kind !== card.kind) {
        throw new Error(await prepaidError("sameTypeRequired"));
      }
      if (replacement.status !== "STANDBY") {
        throw new Error(await prepaidError("standbyRequired"));
      }
      const vehicleItemId = card.vehicleItemId;
      const custodianEmployeeId = card.custodianEmployeeId;
      await returnPrepaidCardToStandby(tx, card.id);
      await tx.prepaidCard.update({
        where: { id: card.id },
        data: { status: "DAMAGED" },
      });
      if (card.kind === "VEHICLE") {
        if (!vehicleItemId) throw new Error(await prepaidError("vehicleCardNoVehicle"));
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
          throw new Error(await prepaidError("openCardNoPic"));
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
  const locale = await getServerLocale();
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
  if (!prepaidCardId) throw new Error(await prepaidError("cardRequired"));
  if (fee < 0) throw new Error(await prepaidError("feeNegative"));
  if (!feeFromLeftover && fee > 0 && !bankAccountId) {
    throw new Error(await prepaidError("bankForFee"));
  }

  await prisma.$transaction(async (tx) => {
    const card = await tx.prepaidCard.findFirst({
      where: { id: prepaidCardId, companyId: session.user.companyId },
    });
    if (!card) throw new Error(await prepaidError("cardNotFound"));
    if (!canReplacePrepaidCard(card.status)) {
      throw new Error(await prepaidError("replacedDamagedOnly"));
    }
    const leftover = decimalToNumber(card.currentBalance) ?? 0;
    if (feeFromLeftover && fee > leftover) {
      throw new Error(await prepaidError("feeExceedsLeftover"));
    }

    let purchaseInvoiceId: string | null = null;
    if (!feeFromLeftover && fee > 0) {
      const bank = await getCompanyBankAccount(
        session.user.companyId,
        bankAccountId
      );
      if (!bank) throw new Error(await prepaidError("bankForFee"));
      const invoiceRef = nextPettyCashTopUpRef().replace(/^PC-/, "CRF-");
      const invoice = await tx.purchaseInvoice.create({
        data: {
          companyId: session.user.companyId,
          supplierName: "Prepaid Card",
          invoiceRef,
          invoiceDate: entryDate,
          amount: fee,
          filePath: "",
          notes: prepaidReplacementFeeLabel(card.cardNumber, locale),
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
      locale,
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
      throw new Error(await prepaidError("destinationRequired"));
    }
    const destination = await tx.prepaidCard.findFirst({
      where: { id: destinationCardId, companyId: session.user.companyId },
    });
    if (!destination) throw new Error(await prepaidError("destinationNotFound"));
    if (destination.id === card.id) {
      throw new Error(await prepaidError("destinationDifferent"));
    }
    if (destination.kind !== card.kind) {
      throw new Error(await prepaidError("sameTypeRequired"));
    }
    if (destination.status === "LOST" || destination.status === "REPLACED") {
      throw new Error(await prepaidError("cardNumberRetired"));
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
      locale,
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
          throw new Error(await prepaidError("assignReplacementVehicle"));
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
          throw new Error(await prepaidError("assignReplacementPic"));
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
  const locale = await getServerLocale();
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
  if (!prepaidCardId) throw new Error(await prepaidError("cardRequired"));
  if (!recoveryKind) throw new Error(await prepaidError("recoveryMethodRequired"));
  if (employeeCovers && recoveryKind === "COMPANY") {
    throw new Error(await prepaidError("employeeCoverMethodRequired"));
  }
  if (employeeCovers && !employeeId) {
    throw new Error(await prepaidError("coveringEmployeeRequired"));
  }
  if (recoveryKind === "PAY_NOW" && !bankAccountId) {
    throw new Error(await prepaidError("returnBankRequired"));
  }

  await prisma.$transaction(async (tx) => {
    const card = await tx.prepaidCard.findFirst({
      where: { id: prepaidCardId, companyId: session.user.companyId },
    });
    if (!card) throw new Error(await prepaidError("cardNotFound"));
    if (!canReportPrepaidCardLost(card.status)) {
      throw new Error(await prepaidError("cardAlreadyRetired"));
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
      if (!coveringEmployee) throw new Error(await prepaidError("coveringEmployeeRequired"));
    }
    if (recoveryKind === "PAY_NOW") {
      const bank = await getCompanyBankAccount(
        session.user.companyId,
        bankAccountId
      );
      if (!bank) {
        throw new Error(await prepaidError("returnBankRequired"));
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
            ? translate(locale, "pages.pettyCash.writtenOffCompany")
            : translate(locale, "pages.pettyCash.writtenOffNamed", {
                name: footed,
              }),
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
          description: prepaidLostReturnLabel(card.cardNumber, locale),
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
        if (!period) throw new Error(await prepaidError("payrollScheduleFailed"));
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

export async function reportPrepaidCardMisuse(formData: FormData) {
  const session = await requireOwnerPrepaidCardManage();
  const prepaidCardId = String(formData.get("prepaidCardId") ?? "").trim();
  const employeeId = String(formData.get("employeeId") ?? "").trim();
  const amount = parseContractPrice(String(formData.get("amount") ?? ""));
  const note = String(formData.get("note") ?? "").trim();
  if (!prepaidCardId) throw new Error(await prepaidError("misuseCardRequired"));
  if (!employeeId) throw new Error(await prepaidError("misuseEmployeeRequired"));
  if (amount == null || amount <= 0) {
    throw new Error(await prepaidError("misuseAmountRequired"));
  }

  const card = await prisma.prepaidCard.findFirst({
    where: { id: prepaidCardId, companyId: session.user.companyId },
    select: { id: true, cardNumber: true },
  });
  if (!card) throw new Error(await prepaidError("prepaidCardMissing"));

  const employee = await requireActiveEmployee(
    prisma,
    session.user.companyId,
    employeeId
  );
  const [period] = await nextOpenPayrollPeriods(session.user.companyId, 1);
  const reason = [
    `Prepaid card misuse · ${formatPrepaidCardNumber(card.cardNumber)}`,
    note,
  ]
    .filter(Boolean)
    .join(" · ");

  await prisma.payrollDeduction.create({
    data: {
      companyId: session.user.companyId,
      employeeId: employee.id,
      year: period.year,
      month: period.month,
      type: "PREPAID_MISUSE",
      amount,
      reason,
      itemName: `Prepaid Card ${normalizePrepaidCardNumber(card.cardNumber)}`,
      createdById: session.user.id,
    },
  });

  revalidatePrepaidCardPaths();
}
