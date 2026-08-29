"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";

import { releaseEquipmentAssetFromProject } from "@/app/projects/equipment-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { outlineChipTones } from "@/components/ui/StatusBadge";
import { showRejectionFromError } from "@/components/ui/rejection-notice";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/use-t";

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
  /** ON_PROJECT assets for this project. */
  assignedAssets: AssignedEquipmentAsset[];
  /** Whether the user may release units back to inventory. */
  canRelease: boolean;
};

export default function ProjectEquipmentPicker({
  projectId,
  assignedAssets,
  canRelease,
}: Props) {
  const { t } = useT();
  const [releaseTarget, setReleaseTarget] = useState<AssignedEquipmentAsset | null>(null);
  const [releasing, startRelease] = useTransition();

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
    <div className="space-y-4">
      {assignedAssets.length === 0 ? (
        <p className="text-sm text-subtle">
          {t("pages.projects.equipmentPicker.noAssignedAssets")}
        </p>
      ) : (
        <div className="flex flex-wrap gap-3">
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
              {canRelease ? (
                <button
                  type="button"
                  onClick={() => setReleaseTarget(asset)}
                  className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-warning/70 hover:text-warning"
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

      <Dialog
        skipUnsavedGuard
        open={releaseTarget != null}
        onOpenChange={(value) => {
          if (!value) setReleaseTarget(null);
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="gap-0 overflow-hidden rounded-2xl border border-border bg-panel p-0 text-text ring-0 sm:max-w-sm"
        >
          <div className="max-h-[min(90dvh,24rem)] overflow-y-auto px-4 pt-6 pb-6 sm:px-10 sm:pt-8 sm:pb-7">
          <DialogHeader>
            <DialogTitle>
              {t("pages.projects.equipmentPicker.releaseTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("pages.projects.equipmentPicker.releaseDesc")}
            </DialogDescription>
          </DialogHeader>
          {releaseTarget ? (
            <div className="mt-4 space-y-1">
              <p className="text-sm font-semibold font-mono">
                {releaseTarget.assetCode}
              </p>
              <p className="text-sm text-subtle">{releaseTarget.item.name}</p>
              {releaseTarget.serialNo ? (
                <p className="text-xs text-subtle">S/N: {releaseTarget.serialNo}</p>
              ) : null}
            </div>
          ) : null}
          </div>
          <DialogFooter className="mx-0 mb-0 mt-0 flex-col gap-3 rounded-none border-t border-border bg-strip px-4 py-5 sm:flex-col sm:justify-stretch sm:px-10 sm:py-6">
            <Button
              type="button"
              variant="secondary"
              disabled={releasing}
              onClick={() => setReleaseTarget(null)}
            >
              {t("common.actions.cancel")}
            </Button>
            <Button type="button" disabled={releasing} onClick={handleRelease}>
              {releasing
                ? t("common.actions.saving")
                : t("pages.projects.equipmentPicker.releaseConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
