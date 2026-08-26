"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { applyMissingExpenseTopUps } from "@/lib/advance-cash-expense";
import {
  parseDateInput,
  parsePettyCashAmount,
  processScheduledPettyCashPays,
} from "@/lib/petty-cash";
import { prisma } from "@/lib/prisma";
import { isAreaManagerOrAbovePosition } from "@/lib/positions";
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

export async function syncPettyCashOnPageLoad() {
  const session = await requirePettyCashAccess();
  await processScheduledPettyCashPays(prisma, session.user.companyId);
  await prisma.$transaction((tx) =>
    applyMissingExpenseTopUps(tx, {
      companyId: session.user.companyId,
      userId: session.user.id,
    })
  );
}

export async function recordPettyCashSpend(formData: FormData) {
  const session = await requirePettyCashAccess();
  const amount = parsePettyCashAmount(String(formData.get("amount") ?? ""));
  const dateRaw = String(formData.get("entryDate") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const chargeType = String(formData.get("chargeType") ?? "").trim();
  const projectIdRaw = String(formData.get("projectId") ?? "").trim();
  const clientIdRaw = String(formData.get("clientId") ?? "").trim();
  const employeeIdRaw = String(formData.get("employeeId") ?? "").trim();
  const file = requireProofFile(formData.get("document"));

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
    throw new Error("Date is required.");
  }
  if (!description) {
    throw new Error("Describe what this Petty Cash was spent on.");
  }
  if (!employeeIdRaw) {
    throw new Error("Select which Area Manager or above this bill is for.");
  }

  const attributed = await prisma.employee.findFirst({
    where: {
      id: employeeIdRaw,
      companyId: session.user.companyId,
      archivedFromDirectory: false,
      status: { in: ["ACTIVE", "ON_LEAVE"] },
    },
    select: {
      id: true,
      jobPosition: { select: { slug: true, name: true } },
    },
  });
  if (
    !attributed?.jobPosition ||
    !isAreaManagerOrAbovePosition(attributed.jobPosition)
  ) {
    throw new Error("This bill must be for an Area Manager, Operations Manager, or Director.");
  }

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
      employeeId: attributed.id,
      proofPath,
      createdById: session.user.id,
      postedAt: new Date(),
    },
  });

  revalidatePath("/billing/petty-cash");
  revalidatePath("/billing/financial-report");
}
