import { NextRequest, NextResponse } from "next/server";

import { searchAddressNominatim } from "@/lib/nominatim";

type SearchSuccess = {
  address: string;
  latitude: number;
  longitude: number;
};

type SearchError = {
  error: string;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message } satisfies SearchError, {
    status,
  });
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return jsonError("Missing q query parameter.");
  }

  try {
    const hit = await searchAddressNominatim(q);
    if (!hit) {
      return jsonError("Address not found.", 404);
    }
    return NextResponse.json({
      address: hit.displayName,
      latitude: hit.lat,
      longitude: hit.lng,
    } satisfies SearchSuccess);
  } catch (error) {
    const aborted =
      error instanceof Error &&
      (error.name === "AbortError" || error.message.includes("abort"));
    return jsonError(
      aborted
        ? "Timed out while searching for the address."
        : "Address search failed.",
      aborted ? 504 : 502
    );
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Request body must be JSON with a q field.");
  }

  const q =
    typeof body === "object" &&
    body !== null &&
    "q" in body &&
    typeof (body as { q: unknown }).q === "string"
      ? (body as { q: string }).q.trim()
      : "";

  if (!q) {
    return jsonError("Missing q.");
  }

  try {
    const hit = await searchAddressNominatim(q);
    if (!hit) {
      return jsonError("Address not found.", 404);
    }
    return NextResponse.json({
      address: hit.displayName,
      latitude: hit.lat,
      longitude: hit.lng,
    } satisfies SearchSuccess);
  } catch (error) {
    const aborted =
      error instanceof Error &&
      (error.name === "AbortError" || error.message.includes("abort"));
    return jsonError(
      aborted
        ? "Timed out while searching for the address."
        : "Address search failed.",
      aborted ? 504 : 502
    );
  }
}
