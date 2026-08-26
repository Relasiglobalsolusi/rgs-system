"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Factory } from "lucide-react";
import { toast } from "sonner";

import {
  confirmFactoryRepaired,
  receiveFactoryReplacement,
  recordFactoryRefund,
  sendEquipmentToFactory,
} from "@/app/inventory/factory-return-actions";
import InventoryLifetimeStats from "@/components/inventory/InventoryLifetimeStats";
import type {
  InventoryCatalogItem,
  InventoryFactoryReturnRow,
  InventoryOverviewAssetRow,
  InventoryUncodedSaleRow,
  InventoryVendorOption,
} from "@/components/inventory/inventory-types";
import type { InventoryStockItemDetail } from "@/app/inventory/actions";
import {
  captureHtmlFormBaseline,
  EmployeeDialogShell,
  EmployeePrimaryButton,
  EmployeeSecondaryButton,
  EmployeeUnsavedExitDialog,
  employeeDialogFieldClass,
  employeeDialogFormClass,
  employeeDialogGridClass,
  employeeDialogHintClass,
  employeeDialogLabelClass,
  employeeInputClass,
  employeeSelectTriggerClass,
  handleEmployeeDialogOpenChange,
  useHtmlFormDirty,
  type HtmlFormDirtyBaseline,
} from "@/components/employees/employee-dialog-ui";
import DirectoryAddButton from "@/components/ui/DirectoryAddButton";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import SectionCard from "@/components/ui/SectionCard";
import StatusBadge from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { MoneyInput } from "@/components/ui/MoneyInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  showRejection,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import {
  equipmentRetirementKind,
  uncodedWarehouseQty,
} from "@/lib/equipment-asset";
import { isVehicleItemType } from "@/lib/inventory-sku";
import { formatDisplayDate } from "@/lib/format-date";
import { formatDateForInput } from "@/lib/format-tenure";
import { isBelowMinStock, formatInventoryQty } from "@/lib/inventory";
import { localizeKnownKey } from "@/lib/i18n/labels";
import { useT } from "@/lib/i18n/use-t";
import { formatContractPrice, parseContractPrice } from "@/lib/project-billing";

const SEND_FORM_ID = "send-factory-return-form";

type Source = "new" | "issued";
type Intent = "REFUND" | "REPAIR" | "REPLACE";

type ProductUnitRow =
  | { kind: "uncoded"; id: string; qty: number }
  | { kind: "coded"; id: string; asset: InventoryOverviewAssetRow }
  | { kind: "soldNew"; id: string; sale: InventoryUncodedSaleRow };

type Props = {
  item: InventoryCatalogItem;
  detail: InventoryStockItemDetail;
  equipmentAssets: InventoryOverviewAssetRow[];
  factoryReturns: InventoryFactoryReturnRow[];
  uncodedSales: InventoryUncodedSaleRow[];
  vendors: InventoryVendorOption[];
  canReturnToFactory: boolean;
};

export default function EquipmentProductPage({
  item,
  detail,
  equipmentAssets,
  factoryReturns,
  uncodedSales,
  vendors,
  canReturnToFactory,
}: Props) {
  const { t, locale } = useT();
  const [includeSold, setIncludeSold] = useState(false);
  const [includeWrittenOff, setIncludeWrittenOff] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [refundTargetId, setRefundTargetId] = useState<string | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [pending, startTransition] = useTransition();

  const availableCoded = equipmentAssets.filter(
    (asset) => asset.status === "AVAILABLE"
  );
  const uncodedNew = uncodedWarehouseQty(
    item.currentStock,
    availableCoded.length
  );
  const onProject = equipmentAssets.filter(
    (asset) => asset.status === "ON_PROJECT"
  );
  const inTransit = equipmentAssets.filter(
    (asset) => asset.status === "IN_TRANSIT"
  );
  const atFactory = equipmentAssets.filter(
    (asset) => asset.status === "AT_FACTORY"
  );
  const hangingReturns = factoryReturns.filter(
    (row) => row.status === "WAITING"
  );

  const visibleAssets = useMemo(
    () =>
      equipmentAssets.filter((asset) => {
        if (asset.status !== "RETIRED") return true;
        const kind = equipmentRetirementKind(asset);
        if (kind === "sold") return includeSold;
        if (kind === "writtenOff") return includeWrittenOff;
        return false;
      }),
    [equipmentAssets, includeSold, includeWrittenOff]
  );

  const unitRows = useMemo(() => {
    const rows: ProductUnitRow[] = [];
    if (uncodedNew > 0) {
      rows.push({ kind: "uncoded", id: "uncoded-new", qty: uncodedNew });
    }
    for (const asset of visibleAssets) {
      rows.push({ kind: "coded", id: asset.id, asset });
    }
    if (includeSold) {
      for (const sale of uncodedSales) {
        rows.push({ kind: "soldNew", id: sale.id, sale });
      }
    }
    return rows;
  }, [includeSold, uncodedNew, uncodedSales, visibleAssets]);

  const assetColumns: DataTableColumn<ProductUnitRow>[] = [
    {
      key: "assetCode",
      title: isVehicleItemType(item.itemType)
        ? t("pages.inventory.overview.numberPlate")
        : t("pages.inventory.overview.assetCode"),
      width: "12rem",
      render: (row) => {
        if (row.kind === "uncoded") {
          return t("pages.inventory.product.newStockRow", {
            qty: formatInventoryQty(row.qty),
          });
        }
        if (row.kind === "soldNew") {
          return t("pages.inventory.product.soldNewRow", {
            qty: formatInventoryQty(row.sale.quantity),
          });
        }
        return (
          <span className="font-mono text-sm text-muted">
            {row.asset.assetCode}
          </span>
        );
      },
    },
    {
      key: "status",
      title: t("pages.inventory.columns.status"),
      width: "10rem",
      cellAlign: "center",
      className: "min-w-[10rem] overflow-visible",
      render: (row) => {
        if (row.kind === "uncoded") {
          return (
            <StatusBadge status="info" compact>
              {t("pages.inventory.product.newNoCode")}
            </StatusBadge>
          );
        }
        if (row.kind === "soldNew") {
          return (
            <StatusBadge status="inactive" compact>
              {t("pages.inventory.product.soldNewNoCode")}
            </StatusBadge>
          );
        }
        return (
          <StatusBadge status={assetStatusTone(row.asset)} compact>
            {statusLabel(row.asset, t)}
          </StatusBadge>
        );
      },
    },
    {
      key: "location",
      title: t("pages.inventory.overview.location"),
      share: 1.4,
      render: (row) => {
        if (row.kind === "uncoded") {
          return t("pages.inventory.overview.locationWarehouse");
        }
        if (row.kind === "soldNew") return "—";
        return locationLabel(row.asset, t);
      },
    },
    {
      key: "serialNo",
      title: t("pages.inventory.overview.serialNo"),
      width: "8rem",
      render: (row) =>
        row.kind === "coded" ? row.asset.serialNo || "—" : "—",
    },
    {
      key: "unitCost",
      title: t("pages.inventory.overview.acquisitionCost"),
      width: "8rem",
      align: "right",
      render: (row) =>
        row.kind === "coded" && row.asset.unitCost != null
          ? formatContractPrice(row.asset.unitCost)
          : "—",
    },
    {
      key: "soldTo",
      title: t("pages.inventory.overview.soldTo"),
      share: 1,
      render: (row) => {
        if (row.kind === "soldNew") {
          return row.sale.buyer?.trim() || "—";
        }
        if (row.kind === "coded" && equipmentRetirementKind(row.asset) === "sold") {
          return row.asset.soldBuyer?.trim() || "—";
        }
        return "—";
      },
    },
  ];

  const returnColumns: DataTableColumn<InventoryFactoryReturnRow>[] = [
    {
      key: "sentAt",
      title: t("pages.inventory.factoryReturn.sentAt"),
      width: "8rem",
      render: (row) => formatDisplayDate(row.sentAt),
    },
    {
      key: "unit",
      title: t("pages.inventory.factoryReturn.unit"),
      share: 1.2,
      render: (row) =>
        row.assetCode ? (
          <span className="font-mono text-sm">{row.assetCode}</span>
        ) : (
          t("pages.inventory.factoryReturn.newNoCode", {
            qty: formatInventoryQty(row.quantity),
          })
        ),
    },
    {
      key: "intent",
      title: t("pages.inventory.factoryReturn.intent"),
      width: "8rem",
      cellAlign: "center",
      className: "min-w-[8rem] overflow-visible",
      render: (row) => (
        <StatusBadge
          status={
            row.originalIntent === "REFUND"
              ? "warning"
              : row.originalIntent === "REPLACE"
                ? "info"
                : "success"
          }
          compact
        >
          {localizeKnownKey(
            `pages.inventory.factoryReturn.intents.${row.originalIntent}`,
            locale
          )}
        </StatusBadge>
      ),
    },
    {
      key: "status",
      title: t("pages.inventory.columns.status"),
      width: "10rem",
      cellAlign: "center",
      className: "min-w-[10rem] overflow-visible",
      render: (row) => (
        <StatusBadge
          status={
            row.status === "WAITING"
              ? "warning"
              : row.status === "REFUNDED"
                ? "inactive"
                : "success"
          }
          compact
        >
          {localizeKnownKey(
            `pages.inventory.factoryReturn.statuses.${row.status}`,
            locale
          )}
        </StatusBadge>
      ),
    },
    {
      key: "refund",
      title: t("pages.inventory.factoryReturn.refundAmount"),
      width: "8rem",
      align: "right",
      render: (row) =>
        row.refundAmount != null ? formatContractPrice(row.refundAmount) : "—",
    },
    {
      key: "reason",
      title: t("pages.inventory.factoryReturn.reason"),
      share: 1.4,
      render: (row) => row.reason,
    },
    ...(canReturnToFactory
      ? [
          {
            key: "actions",
            title: t("pages.inventory.columns.actions"),
            width: "18rem",
            cellAlign: "center" as const,
            render: (row: InventoryFactoryReturnRow) =>
              row.status === "WAITING" ? (
                <div className="flex flex-wrap justify-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() => {
                      setRefundTargetId(row.id);
                      setRefundAmount("");
                    }}
                  >
                    {t("pages.inventory.factoryReturn.recordRefund")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() => runReturnAction(confirmFactoryRepaired, row.id)}
                  >
                    {t("pages.inventory.factoryReturn.confirmRepaired")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      runReturnAction(receiveFactoryReplacement, row.id)
                    }
                  >
                    {t("pages.inventory.factoryReturn.receiveReplacement")}
                  </Button>
                </div>
              ) : (
                <span className="text-xs text-muted">
                  {row.receivedAt
                    ? formatDisplayDate(row.receivedAt)
                    : row.refundedAt
                      ? formatDisplayDate(row.refundedAt)
                      : "—"}
                </span>
              ),
          } satisfies DataTableColumn<InventoryFactoryReturnRow>,
        ]
      : []),
  ];

  function runReturnAction(
    action: (formData: FormData) => Promise<void>,
    returnId: string,
    extra?: Record<string, string>
  ) {
    const formData = new FormData();
    formData.set("returnId", returnId);
    if (extra) {
      for (const [key, value] of Object.entries(extra)) {
        formData.set(key, value);
      }
    }
    startTransition(async () => {
      try {
        await action(formData);
        toast.success(t("pages.inventory.factoryReturn.updated"));
        setRefundTargetId(null);
        setRefundAmount("");
      } catch (error) {
        showRejectionFromError(
          error,
          t("pages.inventory.factoryReturn.updateFailed")
        );
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/inventory"
            className="mb-2 inline-flex items-center gap-1.5 text-sm text-primary underline-offset-2 hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t("pages.inventory.product.backToInventory")}
          </Link>
          <h2 className="text-xl font-semibold text-text">{item.name}</h2>
          <p className="mt-1 font-mono text-sm text-muted">{item.sku}</p>
        </div>
        {canReturnToFactory ? (
          <DirectoryAddButton
            label={t("pages.inventory.factoryReturn.send")}
            icon={<Factory size={14} />}
            variant="warningBadge"
            onClick={() => setSendOpen(true)}
          />
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Stat
          label={t("pages.inventory.product.newInWarehouse")}
          value={formatInventoryQty(uncodedNew)}
        />
        <Stat
          label={t("pages.inventory.product.headOfficeUsed")}
          value={formatInventoryQty(availableCoded.length)}
        />
        <Stat
          label={t("pages.inventory.overview.locationOnProject")}
          value={formatInventoryQty(onProject.length)}
        />
        <Stat
          label={t("pages.inventory.product.inTransit")}
          value={formatInventoryQty(inTransit.length)}
        />
        <Stat
          label={t("pages.inventory.factoryReturn.statuses.WAITING")}
          value={formatInventoryQty(atFactory.length || hangingReturns.length)}
        />
        <Stat
          label={t("pages.inventory.columns.warehouseOnHand")}
          value={formatInventoryQty(item.currentStock)}
        />
      </div>

      <SectionCard>
        <InventoryLifetimeStats
          unit={item.unit}
          loading={false}
          totalBought={detail.totalBought}
          currentStock={item.currentStock}
          totalAssigned={detail.totalAssigned}
          totalSold={detail.totalSold}
          totalWrittenOff={detail.totalWrittenOff}
          lowStock={isBelowMinStock(item.currentStock, item.minStock)}
        />
      </SectionCard>

      <SectionCard>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-text">
              {t("pages.inventory.product.assetList")}
            </h3>
            <p className="text-xs text-muted">
              {t("pages.inventory.product.assetListHint")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={includeSold}
                onChange={(event) => setIncludeSold(event.target.checked)}
                className="rounded border-border"
              />
              {t("pages.inventory.overview.showSold")}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={includeWrittenOff}
                onChange={(event) => setIncludeWrittenOff(event.target.checked)}
                className="rounded border-border"
              />
              {t("pages.inventory.overview.showWrittenOff")}
            </label>
          </div>
        </div>
        {unitRows.length === 0 ? (
          <EmptyState
            title={t("pages.inventory.overview.emptyAssets")}
            description=""
          />
        ) : (
          <DataTable
            columns={assetColumns}
            data={unitRows}
            getRowKey={(row) => row.id}
          />
        )}
      </SectionCard>

      <SectionCard>
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-text">
            {t("pages.inventory.factoryReturn.title")}
          </h3>
          <p className="text-xs text-muted">
            {t("pages.inventory.factoryReturn.productHint")}
          </p>
        </div>
        {factoryReturns.length === 0 ? (
          <EmptyState
            title={t("pages.inventory.factoryReturn.empty")}
            description={t("pages.inventory.factoryReturn.emptyDesc")}
          />
        ) : (
          <DataTable
            columns={returnColumns}
            data={factoryReturns}
            getRowKey={(row) => row.id}
          />
        )}
      </SectionCard>

      {canReturnToFactory ? (
        <SendFactoryReturnDialog
          open={sendOpen}
          onOpenChange={setSendOpen}
          item={item}
          uncodedNew={uncodedNew}
          issuedAssets={[...availableCoded, ...onProject]}
          vendors={vendors}
        />
      ) : null}

      <Dialog
        open={Boolean(refundTargetId)}
        onOpenChange={(open) => {
          if (!open) {
            setRefundTargetId(null);
            setRefundAmount("");
          }
        }}
      >
        <EmployeeDialogShell
          icon={Factory}
          title={t("pages.inventory.factoryReturn.recordRefund")}
          description={t("pages.inventory.factoryReturn.recordRefundDesc")}
          footer={
            <>
              <EmployeeSecondaryButton
                closesDialog={false}
                onClick={() => {
                  setRefundTargetId(null);
                  setRefundAmount("");
                }}
                disabled={pending}
              >
                {t("common.actions.cancel")}
              </EmployeeSecondaryButton>
              <EmployeePrimaryButton
                disabled={pending}
                onClick={() => {
                  if (!refundTargetId) return;
                  const amount = parseContractPrice(refundAmount);
                  if (amount == null || amount <= 0) {
                    showRejection({
                      reasons: t(
                        "pages.inventory.factoryReturn.refundAmountRequired"
                      ),
                    });
                    return;
                  }
                  runReturnAction(recordFactoryRefund, refundTargetId, {
                    refundAmount: String(amount),
                  });
                }}
              >
                {t("pages.inventory.factoryReturn.recordRefund")}
              </EmployeePrimaryButton>
            </>
          }
        >
          <div className={employeeDialogFieldClass}>
            <label className={employeeDialogLabelClass}>
              {t("pages.inventory.factoryReturn.refundAmount")}
            </label>
            <MoneyInput
              value={refundAmount}
              onValueChange={setRefundAmount}
              className={employeeInputClass}
            />
          </div>
        </EmployeeDialogShell>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-3 py-3">
      <p className="text-xs font-semibold text-subtle">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-text">{value}</p>
    </div>
  );
}

function assetStatusTone(
  row: InventoryOverviewAssetRow
): "success" | "info" | "warning" | "inactive" | "danger" {
  if (row.status === "AVAILABLE") return "success";
  if (row.status === "ON_PROJECT") return "info";
  if (row.status === "IN_TRANSIT" || row.status === "AT_FACTORY") {
    return "warning";
  }
  return equipmentRetirementKind(row) === "sold" ? "inactive" : "danger";
}

function statusLabel(
  row: InventoryOverviewAssetRow,
  t: ReturnType<typeof useT>["t"]
) {
  if (row.status === "AVAILABLE") {
    return t("pages.inventory.product.headOfficeUsed");
  }
  if (row.status === "ON_PROJECT") {
    return t("pages.inventory.overview.locationOnProject");
  }
  if (row.status === "IN_TRANSIT") {
    return t("pages.inventory.product.inTransit");
  }
  if (row.status === "AT_FACTORY") {
    return t("pages.inventory.factoryReturn.statuses.WAITING");
  }
  const kind = equipmentRetirementKind(row);
  if (kind === "sold") return t("pages.inventory.overview.sold");
  return t("pages.inventory.overview.writtenOff");
}

function locationLabel(
  row: InventoryOverviewAssetRow,
  t: ReturnType<typeof useT>["t"]
) {
  if (row.status === "ON_PROJECT" || row.status === "IN_TRANSIT") {
    return row.project?.name || "—";
  }
  if (row.status === "AVAILABLE") {
    return t("pages.inventory.product.headOffice");
  }
  if (row.status === "AT_FACTORY") {
    return t("pages.inventory.factoryReturn.title");
  }
  return "—";
}

function SendFactoryReturnDialog({
  open,
  onOpenChange,
  item,
  uncodedNew,
  issuedAssets,
  vendors,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: InventoryCatalogItem;
  uncodedNew: number;
  issuedAssets: InventoryOverviewAssetRow[];
  vendors: InventoryVendorOption[];
}) {
  const { t } = useT();
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [source, setSource] = useState<Source>("new");
  const [intent, setIntent] = useState<Intent>("REPAIR");
  const [quantity, setQuantity] = useState("1");
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [vendorId, setVendorId] = useState("");
  const [pending, startTransition] = useTransition();
  const [baseline, setBaseline] = useState<HtmlFormDirtyBaseline | null>(null);
  const { isDirty, handleFormInput, resetDirtyTracking } = useHtmlFormDirty(
    SEND_FORM_ID,
    "",
    baseline
  );

  function reset() {
    setSource("new");
    setIntent("REPAIR");
    setQuantity("1");
    setSelectedAssetIds([]);
    setVendorId("");
  }

  function closeDialog() {
    onOpenChange(false);
    resetDirtyTracking();
    setBaseline(null);
    reset();
  }

  function handleOpenChange(
    nextOpen: boolean,
    eventDetails?: { cancel: () => void }
  ) {
    handleEmployeeDialogOpenChange(nextOpen, eventDetails, {
      isDirty,
      onOpen: () => {
        onOpenChange(true);
        reset();
        resetDirtyTracking();
        requestAnimationFrame(() => {
          setBaseline(captureHtmlFormBaseline(SEND_FORM_ID, ""));
        });
      },
      onClose: closeDialog,
      onRequestExitConfirm: () => setExitConfirmOpen(true),
    });
  }

  async function submit(formData: FormData) {
    const qty = Number(String(formData.get("quantity") ?? "").replace(/,/g, ""));
    if (source === "new") {
      if (!Number.isFinite(qty) || qty <= 0 || qty > uncodedNew) {
        showRejection({
          reasons: t("pages.inventory.factoryReturn.insufficientNew"),
        });
        return;
      }
    } else if (selectedAssetIds.length === 0) {
      showRejection({
        reasons: t("pages.inventory.factoryReturn.assetsRequired"),
      });
      return;
    }
    if (intent === "REFUND") {
      const amount = parseContractPrice(
        String(formData.get("refundAmount") ?? "")
      );
      if (amount == null || amount <= 0) {
        showRejection({
          reasons: t("pages.inventory.factoryReturn.refundAmountRequired"),
        });
        return;
      }
    }
    formData.set("itemId", item.id);
    formData.set("source", source);
    formData.set("intent", intent);
    formData.set("vendorId", vendorId);
    formData.delete("assetIds");
    for (const assetId of selectedAssetIds) {
      formData.append("assetIds", assetId);
    }
    if (source === "issued") {
      formData.set("quantity", String(selectedAssetIds.length));
    }
    startTransition(async () => {
      try {
        await sendEquipmentToFactory(formData);
        toast.success(t("pages.inventory.factoryReturn.sent"));
        closeDialog();
      } catch (error) {
        showRejectionFromError(
          error,
          t("pages.inventory.factoryReturn.sendFailed")
        );
      }
    });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <EmployeeDialogShell
          icon={Factory}
          title={t("pages.inventory.factoryReturn.send")}
          description={t("pages.inventory.factoryReturn.sendDesc")}
          footer={
            <>
              <EmployeeSecondaryButton
                onClick={() => handleOpenChange(false)}
                disabled={pending}
              >
                {t("common.actions.cancel")}
              </EmployeeSecondaryButton>
              <EmployeePrimaryButton
                type="submit"
                form={SEND_FORM_ID}
                disabled={pending}
              >
                {t("pages.inventory.factoryReturn.send")}
              </EmployeePrimaryButton>
            </>
          }
        >
          <form
            id={SEND_FORM_ID}
            className={employeeDialogFormClass}
            action={submit}
            onInput={handleFormInput}
          >
            <div className={employeeDialogFieldClass}>
              <label className={employeeDialogLabelClass}>
                {t("pages.inventory.factoryReturn.source")}
              </label>
              <Select
                value={source}
                onValueChange={(value) => setSource((value as Source) ?? "new")}
                items={[
                  {
                    value: "new",
                    label: t("pages.inventory.saleSource.newInWarehouse"),
                  },
                  {
                    value: "issued",
                    label: t("pages.inventory.saleSource.issuedAsset"),
                  },
                ]}
              >
                <SelectTrigger className={employeeSelectTriggerClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    value="new"
                    label={t("pages.inventory.saleSource.newInWarehouse")}
                  />
                  <SelectItem
                    value="issued"
                    label={t("pages.inventory.saleSource.issuedAsset")}
                  />
                </SelectContent>
              </Select>
              <p className={employeeDialogHintClass}>
                {source === "new"
                  ? t("pages.inventory.factoryReturn.newHint", {
                      available: formatInventoryQty(uncodedNew),
                    })
                  : t("pages.inventory.factoryReturn.issuedHint")}
              </p>
            </div>

            {source === "new" ? (
              <div className={employeeDialogFieldClass}>
                <label className={employeeDialogLabelClass}>
                  {t("pages.inventory.form.quantity")}
                </label>
                <input
                  name="quantity"
                  type="number"
                  min={1}
                  max={uncodedNew}
                  step={1}
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  className={employeeInputClass}
                />
              </div>
            ) : (
              <div className={employeeDialogFieldClass}>
                <label className={employeeDialogLabelClass}>
                  {t("pages.inventory.factoryReturn.assets")}
                </label>
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-border bg-elevated p-2">
                  {issuedAssets.map((asset) => {
                    const checked = selectedAssetIds.includes(asset.id);
                    return (
                      <label
                        key={asset.id}
                        className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(next) =>
                            setSelectedAssetIds((prev) =>
                              next
                                ? prev.includes(asset.id)
                                  ? prev
                                  : [...prev, asset.id]
                                : prev.filter((id) => id !== asset.id)
                            )
                          }
                        />
                        <span>
                          <span className="font-medium">{asset.assetCode}</span>
                          <span className="mt-0.5 block text-xs text-muted">
                            {asset.status === "ON_PROJECT"
                              ? asset.project?.name || "—"
                              : t("pages.inventory.product.headOffice")}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div className={employeeDialogFieldClass}>
              <label className={employeeDialogLabelClass}>
                {t("pages.inventory.factoryReturn.intent")}
              </label>
              <Select
                value={intent}
                onValueChange={(value) =>
                  setIntent((value as Intent) ?? "REPAIR")
                }
                items={[
                  {
                    value: "REFUND",
                    label: t("pages.inventory.factoryReturn.intents.REFUND"),
                  },
                  {
                    value: "REPAIR",
                    label: t("pages.inventory.factoryReturn.intents.REPAIR"),
                  },
                  {
                    value: "REPLACE",
                    label: t("pages.inventory.factoryReturn.intents.REPLACE"),
                  },
                ]}
              >
                <SelectTrigger className={employeeSelectTriggerClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    value="REFUND"
                    label={t("pages.inventory.factoryReturn.intents.REFUND")}
                  />
                  <SelectItem
                    value="REPAIR"
                    label={t("pages.inventory.factoryReturn.intents.REPAIR")}
                  />
                  <SelectItem
                    value="REPLACE"
                    label={t("pages.inventory.factoryReturn.intents.REPLACE")}
                  />
                </SelectContent>
              </Select>
            </div>

            {intent === "REFUND" ? (
              <div className={employeeDialogFieldClass}>
                <label className={employeeDialogLabelClass}>
                  {t("pages.inventory.factoryReturn.refundAmount")}
                </label>
                <MoneyInput
                  name="refundAmount"
                  className={employeeInputClass}
                />
              </div>
            ) : null}

            <div className={employeeDialogGridClass}>
              <div className={employeeDialogFieldClass}>
                <label className={employeeDialogLabelClass}>
                  {t("pages.inventory.factoryReturn.sentAt")}
                </label>
                <input
                  name="sentAt"
                  type="date"
                  defaultValue={formatDateForInput(new Date())}
                  className={employeeInputClass}
                />
              </div>
              <div className={employeeDialogFieldClass}>
                <label className={employeeDialogLabelClass}>
                  {t("pages.inventory.columns.vendor")}
                </label>
                <Select
                  value={vendorId || undefined}
                  onValueChange={(value) => setVendorId(value ?? "")}
                  items={vendors.map((vendor) => ({
                    value: vendor.id,
                    label: vendor.name,
                  }))}
                >
                  <SelectTrigger className={employeeSelectTriggerClass}>
                    <SelectValue
                      placeholder={t("pages.inventory.factoryReturn.vendorOptional")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((vendor) => (
                      <SelectItem
                        key={vendor.id}
                        value={vendor.id}
                        label={vendor.name}
                      />
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className={employeeDialogFieldClass}>
              <label className={employeeDialogLabelClass}>
                {t("pages.inventory.factoryReturn.reason")}
              </label>
              <textarea
                name="reason"
                required
                rows={3}
                className={employeeInputClass}
              />
            </div>
          </form>
        </EmployeeDialogShell>
      </Dialog>
      <EmployeeUnsavedExitDialog
        open={exitConfirmOpen}
        onCancel={() => setExitConfirmOpen(false)}
        onConfirm={() => {
          setExitConfirmOpen(false);
          closeDialog();
        }}
      />
    </>
  );
}
