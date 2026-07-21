import { prisma } from "@/lib/prisma";
import { requireModule, getEmployeeForUser } from "@/lib/session";

import AppShell from "@/components/layout/AppShell";
import SectionCard from "@/components/ui/SectionCard";
import EmptyState from "@/components/ui/EmptyState";
import LeaveDialog from "@/components/leaves/LeaveDialog";
import LeaveRequestTable from "@/components/leaves/LeaveRequestTable";

export default async function LeavesPage() {
  const session = await requireModule("leaves");
  const employee = await getEmployeeForUser(session.user.id);
  const hasEmployeeProfile = Boolean(employee);

  const leaves = await prisma.leaveRequest.findMany({
    where: hasEmployeeProfile && employee ? { employeeId: employee.id } : {},
    include: { employee: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <AppShell
      titleKey="pages.leaves.title"
      descriptionKey={
        hasEmployeeProfile
          ? "pages.leaves.descriptionEmployeeShort"
          : "pages.leaves.descriptionManagerShort"
      }
    >
      {hasEmployeeProfile && (
        <div className="mb-6 flex justify-end">
          <LeaveDialog />
        </div>
      )}

      <SectionCard>
        {leaves.length === 0 ? (
          <EmptyState
            titleKey="pages.leaves.emptyTitle"
            descriptionKey={
              hasEmployeeProfile
                ? "pages.leaves.emptyDescriptionEmployeeShort"
                : "pages.leaves.emptyDescriptionManagerShort"
            }
          />
        ) : (
          <LeaveRequestTable
            data={leaves}
            showEmployee={!hasEmployeeProfile}
          />
        )}
      </SectionCard>
    </AppShell>
  );
}
