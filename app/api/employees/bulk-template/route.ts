import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { buildEmployeeImportTemplate } from "@/lib/bulk-import/employee-template";
import { loadEmployeeImportTemplateLists } from "@/lib/bulk-import/live-template-lists";
import { getServerLocale, parseAppLocale } from "@/lib/i18n/locale";
import { canAccess } from "@/lib/permissions";
import { canManageEmployees } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { toPermissionUser } from "@/lib/session";

/** Always rebuild Lists from the DB — never serve a cached workbook. */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const user = toPermissionUser(session);
  if (!canAccess(user, "employees") || !canManageEmployees(user)) {
    return NextResponse.json(
      { error: "You do not have permission to manage employees." },
      { status: 403 }
    );
  }

  const queryLocale = request.nextUrl.searchParams.get("locale");
  const locale = queryLocale
    ? parseAppLocale(queryLocale)
    : await getServerLocale();

  const employmentTypeParam = request.nextUrl.searchParams
    .get("employmentType")
    ?.trim()
    .toUpperCase();
  const defaultEmploymentType =
    employmentTypeParam === "PART_TIME" || employmentTypeParam === "FULL_TIME"
      ? employmentTypeParam
      : undefined;

  try {
    const company = await prisma.company.findFirst({
      select: { id: true },
    });

    const lists = company
      ? await loadEmployeeImportTemplateLists(company.id)
      : { categories: [], positions: [], projectNames: [] };

    const buffer = await buildEmployeeImportTemplate({
      categories: lists.categories,
      positions: lists.positions,
      projectNames: lists.projectNames,
      locale,
      defaultEmploymentType,
    });

    const filename =
      defaultEmploymentType === "PART_TIME"
        ? "rgs-employees-part-time-import-template.xlsx"
        : "rgs-employees-import-template.xlsx";

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[api/employees/bulk-template]", error);
    return NextResponse.json(
      { error: "Could not generate the Excel template. Please try again." },
      { status: 500 }
    );
  }
}
