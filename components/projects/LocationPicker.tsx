"use client";

import {
  showRejection,
} from "@/components/ui/rejection-notice";
import { useEffect, useRef, useState, type ClipboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, Search } from "lucide-react";
import { parseCoordinates } from "@/lib/parse-coordinates";
import {
  isGoogleMapsUrl,
  looksLikeUrl,
  normalizeGoogleMapsUrl,
} from "@/lib/google-maps-url";
import { employeeInputClass } from "@/components/employees/employee-dialog-ui";
import { useT } from "@/lib/i18n/use-t";
import { fixLeafletIcons } from "@/lib/leaflet-map";
import { cn } from "@/lib/utils";
import "leaflet/dist/leaflet.css";

export type LocationValue = {
  location: string;
  latitude: number | null;
  longitude: number | null;
  locationRadiusMeters: number;
};

type Props = {
  value: LocationValue;
  onChange: (value: LocationValue) => void;
};

const DEFAULT_CENTER = { lat: -6.1754, lng: 106.8272 };

function formatCoord(n: number | null): string {
  if (n == null) return "—";
  return n.toFixed(6);
}

function coordPlaceholder(lat: number, lng: number): string {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

/** Server reverse-geocode — avoids browser Nominatim CORS / UA blocks. */
async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      lat: String(lat),
      lng: String(lng),
    });
    const response = await fetch(`/api/maps/reverse?${params.toString()}`);
    if (!response.ok) return null;
    const data = (await response.json()) as { address?: string };
    return data.address?.trim() || null;
  } catch {
    return null;
  }
}

async function searchAddressApi(
  query: string
): Promise<{ lat: number; lng: number; address: string } | null> {
  try {
    const params = new URLSearchParams({ q: query });
    const response = await fetch(`/api/maps/search?${params.toString()}`);
    if (!response.ok) return null;
    const data = (await response.json()) as {
      address?: string;
      latitude?: number;
      longitude?: number;
    };
    if (
      data.latitude == null ||
      data.longitude == null ||
      !data.address?.trim()
    ) {
      return null;
    }
    return {
      lat: data.latitude,
      lng: data.longitude,
      address: data.address.trim(),
    };
  } catch {
    return null;
  }
}

async function resolveMapsShortLink(
  raw: string,
  shortLinkError: string
): Promise<{ lat: number; lng: number } | { error: string }> {
  const url = normalizeGoogleMapsUrl(raw);
  if (!url) {
    return { error: shortLinkError };
  }

  try {
    const response = await fetch("/api/maps/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    const data = (await response.json()) as {
      latitude?: number;
      longitude?: number;
      error?: string;
    };

    if (!response.ok || data.latitude == null || data.longitude == null) {
      return { error: data.error?.trim() || shortLinkError };
    }

    return { lat: data.latitude, lng: data.longitude };
  } catch {
    return { error: shortLinkError };
  }
}

export default function LocationPicker({ value, onChange }: Props) {
  const { t } = useT();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").Marker | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  const [searching, setSearching] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [pasteHint, setPasteHint] = useState<string | null>(null);
  const [lookupFailed, setLookupFailed] = useState<{
    lat: number;
    lng: number;
    keptExisting: boolean;
  } | null>(null);
  const [lookupPending, setLookupPending] = useState(false);

  function setCoordinates(
    lat: number,
    lng: number,
    location?: string,
    base: LocationValue = valueRef.current
  ) {
    onChange({
      ...base,
      latitude: lat,
      longitude: lng,
      location: location ?? base.location,
    });
  }

  async function fillAddressFromCoords(
    lat: number,
    lng: number,
    base: LocationValue,
    options: { successHint?: string } = {}
  ): Promise<boolean> {
    setLookupPending(true);
    setLookupFailed(null);
    try {
      const address = await reverseGeocode(lat, lng);
      if (address) {
        onChange({ ...base, location: address });
        setPasteHint(
          options.successHint ??
            t("pages.projects.locationPicker.coordsAppliedFilled")
        );
        return true;
      }

      // Keep existing site address when editing; placeholder only if empty
      const keptExisting = Boolean(base.location.trim());
      if (!keptExisting) {
        onChange({ ...base, location: coordPlaceholder(lat, lng) });
      }
      setLookupFailed({ lat, lng, keptExisting });
      setPasteHint(null);
      return false;
    } finally {
      setLookupPending(false);
    }
  }

  async function applyLatLng(
    lat: number,
    lng: number,
    hint?: string
  ): Promise<boolean> {
    const prev = valueRef.current;
    const withCoords: LocationValue = {
      ...prev,
      latitude: lat,
      longitude: lng,
      locationRadiusMeters: prev.locationRadiusMeters || 50,
      // Keep existing location text until reverse succeeds
      location: prev.location,
    };

    setPasteError(null);
    setPasteHint(
      hint ?? t("pages.projects.locationPicker.coordsLookingUp")
    );
    setLookupFailed(null);
    onChange(withCoords);

    await fillAddressFromCoords(lat, lng, withCoords);

    setPasteText("");
    return true;
  }

  async function retryAddressLookup() {
    if (!lookupFailed) return;
    const { lat, lng } = lookupFailed;
    const base: LocationValue = {
      ...valueRef.current,
      latitude: lat,
      longitude: lng,
    };
    setPasteHint(t("pages.projects.locationPicker.retryingLookup"));
    const ok = await fillAddressFromCoords(lat, lng, base, {
      successHint: t("pages.projects.locationPicker.addressFilled"),
    });
    if (!ok) {
      setPasteHint(null);
    }
  }

  async function applyParsedCoordinates(
    raw: string,
    options: { showEmptyError?: boolean } = {}
  ): Promise<boolean> {
    const trimmed = raw.trim();
    if (!trimmed) {
      if (options.showEmptyError) {
        setPasteError(t("pages.projects.locationPicker.parseError"));
      }
      return false;
    }

    const parsed = parseCoordinates(trimmed);
    if (parsed) {
      return applyLatLng(parsed.lat, parsed.lng);
    }

    // Short Maps / share links have no lat/lng in the pasted URL — resolve server-side
    if (isGoogleMapsUrl(trimmed)) {
      setPasteHint(t("pages.projects.locationPicker.resolvingShortLink"));
      setPasteError(null);
      const resolved = await resolveMapsShortLink(
        trimmed,
        t("pages.projects.locationPicker.shortLinkError")
      );
      if ("error" in resolved) {
        setPasteError(resolved.error);
        setPasteHint(null);
        return false;
      }
      return applyLatLng(
        resolved.lat,
        resolved.lng,
        t("pages.projects.locationPicker.shortLinkLookingUp")
      );
    }

    setPasteError(t("pages.projects.locationPicker.parseError"));
    setPasteHint(null);
    return false;
  }

  async function handleCoordinatePaste(
    event: ClipboardEvent<HTMLInputElement>
  ) {
    const raw = event.clipboardData.getData("text");
    const trimmed = raw.trim();
    if (!trimmed) return;

    // Local coords / full Maps URLs with lat/lng
    if (parseCoordinates(trimmed)) {
      event.preventDefault();
      await applyParsedCoordinates(trimmed);
      return;
    }

    // Short share / goo.gl links — resolve instead of pasting into the field as text
    if (isGoogleMapsUrl(trimmed)) {
      event.preventDefault();
      setPasteText(trimmed);
      await applyParsedCoordinates(trimmed);
    }
  }

  useEffect(() => {
    let cancelled = false;
    let invalidateTimer: ReturnType<typeof setTimeout> | null = null;

    async function initMap() {
      const L = await import("leaflet");
      if (cancelled || !mapContainerRef.current || mapRef.current) return;

      fixLeafletIcons(L);

      const lat = valueRef.current.latitude ?? DEFAULT_CENTER.lat;
      const lng = valueRef.current.longitude ?? DEFAULT_CENTER.lng;

      const map = L.map(mapContainerRef.current, {
        center: [lat, lng],
        zoom: valueRef.current.latitude ? 16 : 11,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);

      const marker = L.marker([lat, lng], { draggable: true }).addTo(map);

      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        void applyLatLng(
          pos.lat,
          pos.lng,
          t("pages.projects.locationPicker.pinMovedLookingUp")
        );
      });

      map.on("click", (event) => {
        marker.setLatLng(event.latlng);
        void applyLatLng(
          event.latlng.lat,
          event.latlng.lng,
          t("pages.projects.locationPicker.pinSetLookingUp")
        );
      });

      mapRef.current = map;
      markerRef.current = marker;

      requestAnimationFrame(() => {
        if (!cancelled) map.invalidateSize();
      });
      invalidateTimer = setTimeout(() => {
        if (!cancelled) map.invalidateSize();
      }, 100);
    }

    initMap();

    return () => {
      cancelled = true;
      if (invalidateTimer) clearTimeout(invalidateTimer);
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    if (value.latitude == null || value.longitude == null) return;

    const latLng: [number, number] = [value.latitude, value.longitude];
    markerRef.current.setLatLng(latLng);
    mapRef.current.setView(latLng, Math.max(mapRef.current.getZoom(), 15));
  }, [value.latitude, value.longitude]);

  async function searchAddress() {
    const query = value.location.trim();
    if (!query) return;

    // Maps / share URLs are not addresses — resolve coords; never Nominatim-geocode them
    if (looksLikeUrl(query) || isGoogleMapsUrl(query)) {
      setSearching(true);
      try {
        const ok = await applyParsedCoordinates(query);
        if (!ok && !isGoogleMapsUrl(query)) {
          setPasteError(t("pages.projects.locationPicker.urlNotAddress"));
        }
      } finally {
        setSearching(false);
      }
      return;
    }

    if (parseCoordinates(query)) {
      await applyParsedCoordinates(query);
      return;
    }

    setSearching(true);
    setPasteError(null);
    setLookupFailed(null);
    try {
      const hit = await searchAddressApi(query);
      if (!hit) {
        showRejection({ reasons: t("pages.projects.locationPicker.addressNotFound") });
        return;
      }
      setCoordinates(hit.lat, hit.lng, hit.address);
      setPasteHint(t("pages.projects.locationPicker.addressFoundUpdated"));
    } catch {
      showRejection({ reasons: t("pages.projects.locationPicker.addressSearchFailed") });
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2.5">
        <label className="text-sm font-medium text-text">
          {t("pages.projects.locationPicker.pasteLabel")}
        </label>
        <Input
          value={pasteText}
          onChange={(event) => {
            setPasteText(event.target.value);
            setPasteError(null);
            setPasteHint(null);
            setLookupFailed(null);
          }}
          onPaste={(event) => {
            void handleCoordinatePaste(event);
          }}
          onBlur={() => {
            if (!pasteText.trim()) return;
            void applyParsedCoordinates(pasteText, { showEmptyError: true });
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void applyParsedCoordinates(pasteText, { showEmptyError: true });
            }
          }}
          placeholder={t("pages.projects.locationPicker.pastePlaceholder")}
          className={cn(employeeInputClass, "h-11")}
          aria-invalid={Boolean(pasteError)}
        />
        {pasteError && (
          <p className="text-xs leading-relaxed text-rose-400">{pasteError}</p>
        )}
        {!pasteError && pasteHint && (
          <p className="text-xs text-cyan-400/90">{pasteHint}</p>
        )}
        {!pasteError && lookupFailed && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-amber-400/90">
            <span>
              {lookupFailed.keptExisting
                ? t("pages.projects.locationPicker.lookupFailedKept")
                : t("pages.projects.locationPicker.lookupFailedPlaceholder")}
              {lookupPending
                ? t("pages.projects.locationPicker.retrying")
                : null}
            </span>
            <button
              type="button"
              className="underline underline-offset-2 hover:text-amber-300 disabled:opacity-50"
              onClick={() => void retryAddressLookup()}
              disabled={lookupPending}
            >
              {t("pages.projects.locationPicker.retryLookup")}
            </button>
          </div>
        )}
      </div>

      <div className="relative z-0 isolate h-64 w-full overflow-hidden rounded-xl border border-border">
        <div ref={mapContainerRef} className="h-full w-full" />
      </div>

      <p className="flex items-center gap-2 text-xs text-muted">
        <MapPin className="h-3.5 w-3.5 shrink-0" />
        {t("pages.projects.locationPicker.pinHelp")}
      </p>

      <div className="space-y-2.5">
        <label className="text-sm font-medium text-text">
          {t("pages.projects.locationPicker.address")}
        </label>
        <div className="flex gap-2.5">
          <Input
            value={value.location}
            onChange={(event) => {
              onChange({ ...value, location: event.target.value });
            }}
            onPaste={(event) => {
              void handleCoordinatePaste(event);
            }}
            placeholder={t("pages.projects.locationPicker.addressPlaceholder")}
            required
            className={cn(employeeInputClass, "h-11")}
          />
          <Button
            type="button"
            variant="outline"
            className="h-11 shrink-0 border-border bg-elevated px-4 text-text hover:bg-card-hover"
            onClick={() => void searchAddress()}
            disabled={searching}
          >
            <Search className="mr-2 h-4 w-4" />
            {searching ? "..." : t("pages.projects.locationPicker.searchAddress")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted">
            {t("pages.projects.locationPicker.latitude")}
          </label>
          <Input
            type="text"
            readOnly
            value={formatCoord(value.latitude)}
            tabIndex={-1}
            className={cn(employeeInputClass, "h-11 text-text")}
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted">
            {t("pages.projects.locationPicker.longitude")}
          </label>
          <Input
            type="text"
            readOnly
            value={formatCoord(value.longitude)}
            tabIndex={-1}
            className={cn(employeeInputClass, "h-11 text-text")}
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted">
            {t("pages.projects.locationPicker.radius")}
          </label>
          <Input
            type="number"
            min={25}
            max={2000}
            value={value.locationRadiusMeters}
            onChange={(event) =>
              onChange({
                ...value,
                locationRadiusMeters: Number(event.target.value) || 50,
              })
            }
            placeholder={t("pages.projects.locationPicker.radiusPlaceholder")}
            className={cn(employeeInputClass, "h-11")}
          />
        </div>
      </div>

      <input type="hidden" name="location" value={value.location} />
      <input type="hidden" name="latitude" value={value.latitude ?? ""} />
      <input type="hidden" name="longitude" value={value.longitude ?? ""} />
      <input
        type="hidden"
        name="locationRadiusMeters"
        value={value.locationRadiusMeters}
      />
    </div>
  );
}
