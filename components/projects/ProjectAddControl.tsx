"use client";

import { useState } from "react";
import { ListPlus } from "lucide-react";

import ProjectBulkCreateDialog from "@/components/projects/ProjectBulkCreateDialog";
import ProjectDialog from "@/components/projects/ProjectDialog";
import type { ProjectStaffEmployee } from "@/components/projects/ProjectStaffPicker";
import type { ProjectTeamOption } from "@/components/projects/ProjectTeamPicker";
import DirectoryAddButton from "@/components/ui/DirectoryAddButton";
import { useT } from "@/lib/i18n/use-t";
import type { CompanyBankAccountOption } from "@/lib/company-bank-accounts";
import type { ProjectCatalogAreaDTO } from "@/lib/project-service-catalog";

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
  catalog?: ProjectCatalogAreaDTO[];
  bankAccounts?: CompanyBankAccountOption[];
  showCatchUpIntake?: boolean;
};

/**
 * Top-right Add Project / Add Bulk chips + dialogs
 * (Clients/Vendors directory pattern).
 */
export default function ProjectAddControl({
  employees,
  teams = [],
  clients,
  catalog = [],
  bankAccounts = [],
  showCatchUpIntake = true,
}: Props) {
  const { t } = useT();
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkCreateOpen, setBulkCreateOpen] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-4">
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
        catalog={catalog}
        bankAccounts={bankAccounts}
        showCatchUpIntake={showCatchUpIntake}
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
        catalog={catalog}
        bankAccounts={bankAccounts}
        showCatchUpIntake={showCatchUpIntake}
      />
    </>
  );
}
