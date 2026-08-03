"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { createMaterialRequest } from "@/app/material-requests/actions";
import {
  showRejection,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/use-t";

export type MaterialRequestCatalogItem = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  currentStock: number;
};

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

  const itemOptions = useMemo(
    () =>
      items.map((item) => ({
        id: item.id,
        label: `${item.name} (${item.sku}) · ${item.currentStock} ${item.unit}`,
      })),
    [items]
  );

  function addLine() {
    setLines((prev) => [
      ...prev,
      { key: crypto.randomUUID(), itemId: "", quantity: "1" },
    ]);
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
    <div className="space-y-4">
      <p className="rounded-xl border border-border bg-elevated/40 px-4 py-3 text-sm text-muted">
        {checkedInProjectName
          ? t("pages.materialRequests.checkedInHint", {
              project: checkedInProjectName,
            })
          : t("pages.materialRequests.mustBeCheckedIn")}
      </p>

      <div className="space-y-3">
        {lines.map((line, index) => (
          <div
            key={line.key}
            className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_8rem_auto]"
          >
            <select
              className="rounded-xl border border-border bg-elevated px-3 py-2 text-sm text-text"
              value={line.itemId}
              onChange={(event) =>
                setLines((prev) =>
                  prev.map((row, i) =>
                    i === index ? { ...row, itemId: event.target.value } : row
                  )
                )
              }
            >
              <option value="">
                {t("pages.materialRequests.selectItem")}
              </option>
              {itemOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              step={1}
              className="rounded-xl border border-border bg-elevated px-3 py-2 text-sm text-text"
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
            <Button
              type="button"
              variant="ghost"
              disabled={lines.length <= 1 || pending}
              onClick={() =>
                setLines((prev) => prev.filter((_, i) => i !== index))
              }
            >
              {t("common.actions.remove")}
            </Button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={addLine}>
          {t("pages.materialRequests.addLine")}
        </Button>
      </div>

      <textarea
        className="min-h-[4rem] w-full rounded-xl border border-border bg-elevated px-3 py-2 text-sm text-text"
        placeholder={t("pages.materialRequests.notesPlaceholder")}
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
      />

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
  );
}
