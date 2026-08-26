"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Wrench } from "lucide-react";

import { assignTeamEquipment } from "@/app/teams/actions";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  EmployeeSecondaryButton,
} from "@/components/employees/employee-dialog-ui";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import DirectorySearchInput, {
  matchesDirectorySearch,
} from "@/components/ui/DirectorySearchInput";
import { showRejectionFromError } from "@/components/ui/rejection-notice";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useT } from "@/lib/i18n/use-t";

export type TeamEquipmentOption = {
  id: string;
  assetCode: string;
  itemName: string;
  teamId: string | null;
  teamName?: string | null;
};

export default function TeamEquipmentDialog({
  teamId,
  assets,
  open,
  onOpenChange,
}: {
  teamId: string;
  assets: TeamEquipmentOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useT();
  const [selected, setSelected] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const visibleAssets = useMemo(
    () =>
      assets.filter((asset) =>
        matchesDirectorySearch(
          searchQuery,
          asset.assetCode,
          asset.itemName,
          asset.teamName
        )
      ),
    [assets, searchQuery]
  );

  useEffect(() => {
    if (!open) return;
    setSelected(
      assets.filter((row) => row.teamId === teamId).map((row) => row.id)
    );
    setSearchQuery("");
  }, [assets, open, teamId]);

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((row) => row !== id)
        : [...current, id]
    );
  }

  function save() {
    const formData = new FormData();
    formData.set("teamId", teamId);
    for (const id of selected) formData.append("assetIds", id);
    startTransition(async () => {
      try {
        await assignTeamEquipment(formData);
        onOpenChange(false);
      } catch (error) {
        showRejectionFromError(error, t("pages.teams.assignEquipment"));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <EmployeeDialogShell
        icon={Wrench}
        title={t("pages.teams.assignEquipment")}
        description={t("pages.teams.assignEquipmentHint")}
        maxWidth="lg"
        footer={
          <div className="flex w-full flex-col gap-2">
            <EmployeePrimaryButton disabled={pending} onClick={save}>
              {t("pages.teams.assignEquipmentSave")}
            </EmployeePrimaryButton>
            <EmployeeSecondaryButton
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              {t("common.actions.cancel")}
            </EmployeeSecondaryButton>
          </div>
        }
      >
        {assets.length === 0 ? (
          <p className="text-sm text-subtle">
            {t("pages.teams.assignEquipmentEmpty")}
          </p>
        ) : (
          <div className="space-y-3">
            <DirectorySearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder={t("pages.teams.assignEquipmentSearch")}
            />
            {visibleAssets.length === 0 ? (
              <p className="text-sm text-subtle">
                {t("pages.teams.assignEquipmentEmptySearch")}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("pages.teams.assetCode")}</TableHead>
                    <TableHead>{t("pages.teams.item")}</TableHead>
                    <TableHead className="text-center">
                      {t("pages.teams.assigned")}
                    </TableHead>
                    <TableHead>{t("pages.teams.currentTeam")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleAssets.map((asset) => {
                    const checked = selected.includes(asset.id);
                    return (
                      <TableRow key={asset.id}>
                        <TableCell className="font-mono text-sm font-medium text-text">
                          {asset.assetCode}
                        </TableCell>
                        <TableCell className="text-sm text-text">
                          {asset.itemName}
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggle(asset.id)}
                            aria-label={asset.assetCode}
                          />
                        </TableCell>
                        <TableCell className="text-sm text-muted">
                          {asset.teamName?.trim() ||
                            t("pages.teams.unassigned")}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        )}
      </EmployeeDialogShell>
    </Dialog>
  );
}
