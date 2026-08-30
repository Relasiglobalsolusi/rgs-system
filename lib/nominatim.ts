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
  osm_type?: string;
  category?: string;
  class?: string;
  type?: string;
  name?: string;
  address?: Record<string, string | undefined>;
  boundingbox?: string[];
};

/** Buildings / institutions we keep as the site name. Tenant shops are dropped. */
const SITE_SCALE_TYPES = new Set([
  "mall",
  "supermarket",
  "department_store",
  "wholesale",
  "hospital",
  "clinic",
  "school",
  "university",
  "college",
  "townhall",
  "police",
  "fire_station",
  "place_of_worship",
  "community_centre",
  "library",
  "theatre",
  "cinema",
  "parking",
  "bus_station",
  "ferry_terminal",
  "hotel",
  "hostel",
  "motel",
]);

function isTenantCategory(category: string, type: string): boolean {
  if (category !== "amenity" && category !== "shop" && category !== "craft") {
    return false;
  }
  return !SITE_SCALE_TYPES.has(type);
}

function isTenantScalePlace(place: NominatimPlace): boolean {
  const category = (place.category ?? place.class ?? "").toLowerCase();
  const type = (place.type ?? "").toLowerCase();
  return isTenantCategory(category, type);
}

function isTenantPhoton(props: PhotonProperties): boolean {
  const category = (props.osm_key ?? "").toLowerCase();
  const type = (props.osm_value ?? "").toLowerCase();
  return isTenantCategory(category, type);
}

/** Nominatim bbox is south, north, west, east. */
function bboxContains(
  bbox: string[] | undefined,
  lat: number,
  lng: number
): boolean {
  if (!bbox || bbox.length < 4) return false;
  const south = Number(bbox[0]);
  const north = Number(bbox[1]);
  const west = Number(bbox[2]);
  const east = Number(bbox[3]);
  if (![south, north, west, east].every(Number.isFinite)) return false;
  return (
    lat >= Math.min(south, north) &&
    lat <= Math.max(south, north) &&
    lng >= Math.min(west, east) &&
    lng <= Math.max(west, east)
  );
}

function bboxArea(bbox: string[] | undefined): number {
  if (!bbox || bbox.length < 4) return 0;
  return (
    Math.abs(Number(bbox[1]) - Number(bbox[0])) *
    Math.abs(Number(bbox[3]) - Number(bbox[2]))
  );
}

function joinAddressParts(parts: Array<string | undefined | null>): string | null {
  const deduped: string[] = [];
  for (const part of parts) {
    const trimmed = part?.trim();
    if (!trimmed) continue;
    if (deduped.some((existing) => existing.toLowerCase() === trimmed.toLowerCase())) {
      continue;
    }
    deduped.push(trimmed);
  }
  return deduped.length ? deduped.join(", ") : null;
}

function formatNominatimStreetAddress(
  address: Record<string, string | undefined> | undefined
): string | null {
  if (!address) return null;
  return joinAddressParts([
    [address.house_number, address.road].filter(Boolean).join(" "),
    address.city_block,
    address.neighbourhood,
    address.quarter,
    address.village,
    address.suburb,
    address.city_district,
    address.city || address.town,
    address.postcode,
    address.country,
  ]);
}

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
  osm_key?: string;
  osm_value?: string;
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
  return joinAddressParts([
    props.name,
    streetLine,
    props.district || props.locality,
    props.city || props.county,
    props.postcode,
    props.country,
  ]);
}

async function reverseNominatim(
  lat: number,
  lng: number
): Promise<NominatimPlace | null> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: "jsonv2",
    addressdetails: "1",
  });
  const result = await fetchJson(
    `${NOMINATIM_BASE}/reverse?${params.toString()}`,
    { "User-Agent": nominatimUserAgent() }
  );
  if (!result.ok || !result.json || typeof result.json !== "object") return null;
  const data = result.json as NominatimPlace;
  if (data.error || !data.display_name?.trim()) return null;
  return data;
}

async function reversePhoton(
  lat: number,
  lng: number
): Promise<PhotonProperties | null> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
  });
  const result = await fetchJson(
    `${PHOTON_BASE}/reverse?${params.toString()}`
  );
  if (!result.ok || !result.json || typeof result.json !== "object") return null;
  const collection = result.json as { features?: PhotonFeature[] };
  return collection.features?.[0]?.properties ?? null;
}

/** Mall / institution outline that actually contains the pin — not a tenant shop. */
async function findContainingSitePlace(
  lat: number,
  lng: number
): Promise<string | null> {
  const span = 0.003;
  const params = new URLSearchParams({
    q: "mall",
    format: "jsonv2",
    addressdetails: "1",
    bounded: "1",
    limit: "8",
    viewbox: `${lng - span},${lat + span},${lng + span},${lat - span}`,
  });
  const result = await fetchJson(
    `${NOMINATIM_BASE}/search?${params.toString()}`,
    { "User-Agent": nominatimUserAgent() }
  );
  if (!result.ok || !Array.isArray(result.json)) return null;

  const containing = (result.json as NominatimPlace[])
    .filter((place) => {
      const type = (place.type ?? "").toLowerCase();
      const category = (place.category ?? place.class ?? "").toLowerCase();
      if (!SITE_SCALE_TYPES.has(type) && category !== "building") return false;
      return bboxContains(place.boundingbox, lat, lng);
    })
    .sort((a, b) => bboxArea(b.boundingbox) - bboxArea(a.boundingbox));

  const bestName = containing[0]?.display_name?.trim();
  return bestName || null;
}

export async function reverseGeocodeNominatim(
  lat: number,
  lng: number
): Promise<string | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  let photon: PhotonProperties | null = null;
  try {
    photon = await reversePhoton(lat, lng);
  } catch {
    photon = null;
  }

  if (photon && !isTenantPhoton(photon)) {
    const fromPhoton = formatPhotonAddress(photon);
    if (fromPhoton) return fromPhoton;
  }

  let nominatim: NominatimPlace | null = null;
  try {
    nominatim = await reverseNominatim(lat, lng);
  } catch {
    nominatim = null;
  }

  const nominatimName = nominatim?.display_name?.trim();
  if (nominatim && !isTenantScalePlace(nominatim) && nominatimName) {
    return nominatimName;
  }

  try {
    const containing = await findContainingSitePlace(lat, lng);
    if (containing) return containing;
  } catch {
    // street fallback
  }

  return (
    formatNominatimStreetAddress(nominatim?.address) ||
    formatPhotonAddress(
      photon ? { ...photon, name: undefined } : {}
    ) ||
    nominatim?.display_name?.trim() ||
    null
  );
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
  const displayName = hit?.display_name?.trim();
  if (!hit?.lat || !hit?.lon || !displayName) return null;
  const lat = Number(hit.lat);
  const lng = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, displayName };
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
