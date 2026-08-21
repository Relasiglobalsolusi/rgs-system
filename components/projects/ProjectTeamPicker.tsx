"use client";

import { useMemo, useState } from "react";
import { Users } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { outlineChipTones } from "@/components/ui/StatusBadge";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

export type ProjectTeamOption = {
  id: string;
  name: string;
  kind: string;
  serviceAreaCatalogId?: string | null;
  catalogSystemArea?: string | null;
  memberIds: string[];
  memberNames: string[];
};

type Props = {
  teams: ProjectTeamOption[];
  defaultCheckedIds?: string[];
  /** Prefix hidden field names (e.g. `line.0.`) for bulk create. */
  namePrefix?: string;
};

export default function ProjectTeamPicker({
  teams,
  defaultCheckedIds = [],
  namePrefix = "",
}: Props) {
  const nameOf = (field: string) =>
    namePrefix ? `${namePrefix}${field}` : field;
  const { t } = useT();
  const initial = useMemo(() => new Set(defaultCheckedIds), [defaultCheckedIds]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(initial)
  );

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (teams.length === 0) return null;

  return (
    <div className="space-y-3">
      {Array.from(selectedIds).map((id) => (
        <input key={id} type="hidden" name={nameOf("teamIds")} value={id} />
      ))}
      <div>
        <label className="text-sm font-medium text-muted">
          {t("pages.projects.assignTeam")}
        </label>
        <p className="mt-1 text-xs text-subtle">
          {t("pages.projects.assignTeamHint")}
        </p>
      </div>
      <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-inset">
        {teams.map((team) => {
          const checked = selectedIds.has(team.id);
          return (
            <li key={team.id}>
              <label
                className={cn(
                  "flex cursor-pointer items-start gap-3 px-3 py-3 text-sm",
                  checked
                    ? "bg-card-tint-emerald text-primary-dark"
                    : "text-muted hover:bg-elevated"
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(team.id)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-elevated text-primary focus:ring-primary/30"
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{team.name}</span>
                  <span className="mt-0.5 block text-[11px] text-subtle">
                    {team.memberNames.length > 0
                      ? team.memberNames.join(", ")
                      : t("pages.teams.emptyMembers")}
                  </span>
                </span>
                <span
                  className={cn(
                    buttonVariants({ variant: "successBadge", size: "badge" }),
                    "pointer-events-none gap-1"
                  )}
                >
                  <Users />
                  {team.memberIds.length}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {selectedIds.size > 0 ? (
        <div className="flex flex-wrap gap-2">
          {teams
            .filter((team) => selectedIds.has(team.id))
            .map((team) => (
              <span
                key={team.id}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-sm font-medium",
                  outlineChipTones.emeraldInteractive
                )}
              >
                {team.name}
              </span>
            ))}
        </div>
      ) : null}
    </div>
  );
}
