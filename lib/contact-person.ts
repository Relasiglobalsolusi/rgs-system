/** Build "First Last" display name from contact person fields. */
export function formatContactPersonName(
  firstName: string | null | undefined,
  lastName: string | null | undefined
): string | null {
  const first = firstName?.trim() ?? "";
  const last = lastName?.trim() ?? "";
  const full = `${first} ${last}`.trim();
  return full || null;
}

/**
 * Resolve contact person first/last for portal username generation.
 * Prefer explicit first/last fields. If last is empty and first contains
 * spaces (legacy single-field contact name), first token = first name and
 * last token = last name (for the collision initial).
 *
 * Never use company/client organization name here.
 */
export function resolveContactPersonNameParts(
  contactPersonFirstName: string,
  contactPersonLastName?: string | null
): { firstName: string; lastName: string | null } {
  const firstRaw = contactPersonFirstName.trim();
  const lastRaw = contactPersonLastName?.trim() ?? "";

  if (lastRaw) {
    return { firstName: firstRaw, lastName: lastRaw };
  }

  const parts = firstRaw.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return {
      firstName: parts[0]!,
      lastName: parts[parts.length - 1]!,
    };
  }

  return { firstName: firstRaw, lastName: null };
}

function normalizeNamePart(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/**
 * True when resolved contact-person name parts differ (case-insensitive).
 * Used to decide whether a client portal login must be reset on edit.
 */
export function contactPersonNamePartsChanged(
  previous: {
    firstName: string | null | undefined;
    lastName?: string | null | undefined;
  },
  next: {
    firstName: string | null | undefined;
    lastName?: string | null | undefined;
  }
): boolean {
  const prevParts = resolveContactPersonNameParts(
    previous.firstName ?? "",
    previous.lastName
  );
  const nextParts = resolveContactPersonNameParts(
    next.firstName ?? "",
    next.lastName
  );

  return (
    normalizeNamePart(prevParts.firstName) !==
      normalizeNamePart(nextParts.firstName) ||
    normalizeNamePart(prevParts.lastName) !==
      normalizeNamePart(nextParts.lastName)
  );
}
