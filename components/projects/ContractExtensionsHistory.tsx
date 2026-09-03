"use client";

import { ChipCell } from "@/components/ui/DataTable";
import UploadedFilesLink from "@/components/ui/UploadedFilesLink";
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
                <th className="px-3 py-3 text-left font-semibold">
                  {t("pages.projects.extendHistoryExtendedOn")}
                </th>
                <th className="px-3 py-3 font-semibold">
                  {t("pages.projects.extendHistoryPreviousEnd")}
                </th>
                <th className="px-3 py-3 font-semibold">
                  {t("pages.projects.extendHistoryNewEnd")}
                </th>
                <th className="px-3 py-3 text-center font-semibold">
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
                    <ChipCell>
                      {row.proofUrl ? (
                        <UploadedFilesLink value={row.proofUrl} />
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </ChipCell>
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

    </div>
  );
}
