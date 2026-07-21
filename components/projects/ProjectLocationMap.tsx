"use client";

import { useEffect, useRef } from "react";
import { fixLeafletIcons } from "@/lib/leaflet-map";
import "leaflet/dist/leaflet.css";

type Props = {
  latitude: number;
  longitude: number;
  location?: string | null;
  radiusMeters?: number | null;
};

const DEFAULT_ZOOM = 16;

export default function ProjectLocationMap({
  latitude,
  longitude,
  location,
  radiusMeters,
}: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let map: import("leaflet").Map | null = null;
    let invalidateTimer: ReturnType<typeof setTimeout> | null = null;

    async function initMap() {
      const L = await import("leaflet");
      if (cancelled || !mapContainerRef.current) return;

      fixLeafletIcons(L);

      map = L.map(mapContainerRef.current, {
        center: [latitude, longitude],
        zoom: DEFAULT_ZOOM,
        scrollWheelZoom: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
      }).addTo(map);

      L.marker([latitude, longitude]).addTo(map);

      if (radiusMeters && radiusMeters > 0) {
        L.circle([latitude, longitude], {
          radius: radiusMeters,
          color: "#22d3ee",
          fillColor: "#22d3ee",
          fillOpacity: 0.12,
          weight: 2,
        }).addTo(map);
      }

      // Recalc size after layout — avoids 0-height init expanding wrongly
      const activeMap = map;
      requestAnimationFrame(() => {
        if (!cancelled) activeMap.invalidateSize();
      });
      invalidateTimer = setTimeout(() => {
        if (!cancelled) activeMap.invalidateSize();
      }, 100);
    }

    initMap();

    return () => {
      cancelled = true;
      if (invalidateTimer) clearTimeout(invalidateTimer);
      map?.remove();
    };
  }, [latitude, longitude, radiusMeters]);

  return (
    <div className="space-y-2">
      {location && <p className="text-sm text-subtle">{location}</p>}
      <div className="relative z-0 isolate h-64 w-full overflow-hidden rounded-xl border border-border">
        <div ref={mapContainerRef} className="h-full w-full" />
      </div>
      {radiusMeters ? (
        <p className="text-xs text-subtle">
          Check-in allowed within {radiusMeters} m of this pin.
        </p>
      ) : null}
    </div>
  );
}
