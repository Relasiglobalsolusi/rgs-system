import { notFound } from "next/navigation";

import { getTransferOrderQueueForProject } from "@/app/transfer-orders/actions";
import AppShell from "@/components/layout/AppShell";
import {
  SendTransferOrderButton,
  WarehouseItemReturnActions,
} from "@/components/transfer-orders/TransferOrderActions";
import TransferOrderBreadcrumbs from "@/components/transfer-orders/TransferOrderBreadcrumbs";
import TransferOrderDetailCard from "@/components/transfer-orders/TransferOrderDetailCard";
import DirectoryStatCard from "@/components/ui/DirectoryStatCard";
import DirectoryStatGrid from "@/components/ui/DirectoryStatGrid";
import EmptyState from "@/components/ui/EmptyState";
import SectionCard from "@/components/ui/SectionCard";
import { CheckCircle2, Package, Truck } from "lucide-react";
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

      <div className="mb-5">
        <h2 className="text-base font-semibold text-text">
          {t("pages.transferOrders.queueTitle")}
        </h2>
        <p className="mt-1 text-sm text-subtle">
          {data.project.location
            ? data.project.location
            : t("pages.transferOrders.queueDesc")}
        </p>
      </div>

      <DirectoryStatGrid className="mb-5">
        <DirectoryStatCard
          compact
          tinted
          title={t("pages.transferOrders.cards.pendingSend")}
          value={data.stats.pendingSend}
          accent="warning"
          icon={<Package size={18} />}
        />
        <DirectoryStatCard
          compact
          tinted
          title={t("pages.transferOrders.cards.inTransit")}
          value={data.stats.inTransit}
          accent="info"
          icon={<Truck size={18} />}
        />
        <DirectoryStatCard
          compact
          tinted
          title={t("pages.transferOrders.cards.received")}
          value={data.stats.received}
          accent="success"
          icon={<CheckCircle2 size={18} />}
        />
      </DirectoryStatGrid>

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
                ) : order.status === "NOT_RECEIVED" ? (
                  <WarehouseItemReturnActions id={order.id} />
                ) : null
              }
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}
