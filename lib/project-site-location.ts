/**
 * Resolve project site coordinates from Google Maps links so CICO geofence
 * matches the pin in the shared Maps URL (not address geocode drift).
 */

import {
  extractGoogleMapsUrlFromText,
  isGoogleMapsUrl,
  looksLikeUrl,
  normalizeGoogleMapsUrl,
} from "@/lib/google-maps-url";
import { resolveMapsUrl } from "@/lib/maps-resolve";
import {
  extractGoogleMapsPin,
  hasReliablePinCoordsInUrl,
  parseCoordinates,
} from "@/lib/parse-coordinates";

export type SiteCoordinateInput = {
  location: string;
  latitude: number | null;
  longitude: number | null;
};

export type ResolvedSiteCoordinates = {
  latitude: number;
  longitude: number;
  source: "maps-url" | "form";
};

function coordsFromText(text: string): { lat: number; lng: number } | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const parsed = parseCoordinates(trimmed);
  if (parsed) return parsed;

  if (isGoogleMapsUrl(trimmed) || looksLikeUrl(trimmed)) {
    return null;
  }

  return null;
}

async function coordsFromMapsUrl(
  raw: string
): Promise<{ lat: number; lng: number } | null> {
  const url = extractGoogleMapsUrlFromText(raw) ?? normalizeGoogleMapsUrl(raw);
  if (!url) return null;

  const inline = extractGoogleMapsPin(url);
  if (inline && hasReliablePinCoordsInUrl(url)) {
    return { lat: inline.lat, lng: inline.lng };
  }

  try {
    const resolved = await resolveMapsUrl(url);
    return { lat: resolved.latitude, lng: resolved.longitude };
  } catch {
    if (inline) return { lat: inline.lat, lng: inline.lng };
    return null;
  }
}

/**
 * Prefer the Maps pin from a Google Maps / share link in `location` (or inline
 * coords in that field) over form lat/lng, which may come from Nominatim search.
 */
export async function resolveProjectSiteCoordinates(
  input: SiteCoordinateInput
): Promise<ResolvedSiteCoordinates | null> {
  const location = input.location.trim();

  if (location) {
    const fromLocationText = coordsFromText(location);
    if (fromLocationText) {
      return {
        latitude: fromLocationText.lat,
        longitude: fromLocationText.lng,
        source: "maps-url",
      };
    }

    if (
      extractGoogleMapsUrlFromText(location) ||
      isGoogleMapsUrl(location) ||
      looksLikeUrl(location)
    ) {
      const fromUrl = await coordsFromMapsUrl(location);
      if (fromUrl) {
        return {
          latitude: fromUrl.lat,
          longitude: fromUrl.lng,
          source: "maps-url",
        };
      }
    }
  }

  if (
    input.latitude != null &&
    input.longitude != null &&
    Number.isFinite(input.latitude) &&
    Number.isFinite(input.longitude)
  ) {
    return {
      latitude: input.latitude,
      longitude: input.longitude,
      source: "form",
    };
  }

  return null;
}
