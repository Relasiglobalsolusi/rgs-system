import AppShell from "@/components/layout/AppShell";
import { SendTransferOrderButton } from "@/components/transfer-orders/TransferOrderActions";
import EmptyState from "@/components/ui/EmptyState";
import SectionCard from "@/components/ui/SectionCard";
import { formatEmployeeName } from "@/lib/employee-user-link";
import { formatDisplayDate } from "@/lib/format-date";
import { createTranslator } from "@/lib/i18n/translate";
import { getServerLocale } from "@/lib/i18n/locale";
import { inventoryQtyFromDecimal } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";

export default async function TransferOrdersPage() {
  await requireModule("transferOrders");
  const locale = await getServerLocale();
  const t = createTranslator(locale);

  const company = await prisma.company.findFirst({ select: { id: true } });
  const orders = company
    ? await prisma.transferOrder.findMany({
        where: { companyId: company.id },
        include: {
          project: { select: { name: true } },
          materialRequest: {
            select: {
              requestedBy: {
                select: { firstName: true, lastName: true },
              },
            },
          },
          lines: {
            include: {
              item: { select: { sku: true, name: true, unit: true } },
            },
          },
        },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: 100,
      })
    : [];

  return (
    <AppShell
      titleKey="pages.transferOrders.title"
      descriptionKey="pages.transferOrders.description"
    >
      <SectionCard className="p-5 sm:p-6">
        {orders.length === 0 ? (
          <EmptyState
            titleKey="pages.transferOrders.emptyTitle"
            descriptionKey="pages.transferOrders.emptyDescription"
          />
        ) : (
          <ul className="space-y-3">
            {orders.map((order) => (
              <li
                key={order.id}
                className="rounded-xl border border-border bg-elevated/30 px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text">
                      {order.project.name}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {order.status} ·{" "}
                      {t("pages.transferOrders.requestedBy", {
                        name: formatEmployeeName(
                          order.materialRequest.requestedBy
                        ),
                      })}{" "}
                      · {formatDisplayDate(order.createdAt)}
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-subtle">
                      {order.lines.map((line) => (
                        <li key={line.id}>
                          {line.item.name} ({line.item.sku}) —{" "}
                          {inventoryQtyFromDecimal(line.quantity)}{" "}
                          {line.item.unit}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {order.status === "PENDING_SEND" ? (
                    <SendTransferOrderButton id={order.id} />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </AppShell>
  );
}
