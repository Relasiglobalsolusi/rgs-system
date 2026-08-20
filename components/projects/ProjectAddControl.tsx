"use client";

import { useState } from "react";
import { ListPlus } from "lucide-react";

import ProjectBulkCreateDialog from "@/components/projects/ProjectBulkCreateDialog";
import ProjectDialog from "@/components/projects/ProjectDialog";
import type { ProjectStaffEmployee } from "@/components/projects/ProjectStaffPicker";
import type { ProjectTeamOption } from "@/components/projects/ProjectTeamPicker";
import DirectoryAddButton from "@/components/ui/DirectoryAddButton";
import { useT } from "@/lib/i18n/use-t";

type ClientOption = {
  id: string;
  name: string;
  npwp?: string | null;
  paymentTermsDays?: number | null;
};

type Props = {
  employees: ProjectStaffEmployee[];
  teams?: ProjectTeamOption[];
  clients: ClientOption[];
};

/**
 * Top-right Add Project / Add Bulk chips + dialogs
 * (Clients/Vendors directory pattern).
 */
export default function ProjectAddControl({
  employees,
  teams = [],
  clients,
}: Props) {
  const { t } = useT();
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkCreateOpen, setBulkCreateOpen] = useState(false);

  return (
    <>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        <DirectoryAddButton
          label={t("pages.projects.addProject")}
          onClick={() => setCreateOpen(true)}
        />
        <DirectoryAddButton
          label={t("common.actions.addBulk")}
          variant="infoBadge"
          icon={<ListPlus className="h-3.5 w-3.5 shrink-0" />}
          onClick={() => setBulkCreateOpen(true)}
        />
      </div>

      <ProjectDialog
        employees={employees}
        teams={teams}
        clients={clients}
        open={createOpen}
        onOpenChange={setCreateOpen}
        showTrigger={false}
      />

      <ProjectBulkCreateDialog
        open={bulkCreateOpen}
        onOpenChange={setBulkCreateOpen}
        employees={employees}
        teams={teams}
        clients={clients}
      />
    </>
  );
}
