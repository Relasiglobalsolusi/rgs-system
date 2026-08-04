import {
  filterLeaveRequestsForReviewer,
  filterOwnPendingLeaveRequests,
  leaveRequestEmployeeSelect,
  resolveLeaveReviewerProfile,
} from "@/lib/leave-approval-hierarchy";
import { prisma } from "@/lib/prisma";
import { requireModule, toPermissionUser } from "@/lib/session";
import { inventoryQtyFromDecimal } from "@/lib/inventory";
import { createTranslator } from "@/lib/i18n/translate";
import { getServerLocale } from "@/lib/i18n/locale";
import { formatEmployeeName } from "@/lib/employee-user-link";

import AppShell from "@/components/layout/AppShell";
import SectionCard from "@/components/ui/SectionCard";
import EmptyState from "@/components/ui/EmptyState";
import OwnPendingLeaveNotice from "@/components/approvals/OwnPendingLeaveNotice";
import PendingLeaveTable from "@/components/approvals/PendingLeaveTable";
import MaterialRequestDetailCard from "@/components/material-requests/MaterialRequestDetailCard";
import { ReviewMaterialRequestButtons } from "@/components/material-requests/MaterialRequestActions";

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
            select: {
              ...leaveRequestEmployeeSelect,
              firstName: true,
              lastName: true,
              employeeNo: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const pendingLeave = filterLeaveRequestsForReviewer(pendingRaw, reviewer);
  const ownPendingLeave = filterOwnPendingLeaveRequests(pendingRaw, reviewer);

  const pendingMaterials = companyId
    ? await prisma.materialRequest.findMany({
        where: { companyId, status: "REQUESTED" },
        include: {
          project: { select: { id: true, name: true } },
          requestedBy: {
            select: {
              firstName: true,
              lastName: true,
              employeeNo: true,
            },
          },
          lines: {
            include: {
              item: {
                select: {
                  sku: true,
                  name: true,
                  unit: true,
                  currentStock: true,
                },
              },
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
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-text">
                {t("pages.approvals.leaveSection")}
              </h2>
              <p className="mt-1 text-sm text-subtle">
                {t("pages.approvals.leaveSectionDesc")}
              </p>
            </div>
            {pendingLeave.length > 0 ? (
              <p className="text-sm tabular-nums text-muted">
                {t("pages.approvals.pendingCount", {
                  count: pendingLeave.length,
                })}
              </p>
            ) : null}
          </div>
          <OwnPendingLeaveNotice data={ownPendingLeave} />
          {pendingLeave.length === 0 ? (
            <EmptyState
              titleKey="pages.approvals.emptyLeaveTitle"
              descriptionKey={
                ownPendingLeave.length > 0
                  ? "pages.approvals.emptyLeaveOnlyOwnDescription"
                  : "pages.approvals.emptyLeaveDescription"
              }
            />
          ) : (
            <PendingLeaveTable data={pendingLeave} />
          )}
        </SectionCard>

        <SectionCard className="p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-text">
                {t("pages.approvals.materialsSection")}
              </h2>
              <p className="mt-1 text-sm text-subtle">
                {t("pages.approvals.materialsSectionDesc")}
              </p>
            </div>
            {pendingMaterials.length > 0 ? (
              <p className="text-sm tabular-nums text-muted">
                {t("pages.approvals.pendingCount", {
                  count: pendingMaterials.length,
                })}
              </p>
            ) : null}
          </div>
          {pendingMaterials.length === 0 ? (
            <EmptyState
              titleKey="pages.approvals.emptyMaterialsTitle"
              descriptionKey="pages.approvals.emptyMaterialsDescription"
            />
          ) : (
            <div className="space-y-4">
              {pendingMaterials.map((request) => (
                <MaterialRequestDetailCard
                  key={request.id}
                  showStock
                  request={{
                    id: request.id,
                    status: request.status,
                    notes: request.notes,
                    reviewNote: request.reviewNote,
                    createdAt: request.createdAt,
                    reviewedAt: request.reviewedAt,
                    project: request.project,
                    requestedByName: formatEmployeeName(request.requestedBy),
                    requestedByNo: request.requestedBy.employeeNo,
                    lines: request.lines.map((line) => ({
                      id: line.id,
                      quantity: inventoryQtyFromDecimal(line.quantity),
                      item: {
                        sku: line.item.sku,
                        name: line.item.name,
                        unit: line.item.unit,
                        currentStock: inventoryQtyFromDecimal(
                          line.item.currentStock
                        ),
                      },
                    })),
                  }}
                  actions={<ReviewMaterialRequestButtons id={request.id} />}
                />
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </AppShell>
  );
}
