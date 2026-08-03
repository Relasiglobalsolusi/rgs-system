import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { buildInventoryImportTemplate } from "@/lib/bulk-import/inventory-template";
import { getServerLocale, parseAppLocale } from "@/lib/i18n/locale";
import { canAccess } from "@/lib/permissions";
import { canManageItemCatalog } from "@/lib/project-access";
import { toPermissionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const user = toPermissionUser(session);
  if (!canAccess(user, "itemCatalog") || !canManageItemCatalog(user)) {
    return NextResponse.json(
      { error: "You do not have permission to manage the item catalog." },
      { status: 403 }
    );
  }

  const queryLocale = request.nextUrl.searchParams.get("locale");
  const locale = queryLocale
    ? parseAppLocale(queryLocale)
    : await getServerLocale();

  try {
    const buffer = await buildInventoryImportTemplate(locale);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="rgs-inventory-items-import-template.xlsx"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[api/inventory/bulk-template]", error);
    return NextResponse.json(
      { error: "Could not generate the Excel template. Please try again." },
      { status: 500 }
    );
  }
}
