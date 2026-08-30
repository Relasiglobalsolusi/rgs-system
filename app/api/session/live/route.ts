import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { sessionLiveness } from "@/lib/session-watch";

export const dynamic = "force-dynamic";

function clearSessionCookies(res: NextResponse) {
  res.cookies.delete("next-auth.session-token");
  res.cookies.delete("__Secure-next-auth.session-token");
  return res;
}

export async function GET(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token?.id) {
    return NextResponse.json({ status: "none" as const });
  }

  const user = await prisma.user.findUnique({
    where: { id: String(token.id) },
    select: { sessionToken: true, active: true },
  });

  const status = sessionLiveness(
    token.sessionToken,
    user?.sessionToken,
    Boolean(user?.active)
  );

  const res = NextResponse.json({ status });
  if (status !== "ok") {
    clearSessionCookies(res);
  }
  return res;
}
