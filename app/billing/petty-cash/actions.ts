"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { applyMissingExpenseTopUps } from "@/lib/advance-cash-expense";
import { formatEmployeeName } from "@/lib/employee-user-link";
import {
  holderBalanceFromEntries,
  parseDateInput,
  parsePettyCashAmount,
  pettyCashPartTimePaidDescription,
  pettyCashTransferInDescription,
  pettyCashTransferOutDescription,
  processScheduledPettyCashPays,
} from "@/lib/petty-cash";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/project-billing";
import { requireAdvanceCashPettyAccess } from "@/lib/session";
import { saveUpload } from "@/lib/upload";

const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
const UPLOAD_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

function requireProofFile(value: FormDataEntryValue | null): File {
  if (!(value instanceof File) || value.size <= 0) {
    throw new Error("Upload the bill or receipt photo.");
  }
  if (value.size > UPLOAD_MAX_BYTES) {
    throw new Error("File must be 10 MB or smaller.");
  }
  const mime = value.type || "";
  if (mime && !UPLOAD_MIME.has(mime)) {
    throw new Error("Upload an image or PDF.");
  }
  return value;
}

function revalidatePettyCashPaths() {
  revalidatePath("/billing/petty-cash");
  revalidatePath("/billing/financial-report");
}

async function requireActiveEmployee(companyId: string, employeeId: string) {
  const employee = await prisma.employee.findFirst({
    where: {
      id: employeeId,
      companyId,
      archivedFromDirectory: false,
      status: { in: ["ACTIVE", "ON_LEAVE"] },
    },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!employee) {
    throw new Error("Select a valid employee.");
  }
  return employee;
}

async function postedHolderBalance(
  companyId: string,
  holderEmployeeId: string | null
): Promise<number> {
  const rows = await prisma.pettyCashEntry.findMany({
    where: {
      companyId,
      status: "POSTED",
      holderEmployeeId,
    },
    select: { kind: true, status: true, amount: true },
  });
  return holderBalanceFromEntries(
    rows.map((row) => ({
      kind: row.kind,
      status: row.status,
      amount: decimalToNumber(row.amount) ?? 0,
    }))
  );
}

export async function syncPettyCashOnPageLoad() {
  const session = await requireAdvanceCashPettyAccess();
  await processScheduledPettyCashPays(prisma, session.user.companyId);
  await prisma.$transaction((tx) =>
    applyMissingExpenseTopUps(tx, {
      companyId: session.user.companyId,
      userId: session.user.id,
    })
  );
}

export async function recordPettyCashSpend(formData: FormData) {
  const session = await requireAdvanceCashPettyAccess();
  const amount = parsePettyCashAmount(String(formData.get("amount") ?? ""));
  const dateRaw = String(formData.get("entryDate") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const chargeType = String(formData.get("chargeType") ?? "").trim();
  const projectIdRaw = String(formData.get("projectId") ?? "").trim();
  const clientIdRaw = String(formData.get("clientId") ?? "").trim();
  const holderRaw = String(formData.get("holderEmployeeId") ?? "").trim();
  const file = requireProofFile(formData.get("document"));

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
    throw new Error("Date is required.");
  }
  if (!description) {
    throw new Error("Describe what this Petty Cash was spent on.");
  }
  if (!holderRaw) {
    throw new Error("Select whose Petty Cash this spend comes from.");
  }

  const holderEmployeeId = holderRaw;
  await requireActiveEmployee(session.user.companyId, holderEmployeeId);

  if (chargeType !== "client" && chargeType !== "project") {
    throw new Error("Choose Client or Project.");
  }

  let projectId: string | null = null;
  let clientId: string | null = null;
  if (chargeType === "project") {
    if (!projectIdRaw) {
      throw new Error("Select a project.");
    }
    const project = await prisma.project.findFirst({
      where: {
        id: projectIdRaw,
        companyId: session.user.companyId,
        status: { not: "CANCELLED" },
      },
      select: { id: true },
    });
    if (!project) {
      throw new Error("Select a valid project.");
    }
    projectId = project.id;
  } else {
    if (!clientIdRaw) {
      throw new Error("Select a client.");
    }
    const client = await prisma.client.findFirst({
      where: {
        id: clientIdRaw,
        companyId: session.user.companyId,
        active: true,
      },
      select: { id: true },
    });
    if (!client) {
      throw new Error("Select a valid client.");
    }
    clientId = client.id;
  }

  const proofPath = await saveUpload(file, "uploads/petty-cash", {
    fileBaseName: `Petty-Cash-Spend-${dateRaw}`,
  });

  await prisma.pettyCashEntry.create({
    data: {
      companyId: session.user.companyId,
      kind: "SPEND",
      status: "POSTED",
      amount: new Prisma.Decimal(amount),
      entryDate: parseDateInput(dateRaw),
      description,
      projectId,
      clientId,
      employeeId: holderEmployeeId,
      holderEmployeeId,
      proofPath,
      createdById: session.user.id,
      postedAt: new Date(),
    },
  });

  revalidatePettyCashPaths();
}

export async function transferPettyCash(formData: FormData) {
  const session = await requireAdvanceCashPettyAccess();
  const fromRaw = String(formData.get("fromEmployeeId") ?? "").trim();
  const toRaw = String(formData.get("toEmployeeId") ?? "").trim();
  const amount = parsePettyCashAmount(String(formData.get("amount") ?? ""));
  const dateRaw = String(formData.get("entryDate") ?? "").trim();
  const note = String(formData.get("description") ?? "").trim();

  if (!fromRaw) {
    throw new Error("Choose whose Petty Cash to transfer from.");
  }
  if (!toRaw) {
    throw new Error("Choose who receives this Petty Cash.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
    throw new Error("Date is required.");
  }

  const fromEmployeeId = fromRaw;
  if (fromEmployeeId === toRaw) {
    throw new Error("Choose a different employee to receive this Petty Cash.");
  }

  const [fromEmployee, toEmployee] = await Promise.all([
    requireActiveEmployee(session.user.companyId, fromEmployeeId),
    requireActiveEmployee(session.user.companyId, toRaw),
  ]);

  const fromName = formatEmployeeName(fromEmployee);
  const toName = formatEmployeeName(toEmployee);
  const balance = await postedHolderBalance(
    session.user.companyId,
    fromEmployeeId
  );
  if (amount > balance) {
    throw new Error("There is not enough Petty Cash to transfer that amount.");
  }

  const entryDate = parseDateInput(dateRaw);
  const postedAt = new Date();
  await prisma.$transaction([
    prisma.pettyCashEntry.create({
      data: {
        companyId: session.user.companyId,
        kind: "TRANSFER_OUT",
        status: "POSTED",
        amount: new Prisma.Decimal(amount),
        entryDate,
        description: pettyCashTransferOutDescription(toName, note),
        employeeId: fromEmployeeId,
        holderEmployeeId: fromEmployeeId,
        relatedEmployeeId: toEmployee.id,
        createdById: session.user.id,
        postedAt,
      },
    }),
    prisma.pettyCashEntry.create({
      data: {
        companyId: session.user.companyId,
        kind: "TRANSFER_IN",
        status: "POSTED",
        amount: new Prisma.Decimal(amount),
        entryDate,
        description: pettyCashTransferInDescription(fromName, note),
        employeeId: toEmployee.id,
        holderEmployeeId: toEmployee.id,
        relatedEmployeeId: fromEmployeeId,
        createdById: session.user.id,
        postedAt,
      },
    }),
  ]);

  revalidatePettyCashPaths();
}

async function resolveWagePayer(
  companyId: string,
  userId: string,
  holderRaw: string
) {
  if (holderRaw) {
    return requireActiveEmployee(companyId, holderRaw);
  }
  const user = await prisma.user.findFirst({
    where: { id: userId, companyId },
    select: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          archivedFromDirectory: true,
          status: true,
        },
      },
    },
  });
  const employee = user?.employee;
  if (
    !employee ||
    employee.archivedFromDirectory ||
    (employee.status !== "ACTIVE" && employee.status !== "ON_LEAVE")
  ) {
    throw new Error("Select whose Petty Cash paid this wage.");
  }
  return employee;
}

export async function payPartTimeWage(formData: FormData) {
  const session = await requireAdvanceCashPettyAccess();
  const entryId = String(formData.get("entryId") ?? "").trim();
  const holderRaw = String(formData.get("holderEmployeeId") ?? "").trim();

  if (!entryId) {
    throw new Error("Select the part-time wage to pay.");
  }

  const [entry, payer] = await Promise.all([
    prisma.pettyCashEntry.findFirst({
      where: {
        id: entryId,
        companyId: session.user.companyId,
        kind: "PART_TIME_PAY",
        status: "UNPAID",
      },
      select: { id: true, employeeId: true, description: true },
    }),
    resolveWagePayer(session.user.companyId, session.user.id, holderRaw),
  ]);

  if (!entry) {
    throw new Error("This wage is already paid or is not waiting for payment.");
  }
  if (entry.employeeId && entry.employeeId === payer.id) {
    throw new Error("Choose the employee whose Petty Cash paid this wage.");
  }

  const updated = await prisma.pettyCashEntry.updateMany({
    where: {
      id: entry.id,
      companyId: session.user.companyId,
      kind: "PART_TIME_PAY",
      status: "UNPAID",
    },
    data: {
      status: "POSTED",
      holderEmployeeId: payer.id,
      relatedEmployeeId: entry.employeeId,
      createdById: session.user.id,
      postedAt: new Date(),
      description: pettyCashPartTimePaidDescription({
        existingDescription: entry.description,
        payerName: formatEmployeeName(payer),
      }),
    },
  });
  if (updated.count !== 1) {
    throw new Error("This wage is already paid or is not waiting for payment.");
  }

  revalidatePettyCashPaths();
}
