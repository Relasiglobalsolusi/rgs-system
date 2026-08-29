"use client";

import { useRouter } from "next/navigation";

import SearchableClientSelect from "@/components/ui/SearchableClientSelect";
import { buildProjectsHref } from "@/lib/project-directory-href";
import { useT } from "@/lib/i18n/use-t";

const ALL_CLIENTS = "all";

type Props = {
  clients: Array<{ id: string; name: string }>;
  selectedClientId?: string;
  view?: string;
  area?: string;
  sub?: string;
};

export default function ProjectsClientFilter({
  clients,
  selectedClientId,
  view,
  area,
  sub,
}: Props) {
  const { t } = useT();
  const router = useRouter();

  return (
    <div className="grid min-w-0 w-full max-w-xl gap-1.5 sm:min-w-[16rem]">
      <span className="text-xs font-semibold uppercase tracking-wide text-subtle">
        {t("pages.projects.filterClient")}
      </span>
      <SearchableClientSelect
        value={selectedClientId || ALL_CLIENTS}
        onValueChange={(value) => {
          const next = !value || value === ALL_CLIENTS ? undefined : value;
          router.push(
            buildProjectsHref({
              clientId: next,
              view,
              area,
              sub,
            })
          );
        }}
        clients={[
          { id: ALL_CLIENTS, name: t("pages.projects.filterAllClients") },
          ...clients,
        ]}
        placeholder={t("pages.projects.filterAllClients")}
      />
    </div>
  );
}
