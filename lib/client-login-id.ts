/**
 * Company Login ID generator — 8 letters a–z (no AI).
 * Titles (PT, Tbk, CV, …) stripped before generation; Admin picks from suggestions.
 */

const LEGAL_TITLES = new Set([
  "pt",
  "cv",
  "ud",
  "tbk",
  "persero",
  "firma",
  "yayasan",
  "pd",
  "perum",
  "inc",
  "ltd",
  "llc",
]);

const FILLER = new Set(["dan", "dari", "yang", "di", "ke", "the", "of", "and", "a", "an"]);

export function normalizeClientName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

/** Strip legal titles for Login ID generation (legal name on Client unchanged). */
export function stripLegalTitlesForLoginId(companyName: string): string[] {
  return companyName
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,/#!$%^&*;:{}=_`~()]/g, " ")
    .split(/\s+/)
    .map((w) => w.toLowerCase())
    .filter((w) => w.length > 0 && !LEGAL_TITLES.has(w));
}

function lettersOnly(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z]/g, "");
}

function padOrTrim8(stem: string, salt: string): string {
  let s = lettersOnly(stem);
  if (s.length >= 8) return s.slice(0, 8);
  const filler = lettersOnly(salt) || "abcdefgh";
  let i = 0;
  while (s.length < 8) {
    s += filler[i % filler.length]!;
    i += 1;
  }
  return s.slice(0, 8);
}

function uniquePush(out: string[], candidate: string) {
  const c = padOrTrim8(candidate, "rgsclient");
  if (/^[a-z]{8}$/.test(c) && !out.includes(c)) out.push(c);
}

/**
 * Up to 5 deterministic 8-letter Login ID suggestions from company name.
 * Caller filters taken names and may regenerate with avoid list.
 */
export function suggestClientLoginIds(
  companyName: string,
  options?: { avoid?: string[]; count?: number }
): string[] {
  const avoid = new Set((options?.avoid ?? []).map((a) => a.toLowerCase()));
  const words = stripLegalTitlesForLoginId(companyName).filter(
    (w) => !FILLER.has(w)
  );
  const content = words.length > 0 ? words : ["client", "portal"];
  const joined = content.join("");
  const initials = content.map((w) => w[0] ?? "").join("");

  const out: string[] = [];
  const tryAdd = (raw: string) => {
    const c = padOrTrim8(raw, joined + initials);
    if (!avoid.has(c)) uniquePush(out, c);
  };

  // Blend starts of distinctive words (e.g. Lebih Cepat Dari Cahaya → leceriya-style).
  if (content.length >= 2) {
    const a = content[0]!;
    const b = content[1]!;
    const c = content[2] ?? content[content.length - 1]!;
    tryAdd(a.slice(0, 2) + b.slice(0, 2) + c.slice(0, 2) + a.slice(-2));
    tryAdd(a.slice(0, 3) + b.slice(0, 2) + c.slice(0, 3));
    tryAdd(a.slice(0, 2) + b.slice(0, 3) + c.slice(0, 3));
  }

  tryAdd(initials + joined);
  tryAdd(joined);
  tryAdd(content.map((w) => w.slice(0, 2)).join(""));
  tryAdd(content.map((w) => w.slice(0, 3)).join(""));
  tryAdd(
    (content[0] ?? "co").slice(0, 4) + (content[content.length - 1] ?? "rp").slice(0, 4)
  );

  // Deterministic variants if still short on unique options.
  let n = 0;
  while (out.length < (options?.count ?? 5) && n < 40) {
    const base = out[n % Math.max(out.length, 1)] ?? padOrTrim8(joined, "rgs");
    const chars = base.split("");
    const idx = n % 8;
    const next = String.fromCharCode(
      ((chars[idx]!.charCodeAt(0) - 97 + 1 + Math.floor(n / 8)) % 26) + 97
    );
    chars[idx] = next;
    tryAdd(chars.join(""));
    n += 1;
  }

  return out.slice(0, options?.count ?? 5);
}

export function isValidClientLoginId(value: string): boolean {
  return /^[a-z]{8}$/.test(value.trim().toLowerCase());
}

export async function allocateClientLoginId(options: {
  companyName: string;
  preferred?: string | null;
  avoid?: string[];
  isTaken: (username: string) => Promise<boolean>;
}): Promise<string> {
  const preferred = options.preferred?.trim() ?? "";
  if (preferred) {
    if (!isValidClientLoginId(preferred)) {
      throw new Error("Login ID must be exactly 8 letters (a–z).");
    }
    const pref = preferred.toLowerCase();
    if (await options.isTaken(pref)) {
      throw new Error("That Login ID is already taken.");
    }
    return pref;
  }

  const suggestions = suggestClientLoginIds(options.companyName, {
    avoid: options.avoid,
    count: 5,
  });

  for (const s of suggestions) {
    if (!(await options.isTaken(s))) return s;
  }

  // Last resort: mutate until free.
  let guard = 0;
  let stem = suggestions[0] ?? padOrTrim8(
    stripLegalTitlesForLoginId(options.companyName).join(""),
    "clientxx"
  );
  while (guard < 500) {
    const chars = stem.split("");
    chars[guard % 8] = String.fromCharCode(
      ((chars[guard % 8]!.charCodeAt(0) - 97 + 1) % 26) + 97
    );
    stem = chars.join("");
    if (isValidClientLoginId(stem) && !(await options.isTaken(stem))) {
      return stem;
    }
    guard += 1;
  }

  throw new Error("Could not allocate a unique Login ID.");
}
