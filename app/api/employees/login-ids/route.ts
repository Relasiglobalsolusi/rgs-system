import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { loadCompanyForPdf } from "@/lib/company-for-pdf";
import {
  buildEmployeeLoginIdPdfBuffer,
  loadEmployeeLoginIdRows,
} from "@/lib/employee-login-id-pdf";
import { getServerLocale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";
import { canManageEmployees } from "@/lib/project-access";
import { toPermissionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

function contentDispositionAttachment(fileName: string): string {
  const encoded = encodeURIComponent(fileName);
  const quoted = fileName.replace(/"/g, "");
  return `attachment; filename="${quoted}"; filename*=UTF-8''${encoded}`;
}

export async function GET() {
  const session = await getCurrentSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (session.user.clientId || session.user.vendorId) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const user = toPermissionUser(session);
  if (!canManageEmployees(user)) {
    return NextResponse.json(
      { error: "You do not have permission to download employee login IDs." },
      { status: 403 }
    );
  }

  const locale = await getServerLocale();

  try {
    const [rows, company] = await Promise.all([
      loadEmployeeLoginIdRows(session.user.companyId),
      loadCompanyForPdf(session.user.companyId),
    ]);

    const buffer = await buildEmployeeLoginIdPdfBuffer({
      rows,
      company,
      locale,
    });

    const fileName = translate(
      locale,
      "pages.employees.loginIdExport.fileName"
    );

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": contentDispositionAttachment(fileName),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[api/employees/login-ids]", error);
    return NextResponse.json(
      { error: "Could not generate the Employee Login IDs PDF. Please try again." },
      { status: 500 }
    );
  }
}
