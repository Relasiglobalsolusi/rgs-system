import { prisma } from "@/lib/prisma";

import AppShell from "@/components/layout/AppShell";
import SectionCard from "@/components/ui/SectionCard";
import EmptyState from "@/components/ui/EmptyState";
import DepartmentTable from "@/components/departments/DepartmentTable";
import DepartmentDialog from "@/components/departments/DepartmentDialog";

export default async function DepartmentsPage() {
  const company = await prisma.company.findFirst();

  if (!company) {
    return (
      <AppShell
        title="Departments"
        description="Manage departments across your organization."
      >
        <SectionCard>
          <p className="text-white">
            Company not found.
          </p>
        </SectionCard>
      </AppShell>
    );
  }

  const departments = await prisma.department.findMany({
    where: {
      companyId: company.id,
    },
    include: {
      _count: {
        select: {
          employees: true,
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  return (
    <AppShell
      title="Departments"
      description="Manage departments across your organization."
    >
      <div className="mb-6 flex justify-end">
        <DepartmentDialog />
      </div>

      <SectionCard>
        {departments.length === 0 ? (
          <EmptyState
            title="No departments yet"
            description="Create your first department to start organizing employees."
          />
        ) : (
          <DepartmentTable departments={departments} />
        )}
      </SectionCard>
    </AppShell>
  );
}