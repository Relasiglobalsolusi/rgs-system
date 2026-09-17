import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { buildMaybankBcaDomWorkbook } from "@/lib/maybank-bulk-transfer";
import { canAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/project-billing";
import { toPermissionUser } from "@/lib/session";

function contentDispositionAttachment(fileName: string): string {
  const encoded = encodeURIComponent(fileName);
  const quoted = fileName.replace(/"/g, "");
  return `attachment; filename="${quoted}"; filename*=UTF-8''${encoded}`;
}

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (session.user.clientId || session.user.vendorId) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const user = toPermissionUser(session);
  if (!canAccess(user, "purchaseInvoices")) {
    return NextResponse.json(
      { error: "You do not have permission to download the AP bank file." },
      { status: 403 }
    );
  }

  const ids = request.nextUrl.searchParams
    .get("ids")
    ?.split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (!ids || ids.length === 0) {
    return NextResponse.json(
      { error: "Tick the unpaid bills to include in the bulk transfer." },
      { status: 400 }
    );
  }

  const invoices = await prisma.purchaseInvoice.findMany({
    where: {
      id: { in: ids },
      companyId: session.user.companyId,
      paidAt: null,
      reversedAt: null,
      freeOfCharge: false,
    },
    select: {
      id: true,
      supplierName: true,
      invoiceRef: true,
      amount: true,
      notes: true,
      vendorBankAccount: {
        select: {
          bankName: true,
          accountNumber: true,
          accountHolder: true,
        },
      },
      vendor: {
        select: {
          name: true,
          bankAccounts: {
            select: {
              bankName: true,
              accountNumber: true,
              accountHolder: true,
            },
            orderBy: { sortOrder: "asc" },
            take: 1,
          },
        },
      },
    },
  });

  if (invoices.length === 0) {
    return NextResponse.json(
      { error: "No unpaid bills matched the selection." },
      { status: 400 }
    );
  }

  const missing: Array<{ name: string; fields: string[] }> = [];
  const transfers = invoices.map((invoice) => {
    const bank = invoice.vendorBankAccount ?? invoice.vendor?.bankAccounts[0] ?? null;
    const fields: string[] = [];
    if (!bank?.bankName?.trim()) fields.push("Bank Name");
    if (!bank?.accountNumber?.trim()) fields.push("Account Number");
    if (!bank?.accountHolder?.trim()) fields.push("Account Holder Name");
    const name = invoice.supplierName || invoice.vendor?.name || invoice.invoiceRef;
    if (fields.length > 0) missing.push({ name, fields });
    return {
      beneficiaryName: bank?.accountHolder?.trim() || name,
      accountNumber: bank?.accountNumber ?? "",
      bankName: bank?.bankName ?? null,
      amount: decimalToNumber(invoice.amount) ?? 0,
      projectName: invoice.invoiceRef,
      periodLabel: invoice.notes,
      beneficiaryType: "2" as const,
    };
  });

  if (missing.length > 0) {
    const detail = missing
      .map((row) => `${row.name}: ${row.fields.join(", ")}`)
      .join("; ");
    return NextResponse.json(
      {
        error: `Bulk transfer is blocked until every selected vendor has complete bank details. Missing: ${detail}`,
        missing,
      },
      { status: 400 }
    );
  }

  const workbook = await buildMaybankBcaDomWorkbook(transfers, {
    periodLabel: "AP",
    fileName: "ap-bca-bulk-transfer.xlsm",
  });

  return new NextResponse(new Uint8Array(workbook.buffer), {
    headers: {
      "Content-Type":
        "application/vnd.ms-excel.sheet.macroEnabled.12",
      "Content-Disposition": contentDispositionAttachment(workbook.fileName),
    },
  });
}
