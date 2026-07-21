import { NextRequest, NextResponse } from "next/server";

import { reverseGeocodeNominatim } from "@/lib/nominatim";

type ReverseSuccess = {
  address: string;
  latitude: number;
  longitude: number;
};

type ReverseError = {
  error: string;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message } satisfies ReverseError, {
    status,
  });
}

function parseCoord(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const lat = parseCoord(searchParams.get("lat"));
  const lng = parseCoord(
    searchParams.get("lng") ?? searchParams.get("lon")
  );

  if (lat == null || lng == null) {
    return jsonError("Missing lat and lng query parameters.");
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return jsonError("Coordinates out of range.");
  }

  try {
    const address = await reverseGeocodeNominatim(lat, lng);
    if (!address) {
      return jsonError("No address found for those coordinates.", 404);
    }
    return NextResponse.json({
      address,
      latitude: lat,
      longitude: lng,
    } satisfies ReverseSuccess);
  } catch (error) {
    const aborted =
      error instanceof Error &&
      (error.name === "AbortError" || error.message.includes("abort"));
    return jsonError(
      aborted
        ? "Timed out while looking up the address."
        : "Address lookup failed.",
      aborted ? 504 : 502
    );
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Request body must be JSON with lat and lng.");
  }

  const obj =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : null;
  const lat = parseCoord(obj?.lat ?? obj?.latitude);
  const lng = parseCoord(obj?.lng ?? obj?.lon ?? obj?.longitude);

  if (lat == null || lng == null) {
    return jsonError("Missing lat and lng.");
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return jsonError("Coordinates out of range.");
  }

  try {
    const address = await reverseGeocodeNominatim(lat, lng);
    if (!address) {
      return jsonError("No address found for those coordinates.", 404);
    }
    return NextResponse.json({
      address,
      latitude: lat,
      longitude: lng,
    } satisfies ReverseSuccess);
  } catch (error) {
    const aborted =
      error instanceof Error &&
      (error.name === "AbortError" || error.message.includes("abort"));
    return jsonError(
      aborted
        ? "Timed out while looking up the address."
        : "Address lookup failed.",
      aborted ? 504 : 502
    );
  }
}
