import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { loadCompanyForPdf } from "@/lib/company-for-pdf";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";
import { getClientPortalGuideModules } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { canManageClients } from "@/lib/project-access";
import { toPermissionUser } from "@/lib/session";
import {
  buildSystemGuidePdfBuffer,
  systemGuideFilename,
} from "@/lib/system-guide/pdf";
import { resolveSystemGuideDocument } from "@/lib/system-guide/resolve";

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (session.user.clientId || session.user.vendorId) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const user = toPermissionUser(session);
  if (!canManageClients(user)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const locale = await getServerLocale();
  const t = createTranslator(locale);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: t("pages.clients.downloadSystemGuideFailed") },
      { status: 400 }
    );
  }

  const record =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const clientId = String(record.clientId ?? "").trim();
  if (!clientId) {
    return NextResponse.json(
      { error: t("pages.clients.systemGuidePickClient") },
      { status: 400 }
    );
  }

  const companyId = session.user.companyId;
  const client = await prisma.client.findFirst({
    where: {
      id: clientId,
      companyId,
      active: true,
    },
    select: { id: true, name: true },
  });

  if (!client) {
    return NextResponse.json(
      { error: t("pages.clients.notFound") },
      { status: 404 }
    );
  }

  const modules = getClientPortalGuideModules();
  if (modules.length === 0) {
    return NextResponse.json(
      { error: t("pages.clients.downloadSystemGuideEmpty") },
      { status: 400 }
    );
  }

  try {
    const company = companyId ? await loadCompanyForPdf(companyId) : null;
    const guide = resolveSystemGuideDocument({
      locale,
      audience: "client",
      positionName: client.name,
      departmentLabel: t("pages.clients.systemGuidePortalLabel"),
      modules,
    });
    const buffer = await buildSystemGuidePdfBuffer({ guide, company });
    const filename = systemGuideFilename(client.name, locale);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[api/clients/system-guide]", error);
    return NextResponse.json(
      { error: t("pages.clients.downloadSystemGuideFailed") },
      { status: 500 }
    );
  }
}
