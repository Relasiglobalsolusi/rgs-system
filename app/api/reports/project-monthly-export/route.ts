import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { getServerLocale } from "@/lib/i18n/locale";
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
  if (!canAccess(user, "reports")) {
    return NextResponse.json(
      { error: "You do not have permission to access reports." },
      { status: 403 }
    );
  }

  const { searchParams } = request.nextUrl;
  const clientId = searchParams.get("clientId")?.trim();
  const projectId = searchParams.get("projectId")?.trim();
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));

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

  try {
    const projectWhere = await getProjectWhereForUser({
      companyId: session.user.companyId,
      clientId: session.user.clientId,
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
      buildProjectMonthlyDayFeed(projectId, year, month),
      prisma.company.findUnique({
        where: { id: session.user.companyId },
        select: {
          name: true,
          email: true,
          phone: true,
          address: true,
        },
      }),
    ]);

    if (!feed) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const locale = await getServerLocale();
    const periodLabel = formatMonthLabel(year, month, locale);
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
    const filename = `progress-report-${slug || "project"}-${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}.pdf`;

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
