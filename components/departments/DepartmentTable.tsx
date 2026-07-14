"use client";

import DataTable, {
  DataTableColumn,
} from "@/components/ui/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";

type Department = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  active: boolean;
  _count: {
    employees: number;
  };
};

type Props = {
  departments: Department[];
};

export default function DepartmentTable({
  departments,
}: Props) {
  const columns: DataTableColumn<Department>[] = [
    {
      key: "name",
      title: "Department",
      render: (department) => (
        <div>
          <p className="font-semibold text-white">
            {department.name}
          </p>

          {department.description && (
            <p className="mt-1 text-sm text-slate-500">
              {department.description}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "code",
      title: "Code",
    },
    {
      key: "employees",
      title: "Employees",
      render: (department) => (
        <span className="text-slate-300">
          {department._count.employees}
        </span>
      ),
    },
    {
      key: "status",
      title: "Status",
      render: (department) => (
        <StatusBadge
          status={
            department.active
              ? "active"
              : "inactive"
          }
        />
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={departments}
      emptyMessage="No departments found."
    />
  );
}