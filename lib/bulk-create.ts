export const MAX_BULK_CREATE_LINES = 50;

export function bulkLineField(index: number, field: string) {
  return `line.${index}.${field}`;
}

export function createBulkLineKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function parseBulkLineCount(formData: FormData): number {
  const raw = Number(formData.get("lineCount"));
  if (!Number.isInteger(raw) || raw < 1 || raw > MAX_BULK_CREATE_LINES) {
    throw new Error(`Add between 1 and ${MAX_BULK_CREATE_LINES} lines.`);
  }
  return raw;
}

export function bulkLineValue(
  formData: FormData,
  index: number,
  field: string
): string {
  return String(formData.get(bulkLineField(index, field)) ?? "").trim();
}

export function bulkLineFile(
  formData: FormData,
  index: number,
  field: string
): File | null {
  const file = formData.get(bulkLineField(index, field));
  if (file instanceof File && file.size > 0) {
    return file;
  }
  return null;
}

export function lineFormData(
  formData: FormData,
  index: number,
  fields: string[]
): FormData {
  const row = new FormData();
  for (const field of fields) {
    const value = formData.get(bulkLineField(index, field));
    if (value != null) {
      row.set(field, value);
    }
  }
  return row;
}

/** Copy every `line.{index}.*` field (including files and repeats) onto a row FormData. */
export function lineFormDataFromPrefix(
  formData: FormData,
  index: number
): FormData {
  const prefix = `${bulkLineField(index, "")}`;
  const row = new FormData();
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith(prefix)) continue;
    row.append(key.slice(prefix.length), value);
  }
  return row;
}
