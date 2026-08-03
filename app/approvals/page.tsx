import {
  filterLeaveRequestsForReviewer,
  resolveLeaveReviewerProfile,
} from "@/lib/leave-approval-hierarchy";
import { prisma } from "@/lib/prisma";
import { requireModule, toPermissionUser } from "@/lib/session";
import { inventoryQtyFromDecimal } from "@/lib/inventory";
import { createTranslator } from "@/lib/i18n/translate";
import { getServerLocale } from "@/lib/i18n/locale";
import { formatDisplayDate } from "@/lib/format-date";

import AppShell from "@/components/layout/AppShell";
import SectionCard from "@/components/ui/SectionCard";
import EmptyState from "@/components/ui/EmptyState";
import PendingLeaveTable from "@/components/approvals/PendingLeaveTable";
import { ReviewMaterialRequestButtons } from "@/components/material-requests/MaterialRequestActions";
import { formatEmployeeName } from "@/lib/employee-user-link";

export default async function ApprovalsPage() {
  const session = await requireModule("approvals");
  const companyId = session.user.companyId;
  const locale = await getServerLocale();
  const t = createTranslator(locale);

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

  const pendingLeave = filterLeaveRequestsForReviewer(pendingRaw, reviewer);

  const pendingMaterials = companyId
    ? await prisma.materialRequest.findMany({
        where: { companyId, status: "REQUESTED" },
        include: {
          project: { select: { name: true } },
          requestedBy: { select: { firstName: true, lastName: true } },
          lines: {
            include: {
              item: { select: { sku: true, name: true, unit: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
        take: 100,
      })
    : [];

  return (
    <AppShell
      titleKey="pages.approvals.title"
      descriptionKey="pages.approvals.description"
    >
      <div className="space-y-6">
        <SectionCard className="p-5 sm:p-6">
          <h2 className="mb-4 text-base font-semibold text-text">
            {t("pages.approvals.leaveSection")}
          </h2>
          {pendingLeave.length === 0 ? (
            <EmptyState
              titleKey="pages.approvals.emptyLeaveTitle"
              descriptionKey="pages.approvals.emptyLeaveDescription"
            />
          ) : (
            <PendingLeaveTable data={pendingLeave} />
          )}
        </SectionCard>

        <SectionCard className="p-5 sm:p-6">
          <h2 className="mb-4 text-base font-semibold text-text">
            {t("pages.approvals.materialsSection")}
          </h2>
          {pendingMaterials.length === 0 ? (
            <EmptyState
              titleKey="pages.approvals.emptyMaterialsTitle"
              descriptionKey="pages.approvals.emptyMaterialsDescription"
            />
          ) : (
            <ul className="space-y-3">
              {pendingMaterials.map((request) => (
                <li
                  key={request.id}
                  className="rounded-xl border border-border bg-elevated/30 px-4 py-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text">
                        {request.project.name}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {formatEmployeeName(request.requestedBy)} ·{" "}
                        {formatDisplayDate(request.createdAt)}
                      </p>
                      <ul className="mt-2 space-y-1 text-sm text-subtle">
                        {request.lines.map((line) => (
                          <li key={line.id}>
                            {line.item.name} ({line.item.sku}) —{" "}
                            {inventoryQtyFromDecimal(line.quantity)}{" "}
                            {line.item.unit}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <ReviewMaterialRequestButtons id={request.id} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </AppShell>
  );
}
