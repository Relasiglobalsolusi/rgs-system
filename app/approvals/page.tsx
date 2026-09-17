import {
  filterLeaveRequestsForReviewer,
  filterOwnPendingLeaveRequests,
  leaveRequestEmployeeSelect,
  resolveLeaveReviewerProfile,
} from "@/lib/leave-approval-hierarchy";
import { prisma } from "@/lib/prisma";
import { getProjectWhereForUser } from "@/lib/project-access";
import { getApprovalsAccess } from "@/lib/permissions";
import { requireModule, toPermissionUser } from "@/lib/session";
import { inventoryQtyFromDecimal } from "@/lib/inventory";
import { createTranslator } from "@/lib/i18n/translate";
import { getServerLocale, localeToBcp47 } from "@/lib/i18n/locale";
import { formatEmployeeName } from "@/lib/employee-user-link";
import { listPendingPayrollUnlockRequests } from "@/lib/payroll-unlock-request";
import { formatDisplayDateTime } from "@/lib/format-date";
import {
  materialRequestProjectSelect,
  toMaterialRequestProjectView,
} from "@/lib/material-request-detail";
import { titleCaseWords } from "@/lib/text-case";

import AppShell from "@/components/layout/AppShell";
import SectionCard from "@/components/ui/SectionCard";
import EmptyState from "@/components/ui/EmptyState";
import {
  ApprovalsEmptyCard,
  ApprovalsQueue,
} from "@/components/approvals/ApprovalsQueue";
import OwnPendingLeaveNotice from "@/components/approvals/OwnPendingLeaveNotice";
import PendingLeaveCards from "@/components/approvals/PendingLeaveCards";
import {
  getNeedsAttentionTransferOrders,
  listProjectsForTransferAssign,
} from "@/app/transfer-orders/actions";
import MaterialRequestDetailCard from "@/components/material-requests/MaterialRequestDetailCard";
import { ReviewMaterialRequestButtons } from "@/components/material-requests/MaterialRequestActions";
import TransferOrderDetailCard from "@/components/transfer-orders/TransferOrderDetailCard";
import { ManagerNeedsAttentionActions } from "@/components/transfer-orders/TransferOrderActions";
import PayrollUnlockApprovalActions from "@/components/approvals/PayrollUnlockApprovalActions";

export default async function ApprovalsPage() {
  const session = await requireModule("approvals");
  const companyId = session.user.companyId;
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  // Each queue is ticked on its own, like Advance Cash.
  const queues = getApprovalsAccess({
    ...toPermissionUser(session),
    username: session.user.username,
  });

  const reviewer = await resolveLeaveReviewerProfile({
    userId: session.user.id,
    username: session.user.username,
    permissionUser: toPermissionUser(session),
  });

  const pendingRaw = companyId && queues.leaves
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

  const projectWhere = companyId
    ? await getProjectWhereForUser({
        companyId,
        clientId: session.user.clientId,
        userId: session.user.id,
        username: session.user.username,
      })
    : null;

  const pendingMaterials = companyId && queues.materialRequests
    ? await prisma.materialRequest.findMany({
        where: {
          companyId,
          status: "REQUESTED",
          ...(projectWhere ? { project: projectWhere } : {}),
        },
        include: {
          project: { select: materialRequestProjectSelect },
          requestedBy: {
            select: {
              firstName: true,
              lastName: true,
              employeeNo: true,
              position: true,
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

  const [needsAttentionOrders, assignableProjects] = await Promise.all([
    queues.warehouseReturns
      ? getNeedsAttentionTransferOrders()
      : Promise.resolve([]),
    queues.warehouseReturns
      ? listProjectsForTransferAssign()
      : Promise.resolve([]),
  ]);
  const pendingPayrollUnlocks = queues.payrollUnlock
    ? await listPendingPayrollUnlockRequests({
        companyId,
        userId: session.user.id,
        bcp47: localeToBcp47(locale),
      })
    : [];

  return (
    <AppShell
      titleKey="pages.approvals.title"
    >
      <div className="min-w-0 max-w-full space-y-6">
        {queues.materialRequests ? (
          <ApprovalsQueue
            title={t("pages.approvals.materialsSection")}
            description={t("pages.approvals.materialsSectionDesc")}
            countLabel={
              pendingMaterials.length > 0
                ? t("pages.approvals.pendingCount", {
                    count: pendingMaterials.length,
                  })
                : undefined
            }
          >
            {pendingMaterials.length === 0 ? (
              <ApprovalsEmptyCard>
                <EmptyState
                  titleKey="pages.approvals.emptyMaterialsTitle"
                  descriptionKey="pages.approvals.emptyMaterialsDescription"
                />
              </ApprovalsEmptyCard>
            ) : (
              pendingMaterials.map((request) => (
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
                    project: toMaterialRequestProjectView(
                      request.project,
                      locale
                    ),
                    requestedByName: formatEmployeeName(request.requestedBy),
                    requestedByNo: request.requestedBy.employeeNo,
                    requestedByPosition: request.requestedBy.position
                      ? titleCaseWords(request.requestedBy.position)
                      : null,
                    lines: request.lines.map((line) => ({
                      id: line.id,
                      quantity: inventoryQtyFromDecimal(line.quantity),
                      notes: line.notes,
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
              ))
            )}
          </ApprovalsQueue>
        ) : null}

        {queues.leaves ? (
          <ApprovalsQueue
            title={t("pages.approvals.leaveSection")}
            description={t("pages.approvals.leaveSectionDesc")}
            countLabel={
              pendingLeave.length > 0
                ? t("pages.approvals.pendingCount", {
                    count: pendingLeave.length,
                  })
                : undefined
            }
          >
            <OwnPendingLeaveNotice data={ownPendingLeave} />
            {pendingLeave.length === 0 ? (
              <ApprovalsEmptyCard>
                <EmptyState
                  titleKey="pages.approvals.emptyLeaveTitle"
                  descriptionKey={
                    ownPendingLeave.length > 0
                      ? "pages.approvals.emptyLeaveOnlyOwnDescription"
                      : "pages.approvals.emptyLeaveDescription"
                  }
                />
              </ApprovalsEmptyCard>
            ) : (
              <PendingLeaveCards data={pendingLeave} />
            )}
          </ApprovalsQueue>
        ) : null}

        {queues.warehouseReturns ? (
          <ApprovalsQueue
            title={t("pages.approvals.needsAttentionSection")}
            description={t("pages.approvals.needsAttentionSectionDesc")}
            countLabel={
              needsAttentionOrders.length > 0
                ? t("pages.approvals.pendingCount", {
                    count: needsAttentionOrders.length,
                  })
                : undefined
            }
          >
            {needsAttentionOrders.length === 0 ? (
              <ApprovalsEmptyCard>
                <EmptyState
                  titleKey="pages.approvals.emptyNeedsAttentionTitle"
                  descriptionKey="pages.approvals.emptyNeedsAttentionDescription"
                />
              </ApprovalsEmptyCard>
            ) : (
              needsAttentionOrders.map((order) => (
                <TransferOrderDetailCard
                  key={order.id}
                  showStock
                  className="border-border bg-card shadow-[0_14px_32px_-26px_rgba(0,0,0,0.55)]"
                  order={order}
                  actions={
                    <ManagerNeedsAttentionActions
                      id={order.id}
                      defaultProjectId={order.project.id}
                      projects={assignableProjects}
                    />
                  }
                />
              ))
            )}
          </ApprovalsQueue>
        ) : null}

        {queues.payrollUnlock ? (
          <ApprovalsQueue
            title={t("pages.approvals.payrollUnlockSection")}
            description={t("pages.approvals.payrollUnlockSectionDesc")}
            countLabel={
              pendingPayrollUnlocks.length > 0
                ? t("pages.approvals.pendingCount", {
                    count: pendingPayrollUnlocks.length,
                  })
                : undefined
            }
          >
            {pendingPayrollUnlocks.length === 0 ? (
              <ApprovalsEmptyCard>
                <EmptyState
                  titleKey="pages.approvals.emptyPayrollUnlockTitle"
                  descriptionKey="pages.approvals.emptyPayrollUnlockDescription"
                />
              </ApprovalsEmptyCard>
            ) : (
              pendingPayrollUnlocks.map((request) => (
                <SectionCard key={request.id} className="p-4 sm:p-5">
                  <div className="min-w-0 space-y-1">
                    <h3 className="text-base font-semibold tracking-tight text-text">
                      {request.periodLabel}
                    </h3>
                    <p className="text-sm text-subtle">
                      {t("pages.approvals.payrollUnlockRequestedBy", {
                        name:
                          request.requestedByName ??
                          t("pages.payroll.unlockUnknownRequester"),
                        date: formatDisplayDateTime(
                          request.requestedAt,
                          { timeZone: "Asia/Jakarta" },
                          localeToBcp47(locale)
                        ),
                      })}
                    </p>
                  </div>
                  <p className="mt-4 whitespace-pre-wrap text-sm text-text">
                    {request.reason}
                  </p>
                  <div className="mt-4 border-t border-border pt-4">
                    <PayrollUnlockApprovalActions id={request.id} />
                  </div>
                </SectionCard>
              ))
            )}
          </ApprovalsQueue>
        ) : null}
      </div>
    </AppShell>
  );
}
