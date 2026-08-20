"use client";

import type { ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MAX_BULK_CREATE_LINES } from "@/lib/bulk-create";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  description: string;
  lineKeys: string[];
  onAdd: (count: number) => void;
  onRemove: (index: number) => void;
  renderLine: (index: number) => ReactNode;
  className?: string;
};

export default function BulkLineList({
  title,
  description,
  lineKeys,
  onAdd,
  onRemove,
  renderLine,
  className,
}: Props) {
  const { t } = useT();
  const lineCount = lineKeys.length;
  const remaining = MAX_BULK_CREATE_LINES - lineCount;
  const canAdd = remaining > 0;

  return (
    <div className={cn("space-y-4", className)}>
      <div>
        <h3 className="text-sm font-semibold text-text">{title}</h3>
        <p className="mt-1 text-xs text-muted">{description}</p>
      </div>

      <div className="space-y-3">
        {lineKeys.map((lineKey, index) => (
          <div
            key={lineKey}
            className="rounded-xl border border-border bg-inset p-4"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-text">
                {t("bulkCreate.lineNumber", { n: String(index + 1) })}
              </p>
              {lineCount > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-danger hover:text-danger"
                  onClick={() => onRemove(index)}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  {t("bulkCreate.removeLine")}
                </Button>
              ) : null}
            </div>
            {renderLine(index)}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!canAdd}
          onClick={() => onAdd(1)}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          {t("bulkCreate.addLine")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={remaining < 1}
          onClick={() => onAdd(Math.min(5, remaining))}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          {t("bulkCreate.addFiveLines")}
        </Button>
        <p className="text-xs text-muted">
          {t("bulkCreate.maxLinesReached", {
            max: String(MAX_BULK_CREATE_LINES),
          })}
        </p>
      </div>
    </div>
  );
}
