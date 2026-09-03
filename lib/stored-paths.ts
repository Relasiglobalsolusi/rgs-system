export function parseStoredPaths(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];
  const trimmed = value.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (item): item is string =>
            typeof item === "string" && item.trim().length > 0
        );
      }
    } catch {
      return [trimmed];
    }
  }
  return [trimmed];
}

export function firstStoredPath(
  value: string | null | undefined
): string | null {
  return parseStoredPaths(value)[0] ?? null;
}

export function serializeStoredPaths(paths: string[]): string | null {
  const clean = paths.map((path) => path.trim()).filter(Boolean);
  if (clean.length === 0) return null;
  if (clean.length === 1) return clean[0];
  return JSON.stringify(clean);
}

export function formFiles(formData: FormData, name: string): File[] {
  return formData
    .getAll(name)
    .filter((value): value is File => value instanceof File && value.size > 0);
}

export function hasFormFiles(formData: FormData, name: string): boolean {
  return formFiles(formData, name).length > 0;
}
