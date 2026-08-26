import { redirect } from "next/navigation";

import {
  syncPettyCashOnPageLoad,
} from "@/app/billing/petty-cash/actions";
import PettyCashSpendDialog from "@/components/billing/PettyCashSpendDialog";
import PrepaidCardsPanel from "@/components/billing/PrepaidCardsPanel";
import DirectoryFilterTab from "@/components/ui/DirectoryFilterTab";
import DirectoryStatCard from "@/components/ui/DirectoryStatCard";
import { isVehicleItemType } from "@/lib/inventory-sku";
import AppShell from "@/components/layout/AppShell";
import EmptyState from "@/components/ui/EmptyState";
import FinanceRecordRow, {
  financeListStatusChipClassName,
  financeRecordListClassName,
} from "@/components/ui/FinanceRecordRow";
import SectionCard from "@/components/ui/SectionCard";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatDisplayDate } from "@/lib/format-date";
import { localizeKnownKey } from "@/lib/i18n/labels";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";
import { getPettyCashTotals, processScheduledPettyCashPays } from "@/lib/petty-cash";
import { prisma } from "@/lib/prisma";
import { decimalToNumber, formatContractPrice } from "@/lib/project-billing";
import { formatEmployeeName } from "@/lib/employee-user-link";
import { isOwnerAccount } from "@/lib/permissions";
import { isAreaManagerOrAbovePosition } from "@/lib/positions";
import { requirePettyCashAccess } from "@/lib/session";
import { jakartaYearMonth, utcRangeForJakartaMonth } from "@/lib/vat";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  Wallet,
} from "lucide-react";


function statusTone(status: string): "success" | "warning" | "danger" | "info" {
  if (status === "POSTED") return "success";
  if (status === "VOIDED") return "danger";
  return "warning";
}

export default async function PettyCashPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requirePettyCashAccess();
  if (session.user.clientId || session.user.vendorId) {
    redirect("/dashboard");
  }

  const { tab } = await searchParams;
  const showPrepaid = tab === "prepaid";

  try {
    await syncPettyCashOnPageLoad();
    await processScheduledPettyCashPays(prisma, session.user.companyId);
  } catch {
    // Directory still loads if scheduled sync fails on an empty company.
  }

  const locale = await getServerLocale();
  const t = createTranslator(locale);
  const now = jakartaYearMonth();
  const { start, endExclusive } = utcRangeForJakartaMonth(now.year, now.month);

  const [totals, entries, projects, clients, attributionEmployees, prepaidCards, inventoryItems] = await Promise.all([
    getPettyCashTotals(prisma, session.user.companyId, start, endExclusive),
    prisma.pettyCashEntry.findMany({
      where: { companyId: session.user.companyId },
      include: {
        project: { select: { name: true } },
        client: { select: { name: true } },
        employee: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
      take: 200,
    }),
    prisma.project.findMany({
      where: {
        companyId: session.user.companyId,
        status: { not: "CANCELLED" },
      },
      select: {
        id: true,
        name: true,
        subCategory: true,
        client: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.client.findMany({
      where: {
        companyId: session.user.companyId,
        active: true,
      },
      select: { id: true, name: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.employee.findMany({
      where: {
        companyId: session.user.companyId,
        archivedFromDirectory: false,
        status: { in: ["ACTIVE", "ON_LEAVE"] },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        jobPosition: { select: { slug: true, name: true } },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    prisma.prepaidCard.findMany({
      where: { companyId: session.user.companyId },
      include: {
        vehicleItem: {
          select: {
            name: true,
            sku: true,
            equipmentAssets: {
              select: { assetCode: true },
              orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            },
          },
        },
        entries: {
          orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.inventoryItem.findMany({
      where: {
        companyId: session.user.companyId,
        active: true,
        deletedAt: null,
        OR: [
          { currentStock: { gt: 0 } },
          { equipmentAssets: { some: { companyId: session.user.companyId } } },
        ],
      },
      select: {
        id: true,
        name: true,
        sku: true,
        itemType: true,
        equipmentAssets: {
          where: { companyId: session.user.companyId },
          select: { id: true, assetCode: true },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const billForEmployees = attributionEmployees
    .filter(
      (employee) =>
        employee.jobPosition != null &&
        isAreaManagerOrAbovePosition(employee.jobPosition)
    )
    .map((employee) => ({
      id: employee.id,
      name: formatEmployeeName(employee),
    }));

  const cards = [
    {
      key: "balance",
      label: t("pages.pettyCash.currentBalance"),
      value: totals.balance,
      accent: totals.balance < 0 ? ("danger" as const) : ("success" as const),
      icon: <Wallet size={18} />,
    },
    {
      key: "lifetimeIn",
      label: t("pages.pettyCash.lifetimeIn"),
      value: totals.lifetimeIn,
      accent: "info" as const,
      icon: <ArrowDownLeft size={18} />,
    },
    {
      key: "monthIn",
      label: t("pages.pettyCash.monthIn"),
      value: totals.monthIn,
      accent: "primary" as const,
      icon: <CalendarDays size={18} />,
    },
    {
      key: "lifetimeOut",
      label: t("pages.pettyCash.lifetimeOut"),
      value: totals.lifetimeOut,
      accent: "warning" as const,
      icon: <ArrowUpRight size={18} />,
    },
    {
      key: "monthOut",
      label: t("pages.pettyCash.monthOut"),
      value: totals.monthOut,
      accent: "warning" as const,
      icon: <ArrowUpRight size={18} />,
    },
  ];

  return (
    <AppShell
      titleKey="pages.pettyCash.title"
    >
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <DirectoryFilterTab
          href="/billing/petty-cash"
          active={!showPrepaid}
        >
          {t("pages.pettyCash.tabPetty")}
        </DirectoryFilterTab>
        <DirectoryFilterTab
          href="/billing/petty-cash?tab=prepaid"
          active={showPrepaid}
        >
          {t("pages.pettyCash.tabPrepaid")}
        </DirectoryFilterTab>
      </div>

      {showPrepaid ? (
        <PrepaidCardsPanel
          canManageCards={isOwnerAccount({ username: session.user.username })}
          cards={prepaidCards.map((card) => ({
            id: card.id,
            cardNumber: card.cardNumber,
            currentBalance: decimalToNumber(card.currentBalance) ?? 0,
            vehicleName: card.vehicleItem.name,
            vehicleSku: card.vehicleItem.sku,
            vehiclePlate: card.vehicleItem.equipmentAssets
              .map((asset) => asset.assetCode)
              .filter(Boolean)
              .join(" / "),
            vehicleItemId: card.vehicleItemId,
            entries: card.entries.map((entry) => ({
              id: entry.id,
              kind: entry.kind,
              spendKind: entry.spendKind,
              amount: decimalToNumber(entry.amount) ?? 0,
              entryDate: entry.entryDate.toISOString().slice(0, 10),
              description: entry.description,
              proofPath: entry.proofPath,
            })),
          }))}
          vehicles={inventoryItems
            .filter((item) => isVehicleItemType(item.itemType))
            .map((item) => ({
              id: item.id,
              name: item.name,
              sku: item.sku,
              plate: item.equipmentAssets
                .map((asset) => asset.assetCode)
                .filter(Boolean)
                .join(" / "),
            }))}
        />
      ) : (
      <>
      <div className="mb-5 flex flex-wrap items-end justify-end gap-3">
        <PettyCashSpendDialog
          projects={projects.map((project) => ({
            id: project.id,
            name: project.name,
            clientName: project.client?.name ?? null,
            subCategory: project.subCategory,
          }))}
          clients={clients}
          billForEmployees={billForEmployees}
        />
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => (
          <DirectoryStatCard
            key={card.key}
            compact
            tinted
            title={card.label}
            value={formatContractPrice(card.value)}
            accent={card.accent}
            icon={card.icon}
          />
        ))}
      </div>

      {totals.balance < 0 ? (
        <p className="mb-4 text-sm text-danger">
          {t("pages.pettyCash.negativeWarning")}
        </p>
      ) : null}
      {totals.upcomingOut > 0 ? (
        <p className="mb-4 text-sm text-muted">
          {t("pages.pettyCash.upcoming", {
            amount: formatContractPrice(totals.upcomingOut),
          })}
        </p>
      ) : null}

      {entries.length === 0 ? (
        <SectionCard className="p-5 sm:p-6">
          <EmptyState
            titleKey="pages.pettyCash.emptyTitle"
            descriptionKey="pages.pettyCash.emptyDesc"
          />
        </SectionCard>
      ) : (
        <div className={financeRecordListClassName}>
          {entries.map((entry) => (
            <FinanceRecordRow
              key={entry.id}
              title={
                <>
                  <h3 className="text-left text-sm font-semibold leading-snug tracking-tight text-text">
                    {entry.description}
                  </h3>
                  <p className="mt-1 truncate text-xs leading-none text-subtle">
                    {formatDisplayDate(entry.entryDate, { timeZone: "UTC" })}
                    {entry.employee ? (
                      <>
                        <span className="mx-1.5 text-border-strong" aria-hidden>
                          ·
                        </span>
                        {formatEmployeeName(entry.employee)}
                      </>
                    ) : null}
                    {entry.project ? (
                      <>
                        <span className="mx-1.5 text-border-strong" aria-hidden>
                          ·
                        </span>
                        {entry.project.name}
                      </>
                    ) : entry.client ? (
                      <>
                        <span className="mx-1.5 text-border-strong" aria-hidden>
                          ·
                        </span>
                        {entry.client.name}
                      </>
                    ) : null}
                  </p>
                  {entry.proofPath ? (
                    <a
                      href={entry.proofPath}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-xs font-medium text-primary-dark underline-offset-2 hover:underline"
                    >
                      {t("pages.pettyCash.viewProof")}
                    </a>
                  ) : null}
                </>
              }
              status={
                <StatusBadge
                  status={statusTone(entry.status)}
                  className={financeListStatusChipClassName}
                >
                  <span className="flex h-full w-full items-center justify-center text-center leading-none">
                    {localizeKnownKey(
                      `pages.pettyCash.status.${entry.status}`,
                      locale
                    )}
                  </span>
                </StatusBadge>
              }
              amount={`${entry.kind === "TOP_UP" ? "+" : "−"}${formatContractPrice(decimalToNumber(entry.amount))}`}
            />
          ))}
        </div>
      )}
      </>
      )}
    </AppShell>
  );
}
