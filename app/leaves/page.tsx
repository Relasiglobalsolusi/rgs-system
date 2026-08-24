import { prisma } from "@/lib/prisma";
import { requireModule, getEmployeeForUser } from "@/lib/session";
import { refreshLeaveEmploymentForUser } from "@/lib/leave-employment-status";

import AppShell from "@/components/layout/AppShell";
import LeaveDirectory from "@/components/leaves/LeaveDirectory";

export default async function LeavesPage() {
  const session = await requireModule("leaves");
  await refreshLeaveEmploymentForUser(session.user.id);
  const employee = await getEmployeeForUser(session.user.id);
  const hasEmployeeProfile = Boolean(employee);
  const companyId = session.user.companyId;

  const leaves = await prisma.leaveRequest.findMany({
    where:
      hasEmployeeProfile && employee
        ? { employeeId: employee.id }
        : companyId
          ? { employee: { companyId } }
          : { id: "__none__" },
    include: { employee: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <AppShell
      titleKey="pages.leaves.title"
    >
      <LeaveDirectory
        data={leaves.map((leave) => ({
          id: leave.id,
          type: leave.type,
          startDate: leave.startDate,
          endDate: leave.endDate,
          reason: leave.reason,
          status: leave.status,
          proofUrl: leave.proofUrl,
          employee: {
            firstName: leave.employee.firstName,
            lastName: leave.employee.lastName,
          },
        }))}
        showEmployee={!hasEmployeeProfile}
        canSubmit={hasEmployeeProfile}
      />
    </AppShell>
  );
}
