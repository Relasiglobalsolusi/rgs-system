import { getServerSession } from "next-auth";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { normalizeUsername } from "@/lib/username";
import {
  needsRecoveryEmail,
  normalizeRecoveryEmail,
} from "@/lib/user-account";
import { parseModuleOverrides } from "@/lib/module-overrides";
import {
  fetchUserNavPreferences,
  parseSidebarOrder,
  type SidebarOrder,
} from "@/lib/sidebar-order";
import { prisma } from "@/lib/prisma";
import type { EmployeeType } from "@prisma/client";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",

      credentials: {
        username: {
          label: "Username",
          type: "text",
        },
        password: {
          label: "Password",
          type: "password",
        },
      },

      async authorize(credentials) {
        const loginId = credentials?.username?.trim() ?? "";
        const username = loginId ? normalizeUsername(loginId) : "";
        const password = credentials?.password;

        if (!username || !password) {
          return null;
        }

        const emailCandidate = loginId.includes("@")
          ? normalizeRecoveryEmail(loginId)
          : "";

        const user = await prisma.user.findFirst({
          where: emailCandidate
            ? { OR: [{ username }, { email: emailCandidate }] }
            : { username },
          include: {
            company: true,
            client: {
              select: { name: true, active: true },
            },
            vendor: {
              select: { name: true, active: true },
            },
            employee: {
              select: {
                status: true,
                archivedFromDirectory: true,
                employeeType: true,
                employeeNo: true,
                placement: true,
                employmentType: true,
                loginRevokedReason: true,
                category: {
                  select: { name: true, prefix: true, slug: true },
                },
              },
            },
          },
        });

        // Soft-delete / revoke sets User.active = false; explain PT off-project etc.
        if (!user) {
          return null;
        }
        if (!user.active) {
          const reason = user.employee?.loginRevokedReason?.trim();
          if (reason) {
            throw new Error(reason);
          }
          throw new Error(
            "Your portal access has been revoked. Contact operations if you need access restored."
          );
        }

        if (
          user.employee &&
          (user.employee.archivedFromDirectory ||
            user.employee.status !== "ACTIVE")
        ) {
          return null;
        }

        if (user.client && user.client.active === false) {
          return null;
        }

        if (user.vendor && user.vendor.active === false) {
          return null;
        }

        const passwordIsCorrect = await bcrypt.compare(
          password,
          user.passwordHash
        );

        if (!passwordIsCorrect) {
          return null;
        }

        const moduleOverrides = parseModuleOverrides(user.moduleOverrides);
        const sidebarOrder = parseSidebarOrder(user.sidebarOrder);

        return {
          id: user.id,
          name: user.name,
          // NextAuth JWT expects a stringy email; optional recovery email may be null.
          email: user.email ?? `${user.username}@users.local`,
          username: user.username,
          role: user.role,
          companyId: user.companyId,
          companyName: user.company.name,
          clientId: user.clientId,
          clientName: user.client?.name ?? null,
          vendorId: user.vendorId,
          vendorName: user.vendor?.name ?? null,
          employee: user.employee
            ? {
                employeeNo: user.employee.employeeNo,
                employeeType: user.employee.employeeType,
                category: user.employee.category
                  ? {
                      name: user.employee.category.name,
                      prefix: user.employee.category.prefix,
                      slug: user.employee.category.slug,
                    }
                  : null,
              }
            : null,
          employeeType: user.employee?.employeeType ?? null,
          moduleOverrides,
          sidebarOrder,
          mustSetPassword: user.mustSetPassword,
          mustSetRecoveryEmail: needsRecoveryEmail(user.email),
        };
      },
    }),
  ],

  pages: {
    signIn: "/login",
  },

  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,
  },

  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        const authenticatedUser = user as typeof user & {
          username: string;
          role: string;
          companyId: string;
          companyName: string;
          clientId?: string | null;
          clientName?: string | null;
          vendorId?: string | null;
          vendorName?: string | null;
          employee?: {
            employeeNo: string;
            employeeType: EmployeeType;
            category?: {
              name: string;
              prefix: string;
              slug?: string | null;
            } | null;
          } | null;
          employeeType?: EmployeeType | null;
          moduleOverrides?: Record<string, boolean> | null;
          sidebarOrder?: SidebarOrder | null;
          mustSetPassword?: boolean;
          mustSetRecoveryEmail?: boolean;
        };

        token.id = authenticatedUser.id;
        token.username = authenticatedUser.username;
        token.role = authenticatedUser.role;
        token.companyId = authenticatedUser.companyId;
        token.companyName = authenticatedUser.companyName;
        token.clientId = authenticatedUser.clientId ?? null;
        token.clientName = authenticatedUser.clientName ?? null;
        token.vendorId = authenticatedUser.vendorId ?? null;
        token.vendorName = authenticatedUser.vendorName ?? null;
        token.employee = authenticatedUser.employee
          ? {
              employeeNo: authenticatedUser.employee.employeeNo,
              employeeType: authenticatedUser.employee.employeeType,
              category: authenticatedUser.employee.category ?? null,
            }
          : null;
        token.employeeType = authenticatedUser.employeeType ?? null;
        token.moduleOverrides = authenticatedUser.moduleOverrides ?? null;
        token.sidebarOrder = authenticatedUser.sidebarOrder ?? null;
        token.mustSetPassword = authenticatedUser.mustSetPassword ?? false;
        token.mustSetRecoveryEmail =
          authenticatedUser.mustSetRecoveryEmail ?? false;
      } else if (trigger === "update" && session) {
        // Client session.update() — apply payload first so sidebarOrder
        // (and other prefs) land in the JWT without waiting for a re-login.
        if ("mustSetPassword" in session) {
          token.mustSetPassword = Boolean(session.mustSetPassword);
        }
        if ("mustSetRecoveryEmail" in session) {
          token.mustSetRecoveryEmail = Boolean(session.mustSetRecoveryEmail);
        }
        if ("moduleOverrides" in session) {
          token.moduleOverrides = parseModuleOverrides(session.moduleOverrides);
        }
        if ("sidebarOrder" in session) {
          token.sidebarOrder = parseSidebarOrder(session.sidebarOrder);
        }
      } else if (token.id) {
        // Keep permissions / sidebar prefs in sync after DB changes.
        const prefs = await fetchUserNavPreferences(String(token.id));
        token.moduleOverrides = prefs.moduleOverrides;
        token.sidebarOrder = prefs.sidebarOrder;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        Object.assign(session.user, {
          id: String(token.id),
          username: token.username ? String(token.username) : undefined,
          role: String(token.role),
          companyId: String(token.companyId),
          companyName: String(token.companyName),
          clientId: token.clientId ? String(token.clientId) : null,
          clientName: token.clientName ? String(token.clientName) : null,
          vendorId: token.vendorId ? String(token.vendorId) : null,
          vendorName: token.vendorName ? String(token.vendorName) : null,
          employee: token.employee ?? null,
          employeeType: token.employeeType ?? null,
          moduleOverrides: token.moduleOverrides ?? null,
          sidebarOrder: token.sidebarOrder ?? null,
          mustSetPassword: Boolean(token.mustSetPassword),
          mustSetRecoveryEmail: Boolean(token.mustSetRecoveryEmail),
        });
      }

      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};

export function getCurrentSession() {
  return getServerSession(authOptions);
}
