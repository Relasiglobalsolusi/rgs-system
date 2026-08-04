import { notFound } from "next/navigation";

import { getTransferOrderQueueForProject } from "@/app/transfer-orders/actions";
import AppShell from "@/components/layout/AppShell";
import { SendTransferOrderButton } from "@/components/transfer-orders/TransferOrderActions";
import TransferOrderBreadcrumbs from "@/components/transfer-orders/TransferOrderBreadcrumbs";
import TransferOrderCountBadges from "@/components/transfer-orders/TransferOrderCountBadges";
import TransferOrderDetailCard from "@/components/transfer-orders/TransferOrderDetailCard";
import EmptyState from "@/components/ui/EmptyState";
import SectionCard from "@/components/ui/SectionCard";
import { ATTENDANCE_INTERNAL_ROUTE_CLIENT_ID } from "@/lib/attendance-internal-sites";
import { createTranslator } from "@/lib/i18n/translate";
import { getServerLocale } from "@/lib/i18n/locale";
import { requireModule } from "@/lib/session";

type Props = {
  params: Promise<{ clientId: string; projectId: string }>;
};

export default async function TransferOrdersProjectQueuePage({
  params,
}: Props) {
  await requireModule("transferOrders");
  const { clientId, projectId } = await params;
  const locale = await getServerLocale();
  const t = createTranslator(locale);

  const data = await getTransferOrderQueueForProject(clientId, projectId);
  if (!data) notFound();

  const isInternal =
    data.routeClientId === ATTENDANCE_INTERNAL_ROUTE_CLIENT_ID;
  const clientLabel = isInternal
    ? t("pages.transferOrders.internalSection")
    : data.clientName;

  return (
    <AppShell
      title={data.project.name}
      descriptionKey="pages.transferOrders.queueDesc"
    >
      <TransferOrderBreadcrumbs
        items={[
          {
            labelKey: "pages.transferOrders.title",
            href: "/transfer-orders",
          },
          {
            label: clientLabel,
            href: `/transfer-orders/${data.routeClientId}`,
          },
          { label: data.project.name },
        ]}
      />

      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text">
            {t("pages.transferOrders.queueTitle")}
          </h2>
          <p className="mt-1 text-sm text-subtle">
            {data.project.location
              ? data.project.location
              : t("pages.transferOrders.queueDesc")}
          </p>
        </div>
        {data.orders.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <TransferOrderCountBadges
              compact={false}
              pendingSendCount={data.stats.pendingSend}
              inTransitCount={data.stats.inTransit}
            />
            {data.stats.received > 0 ? (
              <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold tabular-nums text-emerald-200">
                {t("pages.transferOrders.statReceived", {
                  count: data.stats.received,
                })}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {data.orders.length === 0 ? (
        <SectionCard className="p-5 sm:p-6">
          <EmptyState
            titleKey="pages.transferOrders.emptyTitle"
            descriptionKey="pages.transferOrders.emptyProjectDescription"
          />
        </SectionCard>
      ) : (
        <div className="flex flex-col gap-5">
          {data.orders.map((order) => (
            <TransferOrderDetailCard
              key={order.id}
              showStock
              order={order}
              actions={
                order.status === "PENDING_SEND" ? (
                  <SendTransferOrderButton id={order.id} />
                ) : null
              }
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}
