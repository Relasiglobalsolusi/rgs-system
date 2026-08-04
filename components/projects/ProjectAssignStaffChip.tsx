"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import type {
  BillingMode,
  BillingPeriodBasis,
  ProjectStatus,
} from "@prisma/client";

import { Button } from "@/components/ui/button";
import type { ProjectSubCategory } from "@/lib/project-subcategory";
import type { ProjectServiceAreaValue } from "@/lib/service-area";
import type { ProjectStaffEmployee } from "@/components/projects/ProjectStaffPicker";
import ProjectEditDialog from "@/components/projects/ProjectEditDialog";
import { useT } from "@/lib/i18n/use-t";

type Props = {
  project: {
    id: string;
    name: string;
    location: string | null;
    latitude: number | null;
    longitude: number | null;
    locationRadiusMeters: number | null;
    estimatedStartDate?: Date | null;
    estimatedDurationDays?: number | null;
    startDate: Date | null;
    endDate: Date | null;
    progress: number;
    subCategory: ProjectSubCategory;
    serviceArea?: ProjectServiceAreaValue;
    billingMode: BillingMode;
    billingPeriodBasis?: BillingPeriodBasis | null;
    requiresTaxInvoice: boolean;
    contractPrice?: number | null;
    setupCost?: number | null;
    profitSharePercent?: number | null;
    monthlyClientFee?: number | null;
    serviceFeePercent?: number | null;
    paymentTermsDays?: number | null;
    clientId: string | null;
    status?: ProjectStatus | string;
    assignments: { employeeId: string }[];
  };
  employees: ProjectStaffEmployee[];
  clients: {
    id: string;
    name: string;
    npwp: string | null;
    paymentTermsDays?: number | null;
  }[];
};

export default function ProjectAssignStaffChip({
  project,
  employees,
  clients,
}: Props) {
  const { t } = useT();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="successBadge"
        size="badgeFlex"
        onClick={() => setOpen(true)}
      >
        <Users />
        {t("pages.projects.assignStaff")}
      </Button>
      <ProjectEditDialog
        project={project}
        employees={employees}
        clients={clients}
        showTrigger={false}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
