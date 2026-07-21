import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { buildVendorImportTemplate } from "@/lib/bulk-import/vendor-template";
import { getServerLocale, parseAppLocale } from "@/lib/i18n/locale";
import { canAccess } from "@/lib/permissions";
import { canManageVendors } from "@/lib/project-access";
import { toPermissionUser } from "@/lib/session";

/** Locale-aware static Lists only — still never cache a workbook. */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const user = toPermissionUser(session);
  if (!canAccess(user, "vendors") || !canManageVendors(user)) {
    return NextResponse.json(
      { error: "You do not have permission to manage vendors." },
      { status: 403 }
    );
  }

  const queryLocale = request.nextUrl.searchParams.get("locale");
  const locale = queryLocale
    ? parseAppLocale(queryLocale)
    : await getServerLocale();

  try {
    const buffer = await buildVendorImportTemplate(locale);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="rgs-vendors-import-template.xlsx"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[api/vendors/bulk-template]", error);
    return NextResponse.json(
      { error: "Could not generate the Excel template. Please try again." },
      { status: 500 }
    );
  }
}
