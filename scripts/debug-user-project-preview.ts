/**
 * Run the heavy parts of previewBulkImportProjects against the user's file
 * (parse + location resolve). Skips auth.
 *
 * Run: npx tsx scripts/debug-user-project-preview.ts
 */
import { readFileSync } from "fs";
import path from "path";

import { parseProjectImportRow } from "../lib/bulk-import/parse-project-row";
import { PROJECT_IMPORT_COLUMNS } from "../lib/bulk-import/project-import-columns";
import { parseSpreadsheetRows } from "../lib/bulk-import/xlsx";
import {
  isGoogleMapsUrl,
  normalizeGoogleMapsUrl,
} from "../lib/google-maps-url";
import { resolveMapsUrl } from "../lib/maps-resolve";
import { reverseGeocodeNominatim } from "../lib/nominatim";
import { parseCoordinates } from "../lib/parse-coordinates";
import { capitalizeProper } from "../lib/text-case";

const filePath = path.join(process.cwd(), "tmp-user-project-import.xlsx");

function coordPlaceholder(lat: number, lng: number): string {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

async function resolveImportLocation(raw: string) {
  const trimmed = raw.trim();
  let latitude: number | null = null;
  let longitude: number | null = null;

  const t0 = Date.now();
  const parsed = parseCoordinates(trimmed);
  if (parsed) {
    latitude = parsed.lat;
    longitude = parsed.lng;
    console.log(`  coords from parseCoordinates (${Date.now() - t0}ms)`);
  } else if (isGoogleMapsUrl(trimmed)) {
    const url = normalizeGoogleMapsUrl(trimmed);
    if (!url) throw new Error("Could not read that Maps link.");
    console.log(`  resolving maps url…`);
    const resolved = await resolveMapsUrl(url);
    latitude = resolved.latitude;
    longitude = resolved.longitude;
    console.log(`  maps resolved (${Date.now() - t0}ms)`, latitude, longitude);
  } else {
    throw new Error("Invalid coordinates.");
  }

  if (latitude == null || longitude == null) {
    throw new Error("Could not determine coordinates.");
  }

  const t1 = Date.now();
  const address = await reverseGeocodeNominatim(latitude, longitude);
  console.log(
    `  reverseGeocode (${Date.now() - t1}ms):`,
    address?.slice(0, 100) ?? "(null → placeholder)"
  );
  const location = capitalizeProper(
    address?.trim() || coordPlaceholder(latitude, longitude)
  );
  return { latitude, longitude, location };
}

async function main() {
  const buf = readFileSync(filePath);
  const ab = buf.buffer.slice(
    buf.byteOffset,
    buf.byteOffset + buf.byteLength
  ) as ArrayBuffer;
  const { rows } = parseSpreadsheetRows(ab, PROJECT_IMPORT_COLUMNS);
  console.log("Rows:", rows.length);
  const overall = Date.now();

  for (const { rowNumber, values } of rows) {
    console.log(`\n=== Row ${rowNumber}: ${values.name} ===`);
    try {
      const parsed = parseProjectImportRow(values);
      console.log("  parse OK");
      const resolved = await resolveImportLocation(parsed.coordinatesRaw);
      console.log("  location:", resolved.location.slice(0, 80));
    } catch (e) {
      console.log("  FAIL:", e instanceof Error ? e.message : e);
    }
  }

  console.log(`\nTotal elapsed: ${Date.now() - overall}ms`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
