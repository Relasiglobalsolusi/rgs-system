import { ensureProjectServiceCatalog } from "@/app/projects/catalog-actions";
import type { ProjectCatalogAreaDTO } from "@/lib/project-service-catalog";
import { prisma } from "@/lib/prisma";

/** Seed the project catalog and attach legacy teams (kind-only) to the matching area. */
export async function ensureTeamServiceAreas(
  companyId: string
): Promise<ProjectCatalogAreaDTO[]> {
  const catalog = await ensureProjectServiceCatalog(companyId);
  if (catalog.length === 0) return catalog;

  const cleaning = catalog.find(
    (area) => area.slug === "CLEANING" || area.systemArea === "CLEANING"
  );
  const landscaping = catalog.find(
    (area) => area.slug === "LANDSCAPING" || area.systemArea === "LANDSCAPING"
  );

  if (cleaning) {
    await prisma.operationsTeam.updateMany({
      where: {
        companyId,
        serviceAreaCatalogId: null,
        kind: { in: ["GENERAL_CLEANING", "FACADE_CLEANING"] },
      },
      data: { serviceAreaCatalogId: cleaning.id },
    });
  }
  if (landscaping) {
    await prisma.operationsTeam.updateMany({
      where: {
        companyId,
        serviceAreaCatalogId: null,
        kind: "LANDSCAPING",
      },
      data: { serviceAreaCatalogId: landscaping.id },
    });
  }

  return catalog;
}
