"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { voidProjectInventoryIssue } from "@/app/inventory/actions";
import { matchInventoryItemType } from "@/components/inventory/inventory-category";
import {
  showRejection,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { ChipCell } from "@/components/ui/DataTable";
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
import { formatInventoryQtyWithUnit } from "@/lib/inventory";
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
    itemType: string;
  };
};

type Props = {
  projectId: string;
  issues: ProjectInventoryIssueView[];
  canViewInventoryModule: boolean;
  canVoidIssue: boolean;
};

const sectionTitleClassName = "text-base font-semibold tracking-tight text-text";
const sectionCardClassName = "p-5 sm:p-6";

export default function ProjectInventoryPanel({
  projectId,
  issues,
  canViewInventoryModule,
  canVoidIssue,
}: Props) {
  const { t } = useT();
  const [voidTarget, setVoidTarget] = useState<ProjectInventoryIssueView | null>(
    null
  );
  const [voidReason, setVoidReason] = useState("");
  const [pending, startTransition] = useTransition();

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
              {t("pages.projects.detail.inventoryIssueFromInventoryOnly")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canViewInventoryModule ? (
              <Link
                href="/inventory?tab=issues"
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
          <p className="text-sm text-muted">
            {t("pages.projects.detail.noInventoryIssues")}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[48rem] text-sm">
              <thead className="bg-elevated/60 text-left text-xs uppercase tracking-[0.12em] text-subtle">
                <tr>
                  <th className="px-3 py-2.5 text-left font-semibold">
                    {t("pages.inventory.columns.date")}
                  </th>
                  <th className="px-3 py-2.5 font-semibold">
                    {t("pages.inventory.columns.item")}
                  </th>
                  <th className="px-3 py-2.5 font-semibold">
                    {t("pages.inventory.columns.qty")}
                  </th>
                  <th className="px-3 py-2.5 font-semibold">
                    {t("pages.inventory.columns.totalCost")}
                  </th>
                  {canVoidIssue ? (
                    <th className="px-3 py-2.5 text-center font-semibold">
                      {t("pages.inventory.columns.actions")}
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {issues.map((row) => {
                  const isEquipment = matchInventoryItemType(
                    row.item.itemType,
                    "equipment"
                  );
                  return (
                    <tr key={row.id} className="border-t border-border">
                      <td className="px-3 py-2.5 text-text">
                        {formatDisplayDate(row.movedAt)}
                      </td>
                      <td className="px-3 py-2.5 text-text">
                        <span className="font-medium">{row.item.name}</span>
                        <span className="ml-2 text-subtle">{row.item.sku}</span>
                        {isEquipment ? (
                          <span className="ml-2 text-xs text-muted">
                            {t("pages.inventory.form.equipmentDeployed")}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-text">
                        {formatInventoryQtyWithUnit(
                          row.quantity,
                          row.item.unit
                        )}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-text">
                        {isEquipment
                          ? "—"
                          : formatContractPrice(row.totalCost)}
                      </td>
                      {canVoidIssue ? (
                        <td className="px-3 py-2.5 text-center">
                          <ChipCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-danger"
                            onClick={() => {
                              setVoidTarget(row);
                              setVoidReason("");
                            }}
                          >
                            {t("pages.projects.detail.voidIssue")}
                          </Button>
                          </ChipCell>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

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
                {voidTarget.item.name} —{" "}
                {formatInventoryQtyWithUnit(
                  voidTarget.quantity,
                  voidTarget.item.unit
                )}
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
