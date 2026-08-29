import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { loadCompanyForPdf } from "@/lib/company-for-pdf";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";
import { canManageEmployees } from "@/lib/project-access";
import { toPermissionUser } from "@/lib/session";
import { titleCaseWords } from "@/lib/text-case";
import {
  buildSystemGuidePdfBuffer,
  systemGuideFilename,
} from "@/lib/system-guide/pdf";
import {
  parseRequestedGuideModules,
  resolveSystemGuideDocument,
} from "@/lib/system-guide/resolve";

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (session.user.clientId || session.user.vendorId) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const user = toPermissionUser(session);
  if (!canManageEmployees(user)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const locale = await getServerLocale();
  const t = createTranslator(locale);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: t("pages.employees.positionDialog.downloadSystemGuideFailed") },
      { status: 400 }
    );
  }

  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const positionName = titleCaseWords(String(record.positionName ?? "").trim());
  const departmentLabel = String(record.departmentLabel ?? "").trim();
  const modules = parseRequestedGuideModules(record.modules);

  if (!positionName) {
    return NextResponse.json(
      { error: t("pages.employees.positionDialog.positionName") },
      { status: 400 }
    );
  }
  if (modules.length === 0) {
    return NextResponse.json(
      { error: t("pages.employees.positionDialog.downloadSystemGuideEmpty") },
      { status: 400 }
    );
  }

  try {
    const company = session.user.companyId
      ? await loadCompanyForPdf(session.user.companyId)
      : null;
    const guide = resolveSystemGuideDocument({
      locale,
      positionName,
      departmentLabel,
      modules,
    });
    const buffer = await buildSystemGuidePdfBuffer({ guide, company });
    const filename = systemGuideFilename(positionName, locale);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[api/positions/system-guide]", error);
    return NextResponse.json(
      { error: t("pages.employees.positionDialog.downloadSystemGuideFailed") },
      { status: 500 }
    );
  }
}
