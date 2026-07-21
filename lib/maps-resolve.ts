/**
 * Server-side Google Maps / share.google short-link resolution.
 * Follows redirects and scrapes coords from final URLs / HTML.
 */

import { parseCoordinates, type ParsedCoordinates } from "@/lib/parse-coordinates";
import { isAllowedGoogleMapsHost } from "@/lib/google-maps-url";

export const MAPS_RESOLVE_NO_COORDS_MESSAGE =
  "Resolved the link but could not find coordinates. In Google Maps, right-click the pin → copy the decimal coordinates (e.g. -6.200000, 106.816666) and paste those instead.";

const MAX_REDIRECTS = 12;
const FETCH_TIMEOUT_MS = 12_000;

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export type MapsResolveSuccess = {
  latitude: number;
  longitude: number;
  resolvedUrl: string;
};

function validateCoords(
  lat: number,
  lng: number
): ParsedCoordinates | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  // Reject the placeholder 0,0 unless the URL is clearly near Null Island
  return { lat, lng };
}

/** Extract next navigation URL from HTML (canonical, og:url, meta refresh, anchors). */
export function extractUrlFromHtml(html: string, baseUrl: string): string | null {
  const patterns = [
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i,
    /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:url["']/i,
    /<meta[^>]+http-equiv=["']refresh["'][^>]+content=["'][^"']*url=([^"'>\s]+)/i,
    /<meta[^>]+content=["'][^"']*url=([^"'>\s]+)["'][^>]+http-equiv=["']refresh["']/i,
    // Classic Google "301 Moved" / "302 Moved" bodies
    /<A\s+HREF=["']([^"']+)["']/i,
    /<a\s+href=["']([^"']+)["']/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match?.[1]) continue;
    try {
      const resolved = new URL(
        match[1].replace(/&amp;/g, "&").trim(),
        baseUrl
      ).toString();
      if (resolved && resolved !== baseUrl) return resolved;
    } catch {
      // ignore invalid extracted URLs
    }
  }

  // Any absolute Google Maps / search URL embedded in the document
  const embedded = html.match(
    /https?:\/\/(?:(?:www|maps)\.)?google\.[^\s"'<>\\]+\/(?:maps|search)[^\s"'<>\\]*/i
  );
  if (embedded?.[0]) {
    try {
      return new URL(embedded[0].replace(/&amp;/g, "&")).toString();
    } catch {
      // ignore
    }
  }

  return null;
}

/**
 * Pull lat/lng out of Maps / share HTML:
 * - !3dlat!4dlng pin data
 * - @lat,lng camera
 * - window.APP_INITIALIZATION_STATE (lng, lat order)
 * - JSON-ish "lat"/"lng" pairs
 *
 * Do NOT run the full parseCoordinates() loose-pair heuristics on raw HTML —
 * Maps blobs contain numbers like 31736.182…,106.78… that falsely match.
 */
export function extractCoordsFromHtml(html: string): ParsedCoordinates | null {
  // Prefer place pin data over camera / init state
  const d3 = html.match(/!3d(-?\d+(?:\.\d+)?)/);
  const d4 = html.match(/!4d(-?\d+(?:\.\d+)?)/);
  if (d3 && d4) {
    const parsed = validateCoords(Number(d3[1]), Number(d4[1]));
    if (parsed) return parsed;
  }

  // /@lat,lng or /maps/place/.../@lat,lng
  const atMatch = html.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  if (atMatch) {
    const parsed = validateCoords(Number(atMatch[1]), Number(atMatch[2]));
    if (parsed) return parsed;
  }

  // APP_INITIALIZATION_STATE=[[[zoomFactor, lng, lat], ...
  const appInit = html.match(
    /APP_INITIALIZATION_STATE\s*=\s*\[\[\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/
  );
  if (appInit) {
    const lng = Number(appInit[2]);
    const lat = Number(appInit[3]);
    const parsed = validateCoords(lat, lng);
    if (parsed) return parsed;
  }

  // ["lat",-6.12] style or "latitude":-6.12,"longitude":106.78
  const jsonLatLng = html.match(
    /"(?:latitude|lat)"\s*:\s*(-?\d+(?:\.\d+)?)\s*,\s*"(?:longitude|lng|lon)"\s*:\s*(-?\d+(?:\.\d+)?)/i
  );
  if (jsonLatLng) {
    const parsed = validateCoords(Number(jsonLatLng[1]), Number(jsonLatLng[2]));
    if (parsed) return parsed;
  }

  const jsonLngLat = html.match(
    /"(?:longitude|lng|lon)"\s*:\s*(-?\d+(?:\.\d+)?)\s*,\s*"(?:latitude|lat)"\s*:\s*(-?\d+(?:\.\d+)?)/i
  );
  if (jsonLngLat) {
    const parsed = validateCoords(Number(jsonLngLat[2]), Number(jsonLngLat[1]));
    if (parsed) return parsed;
  }

  // Query-style coords if a Maps URL is embedded in HTML
  const queryMatch = html.match(
    /[?&](?:q|query|ll|center|daddr|sll)=(-?\d+(?:\.\d+)?)[,+\s]+(-?\d+(?:\.\d+)?)/i
  );
  if (queryMatch) {
    const parsed = validateCoords(Number(queryMatch[1]), Number(queryMatch[2]));
    if (parsed) return parsed;
  }

  return null;
}

/** If URL is google /search?q=Address (common share.google landing), return the address. */
export function extractAddressFromSearchUrl(urlString: string): string | null {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return null;
  }

  if (!isAllowedGoogleMapsHost(url.hostname)) return null;

  const path = url.pathname.toLowerCase();
  const isSearch = path === "/search" || path.startsWith("/search?");
  const isMapsQuery =
    path.includes("/maps") &&
    (url.searchParams.has("q") || url.searchParams.has("query"));

  if (!isSearch && !isMapsQuery) return null;

  const raw =
    url.searchParams.get("q") ||
    url.searchParams.get("query") ||
    url.searchParams.get("destination");
  if (!raw?.trim()) return null;

  const text = raw.trim();
  // Skip if q is already coordinates or another URL
  if (parseCoordinates(text)) return null;
  if (/^https?:\/\//i.test(text)) return null;
  // Need some letter content to look like an address / place name
  if (!/[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]/.test(text)) return null;

  return text;
}

async function fetchOnce(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    return await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent": BROWSER_UA,
        "Upgrade-Insecure-Requests": "1",
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

export function assertAllowedMapsUrl(urlString: string): URL {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error("Invalid URL while following redirects.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http(s) Google Maps URLs are allowed.");
  }

  if (!isAllowedGoogleMapsHost(url.hostname)) {
    throw new Error(
      "Redirect left allowed Google / share.google domains; refusing to follow."
    );
  }

  return url;
}

async function coordsFromMapsQuery(
  address: string
): Promise<{ coords: ParsedCoordinates; url: string } | null> {
  const mapsUrl = `https://www.google.com/maps?q=${encodeURIComponent(address)}`;
  assertAllowedMapsUrl(mapsUrl);

  const response = await fetchOnce(mapsUrl);
  // Follow one redirect if present
  let finalUrl = mapsUrl;
  let html: string;

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (!location) return null;
    finalUrl = new URL(location, mapsUrl).toString();
    assertAllowedMapsUrl(finalUrl);

    const fromRedirect = parseCoordinates(finalUrl);
    if (fromRedirect) return { coords: fromRedirect, url: finalUrl };

    const nested = await fetchOnce(finalUrl);
    if (!nested.ok && !(nested.status >= 300 && nested.status < 400)) {
      return null;
    }
    if (nested.status >= 300 && nested.status < 400) {
      const loc2 = nested.headers.get("location");
      if (loc2) {
        finalUrl = new URL(loc2, finalUrl).toString();
        const parsed = parseCoordinates(finalUrl);
        if (parsed) return { coords: parsed, url: finalUrl };
      }
      return null;
    }
    html = await nested.text();
  } else if (response.ok) {
    html = await response.text();
  } else {
    return null;
  }

  const fromUrl = parseCoordinates(finalUrl);
  if (fromUrl) return { coords: fromUrl, url: finalUrl };

  const fromHtml = extractCoordsFromHtml(html);
  if (fromHtml) return { coords: fromHtml, url: finalUrl };

  const next = extractUrlFromHtml(html, finalUrl);
  if (next) {
    const nestedCoords = parseCoordinates(next);
    if (nestedCoords) return { coords: nestedCoords, url: next };
  }

  return null;
}

/**
 * Resolve a Google Maps / share.google URL to latitude / longitude.
 */
export async function resolveMapsUrl(
  startUrl: string
): Promise<MapsResolveSuccess> {
  let current = startUrl;
  const seen = new Set<string>();

  for (let hop = 0; hop < MAX_REDIRECTS; hop++) {
    assertAllowedMapsUrl(current);

    if (seen.has(current)) {
      break;
    }
    seen.add(current);

    const fromUrl = parseCoordinates(current);
    if (fromUrl) {
      return {
        latitude: fromUrl.lat,
        longitude: fromUrl.lng,
        resolvedUrl: current,
      };
    }

    // share.google often lands on /search?q=Address — open Maps with that query
    const address = extractAddressFromSearchUrl(current);
    if (address) {
      const fromMaps = await coordsFromMapsQuery(address);
      if (fromMaps) {
        return {
          latitude: fromMaps.coords.lat,
          longitude: fromMaps.coords.lng,
          resolvedUrl: fromMaps.url,
        };
      }
    }

    const response = await fetchOnce(current);

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new Error("Short link redirect was missing a Location header.");
      }
      current = new URL(location, current).toString();
      continue;
    }

    if (!response.ok) {
      throw new Error(
        `Could not resolve short link (HTTP ${response.status}).`
      );
    }

    const html = await response.text();

    const fromHtmlCoords = extractCoordsFromHtml(html);
    if (fromHtmlCoords) {
      return {
        latitude: fromHtmlCoords.lat,
        longitude: fromHtmlCoords.lng,
        resolvedUrl: current,
      };
    }

    const nextFromHtml = extractUrlFromHtml(html, current);
    if (nextFromHtml && nextFromHtml !== current && !seen.has(nextFromHtml)) {
      const nested = parseCoordinates(nextFromHtml);
      if (nested) {
        return {
          latitude: nested.lat,
          longitude: nested.lng,
          resolvedUrl: nextFromHtml,
        };
      }

      const nestedAddress = extractAddressFromSearchUrl(nextFromHtml);
      if (nestedAddress) {
        const fromMaps = await coordsFromMapsQuery(nestedAddress);
        if (fromMaps) {
          return {
            latitude: fromMaps.coords.lat,
            longitude: fromMaps.coords.lng,
            resolvedUrl: fromMaps.url,
          };
        }
      }

      current = nextFromHtml;
      continue;
    }

    throw new Error(MAPS_RESOLVE_NO_COORDS_MESSAGE);
  }

  throw new Error("Too many redirects while resolving the Maps link.");
}
