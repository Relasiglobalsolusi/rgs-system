import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

import { AUTH_SESSION_REPLACED_REASON } from "@/lib/auth-session";
import { fetchSessionAccessState } from "@/lib/session-access";
import { canAccessRoute, type PermissionUser } from "@/lib/permissions";
import type { EmployeeType, UserRole } from "@prisma/client";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/projects",
  "/progress",
  "/cico",
  "/attendance",
  "/shifts",
  "/leaves",
  "/approvals",
  "/material-requests",
  "/transfer-orders",
  "/employees",
  "/users",
  "/departments",
  "/clients",
  "/vendors",
  "/reports",
  "/inventory",
  "/item-catalog",
  "/billing",
  "/invoicing",
  "/payslips",
  "/multi-project-unlock",
];

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (token.mustSetPassword) {
    const setPasswordUrl = new URL("/set-password", request.url);
    setPasswordUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(setPasswordUrl);
  }

  if (token.mustSetRecoveryEmail) {
    const setRecoveryEmailUrl = new URL("/set-recovery-email", request.url);
    setRecoveryEmailUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(setRecoveryEmailUrl);
  }

  const userId = token.id ? String(token.id) : "";
  const access = userId ? await fetchSessionAccessState(userId) : null;

  // getToken only decodes the cookie — re-check DB so revoke / soft-delete
  // logs the user out on the next protected navigation.
  if (!access?.allowed) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    const response = NextResponse.redirect(loginUrl);
    // Clear NextAuth session cookies so a stale JWT cannot bounce them back in.
    response.cookies.delete("next-auth.session-token");
    response.cookies.delete("__Secure-next-auth.session-token");
    return response;
  }

  // Another device closed this session by signing in — clear the stale cookie.
  const cookieSessionToken = token.sessionToken
    ? String(token.sessionToken)
    : "";
  if (
    access.sessionToken &&
    (!cookieSessionToken || access.sessionToken !== cookieSessionToken)
  ) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    loginUrl.searchParams.set("reason", AUTH_SESSION_REPLACED_REASON);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete("next-auth.session-token");
    response.cookies.delete("__Secure-next-auth.session-token");
    return response;
  }

  const moduleOverrides = access.moduleOverrides;
  const jobPosition =
    access.jobPosition ?? token.employee?.jobPosition ?? null;

  const user: PermissionUser & {
    username?: string;
    clientId?: string | null;
    vendorId?: string | null;
    employee?: {
      employeeNo: string;
      employeeType?: EmployeeType | null;
      jobPosition?: { slug?: string | null; name?: string | null } | null;
    } | null;
  } = {
    role: String(token.role) as UserRole,
    username: token.username ? String(token.username) : undefined,
    employeeType: (token.employeeType as EmployeeType | null) ?? null,
    moduleOverrides,
    clientId: token.clientId ? String(token.clientId) : null,
    vendorId: token.vendorId ? String(token.vendorId) : null,
    employee:
      jobPosition || token.employee
        ? {
            employeeNo: token.employee?.employeeNo ?? "",
            employeeType: (token.employeeType as EmployeeType | null) ?? null,
            jobPosition,
          }
        : null,
  };

  if (!canAccessRoute(user, pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/projects",
    "/projects/:path*",
    "/progress",
    "/progress/:path*",
    "/cico",
    "/cico/:path*",
    "/attendance",
    "/attendance/:path*",
    "/shifts",
    "/shifts/:path*",
    "/leaves",
    "/leaves/:path*",
    "/approvals",
    "/approvals/:path*",
    "/material-requests",
    "/material-requests/:path*",
    "/transfer-orders",
    "/transfer-orders/:path*",
    "/employees",
    "/employees/:path*",
    "/users",
    "/users/:path*",
    "/departments",
    "/departments/:path*",
    "/clients",
    "/clients/:path*",
    "/vendors",
    "/vendors/:path*",
    "/reports",
    "/reports/:path*",
    "/inventory",
    "/inventory/:path*",
    "/item-catalog",
    "/item-catalog/:path*",
    "/billing",
    "/billing/:path*",
    "/invoicing",
    "/invoicing/:path*",
    "/payslips",
    "/payslips/:path*",
    "/multi-project-unlock",
    "/multi-project-unlock/:path*",
  ],
};
