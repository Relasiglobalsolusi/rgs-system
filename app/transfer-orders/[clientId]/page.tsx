import { notFound } from "next/navigation";

import { getTransferOrderProjectsForClient } from "@/app/transfer-orders/actions";
import AppShell from "@/components/layout/AppShell";
import TransferOrderBreadcrumbs from "@/components/transfer-orders/TransferOrderBreadcrumbs";
import TransferOrderProjectDirectory from "@/components/transfer-orders/TransferOrderProjectDirectory";
import { ATTENDANCE_INTERNAL_ROUTE_CLIENT_ID } from "@/lib/attendance-internal-sites";
import { createTranslator } from "@/lib/i18n/translate";
import { getServerLocale } from "@/lib/i18n/locale";
import { requireModule } from "@/lib/session";

type Props = {
  params: Promise<{ clientId: string }>;
};

export default async function TransferOrdersClientPage({ params }: Props) {
  await requireModule("transferOrders");
  const { clientId } = await params;
  const locale = await getServerLocale();
  const t = createTranslator(locale);

  const data = await getTransferOrderProjectsForClient(clientId);
  if (!data) notFound();

  const isInternal = clientId === ATTENDANCE_INTERNAL_ROUTE_CLIENT_ID;
  const clientLabel = isInternal
    ? t("pages.transferOrders.internalSection")
    : data.clientName;

  return (
    <AppShell
      title={clientLabel}
      descriptionKey="pages.transferOrders.clientProjectsDesc"
    >
      <TransferOrderBreadcrumbs
        items={[
          {
            labelKey: "pages.transferOrders.title",
            href: "/transfer-orders",
          },
          { label: clientLabel },
        ]}
      />

      <TransferOrderProjectDirectory
        clientId={data.routeClientId}
        projects={data.projects}
      />
    </AppShell>
  );
}
