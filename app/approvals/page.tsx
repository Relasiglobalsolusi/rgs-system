import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";

import AppShell from "@/components/layout/AppShell";
import SectionCard from "@/components/ui/SectionCard";
import EmptyState from "@/components/ui/EmptyState";
import PendingLeaveTable from "@/components/approvals/PendingLeaveTable";

export default async function ApprovalsPage() {
  await requireModule("approvals");

  const pending = await prisma.leaveRequest.findMany({
    where: { status: "PENDING" },
    include: { employee: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <AppShell
      titleKey="pages.approvals.title"
      descriptionKey="pages.approvals.description"
    >
      <div className="mb-8">
        <SectionCard>
          {pending.length === 0 ? (
            <EmptyState
              titleKey="pages.approvals.emptyTitle"
              descriptionKey="pages.approvals.emptyDescription"
            />
          ) : (
            <PendingLeaveTable data={pending} />
          )}
        </SectionCard>
      </div>
    </AppShell>
  );
}
