"use client";

import { parseStoredPaths } from "@/lib/stored-paths";
import { useT } from "@/lib/i18n/use-t";

export default function UploadedFilesLink({
  value,
  label,
}: {
  value: string | null | undefined;
  label?: string;
}) {
  const { t } = useT();
  const paths = parseStoredPaths(value);
  if (paths.length === 0) return null;
  const text =
    label ??
    (paths.length === 1
      ? t("common.labels.filesUploadedOne")
      : t("common.labels.filesUploadedOther", { count: paths.length }));
  if (paths.length === 1) {
    return (
      <a
        href={paths[0]}
        target="_blank"
        rel="noreferrer"
        className="inline-block text-xs font-medium text-primary-dark underline-offset-2 hover:underline"
      >
        {text}
      </a>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-primary-dark">
      <span>{text}</span>
      {paths.map((href, index) => (
        <a
          key={`${href}-${index}`}
          href={href}
          target="_blank"
          rel="noreferrer"
          className="underline-offset-2 hover:underline"
        >
          {t("common.labels.uploadedFileN", { n: index + 1 })}
        </a>
      ))}
    </span>
  );
}
