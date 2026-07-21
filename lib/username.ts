export function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

export function isValidUsername(username: string) {
  const normalized = normalizeUsername(username);
  return /^[a-z0-9._-]{3,32}$/.test(normalized);
}

/** Lowercase alphanumeric username stem from a first name (spaces stripped). */
export function sanitizeUsernameBase(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 28);
}

/** First letter of last name for collision usernames (e.g. "Prasetyo" → "p"). */
export function sanitizeLastNameInitial(lastName: string | null | undefined) {
  const sanitized = sanitizeUsernameBase(lastName ?? "");
  return sanitized.slice(0, 1) || "";
}

/**
 * Shared portal/ERP login username allocation for employees and client contacts.
 *
 * 1. sanitized first name (e.g. `andi`)
 * 2. if taken and a last-name initial exists: `firstname.lastinitial` (e.g. `andi.p`)
 * 3. if still taken: numeric suffix on that stem (e.g. `andi.p2` or `andi2`)
 *
 * Callers must pass a person first name — never company/client organization name.
 */
export async function allocateUniqueUsername(options: {
  /** Person's first name (employee firstName or contact person first name). */
  firstName: string;
  /** Person's last name — used only for the collision initial. */
  lastName?: string | null;
  /** Pad very short first names so the username meets the 3-char minimum. */
  fallbackCode?: string | null;
  isTaken: (username: string) => Promise<boolean>;
}): Promise<string> {
  let base = sanitizeUsernameBase(options.firstName);
  if (base.length < 3) {
    const fromCode = sanitizeUsernameBase(options.fallbackCode ?? "");
    base = sanitizeUsernameBase(`${base}${fromCode}`) || "user";
    if (base.length < 3) {
      base = "user";
    }
  }

  const taken = async (candidate: string) =>
    options.isTaken(normalizeUsername(candidate));

  if (isValidUsername(base) && !(await taken(base))) {
    return normalizeUsername(base);
  }

  const initial = sanitizeLastNameInitial(options.lastName);
  let collisionBase = base;
  if (initial) {
    const withInitial = `${base.slice(0, 30)}.${initial}`.slice(0, 32);
    if (isValidUsername(withInitial) && !(await taken(withInitial))) {
      return normalizeUsername(withInitial);
    }
    collisionBase = withInitial;
  }

  for (let i = 2; i < 10000; i++) {
    const suffix = String(i);
    const candidate = `${collisionBase.slice(0, 32 - suffix.length)}${suffix}`;
    if (isValidUsername(candidate) && !(await taken(candidate))) {
      return normalizeUsername(candidate);
    }
  }

  throw new Error("Could not allocate a unique username.");
}
