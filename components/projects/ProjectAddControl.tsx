"use client";

import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";

import {
  confirmBulkImportProjects,
  previewBulkImportProjects,
} from "@/app/projects/import-actions";
import BulkImportDialog from "@/components/bulk-import/BulkImportDialog";
import ProjectDialog from "@/components/projects/ProjectDialog";
import type { ProjectStaffEmployee } from "@/components/projects/ProjectStaffPicker";
import DirectoryAddButton from "@/components/ui/DirectoryAddButton";
import { useT } from "@/lib/i18n/use-t";

type ClientOption = {
  id: string;
  name: string;
  npwp?: string | null;
};

type Props = {
  employees: ProjectStaffEmployee[];
  clients: ClientOption[];
};

const PROJECT_TEMPLATE_URL = "/api/projects/bulk-template";

/**
 * Top-right Add Project / Add Bulk chips + dialogs
 * (Clients/Employees directory pattern).
 */
export default function ProjectAddControl({ employees, clients }: Props) {
  const { t } = useT();
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);

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
          icon={<FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />}
          onClick={() => setBulkImportOpen(true)}
        />
      </div>

      <ProjectDialog
        employees={employees}
        clients={clients}
        open={createOpen}
        onOpenChange={setCreateOpen}
        showTrigger={false}
      />

      <BulkImportDialog
        open={bulkImportOpen}
        onOpenChange={setBulkImportOpen}
        entityLabel="project"
        templateUrl={PROJECT_TEMPLATE_URL}
        onPreview={previewBulkImportProjects}
        onConfirm={confirmBulkImportProjects}
      />
    </>
  );
}
