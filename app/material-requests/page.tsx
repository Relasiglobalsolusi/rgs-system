import AppShell from "@/components/layout/AppShell";
import MaterialRequestForm from "@/components/material-requests/MaterialRequestForm";
import {
  CancelMaterialRequestButton,
  ReceiveTransferOrderButton,
} from "@/components/material-requests/MaterialRequestActions";
import EmptyState from "@/components/ui/EmptyState";
import SectionCard from "@/components/ui/SectionCard";
import { findOpenCicoAttendance } from "@/lib/cico-attendance";
import { formatDisplayDate } from "@/lib/format-date";
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
            lines: {
              include: {
                item: { select: { sku: true, name: true, unit: true } },
              },
            },
            transferOrder: {
              select: { id: true, status: true },
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
          <h2 className="mb-4 text-base font-semibold text-text">
            {t("pages.materialRequests.newRequest")}
          </h2>
          <MaterialRequestForm
            checkedInProjectName={checkedInProjectName}
            items={catalogItems.map((item) => ({
              ...item,
              currentStock: inventoryQtyFromDecimal(item.currentStock),
            }))}
          />
        </SectionCard>

        <SectionCard className="p-5 sm:p-6">
          <h2 className="mb-4 text-base font-semibold text-text">
            {t("pages.materialRequests.myRequests")}
          </h2>
          {myRequests.length === 0 ? (
            <EmptyState
              titleKey="pages.materialRequests.emptyTitle"
              descriptionKey="pages.materialRequests.emptyDescription"
            />
          ) : (
            <ul className="space-y-3">
              {myRequests.map((request) => (
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
                        {formatDisplayDate(request.createdAt)} · {request.status}
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
                    <div className="flex flex-wrap gap-2">
                      {request.status === "REQUESTED" ? (
                        <CancelMaterialRequestButton id={request.id} />
                      ) : null}
                      {request.transferOrder?.status === "SENT" ? (
                        <ReceiveTransferOrderButton
                          id={request.transferOrder.id}
                        />
                      ) : null}
                    </div>
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
