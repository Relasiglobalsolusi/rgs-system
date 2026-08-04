import { getTransferOrderDirectory } from "@/app/transfer-orders/actions";
import AppShell from "@/components/layout/AppShell";
import TransferOrderBreadcrumbs from "@/components/transfer-orders/TransferOrderBreadcrumbs";
import TransferOrderClientDirectory from "@/components/transfer-orders/TransferOrderClientDirectory";
import TransferOrderCountBadges from "@/components/transfer-orders/TransferOrderCountBadges";
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
      descriptionKey="pages.transferOrders.description"
    >
      <TransferOrderBreadcrumbs
        items={[{ labelKey: "pages.transferOrders.title" }]}
      />

      <SectionCard className="mb-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-text">
              {t("pages.transferOrders.directoryTitle")}
            </h2>
            <p className="mt-1 text-sm text-subtle">
              {t("pages.transferOrders.directoryDesc")}
            </p>
          </div>
          <TransferOrderCountBadges
            compact={false}
            pendingSendCount={directory.totals.pendingSend}
            inTransitCount={directory.totals.inTransit}
          />
        </div>
      </SectionCard>

      <TransferOrderClientDirectory
        clients={directory.clients}
        internalSites={directory.internalSites}
      />
    </AppShell>
  );
}
