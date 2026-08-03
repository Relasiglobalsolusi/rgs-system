"use client";

import { useMemo, useState, useTransition } from "react";
import { Package, X } from "lucide-react";
import { toast } from "sonner";

import {
  assignEquipmentAssetToProject,
  releaseEquipmentAssetFromProject,
} from "@/app/projects/equipment-actions";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { outlineChipTones } from "@/components/ui/StatusBadge";
import {
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/use-t";

export type EquipmentAssetOption = {
  id: string;
  assetCode: string;
  serialNo: string | null;
  item: {
    id: string;
    sku: string;
    name: string;
  };
};

export type AssignedEquipmentAsset = {
  id: string;
  assetCode: string;
  serialNo: string | null;
  movementId: string | null;
  item: {
    id: string;
    sku: string;
    name: string;
  };
};

type Props = {
  projectId: string;
  projectStatus: string;
  /** AVAILABLE assets grouped by item — already filtered to Equipment type. */
  availableAssets: EquipmentAssetOption[];
  /** ON_PROJECT assets for this project. */
  assignedAssets: AssignedEquipmentAsset[];
  canAssign: boolean;
};

type ItemGroup = {
  itemId: string;
  itemName: string;
  assets: EquipmentAssetOption[];
};

function buildGroups(assets: EquipmentAssetOption[]): ItemGroup[] {
  const map = new Map<string, ItemGroup>();
  for (const asset of assets) {
    const key = asset.item.id;
    const existing = map.get(key);
    if (existing) {
      existing.assets.push(asset);
    } else {
      map.set(key, {
        itemId: asset.item.id,
        itemName: asset.item.name,
        assets: [asset],
      });
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    a.itemName.localeCompare(b.itemName)
  );
}

export default function ProjectEquipmentPicker({
  projectId,
  projectStatus,
  availableAssets,
  assignedAssets,
  canAssign,
}: Props) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assigning, startAssign] = useTransition();
  const [releaseTarget, setReleaseTarget] = useState<AssignedEquipmentAsset | null>(null);
  const [releasing, startRelease] = useTransition();

  const canIssue =
    projectStatus === "IN_PROGRESS" || projectStatus === "ON_HOLD";

  const groups = useMemo(() => buildGroups(availableAssets), [availableAssets]);

  function toggleAsset(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleOpenChange(value: boolean) {
    setOpen(value);
    if (!value) setSelectedIds(new Set());
  }

  function handleAssignOne(assetId: string) {
    const fd = new FormData();
    fd.set("assetId", assetId);
    fd.set("projectId", projectId);
    startAssign(async () => {
      try {
        await assignEquipmentAssetToProject(fd);
        toast.success(t("pages.projects.equipmentPicker.assignSuccess"));
      } catch (error) {
        showRejectionFromError(error, t("pages.projects.equipmentPicker.assignFailed"));
      }
    });
  }

  function handleAssignSelected() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    startAssign(async () => {
      let failed = 0;
      for (const assetId of ids) {
        const fd = new FormData();
        fd.set("assetId", assetId);
        fd.set("projectId", projectId);
        try {
          await assignEquipmentAssetToProject(fd);
        } catch {
          failed++;
        }
      }
      if (failed === 0) {
        toast.success(t("pages.projects.equipmentPicker.assignSuccess"));
        setOpen(false);
        setSelectedIds(new Set());
      } else {
        showRejectionFromError(
          new Error(t("pages.projects.equipmentPicker.assignFailed")),
          t("pages.projects.equipmentPicker.assignFailed")
        );
      }
    });
  }

  function handleRelease() {
    if (!releaseTarget) return;
    const fd = new FormData();
    fd.set("assetId", releaseTarget.id);
    fd.set("projectId", projectId);
    startRelease(async () => {
      try {
        await releaseEquipmentAssetFromProject(fd);
        toast.success(t("pages.projects.equipmentPicker.releaseSuccess"));
        setReleaseTarget(null);
      } catch (error) {
        showRejectionFromError(error, t("pages.projects.equipmentPicker.releaseFailed"));
      }
    });
  }

  return (
    <>
      {/* ── Assign dialog trigger ── */}
      {canAssign && canIssue ? (
        <Button
          type="button"
          variant="infoBadge"
          size="badgeFlex"
          className="text-xs tracking-[0.06em]"
          disabled={availableAssets.length === 0}
          title={
            availableAssets.length === 0
              ? t("pages.projects.equipmentPicker.noAvailableAssets")
              : undefined
          }
          onClick={() => setOpen(true)}
        >
          <Package className="h-3.5 w-3.5" />
          {t("pages.projects.equipmentPicker.assignTitle")}
        </Button>
      ) : null}

      {/* ── Assigned assets list ── */}
      {assignedAssets.length === 0 ? (
        <p className="text-sm text-subtle">
          {t("pages.projects.equipmentPicker.noAssignedAssets")}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {assignedAssets.map((asset) => (
            <div
              key={asset.id}
              className={cn(
                "w-auto max-w-full rounded-md px-3 py-2",
                outlineChipTones.warning
              )}
            >
              <p className="text-sm font-semibold normal-case tracking-normal">
                {asset.assetCode}
              </p>
              <p className="text-xs font-medium normal-case tracking-normal text-warning/70">
                {asset.item.name}
              </p>
              {asset.serialNo ? (
                <p className="text-xs font-medium normal-case tracking-normal text-warning/60">
                  S/N: {asset.serialNo}
                </p>
              ) : null}
              {canAssign ? (
                <button
                  type="button"
                  onClick={() => setReleaseTarget(asset)}
                  className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-warning/70 hover:text-warning"
                  title={t("pages.projects.equipmentPicker.removeFromAssignment")}
                >
                  <X className="h-3 w-3" />
                  {t("pages.projects.equipmentPicker.releaseTitle")}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {/* ── Assign picker dialog ── */}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t("pages.projects.equipmentPicker.assignTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("pages.projects.equipmentPicker.assignPrompt")}
            </DialogDescription>
          </DialogHeader>

          {groups.length === 0 ? (
            <p className="py-4 text-center text-sm text-subtle">
              {t("pages.projects.equipmentPicker.noAvailableAssets")}
            </p>
          ) : (
            <div className="max-h-80 overflow-y-auto space-y-4 pr-1">
              {groups.map((group) => (
                <div key={group.itemId}>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-subtle">
                    {group.itemName}
                  </p>
                  <ul className="divide-y divide-border/60 rounded-xl border border-border bg-elevated">
                    {group.assets.map((asset) => {
                      const checked = selectedIds.has(asset.id);
                      return (
                        <li key={asset.id}>
                          <label
                            className={cn(
                              "flex items-center gap-3 px-3 py-3 text-sm transition-colors cursor-pointer",
                              checked
                                ? "bg-card-tint-amber text-warning"
                                : "text-muted hover:bg-inset/80"
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleAsset(asset.id)}
                              className="h-4 w-4 rounded border-slate-600 bg-elevated text-amber-600 focus:ring-amber-500/30"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium font-mono text-xs">
                                {asset.assetCode}
                              </span>
                              {asset.serialNo ? (
                                <span className="block truncate text-[11px] text-subtle">
                                  S/N: {asset.serialNo}
                                </span>
                              ) : null}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleOpenChange(false)}
              disabled={assigning}
            >
              {t("common.actions.cancel")}
            </Button>
            <Button
              type="button"
              disabled={assigning || selectedIds.size === 0}
              onClick={handleAssignSelected}
            >
              {assigning
                ? t("common.actions.saving")
                : `${t("pages.projects.equipmentPicker.assignTitle")} (${selectedIds.size})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Release confirm dialog ── */}
      <Dialog
        open={releaseTarget != null}
        onOpenChange={(value) => { if (!value) setReleaseTarget(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("pages.projects.equipmentPicker.releaseTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("pages.projects.equipmentPicker.releaseDesc")}
            </DialogDescription>
          </DialogHeader>
          {releaseTarget ? (
            <div className="space-y-1">
              <p className="text-sm font-semibold font-mono">
                {releaseTarget.assetCode}
              </p>
              <p className="text-sm text-subtle">{releaseTarget.item.name}</p>
              {releaseTarget.serialNo ? (
                <p className="text-xs text-subtle">S/N: {releaseTarget.serialNo}</p>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              disabled={releasing}
              onClick={() => setReleaseTarget(null)}
            >
              {t("common.actions.cancel")}
            </Button>
            <Button
              type="button"
              disabled={releasing}
              onClick={handleRelease}
            >
              {releasing
                ? t("common.actions.saving")
                : t("pages.projects.equipmentPicker.releaseConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
