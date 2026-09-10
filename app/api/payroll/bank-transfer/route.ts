import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import type { PayrollDayRow } from "@/lib/internal-payroll-days";
import type { InternalPayrollMonthRow } from "@/lib/internal-payroll-month";
import {
  getInternalPayrollLockRecord,
  snapshotToPayrollRows,
} from "@/lib/internal-payroll-lock";
import { canAccess } from "@/lib/permissions";
import { toPermissionUser } from "@/lib/session";
import { jakartaYearMonth } from "@/lib/vat";
import {
  formatInternalPayrollWorkbookTitle,
  parsePayrollRunKind,
} from "@/lib/internal-payroll-period";
import {
  buildMaybankBcaDomWorkbook,
  formatPayrollPeriodBerita,
} from "@/lib/maybank-bulk-transfer";

function contentDispositionAttachment(fileName: string): string {
  const encoded = encodeURIComponent(fileName);
  const quoted = fileName.replace(/"/g, "");
  return `attachment; filename="${quoted}"; filename*=UTF-8''${encoded}`;
}

function primaryPayrollProjectName(days: PayrollDayRow[]): string {
  const pick = (includeIdle: boolean) => {
    const counts = new Map<string, number>();
    for (const day of days) {
      if (!includeIdle && (day.off || day.onLeave)) continue;
      const name = day.siteName?.trim();
      if (!name) continue;
      const weight = day.complete ? 2 : 1;
      counts.set(name, (counts.get(name) ?? 0) + weight);
    }
    let best = "";
    let bestCount = 0;
    for (const [name, count] of counts) {
      if (count > bestCount) {
        best = name;
        bestCount = count;
      }
    }
    return best;
  };
  return pick(false) || pick(true);
}

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const user = toPermissionUser(session);
  if (!canAccess(user, "payroll")) {
    return NextResponse.json(
      { error: "You do not have permission to access Internal Payroll." },
      { status: 403 }
    );
  }

  const { searchParams } = request.nextUrl;
  const now = jakartaYearMonth();
  const run = parsePayrollRunKind(searchParams.get("run"));
  const year = Number(searchParams.get("year")) || now.year;
  const month = Number(searchParams.get("month")) || now.month;

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12 ||
    year < 2000 ||
    year > 2100
  ) {
    return NextResponse.json(
      { error: "Invalid year or month." },
      { status: 400 }
    );
  }

  const lock = await getInternalPayrollLockRecord(
    session.user.companyId,
    year,
    month,
    run
  );
  if (!lock?.locked) {
    return NextResponse.json(
      {
        error:
          "Bank transfer is available only after this payroll has been reviewed, generated, and locked.",
      },
      { status: 409 }
    );
  }
  const rows = snapshotToPayrollRows<InternalPayrollMonthRow>(lock.snapshot);
  if (!rows) {
    return NextResponse.json(
      {
        error:
          "The locked payroll snapshot is missing. Unlock, review, and generate this period again before creating the bank transfer.",
      },
      { status: 409 }
    );
  }

  const missing: Array<{ name: string; fields: string[] }> = [];
  for (const row of rows) {
    if (row.netPay <= 0) continue;
    const fields: string[] = [];
    if (!row.bankName?.trim()) fields.push("Bank Name");
    if (!row.bankAccountNumber?.trim()) fields.push("Account Number");
    if (!row.bankAccountName?.trim()) fields.push("Account Holder Name");
    if (fields.length > 0) {
      missing.push({
        name: `${row.firstName} ${row.lastName}`.trim() || row.employeeNo,
        fields,
      });
    }
  }
  if (missing.length > 0) {
    const detail = missing
      .map((row) => `${row.name}: ${row.fields.join(", ")}`)
      .join("; ");
    return NextResponse.json(
      {
        error: `Bank transfer is blocked until every paid employee has complete bank details. Missing: ${detail}`,
        missing,
      },
      { status: 400 }
    );
  }

  const periodBerita = formatPayrollPeriodBerita(year, month, run);

  const transfers = rows
    .filter((row) => row.netPay > 0 && row.bankAccountNumber?.trim())
    .map((row) => ({
      beneficiaryName:
        row.bankAccountName?.trim() ||
        `${row.firstName} ${row.lastName}`.trim(),
      accountNumber: row.bankAccountNumber ?? "",
      bankName: row.bankName,
      amount: row.netPay,
      projectName: primaryPayrollProjectName(row.days),
      periodLabel: periodBerita,
      beneficiaryType: "1" as const,
    }));

  const title = formatInternalPayrollWorkbookTitle(year, month, run);
  const workbook = await buildMaybankBcaDomWorkbook(transfers, {
    periodLabel: `${year}-${String(month).padStart(2, "0")}`,
    fileName: `${title}.xlsm`,
  });

  return new NextResponse(new Uint8Array(workbook.buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.ms-excel.sheet.macroEnabled.12",
      "Content-Disposition": contentDispositionAttachment(workbook.fileName),
    },
  });
}
