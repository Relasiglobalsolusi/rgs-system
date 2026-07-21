const LOWERCASE_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "but",
  "or",
  "for",
  "nor",
  "on",
  "at",
  "to",
  "from",
  "by",
  "in",
  "of",
]);

/** Indonesian (and similar) legal-entity tokens that must stay fully uppercase. */
const ALL_CAPS_ENTITY_WORDS = new Set([
  "pt",
  "cv",
  "ud",
  "tbk",
  "pd",
  "fa",
]);

/**
 * If `word` is a known entity prefix (optionally with trailing punctuation),
 * return it in all-caps; otherwise null.
 */
function asAllCapsEntityWord(word: string): string | null {
  const match = word.match(/^([A-Za-z]+)([.,;:)]*)$/);
  if (!match) return null;

  const [, letters, punct] = match;
  if (!ALL_CAPS_ENTITY_WORDS.has(letters.toLowerCase())) return null;

  return letters.toUpperCase() + punct;
}

function capitalizeWord(word: string): string {
  if (!word) return word;

  const entity = asAllCapsEntityWord(word);
  if (entity) return entity;

  if (word.includes("-")) {
    return word.split("-").map(capitalizeWord).join("-");
  }

  if (word.includes("'")) {
    const parts = word.split("'");
    return parts
      .map((part, index) =>
        index === 0 ? capitalizeWord(part) : part.toLowerCase()
      )
      .join("'");
  }

  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/** First letter of each name part (handles spaces, hyphens, apostrophes). */
export function capitalizeName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  return trimmed.split(/\s+/).map(capitalizeWord).join(" ");
}

/** Title-style capitalization for addresses, positions, company names, etc. */
export function capitalizeProper(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  return trimmed
    .split(/\s+/)
    .map((word, index) => {
      const entity = asAllCapsEntityWord(word);
      if (entity) return entity;

      const lower = word.toLowerCase();
      if (index > 0 && LOWERCASE_WORDS.has(lower)) {
        return lower;
      }
      return capitalizeWord(word);
    })
    .join(" ");
}

/** Short codes kept fully uppercase in Title Case (GC Staff, HO, …). */
const TITLE_CASE_ACRONYMS = new Set([
  "gc",
  "ho",
  "cor",
  "opr",
  "fin",
  "una",
  "ceo",
  "cico",
  "om",
  "erp",
  "hr",
  "id",
  "ppn",
  "rw",
  "rt",
  "kk",
  "nik",
]);

function titleCaseSegment(segment: string): string {
  if (!segment) return segment;

  const entity = asAllCapsEntityWord(segment);
  if (entity) return entity;

  const match = segment.match(/^([^A-Za-z]*)([A-Za-z]+)([^A-Za-z]*)$/);
  if (!match) return segment;

  const [, lead, letters, trail] = match;
  if (TITLE_CASE_ACRONYMS.has(letters.toLowerCase())) {
    return `${lead}${letters.toUpperCase()}${trail}`;
  }

  return (
    lead +
    letters.charAt(0).toUpperCase() +
    letters.slice(1).toLowerCase() +
    trail
  );
}

/**
 * Title Case every word (spaces and hyphens). Preserves known acronyms (GC, HO).
 * Unlike capitalizeProper, small words like "of"/"in" are also capitalized.
 */
export function titleCaseWords(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return trimmed;

  return trimmed
    .split(/(\s+|\/)/)
    .map((part) => {
      if (part === "/" || /^\s+$/.test(part)) return part;
      if (part.includes("-")) {
        return part.split("-").map(titleCaseSegment).join("-");
      }
      return titleCaseSegment(part);
    })
    .join("");
}
