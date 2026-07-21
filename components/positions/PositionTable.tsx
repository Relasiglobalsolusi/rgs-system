"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BriefcaseBusiness } from "lucide-react";
import { toast } from "sonner";
import { reorderPositions } from "@/app/positions/actions";
import PositionDialog from "@/components/positions/PositionDialog";
import PositionEditDialog, { type PositionRow } from "@/components/positions/PositionEditDialog";
import type { EmployeeCategoryOption } from "@/components/employees/EmployeeFormFields";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";

export default function PositionTable({ positions, categories }: { positions: PositionRow[]; categories: EmployeeCategoryOption[] }) {
  const router = useRouter(); const [, startTransition] = useTransition(); const [editPosition, setEditPosition] = useState<PositionRow | null>(null);
  function refresh() { router.refresh(); }
  function reorder(ids: string[]) { startTransition(async () => { try { await reorderPositions(ids); refresh(); } catch (error) { toast.error(error instanceof Error ? error.message : "Failed to reorder positions."); refresh(); } }); }
  const columns: DataTableColumn<PositionRow>[] = [
    { key: "name", title: "Position", share: 2, render: (position) => <p className="font-semibold text-text">{position.name}</p> },
    { key: "department", title: "Department", render: (position) => <span className="text-muted">{position.category.name} ({position.category.prefix})</span> },
    { key: "description", title: "Description", share: 2, render: (position) => <span className="text-muted">{position.description || "—"}</span> },
    { key: "employees", title: "Employees", render: (position) => <span className="text-muted">{position._count.employees}</span> },
    { key: "status", title: "Status", render: (position) => <StatusBadge status={position.active ? "active" : "inactive"} /> },
  ];
  return <div className="space-y-4"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-sm text-subtle"><BriefcaseBusiness className="h-4 w-4 text-cyan-400" />{positions.length} position{positions.length === 1 ? "" : "s"}</div><PositionDialog categories={categories} onCreated={refresh} /></div><DataTable columns={columns} data={positions} getRowKey={(position) => position.id} onRowClick={setEditPosition} reorderable onReorder={reorder} emptyMessage="No positions configured." />{editPosition ? <PositionEditDialog position={editPosition} otherPositions={positions.filter((position) => position.id !== editPosition.id)} open onOpenChange={(open) => !open && setEditPosition(null)} onUpdated={refresh} /> : null}</div>;
}
