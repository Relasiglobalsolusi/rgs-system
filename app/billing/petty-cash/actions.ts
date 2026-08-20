"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { extractPettyCashReceiptAmount } from "@/lib/petty-cash-extract";
import {
  parseDateInput,
  parsePettyCashAmount,
  pettyCashAmountsMatch,
  processScheduledPettyCashPays,
} from "@/lib/petty-cash";
import { prisma } from "@/lib/prisma";
import { requirePettyCashAccess } from "@/lib/session";
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

export async function extractPettyCashReceipt(formData: FormData) {
  await requirePettyCashAccess();
  const file = requireProofFile(formData.get("document"));
  return extractPettyCashReceiptAmount(file);
}

export async function syncPettyCashOnPageLoad() {
  const session = await requirePettyCashAccess();
  await processScheduledPettyCashPays(prisma, session.user.companyId);
}

export async function recordPettyCashSpend(formData: FormData) {
  const session = await requirePettyCashAccess();
  const amount = parsePettyCashAmount(String(formData.get("amount") ?? ""));
  const dateRaw = String(formData.get("entryDate") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const projectIdRaw = String(formData.get("projectId") ?? "").trim();
  const file = requireProofFile(formData.get("document"));

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
    throw new Error("Date is required.");
  }
  if (!description) {
    throw new Error("Describe what this Petty Cash was spent on.");
  }

  const extracted = await extractPettyCashReceiptAmount(file);
  if (!extracted.ok) {
    if (extracted.code === "not_configured") {
      throw new Error(
        "Document reading is not configured. Ask Head Office to enable it before recording a spend."
      );
    }
    throw new Error(
      "Could not read the paid amount from this bill. Upload a clearer photo and try again."
    );
  }
  if (!pettyCashAmountsMatch(amount, extracted.amount)) {
    throw new Error(
      `Entered amount must match the bill amount (${extracted.amount}).`
    );
  }

  let projectId: string | null = null;
  if (projectIdRaw) {
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
      proofPath,
      extractedAmount: new Prisma.Decimal(extracted.amount),
      createdById: session.user.id,
      postedAt: new Date(),
    },
  });

  revalidatePath("/billing/petty-cash");
  revalidatePath("/billing/financial-report");
}
