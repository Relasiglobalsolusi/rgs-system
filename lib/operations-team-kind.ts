/** Client-safe team type helpers. Do not import server modules here. */

export const OPERATIONS_TEAM_KINDS = [
  "GENERAL_CLEANING",
  "FACADE_CLEANING",
  "LANDSCAPING",
] as const;

export type OperationsTeamKindValue = (typeof OPERATIONS_TEAM_KINDS)[number];

export function isOperationsTeamKind(
  value: string | null | undefined
): value is OperationsTeamKindValue {
  return OPERATIONS_TEAM_KINDS.includes(value as OperationsTeamKindValue);
}

/** Legacy enum for Cleaning / Landscaping catalog rows. Custom areas have no kind. */
export function legacyKindForCatalogArea(area: {
  systemArea?: string | null;
  slug?: string | null;
}): OperationsTeamKindValue | null {
  if (area.systemArea === "LANDSCAPING" || area.slug === "LANDSCAPING") {
    return "LANDSCAPING";
  }
  if (area.systemArea === "CLEANING" || area.slug === "CLEANING") {
    return "GENERAL_CLEANING";
  }
  return null;
}

/** Legacy kind that used to gate one-time General / Facade / Landscaping jobs. */
export function operationsTeamKindForSubCategory(
  subCategory: string | null | undefined
): OperationsTeamKindValue | null {
  if (subCategory === "GENERAL_CLEANING") return "GENERAL_CLEANING";
  if (subCategory === "FACADE_CLEANING") return "FACADE_CLEANING";
  if (subCategory === "ONE_TIME_LANDSCAPING") return "LANDSCAPING";
  return null;
}

export function teamKindMatchesProjectSubCategory(
  kind: string | null | undefined,
  subCategory: string | null | undefined
): boolean {
  const expected = operationsTeamKindForSubCategory(subCategory);
  return expected != null && kind === expected;
}

export type TeamAreaMatchInput = {
  serviceAreaCatalogId?: string | null;
  catalogSystemArea?: string | null;
  kind?: string | null;
};

export type ProjectAreaMatchInput = {
  areaCatalogId?: string | null;
  serviceArea?: string | null;
  subCategory?: string | null;
};

/** A team belongs to one catalog service area and may be assigned to that area's projects. */
export function teamMatchesProjectServiceArea(
  team: TeamAreaMatchInput,
  project: ProjectAreaMatchInput
): boolean {
  if (team.serviceAreaCatalogId && project.areaCatalogId) {
    return team.serviceAreaCatalogId === project.areaCatalogId;
  }
  if (
    team.catalogSystemArea &&
    team.catalogSystemArea !== "OTHER" &&
    project.serviceArea &&
    team.catalogSystemArea === project.serviceArea
  ) {
    return true;
  }
  return teamKindMatchesProjectSubCategory(team.kind, project.subCategory);
}

export function teamsForProjectServiceArea<T extends TeamAreaMatchInput>(
  teams: T[],
  project: ProjectAreaMatchInput
): T[] {
  return teams.filter((team) => teamMatchesProjectServiceArea(team, project));
}
