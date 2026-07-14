import { prisma } from "@/lib/prisma";

import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import DepartmentTable from "@/components/departments/DepartmentTable";

export default async function DepartmentsPage() {
  const company = await prisma.company.findFirst();

  if (!company) {
    return (
      <div className="p-8 text-white">
        Company not found.
      </div>
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
    <div className="space-y-8">
      <PageHeader
        title="Departments"
        description="Manage company departments and organizational structure."
      />

      <SectionCard>
        <DepartmentTable
          departments={departments}
        />
      </SectionCard>
    </div>
  );
}