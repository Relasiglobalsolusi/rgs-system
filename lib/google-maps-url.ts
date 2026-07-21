/**
 * Helpers for detecting / validating Google Maps & share short links.
 * Used by LocationPicker (client) and /api/maps/resolve (server).
 */

const EXACT_HOSTS = new Set([
  "share.google",
  "maps.app.goo.gl",
  "goo.gl",
  "g.co",
]);

/** Hostnames we are willing to request when resolving short Maps links. */
export function isAllowedGoogleMapsHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (!host || host.includes("..")) return false;
  if (EXACT_HOSTS.has(host)) return true;

  // google.com, www.google.com, maps.google.com
  if (host === "google.com" || host.endsWith(".google.com")) return true;

  // Country TLDs: google.de, maps.google.co.id, www.google.com.au, etc.
  // Require a label boundary before "google" (blocks evilgoogle.com).
  if (
    /^([a-z0-9-]+\.)*google\.[a-z]{2,}$/i.test(host) ||
    /^([a-z0-9-]+\.)*google\.co\.[a-z]{2,}$/i.test(host) ||
    /^([a-z0-9-]+\.)*google\.com\.[a-z]{2,}$/i.test(host)
  ) {
    return true;
  }

  return false;
}

/**
 * Normalize pasted text into an absolute URL when it looks like a Maps/share link.
 * Returns null if the string is not a plausible Google Maps / share URL.
 */
export function normalizeGoogleMapsUrl(input: string): string | null {
  const text = input.trim();
  if (!text) return null;

  const candidate = /^https?:\/\//i.test(text) ? text : `https://${text}`;

  try {
    const url = new URL(candidate);
    if (!isAllowedGoogleMapsHost(url.hostname)) return null;
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** True when paste/search input is a Google Maps or share.google URL (short or full). */
export function isGoogleMapsUrl(input: string): boolean {
  return normalizeGoogleMapsUrl(input) != null;
}

/**
 * True when the input looks like any URL (http/https or known Maps short host).
 * Used to avoid treating Maps links as Nominatim address queries.
 */
export function looksLikeUrl(input: string): boolean {
  const text = input.trim();
  if (!text) return false;
  if (/^https?:\/\//i.test(text)) return true;
  return isGoogleMapsUrl(text);
}
