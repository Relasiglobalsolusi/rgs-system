import { Children, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Row sizes that always fill the page width. Never leaves a leftover
 * single card sitting in the first column of a wider row.
 */
function planDirectoryStatRows(count: number): number[] {
  if (count <= 0) return [];
  if (count <= 4) return [count];
  if (count === 5) return [2, 3];
  if (count === 6) return [6];
  if (count === 8) return [4, 4];
  if (count === 13) return [2, 3, 3, 3, 2];
  if (count % 3 === 0) return Array(count / 3).fill(3);
  if (count % 4 === 0) return Array(count / 4).fill(4);
  if (count % 3 === 1) return [4, ...Array((count - 4) / 3).fill(3)];
  return [2, ...Array((count - 2) / 3).fill(3)];
}

const colsClass: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-3",
  4: "grid-cols-2 xl:grid-cols-4",
  6: "grid-cols-2 md:grid-cols-3 xl:grid-cols-6",
};

type Props = {
  children: ReactNode;
  className?: string;
  gapClassName?: string;
};

export default function DirectoryStatGrid({
  children,
  className,
  gapClassName = "gap-3",
}: Props) {
  const items = Children.toArray(children).filter(Boolean);
  const rows = planDirectoryStatRows(items.length);
  let offset = 0;

  return (
    <div className={cn(items.length > 0 && "space-y-2", className)}>
      {rows.map((size, index) => {
        const slice = items.slice(offset, offset + size);
        offset += size;
        return (
          <div
            key={index}
            className={cn(
              "grid items-stretch",
              gapClassName,
              colsClass[size] ?? "grid-cols-1"
            )}
          >
            {slice}
          </div>
        );
      })}
    </div>
  );
}
