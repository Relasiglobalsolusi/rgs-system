import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      type: string;
      companyId: string;
      companyName: string;
    } & DefaultSession["user"];
  }

  interface User {
    role: string;
    type: string;
    companyId: string;
    companyName: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    type: string;
    companyId: string;
    companyName: string;
  }
}