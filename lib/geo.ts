const EARTH_RADIUS_METERS = 6_371_000;

/** Default CICO geofence when a project has no stored radius. */
export const CICO_GEOFENCE_RADIUS_METERS = 50;

/** Smallest site radius the location picker accepts. */
export const MIN_LOCATION_RADIUS_METERS = 20;

/** Largest site radius — wide compounds / malls. CICO uses this as the cap. */
export const MAX_LOCATION_RADIUS_METERS = 300;

/** Default project site radius when none is stored. */
export const DEFAULT_LOCATION_RADIUS_METERS = CICO_GEOFENCE_RADIUS_METERS;

export function clampLocationRadiusMeters(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_LOCATION_RADIUS_METERS;
  }
  return Math.min(
    Math.max(Math.round(value), MIN_LOCATION_RADIUS_METERS),
    MAX_LOCATION_RADIUS_METERS
  );
}

export function resolveGeofenceRadiusMeters(
  radiusMeters: number | null | undefined
): number {
  if (
    radiusMeters != null &&
    Number.isFinite(radiusMeters) &&
    radiusMeters > 0
  ) {
    return clampLocationRadiusMeters(radiusMeters);
  }
  return DEFAULT_LOCATION_RADIUS_METERS;
}

export function haversineDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isWithinGeofence(
  userLat: number,
  userLng: number,
  siteLat: number,
  siteLng: number,
  radiusMeters: number
) {
  return (
    haversineDistanceMeters(userLat, userLng, siteLat, siteLng) <= radiusMeters
  );
}

export function formatDistanceMeters(meters: number) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}
