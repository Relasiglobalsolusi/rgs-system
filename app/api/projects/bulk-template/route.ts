import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { loadProjectImportTemplateLists } from "@/lib/bulk-import/live-template-lists";
import { buildProjectImportTemplate } from "@/lib/bulk-import/project-template";
import { getServerLocale, parseAppLocale } from "@/lib/i18n/locale";
import { canAccess } from "@/lib/permissions";
import { canManageProjects } from "@/lib/project-access";
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
  if (!canAccess(user, "projects") || !canManageProjects(user)) {
    return NextResponse.json(
      { error: "You do not have permission to manage projects." },
      { status: 403 }
    );
  }

  const queryLocale = request.nextUrl.searchParams.get("locale");
  const locale = queryLocale
    ? parseAppLocale(queryLocale)
    : await getServerLocale();

  try {
    const company = await prisma.company.findFirst({
      select: { id: true },
    });

    const lists = company
      ? await loadProjectImportTemplateLists(company.id)
      : { clients: [], categories: [], employees: [] };

    const buffer = await buildProjectImportTemplate({
      clients: lists.clients,
      categories: lists.categories,
      employees: lists.employees,
      locale,
    });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="rgs-projects-import-template.xlsx"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[api/projects/bulk-template]", error);
    return NextResponse.json(
      { error: "Could not generate the Excel template. Please try again." },
      { status: 500 }
    );
  }
}
