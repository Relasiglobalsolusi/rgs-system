"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { createMaterialRequest } from "@/app/material-requests/actions";
import MaterialRequestItemPicker, {
  isMaterialRequestItemAvailable,
  type MaterialRequestCatalogItem,
} from "@/components/material-requests/MaterialRequestItemPicker";
import {
  showRejection,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

export type { MaterialRequestCatalogItem };

type LineDraft = {
  key: string;
  itemId: string;
  quantity: string;
};

type Props = {
  items: MaterialRequestCatalogItem[];
  checkedInProjectName: string | null;
};

export default function MaterialRequestForm({
  items,
  checkedInProjectName,
}: Props) {
  const { t } = useT();
  const [pending, startTransition] = useTransition();
  const [lines, setLines] = useState<LineDraft[]>([
    { key: crypto.randomUUID(), itemId: "", quantity: "1" },
  ]);
  const [notes, setNotes] = useState("");
  const [pickerLineKey, setPickerLineKey] = useState<string | null>(null);

  const itemsById = useMemo(() => {
    const map = new Map(items.map((item) => [item.id, item]));
    return map;
  }, [items]);

  const pickerLine = lines.find((line) => line.key === pickerLineKey);

  function addLine() {
    const key = crypto.randomUUID();
    setLines((prev) => [...prev, { key, itemId: "", quantity: "1" }]);
    setPickerLineKey(key);
  }

  function submit() {
    if (!checkedInProjectName) {
      showRejection({
        reasons: t("pages.materialRequests.mustBeCheckedIn"),
      });
      return;
    }
    const formData = new FormData();
    formData.set("notes", notes);
    for (const line of lines) {
      if (!line.itemId.trim()) continue;
      formData.append("itemId", line.itemId);
      formData.append("quantity", line.quantity);
    }
    startTransition(async () => {
      try {
        await createMaterialRequest(formData);
        toast.success(t("pages.materialRequests.created"));
        setLines([{ key: crypto.randomUUID(), itemId: "", quantity: "1" }]);
        setNotes("");
      } catch (error) {
        showRejectionFromError(
          error,
          t("pages.materialRequests.createFailed")
        );
      }
    });
  }

  return (
    <div className="space-y-5">
      <div
        className={cn(
          "rounded-xl border px-4 py-3 text-sm",
          checkedInProjectName
            ? "border-emerald-500/30 bg-emerald-500/10 text-text"
            : "border-amber-500/30 bg-amber-500/10 text-muted"
        )}
      >
        {checkedInProjectName ? (
          <>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-subtle">
              {t("pages.materialRequests.checkedInProjectLabel")}
            </p>
            <p className="mt-1 font-semibold text-text">
              {checkedInProjectName}
            </p>
            <p className="mt-1 text-xs text-subtle">
              {t("pages.materialRequests.checkedInHintDetail")}
            </p>
          </>
        ) : (
          t("pages.materialRequests.mustBeCheckedIn")
        )}
      </div>

      <div>
        <p className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-subtle">
          {t("pages.materialRequests.columns.requestedItems")}
        </p>
        <p className="mb-3 text-xs text-subtle">
          {t("pages.materialRequests.itemTypeHint")}
        </p>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[28rem] text-sm">
            <thead className="bg-elevated/60 text-left text-[0.6875rem] uppercase tracking-[0.12em] text-subtle">
              <tr>
                <th className="px-3 py-2.5 text-left font-semibold">
                  {t("pages.materialRequests.columns.item")}
                </th>
                <th className="px-3 py-2.5 font-semibold text-right">
                  {t("pages.materialRequests.columns.qty")}
                </th>
                <th className="px-3 py-2.5 font-semibold text-right">
                  {t("common.labels.actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => {
                const selected = itemsById.get(line.itemId);
                return (
                  <tr key={line.key} className="border-t border-border">
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        className="w-full rounded-xl border border-border bg-card px-3 py-2 text-left text-sm text-text"
                        onClick={() => setPickerLineKey(line.key)}
                      >
                        {selected ? (
                          <span className="font-medium">
                            {selected.name}{" "}
                            <span className="font-normal text-subtle">
                              ({selected.sku})
                            </span>
                          </span>
                        ) : (
                          <span className="text-subtle">
                            {t("pages.materialRequests.selectItem")}
                          </span>
                        )}
                      </button>
                      {selected ? (
                        <p className="mt-1 text-xs text-subtle">
                          {selected.sku} · {selected.unit}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <input
                        type="number"
                        min={1}
                        step={1}
                        className="w-24 rounded-xl border border-border bg-card px-3 py-2 text-right text-sm tabular-nums text-text"
                        value={line.quantity}
                        onChange={(event) =>
                          setLines((prev) =>
                            prev.map((row, i) =>
                              i === index
                                ? { ...row, quantity: event.target.value }
                                : row
                            )
                          )
                        }
                      />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={lines.length <= 1 || pending}
                        onClick={() =>
                          setLines((prev) =>
                            prev.filter((_, i) => i !== index)
                          )
                        }
                      >
                        {t("common.actions.remove")}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3">
          <Button type="button" variant="secondary" size="sm" onClick={addLine}>
            {t("pages.materialRequests.addLine")}
          </Button>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-subtle">
          {t("pages.materialRequests.columns.notes")}
        </label>
        <textarea
          className="min-h-[4.5rem] w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-text"
          placeholder={t("pages.materialRequests.notesPlaceholder")}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-xs text-subtle">
          {t("pages.materialRequests.submitHint")}
        </p>
        <Button
          type="button"
          disabled={pending || !checkedInProjectName}
          onClick={submit}
        >
          {pending
            ? t("common.actions.saving")
            : t("pages.materialRequests.submit")}
        </Button>
      </div>

      <MaterialRequestItemPicker
        open={pickerLineKey != null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setPickerLineKey(null);
        }}
        items={items}
        selectedItemId={pickerLine?.itemId}
        onSelect={(item) => {
          if (!pickerLineKey) return;
          if (!isMaterialRequestItemAvailable(item)) return;
          setLines((prev) =>
            prev.map((row) =>
              row.key === pickerLineKey ? { ...row, itemId: item.id } : row
            )
          );
          setPickerLineKey(null);
        }}
      />
    </div>
  );
}
