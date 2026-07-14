"use client";

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
  return (
    <div className="overflow-hidden rounded-3xl border border-white/5 bg-[#151b22]">
      <table className="min-w-full">
        <thead className="border-b border-white/5 bg-[#1a2129]">
          <tr>
            <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Department
            </th>

            <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Code
            </th>

            <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Employees
            </th>

            <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Status
            </th>
          </tr>
        </thead>

        <tbody>
          {departments.length === 0 ? (
            <tr>
              <td
                colSpan={4}
                className="px-6 py-16 text-center text-slate-500"
              >
                No departments found.
              </td>
            </tr>
          ) : (
            departments.map((department) => (
              <tr
                key={department.id}
                className="border-b border-white/5 transition hover:bg-white/[0.03]"
              >
                <td className="px-6 py-5">
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
                </td>

                <td className="px-6 py-5 text-slate-300">
                  {department.code}
                </td>

                <td className="px-6 py-5 text-slate-300">
                  {department._count.employees}
                </td>

                <td className="px-6 py-5">
                  <StatusBadge
                    status={
                      department.active
                        ? "active"
                        : "inactive"
                    }
                  />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}