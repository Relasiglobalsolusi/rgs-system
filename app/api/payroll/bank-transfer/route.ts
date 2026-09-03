import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import type { PayrollDayRow } from "@/lib/internal-payroll-days";
import { loadInternalPayrollMonth } from "@/lib/internal-payroll-month";
import { canAccess } from "@/lib/permissions";
import { toPermissionUser } from "@/lib/session";
import { jakartaYearMonth } from "@/lib/vat";
import {
  formatInternalPayrollWorkbookTitle,
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

  const rows = await loadInternalPayrollMonth({
    companyId: session.user.companyId,
    year,
    month,
  });

  const periodBerita = formatPayrollPeriodBerita(year, month);

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

  const title = formatInternalPayrollWorkbookTitle(year, month);
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
