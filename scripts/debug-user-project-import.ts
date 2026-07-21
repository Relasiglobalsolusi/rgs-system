/**
 * One-off: parse the user's project bulk file with the app's spreadsheet + row parsers.
 * Run: npx tsx scripts/debug-user-project-import.ts
 */
import { readFileSync } from "fs";
import path from "path";

import { parseProjectImportRow } from "../lib/bulk-import/parse-project-row";
import { PROJECT_IMPORT_COLUMNS } from "../lib/bulk-import/project-import-columns";
import { parseSpreadsheetRows } from "../lib/bulk-import/xlsx";

const filePath = path.join(process.cwd(), "tmp-user-project-import.xlsx");

async function main() {
  const buf = readFileSync(filePath);
  const ab = buf.buffer.slice(
    buf.byteOffset,
    buf.byteOffset + buf.byteLength
  ) as ArrayBuffer;

  console.log("File size:", buf.length);

  try {
    const { rows, sheetName } = parseSpreadsheetRows(ab, PROJECT_IMPORT_COLUMNS);
    console.log("Sheet:", sheetName, "Rows:", rows.length);

    for (const { rowNumber, values } of rows) {
      console.log("--- Row", rowNumber, "---");
      console.log(JSON.stringify(values, null, 2));
      try {
        const parsed = parseProjectImportRow(values);
        console.log(
          "PARSED OK:",
          JSON.stringify(
            parsed,
            (_k, v) => (v instanceof Date ? v.toISOString() : v),
            2
          )
        );
      } catch (e) {
        console.log(
          "PARSE ERROR:",
          e instanceof Error ? e.message : String(e)
        );
      }
    }
  } catch (e) {
    console.log(
      "SPREADSHEET ERROR:",
      e instanceof Error ? e.message : String(e)
    );
    console.error(e);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
