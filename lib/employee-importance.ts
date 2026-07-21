const RANK_KEYWORDS: ReadonlyArray<{
  rank: number;
  keywords: readonly string[];
}> = [
  {
    rank: 0,
    keywords: [
      "chief executive",
      "ceo",
      "c.e.o",
      "president",
      "founder",
      "owner",
    ],
  },
  { rank: 1, keywords: ["director"] },
  { rank: 2, keywords: ["manager", "head of"] },
  { rank: 3, keywords: ["supervisor", "coordinator", "lead"] },
  { rank: 4, keywords: ["officer", "specialist"] },
  { rank: 5, keywords: ["staff", "cleaner"] },
];

const DEFAULT_RANK = 5;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizePosition(position: string): string {
  return position.toLowerCase().replace(/\s+/g, " ").trim();
}

function matchesKeyword(normalized: string, keyword: string): boolean {
  const lowerKeyword = keyword.toLowerCase();

  if (lowerKeyword.includes(" ")) {
    return normalized.includes(lowerKeyword);
  }

  if (lowerKeyword === "ceo" || lowerKeyword === "c.e.o") {
    return (
      /\bceo\b/.test(normalized) || /\bc\.?\s*e\.?\s*o\.?\b/.test(normalized)
    );
  }

  return new RegExp(`\\b${escapeRegExp(lowerKeyword)}\\b`).test(normalized);
}

/** Lower rank = higher seniority (0 = CEO tier, 5 = Staff/default). */
export function getPositionImportanceRank(
  position: string | null | undefined
): number {
  if (!position?.trim()) {
    return DEFAULT_RANK;
  }

  const normalized = normalizePosition(position);

  for (const { rank, keywords } of RANK_KEYWORDS) {
    for (const keyword of keywords) {
      if (matchesKeyword(normalized, keyword)) {
        return rank;
      }
    }
  }

  return DEFAULT_RANK;
}

type SortableEmployee = {
  employeeNo: string;
  position: string | null;
  categoryId: string | null;
  category: { name: string } | null;
};

type CategoryLookup = {
  id: string;
  prefix: string;
  name: string;
};

function getCategorySortKey(
  employee: SortableEmployee,
  categoryById: Map<string, CategoryLookup>
): string {
  if (employee.categoryId) {
    const category = categoryById.get(employee.categoryId);
    if (category) {
      return category.prefix || category.name;
    }
  }

  return employee.category?.name ?? "";
}

export function compareEmployeesByImportance(
  a: SortableEmployee,
  b: SortableEmployee,
  categoryById: Map<string, CategoryLookup>
): number {
  const rankDiff =
    getPositionImportanceRank(a.position) -
    getPositionImportanceRank(b.position);
  if (rankDiff !== 0) {
    return rankDiff;
  }

  const categoryDiff = getCategorySortKey(a, categoryById).localeCompare(
    getCategorySortKey(b, categoryById),
    undefined,
    { sensitivity: "base" }
  );
  if (categoryDiff !== 0) {
    return categoryDiff;
  }

  return a.employeeNo.localeCompare(b.employeeNo, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export function sortEmployeesByImportance<T extends SortableEmployee>(
  employees: T[],
  categories: CategoryLookup[]
): T[] {
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  return [...employees].sort((a, b) =>
    compareEmployeesByImportance(a, b, categoryById)
  );
}
