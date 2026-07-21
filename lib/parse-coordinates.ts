export type ParsedCoordinates = {
  lat: number;
  lng: number;
};

function validateCoordinates(lat: number, lng: number): ParsedCoordinates | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
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

  // Decode common URL encodings so %2C / %40 patterns still match
  let decoded = text;
  try {
    decoded = decodeURIComponent(text.replace(/\+/g, " "));
  } catch {
    decoded = text;
  }

  // Place pin in Maps data (!3dlat!4dlng) is preferred over camera @lat,lng
  // Also accept data=!3d…!4d… without requiring adjacent tokens
  const d3 = decoded.match(/!3d(-?\d+(?:\.\d+)?)/);
  const d4 = decoded.match(/!4d(-?\d+(?:\.\d+)?)/);
  if (d3 && d4) {
    return validateCoordinates(Number(d3[1]), Number(d4[1]));
  }

  // Google Maps camera / place: .../@-6.2,106.8,17z  or  /maps/place/.../@lat,lng
  const atMatch = decoded.match(
    /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/
  );
  if (atMatch) {
    return validateCoordinates(Number(atMatch[1]), Number(atMatch[2]));
  }

  // q= / query= / ll= / center= / daddr= / sll=
  const queryMatch = decoded.match(
    /[?&](?:q|query|ll|center|daddr|sll)=(-?\d+(?:\.\d+)?)[,+\s]+(-?\d+(?:\.\d+)?)/i
  );
  if (queryMatch) {
    return validateCoordinates(Number(queryMatch[1]), Number(queryMatch[2]));
  }

  // Destination / place / search path coords: /dir//lat,lng/ or /place/Name/@ already covered
  const pathMatch = decoded.match(
    /\/(?:dir\/+|place\/[^/]+\/|search\/)(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i
  );
  if (pathMatch) {
    return validateCoordinates(Number(pathMatch[1]), Number(pathMatch[2]));
  }

  // Embedded Maps data blob: data=!4m…!3dLAT!4dLNG (order may vary; already handled above)
  // Fallback: 3dLAT!4dLNG without leading !
  const loose3d4d = decoded.match(
    /(?:^|[^0-9])3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/
  );
  if (loose3d4d) {
    return validateCoordinates(Number(loose3d4d[1]), Number(loose3d4d[2]));
  }

  const dms = parseDmsPair(decoded);
  if (dms) return dms;

  // Labeled: lat: -6.2, lng: 106.8
  const labeled = decoded.match(
    /(?:lat(?:itude)?)\s*[:=]?\s*(-?\d+(?:\.\d+)?)\s*[,;\s]+\s*(?:lng|lon(?:gitude)?)\s*[:=]?\s*(-?\d+(?:\.\d+)?)/i
  );
  if (labeled) {
    return validateCoordinates(Number(labeled[1]), Number(labeled[2]));
  }

  // Plain decimal pair: -6.200000, 106.816666
  const plain = decoded.match(
    /^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*$/
  );
  if (plain) {
    return validateCoordinates(Number(plain[1]), Number(plain[2]));
  }

  // Loose pair somewhere in the string (last resort for noisy paste)
  const loose = decoded.match(
    /(-?\d{1,2}(?:\.\d{3,}))\s*[,;\s]\s*(-?\d{1,3}(?:\.\d{3,}))/
  );
  if (loose) {
    return validateCoordinates(Number(loose[1]), Number(loose[2]));
  }

  return null;
}
