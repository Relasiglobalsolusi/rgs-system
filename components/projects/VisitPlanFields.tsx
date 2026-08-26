"use client";

import { Plus, Trash2 } from "lucide-react";

import {
  employeeDialogFieldClass,
  employeeDialogHintClass,
  employeeInputClass,
} from "@/components/employees/employee-dialog-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MessageKey } from "@/lib/i18n/messages";
import { useT } from "@/lib/i18n/use-t";

export type VisitWindowDraft = {
  startDate: string;
  endDate: string;
};

type Props = {
  visits: VisitWindowDraft[];
  onChange: (visits: VisitWindowDraft[]) => void;
  /** Prefix field names (e.g. `line.0.`) for bulk create. */
  namePrefix?: string;
  hintKey?: MessageKey;
};

export default function VisitPlanFields({
  visits,
  onChange,
  namePrefix = "",
  hintKey = "pages.projects.visitPlanHint",
}: Props) {
  const nameOf = (field: string) =>
    namePrefix ? `${namePrefix}${field}` : field;
  const { t } = useT();

  function update(index: number, patch: Partial<VisitWindowDraft>) {
    onChange(
      visits.map((visit, visitIndex) =>
        visitIndex === index ? { ...visit, ...patch } : visit
      )
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-inset p-4">
      <div>
        <p className="text-sm font-medium text-text">
          {t("pages.projects.visitPlan")}
        </p>
        <p className={employeeDialogHintClass}>
          {t(hintKey)}
        </p>
      </div>
      {visits.map((visit, index) => (
        <div
          key={`visit-${index}`}
          className="grid gap-3 rounded-lg border border-border bg-elevated p-3 sm:grid-cols-[1fr_1fr_auto]"
        >
          <div className={employeeDialogFieldClass}>
            <label className="text-sm font-medium text-text">
              {t("pages.projects.visitN", { n: index + 1 })} ·{" "}
              {t("pages.projects.visitStart")}
            </label>
            <Input
              type="date"
              name={nameOf("visitStart")}
              value={visit.startDate}
              onChange={(event) =>
                update(index, { startDate: event.target.value })
              }
              className={employeeInputClass}
              required
            />
          </div>
          <div className={employeeDialogFieldClass}>
            <label className="text-sm font-medium text-text">
              {t("pages.projects.visitEnd")}
            </label>
            <Input
              type="date"
              name={nameOf("visitEnd")}
              value={visit.endDate}
              onChange={(event) =>
                update(index, { endDate: event.target.value })
              }
              className={employeeInputClass}
              required
            />
          </div>
          {visits.length > 2 ? (
            <div className="flex items-end">
              <Button
                type="button"
                variant="destructiveBadge"
                size="badgeFlex"
                onClick={() =>
                  onChange(visits.filter((_, visitIndex) => visitIndex !== index))
                }
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t("pages.projects.removeVisit")}
              </Button>
            </div>
          ) : null}
        </div>
      ))}
      <Button
        type="button"
        variant="infoBadge"
        size="badgeFlex"
        onClick={() => onChange([...visits, { startDate: "", endDate: "" }])}
      >
        <Plus className="h-3.5 w-3.5" />
        {t("pages.projects.addVisit")}
      </Button>
    </div>
  );
}
