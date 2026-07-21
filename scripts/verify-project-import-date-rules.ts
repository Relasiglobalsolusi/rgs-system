/**
 * Proves project Excel import date / duration rejection rules fire.
 * Run: npx tsx scripts/verify-project-import-date-rules.ts
 *
 * Reference day: Asia/Jakarta "today" fixed as 2026-07-18 for determinism.
 */
import { parseDateInput } from "../lib/invoice-period";
import { parseProjectImportRow } from "../lib/bulk-import/parse-project-row";
import { formatImportDateDisplay } from "../lib/bulk-import/parse-import-date";
import { projectDurationDaysLabels } from "../lib/bulk-import/template-i18n";

const UPLOAD = parseDateInput("2026-07-18");

type CaseResult = {
  id: string;
  name: string;
  ok: boolean;
  detail?: string;
};

const results: CaseResult[] = [];

function base(overrides: Record<string, string>): Record<string, string> {
  return {
    name: "Test Project",
    client: "Acme",
    startingStage: "Planning",
    subCategory: "Regular Cleaning",
    billingMode: "Monthly",
    milestonePayments: "N/A",
    estimatedStartDate: "20/07/2026",
    durationMonths: "12 months",
    estimatedEndDate: "",
    coordinates: "-6.1754, 106.8272",
    department: "N/A",
    staffAssigned: "N/A",
    ...overrides,
  };
}

function inProgress(overrides: Record<string, string>): Record<string, string> {
  return base({
    startingStage: "In Progress",
    estimatedStartDate: "10/07/2026",
    durationMonths: "12 months",
    department: "Ops",
    staffAssigned: "Andi - EMP-001",
    ...overrides,
  });
}

function record(id: string, name: string, ok: boolean, detail?: string) {
  results.push({ id, name, ok, detail });
  if (ok) {
    console.log(`PASS  ${id}  ${name}`);
  } else {
    console.error(`FAIL  ${id}  ${name}`);
    if (detail) console.error(`      ${detail}`);
  }
}

function expectReject(
  id: string,
  name: string,
  values: Record<string, string>,
  expectReject: string | RegExp
) {
  try {
    parseProjectImportRow(values, { referenceDate: UPLOAD });
    record(id, name, false, "expected reject but accepted");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const ok =
      typeof expectReject === "string"
        ? message.includes(expectReject)
        : expectReject.test(message);
    if (!ok) {
      record(id, name, false, `wrong message: ${message}`);
      return;
    }
    if (!message.trim() || !message.includes(" / ")) {
      record(id, name, false, `missing bilingual/actionable text: ${message}`);
      return;
    }
    record(id, name, true, message.split(" / ")[0]);
  }
}

function expectAccept(
  id: string,
  name: string,
  values: Record<string, string>,
  assertParsed?: (parsed: ReturnType<typeof parseProjectImportRow>) => string | null
) {
  try {
    const parsed = parseProjectImportRow(values, { referenceDate: UPLOAD });
    if (assertParsed) {
      const issue = assertParsed(parsed);
      if (issue) {
        record(id, name, false, issue);
        return;
      }
    }
    record(id, name, true);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    record(id, name, false, `unexpected reject: ${message}`);
  }
}

console.log(`Reference upload day: 2026-07-18 (Asia/Jakarta)\n`);

// --- Must REJECT (1–9) ---
expectReject(
  "1",
  "Planning + start before today",
  base({ estimatedStartDate: "17/07/2026" }),
  /before the upload day/i
);
expectReject(
  "2a",
  "Planning + missing start",
  base({ estimatedStartDate: "" }),
  /Contract Start Date is missing/i
);
expectReject(
  "2b",
  "Planning + invalid start",
  base({ estimatedStartDate: "not-a-date" }),
  /could not be read/i
);
expectReject(
  "3a",
  "Planning + empty duration (Regular)",
  base({ durationMonths: "" }),
  /6, 12, 24, or 36 months/i
);
expectReject(
  "3b",
  "Planning + wrong duration unit (Regular)",
  base({ durationMonths: "12 weeks" }),
  /6, 12, 24, or 36 months/i
);
expectReject(
  "3c",
  "Planning + duration out of range (General)",
  base({
    subCategory: "General Cleaning",
    billingMode: "On completion",
    durationMonths: "400 days",
  }),
  /1 to 365/i
);
expectReject(
  "4",
  "In Progress + start after today",
  inProgress({ estimatedStartDate: "19/07/2026" }),
  /after the upload day/i
);
expectReject(
  "5",
  "In Progress + computed end before today",
  inProgress({
    subCategory: "General Cleaning",
    billingMode: "On completion",
    estimatedStartDate: "15/07/2026",
    durationMonths: "2 days",
    estimatedEndDate: "",
  }),
  /Computed contract end.*before the upload day/i
);
expectReject(
  "6a",
  "In Progress + invalid duration (Regular)",
  inProgress({ durationMonths: "5 months" }),
  /6, 12, 24, or 36 months/i
);
expectReject(
  "6b",
  "In Progress + invalid duration (General)",
  inProgress({
    subCategory: "General Cleaning",
    billingMode: "On completion",
    durationMonths: "0 days",
  }),
  /1 to 365/i
);
expectReject(
  "7a",
  "Unparseable start date",
  base({ estimatedStartDate: "32/13/2026" }),
  /could not be read/i
);
expectReject(
  "7b",
  "Unparseable end date",
  base({ estimatedEndDate: "not-a-date" }),
  /could not be read/i
);
expectReject(
  "8",
  "General/Facade duration outside 1–365",
  base({
    subCategory: "Facade Cleaning",
    billingMode: "On completion",
    durationMonths: "366",
  }),
  /1 to 365/i
);
expectReject(
  "9",
  "Regular duration not in 6/12/24/36",
  base({ durationMonths: "18" }),
  /6, 12, 24, or 36 months/i
);

// --- Must ACCEPT (10–15) ---
expectAccept(
  "10",
  "Planning + start = today + valid duration",
  base({ estimatedStartDate: "18/07/2026", durationMonths: "12 months" })
);
expectAccept(
  "11",
  "Planning + start after today + valid duration",
  base({ estimatedStartDate: "20/07/2026", durationMonths: "12 months" })
);
expectAccept(
  "12",
  "In Progress + start = today + end >= today",
  inProgress({ estimatedStartDate: "18/07/2026", durationMonths: "12" })
);
expectAccept(
  "13",
  "In Progress + start before today + end >= today",
  inProgress({
    subCategory: "General Cleaning",
    billingMode: "On completion",
    estimatedStartDate: "15/07/2026",
    durationMonths: "3 days",
  })
);
expectAccept(
  "14a",
  "General/Facade duration '30 days'",
  base({
    subCategory: "General Cleaning",
    billingMode: "On completion",
    estimatedStartDate: "20/07/2026",
    durationMonths: "30 days",
  }),
  (parsed) =>
    parsed.durationDays === 30
      ? null
      : `expected durationDays=30, got ${parsed.durationDays}`
);
expectAccept(
  "14b",
  "General/Facade duration bare '30'",
  base({
    subCategory: "Facade Cleaning",
    billingMode: "On completion",
    estimatedStartDate: "20/07/2026",
    durationMonths: "30",
  }),
  (parsed) =>
    parsed.durationDays === 30
      ? null
      : `expected durationDays=30, got ${parsed.durationDays}`
);
expectAccept(
  "15a",
  "Regular duration '12 months'",
  base({ durationMonths: "12 months" }),
  (parsed) =>
    parsed.durationMonths === 12
      ? null
      : `expected durationMonths=12, got ${parsed.durationMonths}`
);
expectAccept(
  "15b",
  "Regular duration bare '12'",
  base({ durationMonths: "12" }),
  (parsed) =>
    parsed.durationMonths === 12
      ? null
      : `expected durationMonths=12, got ${parsed.durationMonths}`
);

// --- B: computed end ignores conflicting sheet end ---
expectAccept(
  "B",
  "Computed end from start+duration (ignore sheet end)",
  base({
    estimatedStartDate: "20/07/2026",
    durationMonths: "12 months",
    estimatedEndDate: "19/07/2026",
  }),
  (parsed) => {
    const endDisplay = parsed.estimatedEndDate
      ? formatImportDateDisplay(parsed.estimatedEndDate)
      : "";
    return endDisplay === "20/07/2027"
      ? null
      : `expected computed end 20/07/2027, got ${endDisplay}`;
  }
);

// Extra accept forms (locale labels)
expectAccept(
  "X1",
  "Accept Regular '12 bulan'",
  base({ durationMonths: "12 bulan" })
);
expectAccept(
  "X2",
  "Accept Facade '3 hari'",
  base({
    subCategory: "Facade Cleaning",
    billingMode: "On completion",
    durationMonths: "3 hari",
  })
);

const enDays = projectDurationDaysLabels("en");
const idDays = projectDurationDaysLabels("id");
if (
  enDays.length === 365 &&
  enDays[0] === "1 days" &&
  enDays[364] === "365 days"
) {
  record("L1", "EN duration dropdown labels 1–365 days", true);
} else {
  record(
    "L1",
    "EN duration dropdown labels 1–365 days",
    false,
    `${enDays[0]} … ${enDays[364]} (${enDays.length})`
  );
}
if (
  idDays.length === 365 &&
  idDays[0] === "1 hari" &&
  idDays[364] === "365 hari"
) {
  record("L2", "ID duration dropdown labels 1–365 hari", true);
} else {
  record(
    "L2",
    "ID duration dropdown labels 1–365 hari",
    false,
    `${idDays[0]} … ${idDays[364]} (${idDays.length})`
  );
}

const failed = results.filter((r) => !r.ok).length;
console.log("\n--- Summary ---");
for (const r of results) {
  console.log(`${r.ok ? "PASS" : "FAIL"}\t${r.id}\t${r.name}`);
}
if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nAll project import date / duration rejection checks passed.");
