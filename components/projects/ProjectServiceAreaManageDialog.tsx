"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Layers, Tags } from "lucide-react";

import {
  EmployeeDialogShell,
  EmployeeSecondaryButton,
} from "@/components/employees/employee-dialog-ui";
import ProjectServiceAreaTable from "@/components/projects/ProjectServiceAreaTable";
import DirectoryAddButton from "@/components/ui/DirectoryAddButton";
import { Dialog } from "@/components/ui/dialog";
import { useT } from "@/lib/i18n/use-t";
import {
  catalogDisplayName,
  type ProjectCatalogAreaDTO,
} from "@/lib/project-service-catalog";

export default function ProjectServiceAreaManageDialog({
  catalog,
}: {
  catalog: ProjectCatalogAreaDTO[];
}) {
  const [open, setOpen] = useState(false);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const router = useRouter();
  const { t, locale } = useT();

  const selectedArea = useMemo(
    () => catalog.find((area) => area.id === selectedAreaId) ?? null,
    [catalog, selectedAreaId]
  );

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setSelectedAreaId(null);
      router.refresh();
    }
  }

  return (
    <>
      <DirectoryAddButton
        label={t("pages.projects.manageServiceAreas")}
        variant="warningBadge"
        icon={<Layers className="h-3.5 w-3.5 shrink-0" />}
        onClick={() => setOpen(true)}
        className="text-xs tracking-[0.06em]"
      />
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <EmployeeDialogShell
          icon={selectedArea ? Tags : Layers}
          title={
            selectedArea
              ? catalogDisplayName(selectedArea, locale)
              : t("pages.projects.manageServiceAreasTitle")
          }
          description={
            selectedArea
              ? t("pages.projects.manageSubcategoriesDescription")
              : t("pages.projects.manageServiceAreasDescription")
          }
          maxWidth="lg"
          footer={
            <EmployeeSecondaryButton onClick={() => setOpen(false)}>
              {t("common.actions.close")}
            </EmployeeSecondaryButton>
          }
        >
          <ProjectServiceAreaTable
            catalog={catalog}
            selectedAreaId={selectedAreaId}
            onSelectedAreaIdChange={setSelectedAreaId}
          />
        </EmployeeDialogShell>
      </Dialog>
    </>
  );
}
