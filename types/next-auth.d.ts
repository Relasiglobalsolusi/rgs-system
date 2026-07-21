import type { DefaultSession } from "next-auth";
import type { EmployeeType } from "@prisma/client";

import type { SidebarOrder } from "@/lib/sidebar-order";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username?: string;
      role: string;
      companyId: string;
      companyName: string;
      clientId: string | null;
      clientName: string | null;
      vendorId: string | null;
      vendorName: string | null;
      employee: {
        employeeNo: string;
        employeeType: EmployeeType;
        category: {
          name: string;
          prefix: string;
          slug?: string | null;
        } | null;
      } | null;
      employeeType: EmployeeType | null;
      moduleOverrides: Record<string, boolean> | null;
      sidebarOrder: SidebarOrder | null;
      mustSetPassword: boolean;
      mustSetRecoveryEmail: boolean;
    } & DefaultSession["user"];
  }

  interface User {
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
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    username?: string;
    role: string;
    companyId: string;
    companyName: string;
    clientId: string | null;
    clientName: string | null;
    vendorId: string | null;
    vendorName: string | null;
    employee: {
      employeeNo: string;
      employeeType: EmployeeType;
      category: {
        name: string;
        prefix: string;
        slug?: string | null;
      } | null;
    } | null;
    employeeType: EmployeeType | null;
    moduleOverrides: Record<string, boolean> | null;
    sidebarOrder: SidebarOrder | null;
    mustSetPassword: boolean;
    mustSetRecoveryEmail: boolean;
  }
}

declare module "next-auth/react" {
  interface Session {
    user: {
      mustSetPassword: boolean;
      mustSetRecoveryEmail: boolean;
    } & DefaultSession["user"];
  }
}
