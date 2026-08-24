import { getTransferOrderDirectory } from "@/app/transfer-orders/actions";
import AppShell from "@/components/layout/AppShell";
import TransferOrderBreadcrumbs from "@/components/transfer-orders/TransferOrderBreadcrumbs";
import TransferOrderClientDirectory from "@/components/transfer-orders/TransferOrderClientDirectory";
import TransferOrderPendingCards from "@/components/transfer-orders/TransferOrderPendingCards";
import SectionCard from "@/components/ui/SectionCard";
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

      <TransferOrderPendingCards orders={directory.pendingOrders} />

      <SectionCard className="mb-5 p-5 sm:p-6">
        <h2 className="text-base font-semibold text-text">
          {t("pages.transferOrders.directoryTitle")}
        </h2>
        <p className="mt-1 text-sm text-subtle">
          {t("pages.transferOrders.directoryDesc")}
        </p>
      </SectionCard>

      <TransferOrderClientDirectory
        clients={directory.clients}
        internalSites={directory.internalSites}
      />
    </AppShell>
  );
}
