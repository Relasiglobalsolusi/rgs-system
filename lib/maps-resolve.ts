/**
 * Server-side Google Maps / share.google short-link resolution.
 * Follows redirects and scrapes the shared place pin only.
 *
 * Never use the Maps camera / APP_INITIALIZATION_STATE / !2dlng!3dlat
 * viewport — that is the neighborhood center (often a road or river),
 * not the red pin. CICO uses a tight site radius, so a guessed pin fails check-in.
 *
 * Reliable pins: !8m2!3dlat!4dlng, or q=lat,lng dropped pins.
 * share.google Search shares often omit those; ask for coordinates instead.
 */

import {
  extractGoogleMapsPin,
  parseCoordinates,
  type ParsedCoordinates,
  hasPlaceDataPinInUrl,
  hasReliablePinCoordsInUrl,
} from "@/lib/parse-coordinates";
import { isAllowedGoogleMapsHost } from "@/lib/google-maps-url";

export const MAPS_RESOLVE_NO_COORDS_MESSAGE =
  "That link does not include the exact pin. In Google Maps, right-click the red pin → copy the decimal coordinates (e.g. -6.121412, 106.778304) and paste those instead.";

const MAX_REDIRECTS = 12;
const FETCH_TIMEOUT_MS = 12_000;

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export type MapsResolveSuccess = {
  latitude: number;
  longitude: number;
  resolvedUrl: string;
  /** Street / place text from the shared link, when Google landed on Search. */
  address?: string;
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

function toAbsoluteGoogleUrl(raw: string, baseUrl: string): string | null {
  try {
    const resolved = new URL(raw.replace(/&amp;/g, "&").trim(), baseUrl);
    if (!isAllowedGoogleMapsHost(resolved.hostname)) return null;
    if (resolved.toString() === baseUrl) return null;
    return resolved.toString();
  } catch {
    return null;
  }
}

/** Extract next navigation URL from HTML (canonical, og:url, meta refresh, anchors). */
export function extractUrlFromHtml(html: string, baseUrl: string): string | null {
  const preferred = html.match(
    /(?:https?:\/\/(?:(?:www|maps)\.)?google\.[^\s"'<>\\]+)?\/(?:maps\/place\/[^"'<\s]+|search\?[^"'<\s]*[?&]q=[^"'<\s]+)/i
  );
  if (preferred?.[0]) {
    const fromPreferred = toAbsoluteGoogleUrl(preferred[0], baseUrl);
    if (fromPreferred) return fromPreferred;
  }

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
    const resolved = toAbsoluteGoogleUrl(match[1], baseUrl);
    if (resolved) return resolved;
  }

  const embedded = html.match(
    /https?:\/\/(?:(?:www|maps)\.)?google\.[^\s"'<>\\]+\/(?:maps|search)[^\s"'<>\\]*/i
  );
  if (embedded?.[0]) {
    return toAbsoluteGoogleUrl(embedded[0], baseUrl);
  }

  return null;
}

/**
 * Pull lat/lng out of Maps / share HTML.
 * Prefers the shared place pin (!8m2 / q=lat,lng). Viewport tokens
 * (@camera, center=, APP_INITIALIZATION_STATE, loose JSON) are optional —
 * share.google Search pages put the mini-map center in the neighborhood,
 * not on the street pin.
 *
 * Do NOT run the full parseCoordinates() loose-pair heuristics on raw HTML —
 * Maps blobs contain numbers like 31736.182…,106.78… that falsely match.
 */
export function extractCoordsFromHtml(
  html: string,
  options: { allowViewport?: boolean } = {}
): ParsedCoordinates | null {
  const allowViewport = options.allowViewport === true;

  const embeddedMapsUrls = html.match(
    /https?:\/\/(?:(?:www|maps)\.)?google\.[^\s"'<>\\]+\/maps[^\s"'<>\\]*/gi
  );
  if (embeddedMapsUrls) {
    for (const raw of embeddedMapsUrls) {
      const pin = extractGoogleMapsPin(raw.replace(/&amp;/g, "&"));
      if (pin?.source === "place" || pin?.source === "query") {
        return { lat: pin.lat, lng: pin.lng };
      }
    }
  }

  const fromBlob = extractGoogleMapsPin(html);
  if (fromBlob?.source === "place" || fromBlob?.source === "query") {
    return { lat: fromBlob.lat, lng: fromBlob.lng };
  }

  // Destination-style q=lat,lng only — not center=/ll= viewport.
  const queryMatch = html.match(
    /[?&](?:q|query|daddr|pt)=(-?\d+(?:\.\d+)?)[,+\s]+(-?\d+(?:\.\d+)?)/i
  );
  if (queryMatch) {
    const parsed = validateCoords(Number(queryMatch[1]), Number(queryMatch[2]));
    if (parsed) return parsed;
  }

  if (!allowViewport) return null;

  const appInit = html.match(
    /APP_INITIALIZATION_STATE\s*=\s*\[\[\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/
  );
  if (appInit) {
    const lng = Number(appInit[2]);
    const lat = Number(appInit[3]);
    const parsed = validateCoords(lat, lng);
    if (parsed) return parsed;
  }

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

  if (fromBlob?.source === "camera") {
    return { lat: fromBlob.lat, lng: fromBlob.lng };
  }

  return null;
}

function decodeQueryText(raw: string): string {
  try {
    return decodeURIComponent(raw.replace(/\+/g, " ")).trim();
  } catch {
    return raw.replace(/\+/g, " ").trim();
  }
}

export function looksLikePlaceAddress(text: string): boolean {
  const value = text.trim();
  if (value.length < 8 || value.length > 350) return false;
  if (parseCoordinates(value)) return false;
  if (/^https?:\/\//i.test(value)) return false;
  if (!/[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]/.test(value)) {
    return false;
  }
  return /[,]|(\b(jl\.?|jalan|street|no\.?|rt\.?|rw\.?)\b)|\d/i.test(value);
}

/** Address / place name buried in share.google or Search HTML. */
export function extractAddressFromHtml(html: string): string | null {
  const searchLinks = html.matchAll(
    /(?:https?:\/\/(?:(?:www|maps)\.)?google\.[^"'<\s]+)?\/search\?[^"'<\s]*?[?&]q=([^&"'<\s]+)/gi
  );
  for (const match of searchLinks) {
    const text = decodeQueryText(match[1] ?? "");
    if (looksLikePlaceAddress(text)) return text;
  }

  const placePaths = html.matchAll(/\/maps\/place\/([^/@"'<\s]+)/gi);
  for (const match of placePaths) {
    const text = decodeQueryText(match[1] ?? "");
    if (looksLikePlaceAddress(text)) return text;
  }

  const title =
    html.match(/<title[^>]*>([^<]+)/i)?.[1] ??
    html.match(/property=["']og:title["'][^>]+content=["']([^"']+)/i)?.[1] ??
    html.match(/content=["']([^"']+)["'][^>]+property=["']og:title["']/i)?.[1];
  if (title) {
    const cleaned = decodeQueryText(title)
      .replace(/\s+[–|—-]\s+Google(?:\s+Search|\s+Maps)?\s*$/i, "")
      .trim();
    if (looksLikePlaceAddress(cleaned)) return cleaned;
  }

  return null;
}

function pinFromResolvedUrl(url: string): ParsedCoordinates | null {
  const pin = extractGoogleMapsPin(url);
  if (!pin || pin.source === "camera") return null;
  if (pin.source === "place" || pin.source === "query") {
    return { lat: pin.lat, lng: pin.lng };
  }
  return null;
}

/** Maps place URLs that carry a hex place id or an already-expanded pin. */
export function extractMapsPlaceFollowUrls(
  html: string,
  baseUrl: string
): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  const add = (raw: string) => {
    const abs = toAbsoluteGoogleUrl(raw, baseUrl);
    if (!abs || seen.has(abs)) return;
    seen.add(abs);
    urls.push(abs);
  };

  for (const match of html.matchAll(
    /https?:\/\/(?:(?:www|maps)\.)?google\.[^\s"'<>\\]+\/maps\/place\/[^\s"'<>\\]+/gi
  )) {
    add(match[0]);
  }
  for (const match of html.matchAll(/\/maps\/place\/[^\s"'<>\\]+/gi)) {
    add(match[0]);
  }
  for (const match of html.matchAll(/1s(0x[0-9a-f]+:0x[0-9a-f]+)/gi)) {
    add(`https://www.google.com/maps/place/data=!4m2!3m1!1s${match[1]}`);
  }

  urls.sort((a, b) => {
    const score = (url: string) =>
      (hasPlaceDataPinInUrl(url) ? 4 : 0) +
      (hasReliablePinCoordsInUrl(url) ? 2 : 0) +
      (/1s0x/i.test(url) ? 1 : 0);
    return score(b) - score(a);
  });

  return urls;
}

/** If URL is google /search?q=Address or /maps/place/Name, return the address. */
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
    (url.searchParams.has("q") ||
      url.searchParams.has("query") ||
      url.searchParams.has("destination"));

  const raw =
    url.searchParams.get("q") ||
    url.searchParams.get("query") ||
    url.searchParams.get("destination");
  if ((isSearch || isMapsQuery) && raw?.trim()) {
    const text = raw.trim();
    if (looksLikePlaceAddress(text)) return text;
  }

  const placePath = url.pathname.match(/\/maps\/place\/([^/]+)/i);
  if (placePath?.[1]) {
    const text = decodeQueryText(placePath[1]);
    if (looksLikePlaceAddress(text)) return text;
  }

  return null;
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
        Cookie: "CONSENT=YES+;",
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
  const startUrls = [
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
    `https://www.google.com/maps?q=${encodeURIComponent(address)}`,
  ];

  for (const startUrl of startUrls) {
    let current = startUrl;
    const seen = new Set<string>();

    for (let hop = 0; hop < 8; hop++) {
      assertAllowedMapsUrl(current);
      if (seen.has(current)) break;
      seen.add(current);

      const fromCurrent = pinFromResolvedUrl(current);
      if (fromCurrent && (hasPlaceDataPinInUrl(current) || hasReliablePinCoordsInUrl(current))) {
        return { coords: fromCurrent, url: current };
      }

      const response = await fetchOnce(current);

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) break;
        current = new URL(location, current).toString();
        continue;
      }

      if (!response.ok) break;

      const html = await response.text();
      // Only Google's shared place pin (!8m2). Viewport / nearby POIs are not CICO-safe.
      if (/!8m2!3d-?\d/.test(html)) {
        const placePin = extractGoogleMapsPin(html);
        if (placePin?.source === "place") {
          return {
            coords: { lat: placePin.lat, lng: placePin.lng },
            url: current,
          };
        }
      }

      const placeUrls = extractMapsPlaceFollowUrls(html, current);
      for (const next of placeUrls) {
        const fromNext = pinFromResolvedUrl(next);
        if (fromNext && hasPlaceDataPinInUrl(next)) {
          return { coords: fromNext, url: next };
        }
      }
      if (placeUrls[0] && !seen.has(placeUrls[0])) {
        current = placeUrls[0];
        continue;
      }

      const next = extractUrlFromHtml(html, current);
      if (next && !seen.has(next)) {
        const fromNext = pinFromResolvedUrl(next);
        if (fromNext && hasPlaceDataPinInUrl(next)) {
          return { coords: fromNext, url: next };
        }
        current = next;
        continue;
      }

      break;
    }
  }

  return null;
}

async function resolveSharedAddress(
  address: string
): Promise<MapsResolveSuccess | null> {
  const fromMaps = await coordsFromMapsQuery(address);
  if (!fromMaps) return null;
  return {
    latitude: fromMaps.coords.lat,
    longitude: fromMaps.coords.lng,
    resolvedUrl: fromMaps.url,
    address,
  };
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

    const fromUrl = pinFromResolvedUrl(current);
    if (fromUrl && (hasPlaceDataPinInUrl(current) || hasReliablePinCoordsInUrl(current))) {
      return {
        latitude: fromUrl.lat,
        longitude: fromUrl.lng,
        resolvedUrl: current,
      };
    }

    // Address text is for the form. Never geocode it via OSM — that misses the pin.
    const addressFromUrl = extractAddressFromSearchUrl(current);
    if (addressFromUrl) {
      const resolved = await resolveSharedAddress(addressFromUrl);
      if (resolved) return resolved;
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

    const addressFromHtml =
      extractAddressFromSearchUrl(current) ?? extractAddressFromHtml(html);

    const placeUrls = extractMapsPlaceFollowUrls(html, current);
    for (const placeUrl of placeUrls) {
      const fromPlace = pinFromResolvedUrl(placeUrl);
      if (fromPlace && hasPlaceDataPinInUrl(placeUrl)) {
        return {
          latitude: fromPlace.lat,
          longitude: fromPlace.lng,
          resolvedUrl: placeUrl,
          ...(addressFromHtml ? { address: addressFromHtml } : {}),
        };
      }
    }

    if (addressFromHtml) {
      const resolved = await resolveSharedAddress(addressFromHtml);
      if (resolved) return resolved;
    }

    // Place / dropped-pin only — never the Search / Maps camera center
    const fromHtmlCoords = extractCoordsFromHtml(html);
    if (fromHtmlCoords) {
      return {
        latitude: fromHtmlCoords.lat,
        longitude: fromHtmlCoords.lng,
        resolvedUrl: current,
        ...(addressFromHtml ? { address: addressFromHtml } : {}),
      };
    }

    if (placeUrls[0] && !seen.has(placeUrls[0])) {
      current = placeUrls[0];
      continue;
    }

    const nextFromHtml = extractUrlFromHtml(html, current);
    if (nextFromHtml && nextFromHtml !== current && !seen.has(nextFromHtml)) {
      const nested = pinFromResolvedUrl(nextFromHtml);
      if (nested && hasPlaceDataPinInUrl(nextFromHtml)) {
        return {
          latitude: nested.lat,
          longitude: nested.lng,
          resolvedUrl: nextFromHtml,
          ...(addressFromHtml ? { address: addressFromHtml } : {}),
        };
      }

      const nestedAddress =
        extractAddressFromSearchUrl(nextFromHtml) ?? addressFromHtml;
      if (nestedAddress) {
        const resolved = await resolveSharedAddress(nestedAddress);
        if (resolved) return resolved;
      }

      current = nextFromHtml;
      continue;
    }

    throw new Error(MAPS_RESOLVE_NO_COORDS_MESSAGE);
  }

  throw new Error("Too many redirects while resolving the Maps link.");
}
