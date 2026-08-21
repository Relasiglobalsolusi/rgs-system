import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { loadAttendanceExportFeed } from "@/lib/attendance-export-data";
import { buildAttendanceReportPdfBuffer } from "@/lib/attendance-report-pdf";
import {
  isClosedCalendarDay,
  isClosedCalendarMonth,
} from "@/lib/closed-report-period";
import { loadCompanyForPdf } from "@/lib/company-for-pdf";
import { getServerLocale } from "@/lib/i18n/locale";
import { formatMonthLabel } from "@/lib/monthly-report";
import { canAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getProjectWhereForUser } from "@/lib/project-access";
import {
  getReportPeriodBounds,
  isReportPeriodInBounds,
} from "@/lib/report-period-bounds";
import { toPermissionUser } from "@/lib/session";
import { formatDisplayDate } from "@/lib/format-date";
import { parseDateInput } from "@/lib/invoice-period";
import { translate } from "@/lib/i18n/translate";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const user = toPermissionUser(session);
  if (!canAccess(user, "progress")) {
    return NextResponse.json(
      { error: "You do not have permission to download attendance." },
      { status: 403 }
    );
  }

  const { searchParams } = request.nextUrl;
  const projectId = searchParams.get("projectId")?.trim();
  const mode = searchParams.get("mode")?.trim();
  const date = searchParams.get("date")?.trim() ?? "";
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));

  if (!projectId) {
    return NextResponse.json({ error: "Missing project." }, { status: 400 });
  }

  const locale = await getServerLocale();

  if (mode === "day") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Invalid date." }, { status: 400 });
    }
    if (!isClosedCalendarDay(date)) {
      return NextResponse.json(
        { error: translate(locale, "pages.progress.errors.dayNotClosed") },
        { status: 400 }
      );
    }
  } else if (mode === "month") {
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
    if (!isClosedCalendarMonth(year, month)) {
      return NextResponse.json(
        { error: translate(locale, "pages.progress.errors.monthNotClosed") },
        { status: 400 }
      );
    }
  } else {
    return NextResponse.json({ error: "Invalid export mode." }, { status: 400 });
  }

  try {
    const projectWhere = await getProjectWhereForUser({
      companyId: session.user.companyId,
      clientId: session.user.clientId,
      userId: session.user.id,
      username: session.user.username,
    });

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        companyId: session.user.companyId,
        ...projectWhere,
      },
      select: {
        id: true,
        name: true,
        startDate: true,
        estimatedStartDate: true,
        endDate: true,
        createdAt: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    if (mode === "month") {
      const bounds = getReportPeriodBounds(project);
      if (!isReportPeriodInBounds(year, month, bounds)) {
        return NextResponse.json(
          { error: "Period is outside the allowed range for this project." },
          { status: 404 }
        );
      }
    }

    const feed = await loadAttendanceExportFeed(
      projectId,
      mode === "day" ? { mode: "day", date } : { mode: "month", year, month }
    );
    if (!feed) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const periodLabel =
      mode === "day"
        ? formatDisplayDate(parseDateInput(date), { timeZone: "UTC" }, locale)
        : formatMonthLabel(year, month, locale);

    const company = await loadCompanyForPdf(session.user.companyId);
    const buffer = await buildAttendanceReportPdfBuffer({
      feed,
      periodLabel,
      company,
      locale,
    });

    const slug = slugify(feed.projectName);
    const filename =
      mode === "day"
        ? `attendance-${slug || "project"}-${date}.pdf`
        : `attendance-${slug || "project"}-${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[api/reports/attendance-export]", error);
    return NextResponse.json(
      { error: translate(locale, "pages.progress.errors.exportFailed") },
      { status: 500 }
    );
  }
}
