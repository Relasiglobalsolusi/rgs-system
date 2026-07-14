import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { ReactNode } from "react";

export type DataTableColumn<T> = {
  key: keyof T | string;
  title: string;
  render?: (row: T) => ReactNode;
  className?: string;
};

type Props<T> = {
  columns: DataTableColumn<T>[];
  data: T[];
  emptyMessage?: string;
};

export default function DataTable<T>({
  columns,
  data,
  emptyMessage = "No records found.",
}: Props<T>) {
  return (
    <div className="overflow-hidden rounded-3xl border border-white/5 bg-[#151b22]">
      <Table>
        <TableHeader className="bg-[#1a2129]">
          <TableRow className="border-white/5 hover:bg-transparent">
            {columns.map((column) => (
              <TableHead
                key={String(column.key)}
                className={`py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 ${column.className ?? ""}`}
              >
                {column.title}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {data.length === 0 ? (
            <TableRow className="border-white/5">
              <TableCell
                colSpan={columns.length}
                className="h-40 text-center text-slate-500"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            data.map((row, index) => (
              <TableRow
                key={index}
                className="border-white/5 transition hover:bg-white/[0.03]"
              >
                {columns.map((column) => (
                  <TableCell
                    key={String(column.key)}
                    className={column.className}
                  >
                    {column.render
                      ? column.render(row)
                      : String(
                          row[column.key as keyof T] ?? ""
                        )}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}