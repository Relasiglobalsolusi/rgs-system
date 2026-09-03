import { redirect } from "next/navigation";

import {
  syncPettyCashOnPageLoad,
} from "@/app/billing/petty-cash/actions";
import PettyCashHoldersPanel from "@/components/billing/PettyCashHoldersPanel";
import PrepaidCardsPanel from "@/components/billing/PrepaidCardsPanel";
import DirectoryFilterTab from "@/components/ui/DirectoryFilterTab";
import DirectoryStatCard from "@/components/ui/DirectoryStatCard";
import DirectoryStatGrid from "@/components/ui/DirectoryStatGrid";
import { isVehicleItemType } from "@/lib/inventory-sku";
import AppShell from "@/components/layout/AppShell";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";
import { getPettyCashTotals, processScheduledPettyCashPays } from "@/lib/petty-cash";
import { loadPettyCashHolders, loadUnpaidPartTimeWages } from "@/lib/petty-cash-query";
import { prisma } from "@/lib/prisma";
import { formatContractPrice } from "@/lib/project-billing";
import { formatEmployeeName } from "@/lib/employee-user-link";
import {
  loadPrepaidCardFormOptions,
  loadPrepaidCardsForPanel,
} from "@/lib/prepaid-card-query";
import { getAdvanceCashAccess, isOwnerAccount } from "@/lib/permissions";
import { requirePettyCashAccess, toPermissionUser } from "@/lib/session";
import { jakartaYearMonth, utcRangeForJakartaMonth } from "@/lib/vat";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  Wallet,
} from "lucide-react";

export default async function PettyCashPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requirePettyCashAccess();
  if (session.user.clientId || session.user.vendorId) {
    redirect("/dashboard");
  }

  const access = getAdvanceCashAccess(toPermissionUser(session));
  if (!access.petty && !access.prepaid) {
    redirect("/dashboard");
  }

  const { tab } = await searchParams;
  if (access.prepaid && !access.petty && tab !== "prepaid") {
    redirect("/billing/petty-cash?tab=prepaid");
  }
  if (access.petty && !access.prepaid && tab === "prepaid") {
    redirect("/billing/petty-cash");
  }

  const showPrepaid = tab === "prepaid";
  const showTabs = access.petty && access.prepaid;

  if (access.petty && !showPrepaid) {
    try {
      await syncPettyCashOnPageLoad();
      await processScheduledPettyCashPays(prisma, session.user.companyId);
    } catch {
      // Directory still loads if scheduled sync fails on an empty company.
    }
  }

  const locale = await getServerLocale();
  const t = createTranslator(locale);
  const now = jakartaYearMonth();
  const { start, endExclusive } = utcRangeForJakartaMonth(now.year, now.month);

  const [totals, holders, unpaidWages, currentPayer, projects, clients, employees, prepaidPanel, prepaidFormOptions, inventoryItems] = await Promise.all([
    getPettyCashTotals(prisma, session.user.companyId, start, endExclusive),
    loadPettyCashHolders(session.user.companyId),
    loadUnpaidPartTimeWages(session.user.companyId),
    prisma.user.findFirst({
      where: { id: session.user.id, companyId: session.user.companyId },
      select: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            archivedFromDirectory: true,
            status: true,
          },
        },
      },
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
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    loadPrepaidCardsForPanel(session.user.companyId),
    loadPrepaidCardFormOptions(session.user.companyId),
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
          select: { id: true, assetCode: true, vehicleYear: true },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

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

  const titleKey =
    showTabs
      ? "pages.pettyCash.title"
      : showPrepaid
        ? "pages.pettyCash.tabPrepaid"
        : "pages.pettyCash.tabPetty";

  return (
    <AppShell titleKey={titleKey}>
      {showTabs && !showPrepaid ? (
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
      ) : null}

      {showPrepaid ? (
        <PrepaidCardsPanel
          showModuleTabs={showTabs}
          canManageCards={isOwnerAccount({ username: session.user.username })}
          cards={prepaidPanel.cards}
          losses={prepaidPanel.losses}
          employees={prepaidFormOptions.employees}
          bankAccounts={prepaidFormOptions.bankAccounts}
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
              year:
                item.equipmentAssets.find((asset) => asset.vehicleYear != null)
                  ?.vehicleYear ?? null,
            }))}
        />
      ) : (
      <>
      <DirectoryStatGrid className="mb-5">
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
      </DirectoryStatGrid>

      {totals.unpaidOut > 0 ? (
        <p className="mb-4 text-sm text-muted">
          {t("pages.pettyCash.unpaidBanner", {
            amount: formatContractPrice(totals.unpaidOut),
          })}
        </p>
      ) : null}
      {totals.upcomingOut > 0 ? (
        <p className="mb-4 text-sm text-muted">
          {t("pages.pettyCash.upcoming", {
            amount: formatContractPrice(totals.upcomingOut),
          })}
        </p>
      ) : null}

      <PettyCashHoldersPanel
        holders={holders}
        unpaidWages={unpaidWages}
        currentPayerId={
          currentPayer?.employee &&
          !currentPayer.employee.archivedFromDirectory &&
          (currentPayer.employee.status === "ACTIVE" ||
            currentPayer.employee.status === "ON_LEAVE")
            ? currentPayer.employee.id
            : null
        }
        currentPayerName={
          currentPayer?.employee
            ? formatEmployeeName(currentPayer.employee)
            : null
        }
        employees={employees.map((employee) => ({
          id: employee.id,
          name: formatEmployeeName(employee),
        }))}
        projects={projects.map((project) => ({
          id: project.id,
          name: project.name,
          clientName: project.client?.name ?? null,
          subCategory: project.subCategory,
        }))}
        clients={clients}
      />
      </>
      )}
    </AppShell>
  );
}
