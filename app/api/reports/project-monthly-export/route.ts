import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import {
  isClosedCalendarDay,
  isClosedCalendarMonth,
  yearMonthFromDateInput,
} from "@/lib/closed-report-period";
import { loadCompanyForPdf } from "@/lib/company-for-pdf";
import { formatDisplayDate } from "@/lib/format-date";
import { getServerLocale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";
import { parseDateInput } from "@/lib/invoice-period";
import { formatMonthLabel } from "@/lib/monthly-report";
import { canAccess } from "@/lib/permissions";
import { buildProjectMonthlyDayFeed } from "@/lib/project-monthly-feed";
import { buildProjectMonthlyReportPdfBuffer } from "@/lib/project-monthly-report-pdf";
import { prisma } from "@/lib/prisma";
import { getProjectWhereForUser } from "@/lib/project-access";
import {
  getReportPeriodBounds,
  isReportPeriodInBounds,
} from "@/lib/report-period-bounds";
import { toPermissionUser } from "@/lib/session";

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const user = toPermissionUser(session);
  if (!canAccess(user, "progress")) {
    return NextResponse.json(
      { error: "You do not have permission to download this report." },
      { status: 403 }
    );
  }

  const { searchParams } = request.nextUrl;
  const clientId = searchParams.get("clientId")?.trim();
  const projectId = searchParams.get("projectId")?.trim();
  const mode = searchParams.get("mode")?.trim() || "month";
  const date = searchParams.get("date")?.trim() ?? "";
  const yearParam = Number(searchParams.get("year"));
  const monthParam = Number(searchParams.get("month"));

  if (!clientId || !projectId) {
    return NextResponse.json(
      { error: "Missing client or project." },
      { status: 400 }
    );
  }

  if (
    session.user.clientId &&
    session.user.clientId !== clientId
  ) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const locale = await getServerLocale();
  let year = yearParam;
  let month = monthParam;
  let dateKey: string | undefined;

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
    const fromDate = yearMonthFromDateInput(date);
    if (!fromDate) {
      return NextResponse.json({ error: "Invalid date." }, { status: 400 });
    }
    year = fromDate.year;
    month = fromDate.month;
    dateKey = date;
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
        clientId,
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

    const bounds = getReportPeriodBounds(project);
    if (!isReportPeriodInBounds(year, month, bounds)) {
      return NextResponse.json(
        { error: "Period is outside the allowed range for this project." },
        { status: 404 }
      );
    }

    const [feed, company] = await Promise.all([
      buildProjectMonthlyDayFeed(projectId, year, month, dateKey ? { dateKey } : undefined),
      loadCompanyForPdf(session.user.companyId),
    ]);

    if (!feed) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const periodLabel =
      mode === "day" && dateKey
        ? formatDisplayDate(parseDateInput(dateKey), { timeZone: "UTC" }, locale)
        : formatMonthLabel(year, month, locale);
    const buffer = await buildProjectMonthlyReportPdfBuffer({
      feed,
      periodLabel,
      company,
      locale,
    });

    const slug = feed.projectName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
    const filename =
      mode === "day" && dateKey
        ? `progress-report-${slug || "project"}-${dateKey}.pdf`
        : `progress-report-${slug || "project"}-${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[api/reports/project-monthly-export]", error);
    return NextResponse.json(
      {
        error: "Could not generate the progress report PDF. Please try again.",
      },
      { status: 500 }
    );
  }
}
