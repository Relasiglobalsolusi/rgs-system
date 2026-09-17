import type { ServiceArea } from "@prisma/client";

import type { AppLocale } from "@/lib/i18n/locale";
import { catalogDisplayName } from "@/lib/project-service-catalog";
import { serviceAreaLabel } from "@/lib/service-area";

export const materialRequestProjectSelect = {
  id: true,
  name: true,
  location: true,
  serviceArea: true,
  client: { select: { name: true } },
  areaCatalog: { select: { nameEn: true, nameId: true } },
  subcategoryCatalog: { select: { nameEn: true, nameId: true } },
} as const;

type MaterialRequestProjectRow = {
  id: string;
  name: string;
  location: string | null;
  serviceArea: ServiceArea;
  client: { name: string } | null;
  areaCatalog: { nameEn: string; nameId: string } | null;
  subcategoryCatalog: { nameEn: string; nameId: string } | null;
};

export function toMaterialRequestProjectView(
  project: MaterialRequestProjectRow,
  locale: AppLocale
) {
  return {
    id: project.id,
    name: project.name,
    location: project.location,
    clientName: project.client?.name ?? null,
    serviceAreaName: project.areaCatalog
      ? catalogDisplayName(project.areaCatalog, locale)
      : serviceAreaLabel(project.serviceArea),
    subcategoryName: project.subcategoryCatalog
      ? catalogDisplayName(project.subcategoryCatalog, locale)
      : null,
  };
}
