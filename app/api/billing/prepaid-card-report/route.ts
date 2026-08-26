import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { loadCompanyForPdf } from "@/lib/company-for-pdf";
import {
  financePeriodFilenameStamp,
  financePeriodRange,
  parseFinancePeriod,
} from "@/lib/finance-period";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";
import { canAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { buildPrepaidCardReportPdfBuffer } from "@/lib/prepaid-card-report-pdf";
import { decimalToNumber } from "@/lib/project-billing";
import { formatVehicleIdentityLabel } from "@/lib/vehicle-plate";
import { toPermissionUser } from "@/lib/session";

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (session.user.clientId || session.user.vendorId) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const user = toPermissionUser(session);
  if (!canAccess(user, "pettyCash")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const period = parseFinancePeriod({
    year: searchParams.get("year") ?? undefined,
    month: searchParams.get("month") ?? undefined,
    day: searchParams.get("day") ?? undefined,
  });
  const cardId = searchParams.get("card")?.trim() || null;
  const { start, endExclusive } = financePeriodRange(period);
  const locale = await getServerLocale();
  const t = createTranslator(locale);

  const [entries, company] = await Promise.all([
    prisma.prepaidCardEntry.findMany({
      where: {
        prepaidCard: {
          companyId: session.user.companyId,
          ...(cardId ? { id: cardId } : {}),
        },
        entryDate: { gte: start, lt: endExclusive },
      },
      include: {
        prepaidCard: {
          select: {
            cardNumber: true,
            vehicleItem: {
              select: {
                name: true,
                sku: true,
                equipmentAssets: {
                  select: { assetCode: true },
                  orderBy: [{ createdAt: "asc" }, { id: "asc" }],
                },
              },
            },
          },
        },
      },
      orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
    }),
    loadCompanyForPdf(session.user.companyId),
  ]);

  const rows = entries.map((entry) => ({
    entryDate: entry.entryDate,
    cardNumber: entry.prepaidCard.cardNumber,
    vehicleName: formatVehicleIdentityLabel({
      plate: entry.prepaidCard.vehicleItem.equipmentAssets
        .map((asset) => asset.assetCode)
        .filter(Boolean)
        .join(" / "),
      name: entry.prepaidCard.vehicleItem.name,
      sku: entry.prepaidCard.vehicleItem.sku,
    }),
    kind: entry.kind,
    spendKind: entry.spendKind,
    amount: decimalToNumber(entry.amount) ?? 0,
    description: entry.description,
  }));
  const totalTopUp = rows
    .filter((row) => row.kind === "TOP_UP")
    .reduce((sum, row) => sum + row.amount, 0);
  const totalSpend = rows
    .filter((row) => row.kind === "SPEND")
    .reduce((sum, row) => sum + row.amount, 0);

  const periodLabel =
    period.month == null
      ? String(period.year)
      : period.day != null
        ? `${period.year}-${String(period.month).padStart(2, "0")}-${String(period.day).padStart(2, "0")}`
        : t(`pages.reports.months.${period.month}`) + ` ${period.year}`;

  const buffer = await buildPrepaidCardReportPdfBuffer({
    periodLabel,
    entries: rows,
    totalTopUp,
    totalSpend,
    company,
    locale,
  });

  const stamp = financePeriodFilenameStamp(period);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="prepaid-card-report-${stamp}.pdf"`,
    },
  });
}
