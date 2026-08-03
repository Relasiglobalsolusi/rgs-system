"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { voidProjectInventoryIssue } from "@/app/inventory/actions";
import InventoryIssueDialog from "@/components/inventory/InventoryIssueDialog";
import type { InventoryCatalogItem } from "@/components/inventory/inventory-types";
import {
  showRejection,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import SectionCard from "@/components/ui/SectionCard";
import { formatDisplayDate } from "@/lib/format-date";
import { canIssueInventoryToProject, formatInventoryQtyWithUnit } from "@/lib/inventory";
import { useT } from "@/lib/i18n/use-t";
import { formatContractPrice } from "@/lib/project-billing";
import { cn } from "@/lib/utils";

export type ProjectInventoryIssueView = {
  id: string;
  movedAt: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  item: {
    id: string;
    sku: string;
    name: string;
    unit: string;
  };
};

type Props = {
  projectId: string;
  projectName: string;
  projectStatus: string;
  issues: ProjectInventoryIssueView[];
  catalogItems: InventoryCatalogItem[];
  canViewInventoryModule: boolean;
  canAssignStock: boolean;
  canVoidIssue: boolean;
};

const sectionTitleClassName = "text-base font-semibold tracking-tight text-text";
const sectionCardClassName = "p-5 sm:p-6";

export default function ProjectInventoryPanel({
  projectId,
  projectName,
  projectStatus,
  issues,
  catalogItems,
  canViewInventoryModule,
  canAssignStock,
  canVoidIssue,
}: Props) {
  const { t } = useT();
  const [assignOpen, setAssignOpen] = useState(false);
  const [voidTarget, setVoidTarget] = useState<ProjectInventoryIssueView | null>(
    null
  );
  const [voidReason, setVoidReason] = useState("");
  const [pending, startTransition] = useTransition();

  const canIssueToStatus = canIssueInventoryToProject(projectStatus);
  const hasStock = catalogItems.some(
    (item) => item.active && item.currentStock > 0
  );

  function submitVoid() {
    if (!voidTarget) return;
    const reason = voidReason.trim();
    if (!reason) {
      showRejection({
        reasons: t("pages.inventory.voidReasonRequired"),
      });
      return;
    }
    const formData = new FormData();
    formData.set("id", voidTarget.id);
    formData.set("projectId", projectId);
    formData.set("voidReason", reason);

    startTransition(async () => {
      try {
        await voidProjectInventoryIssue(formData);
        toast.success(t("pages.projects.detail.voidIssueSuccess"));
        setVoidTarget(null);
        setVoidReason("");
      } catch (error) {
        showRejectionFromError(error, t("pages.inventory.voidFailed"));
      }
    });
  }

  return (
    <>
      <SectionCard className={sectionCardClassName}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className={sectionTitleClassName}>
              {t("pages.projects.detail.inventoryIssues")}
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-subtle">
              {t("pages.projects.detail.inventoryEquipmentReleaseHint")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canAssignStock && canIssueToStatus ? (
              <Button
                type="button"
                variant="infoBadge"
                size="badgeFlex"
                className="text-xs tracking-[0.06em]"
                disabled={!hasStock}
                title={
                  hasStock
                    ? undefined
                    : t("pages.inventory.noStockToIssue")
                }
                onClick={() => setAssignOpen(true)}
              >
                {t("pages.projects.detail.assignStock")}
              </Button>
            ) : null}
            {canViewInventoryModule ? (
              <Link
                href="/inventory"
                className={cn(
                  buttonVariants({
                    variant: "infoBadge",
                    size: "badgeFlex",
                  }),
                  "text-xs tracking-[0.06em]"
                )}
              >
                {t("pages.projects.detail.viewInventory")}
              </Link>
            ) : null}
          </div>
        </div>
        {issues.length === 0 ? (
          <p className="text-sm text-subtle">
            {t("pages.projects.detail.noInventoryIssues")}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-[0.12em] text-subtle">
                  <th className="px-3 py-3 font-semibold">
                    {t("pages.projects.detail.inventoryIssueDate")}
                  </th>
                  <th className="px-3 py-3 font-semibold">
                    {t("pages.projects.detail.inventoryIssueItem")}
                  </th>
                  <th className="px-3 py-3 font-semibold">
                    {t("pages.projects.detail.inventoryIssueQty")}
                  </th>
                  <th className="px-3 py-3 font-semibold">
                    {t("pages.projects.detail.inventoryIssueUnitCost")}
                  </th>
                  <th className="px-3 py-3 text-right font-semibold">
                    {t("pages.projects.detail.inventoryIssueTotal")}
                  </th>
                  {canVoidIssue ? (
                    <th className="px-3 py-3 text-right font-semibold">
                      {t("pages.projects.detail.inventoryIssueActions")}
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {issues.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-3 py-3.5 text-text">
                      {formatDisplayDate(row.movedAt)}
                    </td>
                    <td className="px-3 py-3.5">
                      <p className="font-medium text-text">{row.item.name}</p>
                      <p className="text-xs text-subtle">{row.item.sku}</p>
                    </td>
                    <td className="px-3 py-3.5 text-text">
                      {formatInventoryQtyWithUnit(row.quantity, row.item.unit)}
                    </td>
                    <td className="px-3 py-3.5 text-text">
                      {formatContractPrice(row.unitCost)}
                    </td>
                    <td className="px-3 py-3.5 text-right font-medium text-text">
                      {formatContractPrice(row.totalCost)}
                    </td>
                    {canVoidIssue ? (
                      <td className="px-3 py-3.5 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          onClick={() => {
                            setVoidTarget(row);
                            setVoidReason("");
                          }}
                        >
                          {t("pages.projects.detail.voidIssue")}
                        </Button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {canAssignStock ? (
        <InventoryIssueDialog
          open={assignOpen}
          onOpenChange={setAssignOpen}
          items={catalogItems}
          projects={[
            {
              id: projectId,
              name: projectName,
              status: projectStatus,
            },
          ]}
          lockedProjectId={projectId}
        />
      ) : null}

      <Dialog
        open={voidTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            setVoidTarget(null);
            setVoidReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("pages.projects.detail.voidIssueTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("pages.projects.detail.voidIssueDesc")}
            </DialogDescription>
          </DialogHeader>
          {voidTarget ? (
            <div className="space-y-3">
              <p className="text-sm text-text">
                {voidTarget.item.name} — {formatInventoryQtyWithUnit(voidTarget.quantity, voidTarget.item.unit)}
              </p>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">
                  {t("pages.projects.detail.voidReason")}
                </span>
                <textarea
                  value={voidReason}
                  onChange={(event) => setVoidReason(event.target.value)}
                  rows={3}
                  placeholder={t("pages.projects.detail.voidReasonPlaceholder")}
                  className="w-full rounded-xl border border-border bg-elevated px-3 py-2 text-sm text-text"
                />
              </label>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => {
                setVoidTarget(null);
                setVoidReason("");
              }}
            >
              {t("common.actions.cancel")}
            </Button>
            <Button
              type="button"
              disabled={pending || !voidReason.trim()}
              onClick={submitVoid}
            >
              {pending
                ? t("common.actions.saving")
                : t("pages.projects.detail.voidIssueConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
