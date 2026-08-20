import AppShell from "@/components/layout/AppShell";
import MaterialRequestDetailCard from "@/components/material-requests/MaterialRequestDetailCard";
import MaterialRequestForm from "@/components/material-requests/MaterialRequestForm";
import {
  CancelMaterialRequestButton,
  SiteTransferReceiveActions,
} from "@/components/material-requests/MaterialRequestActions";
import EmptyState from "@/components/ui/EmptyState";
import SectionCard from "@/components/ui/SectionCard";
import { findOpenCicoAttendance } from "@/lib/cico-attendance";
import { createTranslator } from "@/lib/i18n/translate";
import { getServerLocale } from "@/lib/i18n/locale";
import { inventoryQtyFromDecimal } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";

export default async function MaterialRequestsPage() {
  const session = await requireModule("materialRequests");
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  const companyId = session.user.companyId;

  const employee = companyId
    ? await prisma.employee.findFirst({
        where: { userId: session.user.id, companyId, status: "ACTIVE" },
        select: { id: true },
      })
    : null;

  const openCico = employee
    ? await findOpenCicoAttendance(employee.id)
    : null;
  const checkedInProjectName = openCico?.record?.project?.name ?? null;

  const catalogItems = companyId
    ? await prisma.inventoryItem.findMany({
        where: {
          companyId,
          active: true,
          deletedAt: null,
          tracksStock: true,
        },
        select: {
          id: true,
          sku: true,
          name: true,
          unit: true,
          currentStock: true,
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        take: 300,
      })
    : [];

  const myRequests =
    companyId && employee
      ? await prisma.materialRequest.findMany({
          where: { companyId, requestedById: employee.id },
          include: {
            project: { select: { id: true, name: true } },
            reviewedBy: { select: { name: true, username: true } },
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
            transferOrder: {
              select: {
                id: true,
                status: true,
                sentAt: true,
                receivedAt: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        })
      : [];

  return (
    <AppShell
      titleKey="pages.materialRequests.title"
      descriptionKey="pages.materialRequests.description"
    >
      <div className="space-y-6">
        <SectionCard className="p-5 sm:p-6">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-text">
              {t("pages.materialRequests.newRequest")}
            </h2>
            <p className="mt-1 text-sm text-subtle">
              {t("pages.materialRequests.newRequestDesc")}
            </p>
          </div>
          <MaterialRequestForm
            checkedInProjectName={checkedInProjectName}
            items={catalogItems.map((item) => ({
              ...item,
              currentStock: inventoryQtyFromDecimal(item.currentStock),
            }))}
          />
        </SectionCard>

        <SectionCard className="p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-text">
                {t("pages.materialRequests.myRequests")}
              </h2>
              <p className="mt-1 text-sm text-subtle">
                {t("pages.materialRequests.myRequestsDesc")}
              </p>
            </div>
            {myRequests.length > 0 ? (
              <p className="text-sm tabular-nums text-muted">
                {t("pages.materialRequests.requestCount", {
                  count: myRequests.length,
                })}
              </p>
            ) : null}
          </div>
          {myRequests.length === 0 ? (
            <EmptyState
              titleKey="pages.materialRequests.emptyTitle"
              descriptionKey="pages.materialRequests.emptyDescription"
            />
          ) : (
            <div className="space-y-4">
              {myRequests.map((request) => (
                <MaterialRequestDetailCard
                  key={request.id}
                  request={{
                    id: request.id,
                    status: request.status,
                    notes: request.notes,
                    reviewNote: request.reviewNote,
                    createdAt: request.createdAt,
                    reviewedAt: request.reviewedAt,
                    project: request.project,
                    reviewedByName:
                      request.reviewedBy?.name ||
                      request.reviewedBy?.username ||
                      null,
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
                    transferOrder: request.transferOrder,
                  }}
                  actions={
                    <>
                      {request.status === "REQUESTED" ? (
                        <CancelMaterialRequestButton id={request.id} />
                      ) : null}
                      {request.transferOrder?.status === "SENT" ? (
                        <SiteTransferReceiveActions
                          id={request.transferOrder.id}
                        />
                      ) : null}
                    </>
                  }
                />
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </AppShell>
  );
}
