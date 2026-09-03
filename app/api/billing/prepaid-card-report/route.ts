import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { loadCompanyForPdf } from "@/lib/company-for-pdf";
import {
  financePeriodFilenameStamp,
  financePeriodRange,
  parseFinancePeriod,
} from "@/lib/finance-period";
import { formatEmployeeName } from "@/lib/employee-user-link";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";
import { canAccessAdvanceCashPrepaid } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { buildPrepaidCardReportPdfBuffer } from "@/lib/prepaid-card-report-pdf";
import { vehicleAssignmentLabel } from "@/lib/prepaid-card-lifecycle";
import { decimalToNumber } from "@/lib/project-billing";
import { toPermissionUser } from "@/lib/session";
import type { PrepaidCardEntryKind, PrepaidCardKind, PrepaidCardSpendKind } from "@prisma/client";

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (session.user.clientId || session.user.vendorId) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const user = toPermissionUser(session);
  if (!canAccessAdvanceCashPrepaid(user)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const { searchParams } = request.nextUrl;
  const period = parseFinancePeriod({
    year: searchParams.get("year") ?? undefined,
    month: searchParams.get("month") ?? undefined,
    day: searchParams.get("day") ?? undefined,
  });
  const cardId = searchParams.get("card")?.trim() || null;
  const movementRaw = searchParams.get("movement")?.trim() || "all";
  const spendKindRaw = searchParams.get("spendKind")?.trim() || "all";
  const cardTypeRaw = searchParams.get("cardType")?.trim() || "all";
  const assignment = searchParams.get("assignment")?.trim() || "all";
  const movement: PrepaidCardEntryKind | "all" =
    movementRaw === "TOP_UP" ||
    movementRaw === "SPEND" ||
    movementRaw === "WRITE_OFF"
      ? movementRaw
      : "all";
  const spendKind: PrepaidCardSpendKind | "all" =
    spendKindRaw === "FUEL" ||
    spendKindRaw === "TOLL" ||
    spendKindRaw === "PARKING" ||
    spendKindRaw === "OTHER"
      ? spendKindRaw
      : "all";
  const cardType: PrepaidCardKind | "all" =
    cardTypeRaw === "VEHICLE" || cardTypeRaw === "OPEN" ? cardTypeRaw : "all";
  const { start, endExclusive } = financePeriodRange(period);
  const locale = await getServerLocale();
  const t = createTranslator(locale);

  const [entries, company] = await Promise.all([
    prisma.prepaidCardEntry.findMany({
      where: {
        prepaidCard: {
          companyId: session.user.companyId,
          ...(cardId ? { id: cardId } : {}),
          ...(cardType === "VEHICLE" || cardType === "OPEN"
            ? { kind: cardType }
            : {}),
          ...(assignment === "standby" ? { status: "STANDBY" } : {}),
          ...(assignment === "assigned"
            ? {
                OR: [
                  { vehicleItemId: { not: null } },
                  { custodianEmployeeId: { not: null } },
                ],
              }
            : {}),
        },
        entryDate: { gte: start, lt: endExclusive },
        ...(movement === "TOP_UP" ||
        movement === "SPEND" ||
        movement === "WRITE_OFF"
          ? { kind: movement }
          : {}),
        ...(spendKind !== "all" &&
        (movement === "SPEND" || movement === "all")
          ? { spendKind }
          : {}),
      },
      include: {
        prepaidCard: {
          select: {
            cardNumber: true,
            kind: true,
            custodianEmployee: { select: { firstName: true, lastName: true } },
            vehicleItem: {
              select: {
                name: true,
                sku: true,
                equipmentAssets: {
                  select: { assetCode: true, vehicleYear: true },
                  orderBy: [{ createdAt: "asc" }, { id: "asc" }],
                },
              },
            },
          },
        },
        assignment: {
          select: {
            custodianEmployee: { select: { firstName: true, lastName: true } },
            vehicleItem: {
              select: {
                name: true,
                sku: true,
                equipmentAssets: {
                  select: { assetCode: true, vehicleYear: true },
                  orderBy: [{ createdAt: "asc" }, { id: "asc" }],
                },
              },
            },
          },
        },
        loss: {
          select: {
            recoveryKind: true,
            employee: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
    }),
    loadCompanyForPdf(session.user.companyId),
  ]);

  const rows = entries
    .filter((entry) => {
      if (movement === "all" && spendKind !== "all" && entry.kind !== "SPEND") {
        return false;
      }
      return true;
    })
    .map((entry) => {
      const assignmentRow = entry.assignment;
      const assignmentLabel =
        assignmentRow?.custodianEmployee
          ? formatEmployeeName(assignmentRow.custodianEmployee)
          : assignmentRow?.vehicleItem
            ? vehicleAssignmentLabel(assignmentRow.vehicleItem)
            : entry.prepaidCard.custodianEmployee
              ? formatEmployeeName(entry.prepaidCard.custodianEmployee)
              : entry.prepaidCard.vehicleItem
                ? vehicleAssignmentLabel(entry.prepaidCard.vehicleItem)
                : t("pages.pettyCash.statusStandby");
      const footedBy =
        entry.kind === "WRITE_OFF"
          ? entry.loss?.recoveryKind === "COMPANY"
            ? t("pages.pettyCash.footedByCompany")
            : entry.loss?.employee
              ? formatEmployeeName(entry.loss.employee)
              : null
          : null;
      return {
        entryDate: entry.entryDate,
        cardNumber: entry.prepaidCard.cardNumber,
        assignmentLabel,
        kind: entry.kind,
        spendKind: entry.spendKind,
        amount: decimalToNumber(entry.amount) ?? 0,
        description: entry.description,
        footedBy,
      };
    });
  const totalTopUp = rows
    .filter((row) => row.kind === "TOP_UP")
    .reduce((sum, row) => sum + row.amount, 0);
  const totalSpend = rows
    .filter((row) => row.kind === "SPEND")
    .reduce((sum, row) => sum + row.amount, 0);
  const totalWrittenOff = rows
    .filter((row) => row.kind === "WRITE_OFF")
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
    totalWrittenOff,
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
