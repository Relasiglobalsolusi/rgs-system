import { Download, FileText } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { chipScrollRowClassName } from "@/components/ui/chip-scroll-row";
import { cn } from "@/lib/utils";

export type PageDocumentAction = {
  href: string;
  label: string;
  icon?: "download" | "file";
};

/** Ready document chips for the top-right of a long detail page. */
export function PageDocumentActions({
  documents,
  className,
}: {
  documents: PageDocumentAction[];
  className?: string;
}) {
  if (documents.length === 0) return null;

  return (
    <div
      className={cn(
        "ml-auto min-w-0",
        chipScrollRowClassName("justify-end"),
        className
      )}
    >
      {documents.map((doc) => (
        <a
          key={`${doc.href}-${doc.label}`}
          href={doc.href}
          target="_blank"
          rel="noreferrer"
          className={buttonVariants({
            variant:
              doc.icon === "download" ? "permissionsBadge" : "infoBadge",
            size: "badgeFlex",
          })}
        >
          {doc.icon === "download" ? (
            <Download className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <FileText className="h-3.5 w-3.5 shrink-0" />
          )}
          {doc.label}
        </a>
      ))}
    </div>
  );
}
