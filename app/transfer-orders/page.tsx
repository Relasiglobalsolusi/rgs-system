import { Building2, Landmark, Package, Truck } from "lucide-react";

import { getTransferOrderDirectory } from "@/app/transfer-orders/actions";
import PageIntro from "@/components/i18n/PageIntro";
import AppShell from "@/components/layout/AppShell";
import TransferOrderBreadcrumbs from "@/components/transfer-orders/TransferOrderBreadcrumbs";
import TransferOrderClientDirectory from "@/components/transfer-orders/TransferOrderClientDirectory";
import TransferOrderPendingCards from "@/components/transfer-orders/TransferOrderPendingCards";
import DirectoryStatCard from "@/components/ui/DirectoryStatCard";
import { createTranslator } from "@/lib/i18n/translate";
import { getServerLocale } from "@/lib/i18n/locale";
import { requireModule } from "@/lib/session";

export default async function TransferOrdersPage() {
  await requireModule("transferOrders");
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  const directory = await getTransferOrderDirectory();

  return (
    <AppShell
      titleKey="pages.transferOrders.title"
    >
      <TransferOrderBreadcrumbs
        items={[{ labelKey: "pages.transferOrders.title" }]}
      />
      <PageIntro
        titleKey="pages.transferOrders.title"
        descriptionKey="pages.transferOrders.description"
      />

      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <DirectoryStatCard
          compact
          tinted
          title={t("pages.transferOrders.cards.pendingSend")}
          value={directory.totals.pendingSend}
          accent="warning"
          icon={<Package size={18} />}
        />
        <DirectoryStatCard
          compact
          tinted
          title={t("pages.transferOrders.cards.inTransit")}
          value={directory.totals.inTransit}
          accent="info"
          icon={<Truck size={18} />}
        />
        <DirectoryStatCard
          compact
          tinted
          title={t("pages.transferOrders.cards.clients")}
          value={directory.clients.length}
          accent="success"
          icon={<Building2 size={18} />}
        />
        <DirectoryStatCard
          compact
          tinted
          title={t("pages.transferOrders.cards.sites")}
          value={directory.internalSites.length}
          accent="primary"
          icon={<Landmark size={18} />}
        />
      </div>

      <TransferOrderPendingCards orders={directory.pendingOrders} />

      <TransferOrderClientDirectory
        clients={directory.clients}
        internalSites={directory.internalSites}
      />
    </AppShell>
  );
}
