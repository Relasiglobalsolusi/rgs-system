import { getServerSession } from "next-auth";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",

      credentials: {
        email: {
          label: "Email",
          type: "email",
        },
        password: {
          label: "Password",
          type: "password",
        },
      },

      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;

        if (!email || !password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: {
            email,
          },
          include: {
            company: true,
          },
        });

        if (!user || !user.active) {
          return null;
        }

        const passwordIsCorrect = await bcrypt.compare(
          password,
          user.passwordHash
        );

        if (!passwordIsCorrect) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          type: user.type,
          companyId: user.companyId,
          companyName: user.company.name,
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
    async jwt({ token, user }) {
      if (user) {
        const authenticatedUser = user as typeof user & {
          role: string;
          type: string;
          companyId: string;
          companyName: string;
        };

        token.id = authenticatedUser.id;
        token.role = authenticatedUser.role;
        token.type = authenticatedUser.type;
        token.companyId = authenticatedUser.companyId;
        token.companyName = authenticatedUser.companyName;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        Object.assign(session.user, {
          id: String(token.id),
          role: String(token.role),
          type: String(token.type),
          companyId: String(token.companyId),
          companyName: String(token.companyName),
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