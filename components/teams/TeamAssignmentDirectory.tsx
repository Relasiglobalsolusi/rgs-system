"use client";

import { useMemo, useState } from "react";
import { Pencil, Trash2, Users } from "lucide-react";

import DirectoryAddButton from "@/components/ui/DirectoryAddButton";
import DirectoryFilterTab from "@/components/ui/DirectoryFilterTab";
import DirectorySearchInput, {
  matchesDirectorySearch,
} from "@/components/ui/DirectorySearchInput";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import SectionCard from "@/components/ui/SectionCard";
import StatusBadge from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/button";
import TeamDeleteDialog from "@/components/teams/TeamDeleteDialog";
import TeamFormDialog from "@/components/teams/TeamFormDialog";
import TeamMembersDialog, {
  type EligibleEmployeeRow,
  type TeamMemberRow,
} from "@/components/teams/TeamMembersDialog";
import { useT } from "@/lib/i18n/use-t";
import type { OperationsTeamKindValue } from "@/lib/operations-teams";

export type TeamAssignmentRow = {
  id: string;
  name: string;
  kind: OperationsTeamKindValue;
  memberCount: number;
  occupiedProjectName: string | null;
  members: TeamMemberRow[];
};

type Filter = "all" | OperationsTeamKindValue;

type Props = {
  teams: TeamAssignmentRow[];
  eligible: EligibleEmployeeRow[];
  canManage: boolean;
};

export default function TeamAssignmentDirectory({
  teams,
  eligible,
  canManage,
}: Props) {
  const { t } = useT();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editTeamId, setEditTeamId] = useState<string | null>(null);
  const [membersTeamId, setMembersTeamId] = useState<string | null>(null);
  const [deleteTeamId, setDeleteTeamId] = useState<string | null>(null);
  const editTeam = teams.find((team) => team.id === editTeamId) ?? null;
  const membersTeam = teams.find((team) => team.id === membersTeamId) ?? null;
  const deleteTeam = teams.find((team) => team.id === deleteTeamId) ?? null;

  const visible = useMemo(
    () =>
      teams.filter((team) => {
        if (filter !== "all" && team.kind !== filter) return false;
        return matchesDirectorySearch(query, team.name);
      }),
    [teams, filter, query]
  );

  function kindLabel(kind: OperationsTeamKindValue) {
    return kind === "FACADE_CLEANING"
      ? t("pages.teams.kindFacade")
      : t("pages.teams.kindGeneral");
  }

  const columns: DataTableColumn<TeamAssignmentRow>[] = [
    {
      key: "name",
      title: t("pages.teams.columns.team"),
      share: 2,
      render: (team) => <p className="font-semibold text-text">{team.name}</p>,
    },
    {
      key: "kind",
      title: t("pages.teams.columns.type"),
      render: (team) => (
        <span className="text-muted">{kindLabel(team.kind)}</span>
      ),
    },
    {
      key: "members",
      title: t("pages.teams.columns.members"),
      render: (team) => (
        <span className="text-muted">
          {team.memberCount === 1
            ? t("pages.teams.memberCountOne")
            : t("pages.teams.memberCount", { count: team.memberCount })}
        </span>
      ),
    },
    {
      key: "status",
      title: t("pages.teams.columns.status"),
      render: (team) =>
        team.occupiedProjectName ? (
          <StatusBadge status="warning" compact>
            {t("pages.teams.onSiteAt", { project: team.occupiedProjectName })}
          </StatusBadge>
        ) : (
          <StatusBadge status="active" compact>
            {t("pages.teams.statusAvailable")}
          </StatusBadge>
        ),
    },
    ...(canManage
      ? [
          {
            key: "actions",
            title: t("pages.teams.columns.actions"),
            align: "right" as const,
            render: (team: TeamAssignmentRow) => (
              <div className="flex justify-end gap-1.5">
                <Button
                  type="button"
                  variant="infoBadge"
                  size="badgeFlex"
                  onClick={() => setMembersTeamId(team.id)}
                >
                  <Users className="h-3.5 w-3.5" />
                  {t("pages.teams.members")}
                </Button>
                <Button
                  type="button"
                  variant="infoBadge"
                  size="badgeFlex"
                  onClick={() => setEditTeamId(team.id)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {t("common.actions.edit")}
                </Button>
                <Button
                  type="button"
                  variant="destructiveBadge"
                  size="badgeFlex"
                  onClick={() => setDeleteTeamId(team.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t("common.actions.delete")}
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <DirectorySearchInput
          value={query}
          onChange={setQuery}
          placeholder={t("pages.teams.searchPlaceholder")}
          className="min-w-[12rem] w-auto max-w-none flex-1"
        />
        {canManage ? (
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <DirectoryAddButton
              label={t("pages.teams.addTeam")}
              onClick={() => setCreateOpen(true)}
            />
          </div>
        ) : null}
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        <DirectoryFilterTab
          active={filter === "all"}
          onClick={() => setFilter("all")}
          count={teams.length}
        >
          {t("pages.teams.filterAll")}
        </DirectoryFilterTab>
        <DirectoryFilterTab
          active={filter === "GENERAL_CLEANING"}
          onClick={() => setFilter("GENERAL_CLEANING")}
          count={teams.filter((team) => team.kind === "GENERAL_CLEANING").length}
        >
          {t("pages.teams.kindGeneral")}
        </DirectoryFilterTab>
        <DirectoryFilterTab
          active={filter === "FACADE_CLEANING"}
          onClick={() => setFilter("FACADE_CLEANING")}
          count={teams.filter((team) => team.kind === "FACADE_CLEANING").length}
        >
          {t("pages.teams.kindFacade")}
        </DirectoryFilterTab>
      </div>

      {visible.length === 0 ? (
        <SectionCard>
          <EmptyState
            title={
              teams.length === 0
                ? t("pages.teams.emptyTitle")
                : t("pages.teams.emptySearch")
            }
            description={
              teams.length === 0 ? t("pages.teams.emptyDescription") : undefined
            }
          />
        </SectionCard>
      ) : (
        <DataTable
          columns={columns}
          data={visible}
          getRowKey={(team) => team.id}
        />
      )}

      <TeamFormDialog open={createOpen} onOpenChange={setCreateOpen} />
      <TeamFormDialog
        key={editTeam?.id ?? "edit-team"}
        open={Boolean(editTeam)}
        onOpenChange={(open) => {
          if (!open) setEditTeamId(null);
        }}
        team={
          editTeam
            ? { id: editTeam.id, name: editTeam.name, kind: editTeam.kind }
            : null
        }
      />
      {membersTeam ? (
        <TeamMembersDialog
          open
          onOpenChange={(open) => {
            if (!open) setMembersTeamId(null);
          }}
          teamId={membersTeam.id}
          teamName={membersTeam.name}
          members={membersTeam.members}
          eligible={eligible}
        />
      ) : null}
      {deleteTeam ? (
        <TeamDeleteDialog
          open
          onOpenChange={(open) => {
            if (!open) setDeleteTeamId(null);
          }}
          teamId={deleteTeam.id}
          teamName={deleteTeam.name}
        />
      ) : null}
    </div>
  );
}
