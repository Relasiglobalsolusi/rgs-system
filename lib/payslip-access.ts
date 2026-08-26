import { redirect } from "next/navigation";

import { canAccess } from "@/lib/permissions";
import {
  getEmployeeForUser,
  requireSession,
  toPermissionUser,
} from "@/lib/session";

export async function requirePayslipAccess() {
  const session = await requireSession();
  if (session.user.clientId || session.user.vendorId) {
    redirect("/billing");
  }

  const user = toPermissionUser(session);
  const canManageAll = canAccess(user, "payroll");
  const linkedEmployee = await getEmployeeForUser(session.user.id);

  if (!canManageAll && !linkedEmployee) {
    redirect("/dashboard");
  }

  return {
    session,
    canManageAll,
    ownEmployeeId: linkedEmployee?.id ?? null,
  };
}

export function assertPayslipEmployeeAccess(
  employeeId: string,
  access: { canManageAll: boolean; ownEmployeeId: string | null }
) {
  if (access.canManageAll) return;
  if (access.ownEmployeeId !== employeeId) {
    redirect(`/payslips/${access.ownEmployeeId}`);
  }
}
