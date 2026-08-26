export type ParsedCoordinates = {
  lat: number;
  lng: number;
};

export type PinSource = "place" | "query" | "camera" | "plain";

export type ExtractedPin = ParsedCoordinates & {
  source: PinSource;
};

function validateCoordinates(lat: number, lng: number): ParsedCoordinates | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function decodeMapsText(input: string): string {
  let decoded = input.trim();
  try {
    decoded = decodeURIComponent(decoded.replace(/\+/g, " "));
  } catch {
    decoded = input.trim();
  }
  return decoded.replace(/&amp;/g, "&");
}

function collectPairs(
  text: string,
  pattern: RegExp,
  order: "latlng" | "lnglat"
): ParsedCoordinates[] {
  const pairs: ParsedCoordinates[] = [];
  const regex = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
  for (const match of text.matchAll(regex)) {
    const first = Number(match[1]);
    const second = Number(match[2]);
    const parsed =
      order === "latlng"
        ? validateCoordinates(first, second)
        : validateCoordinates(second, first);
    if (parsed) pairs.push(parsed);
  }
  return pairs;
}

function distanceSq(a: ParsedCoordinates, b: ParsedCoordinates): number {
  const dLat = a.lat - b.lat;
  const dLng = a.lng - b.lng;
  return dLat * dLat + dLng * dLng;
}

function pickPlacePair(
  pairs: ParsedCoordinates[],
  camera: ParsedCoordinates | null
): ParsedCoordinates | null {
  if (pairs.length === 0) return null;
  if (camera) {
    let best = pairs[0];
    let bestDist = distanceSq(best, camera);
    for (const pair of pairs.slice(1)) {
      const dist = distanceSq(pair, camera);
      if (dist < bestDist) {
        best = pair;
        bestDist = dist;
      }
    }
    return best;
  }
  return pairs[pairs.length - 1];
}

function parseCameraAt(text: string): ParsedCoordinates | null {
  const atMatch = text.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  if (!atMatch) return null;
  return validateCoordinates(Number(atMatch[1]), Number(atMatch[2]));
}

function parseQueryCoords(text: string): ParsedCoordinates | null {
  const queryMatch = text.match(
    /[?&](?:q|query|ll|center|daddr|sll|pt)=(-?\d+(?:\.\d+)?)[,+\s]+(-?\d+(?:\.\d+)?)/i
  );
  if (queryMatch) {
    return validateCoordinates(Number(queryMatch[1]), Number(queryMatch[2]));
  }

  const pathMatch = text.match(
    /\/(?:dir\/+|place\/[^/]+\/|search\/)(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i
  );
  if (pathMatch) {
    return validateCoordinates(Number(pathMatch[1]), Number(pathMatch[2]));
  }

  return null;
}

/**
 * Google Maps place pin from a URL or data blob.
 * Prefers !8m2!3dlat!4dlng (the shared place), never unpaired first !3d + first !4d.
 */
export function extractGoogleMapsPin(input: string): ExtractedPin | null {
  const decoded = decodeMapsText(input);
  if (!decoded) return null;

  const camera = parseCameraAt(decoded);

  const placePins = collectPairs(
    decoded,
    /!8m2!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
    "latlng"
  );
  if (placePins.length > 0) {
    const picked = pickPlacePair(placePins, camera) ?? placePins[placePins.length - 1];
    return { ...picked, source: "place" };
  }

  const latLngPins = collectPairs(
    decoded,
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
    "latlng"
  );
  const lngLatPins = collectPairs(
    decoded,
    /!2d(-?\d+(?:\.\d+)?)!3d(-?\d+(?:\.\d+)?)/,
    "lnglat"
  );
  const consecutive = [...latLngPins, ...lngLatPins];
  const place = pickPlacePair(consecutive, camera);
  if (place) {
    return { ...place, source: "place" };
  }

  const query = parseQueryCoords(decoded);
  if (query) {
    return { ...query, source: "query" };
  }

  if (camera) {
    return { ...camera, source: "camera" };
  }

  return null;
}

/** True when URL embeds a place pin or explicit coord query — not just a map camera @ position. */
export function hasReliablePinCoordsInUrl(url: string): boolean {
  const pin = extractGoogleMapsPin(url);
  return pin?.source === "place" || pin?.source === "query";
}

function dmsToDecimal(
  degrees: number,
  minutes: number,
  seconds: number,
  hemisphere?: string
): number {
  const absolute = Math.abs(degrees) + minutes / 60 + seconds / 3600;
  const hemi = (hemisphere ?? "").toUpperCase();
  if (hemi === "S" || hemi === "W" || degrees < 0) return -absolute;
  return absolute;
}

/**
 * Parse DMS like: 6°10'12.0"S 106°49'00.0"E
 * Also accepts deg/min/sec words and optional commas.
 */
function parseDmsPair(text: string): ParsedCoordinates | null {
  const pattern =
    /(-?\d+(?:\.\d+)?)\s*°\s*(\d+(?:\.\d+)?)?\s*['′]?\s*(\d+(?:\.\d+)?)?\s*["″]?\s*([NS])?[^\dNSWE]*?(-?\d+(?:\.\d+)?)\s*°\s*(\d+(?:\.\d+)?)?\s*['′]?\s*(\d+(?:\.\d+)?)?\s*["″]?\s*([EW])?/i;

  const match = text.match(pattern);
  if (!match) return null;

  const lat = dmsToDecimal(
    Number(match[1]),
    Number(match[2] ?? 0),
    Number(match[3] ?? 0),
    match[4]
  );
  const lng = dmsToDecimal(
    Number(match[5]),
    Number(match[6] ?? 0),
    Number(match[7] ?? 0),
    match[8]
  );

  return validateCoordinates(lat, lng);
}

/**
 * Parse pasted Google Maps URLs or plain "lat, lng" / DMS pairs.
 */
export function parseCoordinates(input: string): ParsedCoordinates | null {
  const text = input.trim();
  if (!text) return null;

  const mapsPin = extractGoogleMapsPin(text);
  if (mapsPin) {
    return { lat: mapsPin.lat, lng: mapsPin.lng };
  }

  const decoded = decodeMapsText(text);

  const dms = parseDmsPair(decoded);
  if (dms) return dms;

  const labeled = decoded.match(
    /(?:lat(?:itude)?)\s*[:=]?\s*(-?\d+(?:\.\d+)?)\s*[,;\s]+\s*(?:lng|lon(?:gitude)?)\s*[:=]?\s*(-?\d+(?:\.\d+)?)/i
  );
  if (labeled) {
    return validateCoordinates(Number(labeled[1]), Number(labeled[2]));
  }

  const plain = decoded.match(
    /^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*$/
  );
  if (plain) {
    return validateCoordinates(Number(plain[1]), Number(plain[2]));
  }

  const loose = decoded.match(
    /(-?\d{1,2}(?:\.\d{3,}))\s*[,;\s]\s*(-?\d{1,3}(?:\.\d{3,}))/
  );
  if (loose) {
    return validateCoordinates(Number(loose[1]), Number(loose[2]));
  }

  return null;
}
