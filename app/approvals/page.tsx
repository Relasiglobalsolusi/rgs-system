import {
  filterLeaveRequestsForReviewer,
  resolveLeaveReviewerProfile,
} from "@/lib/leave-approval-hierarchy";
import { prisma } from "@/lib/prisma";
import { requireModule, toPermissionUser } from "@/lib/session";

import AppShell from "@/components/layout/AppShell";
import SectionCard from "@/components/ui/SectionCard";
import EmptyState from "@/components/ui/EmptyState";
import PendingLeaveTable from "@/components/approvals/PendingLeaveTable";

export default async function ApprovalsPage() {
  const session = await requireModule("approvals");
  const companyId = session.user.companyId;

  const reviewer = await resolveLeaveReviewerProfile({
    userId: session.user.id,
    username: session.user.username,
    permissionUser: toPermissionUser(session),
  });

  const pendingRaw = companyId
    ? await prisma.leaveRequest.findMany({
        where: {
          status: "PENDING",
          employee: { companyId },
        },
        include: {
          employee: {
            include: {
              jobPosition: { select: { slug: true, name: true } },
              projectAssignments: {
                select: {
                  project: { select: { serviceArea: true, status: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const pending = filterLeaveRequestsForReviewer(pendingRaw, reviewer);

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
