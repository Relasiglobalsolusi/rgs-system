/**
 * Server-side reverse/forward geocode.
 * Prefer Nominatim (with identifying User-Agent per usage policy).
 * Fall back to Photon (Komoot) when Nominatim is blocked / rate-limited.
 */

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const PHOTON_BASE = "https://photon.komoot.io";
const FETCH_TIMEOUT_MS = 10_000;

function nominatimUserAgent(): string {
  const email =
    process.env.NOMINATIM_CONTACT_EMAIL?.trim() || "noreply@rgs.co.id";
  const custom = process.env.NOMINATIM_USER_AGENT?.trim();
  if (custom) return custom;
  return `RGS-System/1.0 (${email})`;
}

async function fetchJson(
  url: string,
  headers: Record<string, string> = {}
): Promise<{ ok: boolean; status: number; json: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", ...headers },
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await response.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { ok: response.ok, status: response.status, json };
  } finally {
    clearTimeout(timer);
  }
}

type NominatimPlace = {
  display_name?: string;
  lat?: string;
  lon?: string;
  error?: string;
};

type PhotonProperties = {
  name?: string;
  street?: string;
  housenumber?: string;
  district?: string;
  city?: string;
  state?: string;
  country?: string;
  postcode?: string;
  locality?: string;
  county?: string;
};

type PhotonFeature = {
  properties?: PhotonProperties;
  geometry?: { coordinates?: [number, number] };
};

function formatPhotonAddress(props: PhotonProperties): string | null {
  const streetLine = [props.housenumber, props.street]
    .filter(Boolean)
    .join(" ")
    .trim();
  const parts = [
    streetLine || props.name,
    props.district || props.locality,
    props.city || props.county,
    props.state,
    props.postcode,
    props.country,
  ].filter((p): p is string => Boolean(p?.trim()));

  // Deduplicate consecutive identical labels (e.g. name === district)
  const deduped: string[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (
      deduped.length &&
      deduped[deduped.length - 1].toLowerCase() === trimmed.toLowerCase()
    ) {
      continue;
    }
    deduped.push(trimmed);
  }
  return deduped.length ? deduped.join(", ") : null;
}

async function reverseNominatim(
  lat: number,
  lng: number
): Promise<string | null> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: "json",
  });
  const result = await fetchJson(
    `${NOMINATIM_BASE}/reverse?${params.toString()}`,
    { "User-Agent": nominatimUserAgent() }
  );
  if (!result.ok || !result.json || typeof result.json !== "object") return null;
  const data = result.json as NominatimPlace;
  if (data.error || !data.display_name?.trim()) return null;
  return data.display_name.trim();
}

async function reversePhoton(lat: number, lng: number): Promise<string | null> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
  });
  const result = await fetchJson(
    `${PHOTON_BASE}/reverse?${params.toString()}`
  );
  if (!result.ok || !result.json || typeof result.json !== "object") return null;
  const collection = result.json as { features?: PhotonFeature[] };
  const props = collection.features?.[0]?.properties;
  if (!props) return null;
  return formatPhotonAddress(props);
}

export async function reverseGeocodeNominatim(
  lat: number,
  lng: number
): Promise<string | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  try {
    const fromNominatim = await reverseNominatim(lat, lng);
    if (fromNominatim) return fromNominatim;
  } catch {
    // fall through to Photon
  }

  try {
    return await reversePhoton(lat, lng);
  } catch {
    return null;
  }
}

async function searchNominatim(
  query: string
): Promise<{ lat: number; lng: number; displayName: string } | null> {
  const params = new URLSearchParams({
    q: query,
    format: "json",
    limit: "1",
  });
  const result = await fetchJson(
    `${NOMINATIM_BASE}/search?${params.toString()}`,
    { "User-Agent": nominatimUserAgent() }
  );
  if (!result.ok || !Array.isArray(result.json)) return null;
  const hit = (result.json as NominatimPlace[])[0];
  if (!hit?.lat || !hit?.lon || !hit.display_name?.trim()) return null;
  const lat = Number(hit.lat);
  const lng = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, displayName: hit.display_name.trim() };
}

async function searchPhoton(
  query: string
): Promise<{ lat: number; lng: number; displayName: string } | null> {
  const params = new URLSearchParams({ q: query, limit: "1" });
  const result = await fetchJson(`${PHOTON_BASE}/api?${params.toString()}`);
  if (!result.ok || !result.json || typeof result.json !== "object") return null;
  const feature = (result.json as { features?: PhotonFeature[] }).features?.[0];
  const coords = feature?.geometry?.coordinates;
  if (!coords || coords.length < 2) return null;
  const [lng, lat] = coords;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const displayName =
    (feature.properties && formatPhotonAddress(feature.properties)) || null;
  if (!displayName) return null;
  return { lat, lng, displayName };
}

export async function searchAddressNominatim(
  query: string
): Promise<{ lat: number; lng: number; displayName: string } | null> {
  const q = query.trim();
  if (!q) return null;

  try {
    const fromNominatim = await searchNominatim(q);
    if (fromNominatim) return fromNominatim;
  } catch {
    // fall through
  }

  try {
    return await searchPhoton(q);
  } catch {
    return null;
  }
}
