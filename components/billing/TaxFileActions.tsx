"use client";

import { useState } from "react";
import { Download, Eye, Upload } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import ProofLightbox from "@/components/ui/ProofLightbox";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

export type TaxFileSlot = {
  id: string;
  title: string;
  hint?: string;
  href: string | null;
  canUpload?: boolean;
};

function downloadName(href: string): string {
  const path = href.split("?")[0] ?? href;
  return path.split("/").filter(Boolean).pop() || "tax-document";
}

type Props = {
  files: TaxFileSlot[];
  onUpload?: (file: TaxFileSlot) => void;
};

export default function TaxFileActions({
  files,
  onUpload,
}: Props) {
  const { t } = useT();
  const [lightbox, setLightbox] = useState<{ src: string; title: string } | null>(
    null
  );

  return (
    <>
      <div className="space-y-3">
        {files.map((file) => (
          <div
            key={file.id}
            className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-elevated px-4 py-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text">{file.title}</p>
              {file.hint ? (
                <p className="mt-1 text-xs leading-snug text-subtle">
                  {file.hint}
                </p>
              ) : null}
              {!file.href ? (
                <p className="mt-1 text-xs text-muted">
                  {t("pages.vat.taxDocumentMissing")}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {file.href ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5"
                    onClick={() =>
                      setLightbox({ src: file.href!, title: file.title })
                    }
                  >
                    <Eye className="h-3.5 w-3.5" aria-hidden />
                    {t("common.actions.view")}
                  </Button>
                  <a
                    href={file.href}
                    download={downloadName(file.href)}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "h-8 gap-1.5"
                    )}
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden />
                    {t("common.actions.download")}
                  </a>
                </>
              ) : file.canUpload && onUpload ? (
                <Button
                  type="button"
                  variant="accent"
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={() => onUpload(file)}
                >
                  <Upload className="h-3.5 w-3.5" aria-hidden />
                  {t("common.actions.upload")}
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      <ProofLightbox
        open={Boolean(lightbox)}
        onOpenChange={(open) => {
          if (!open) setLightbox(null);
        }}
        src={lightbox?.src ?? null}
        title={lightbox?.title}
      />
    </>
  );
}
