"use client";

import { useState } from "react";

import ProofLightbox from "@/components/ui/ProofLightbox";
import { formatDisplayDate } from "@/lib/format-date";
import { useT } from "@/lib/i18n/use-t";

export type ContractExtensionRow = {
  id: string;
  extendedOn: string;
  previousEndDate: string;
  newEndDate: string;
  proofUrl: string;
  notes: string | null;
};

type Props = {
  extensions: ContractExtensionRow[];
  /** Optional heading override; defaults to pages.projects.extendHistory. */
  title?: string;
  className?: string;
};

/**
 * Read-only Contract Extensions history (no Extended By).
 * Used on project detail and billing project panel.
 */
export default function ContractExtensionsHistory({
  extensions,
  title,
  className,
}: Props) {
  const { t } = useT();
  const [proofSrc, setProofSrc] = useState<string | null>(null);
  const heading = title ?? t("pages.projects.extendHistory");

  return (
    <div className={className}>
      <h3 className="mb-3 text-base font-semibold tracking-tight text-text">
        {heading}
      </h3>

      {extensions.length === 0 ? (
        <p className="text-sm text-subtle">
          {t("pages.projects.extendHistoryEmpty")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-[0.12em] text-subtle">
                <th className="px-3 py-3 font-semibold">
                  {t("pages.projects.extendHistoryExtendedOn")}
                </th>
                <th className="px-3 py-3 font-semibold">
                  {t("pages.projects.extendHistoryPreviousEnd")}
                </th>
                <th className="px-3 py-3 font-semibold">
                  {t("pages.projects.extendHistoryNewEnd")}
                </th>
                <th className="px-3 py-3 font-semibold">
                  {t("pages.projects.extendHistoryProof")}
                </th>
                <th className="px-3 py-3 font-semibold">
                  {t("pages.projects.extendHistoryNotes")}
                </th>
              </tr>
            </thead>
            <tbody>
              {extensions.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-3 py-3.5 text-text">
                    {formatDisplayDate(row.extendedOn)}
                  </td>
                  <td className="px-3 py-3.5 text-text">
                    {formatDisplayDate(row.previousEndDate)}
                  </td>
                  <td className="px-3 py-3.5 font-medium text-text">
                    {formatDisplayDate(row.newEndDate)}
                  </td>
                  <td className="px-3 py-3.5">
                    {row.proofUrl ? (
                      <button
                        type="button"
                        onClick={() => setProofSrc(row.proofUrl)}
                        className="text-cyan-400 hover:underline"
                      >
                        {t("common.actions.view")}
                      </button>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3.5 text-muted">
                    {row.notes?.trim() ? row.notes : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ProofLightbox
        open={proofSrc != null}
        onOpenChange={(open) => {
          if (!open) setProofSrc(null);
        }}
        src={proofSrc}
        title={t("pages.projects.extendHistoryProof")}
      />
    </div>
  );
}
