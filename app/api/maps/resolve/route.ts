import { NextRequest, NextResponse } from "next/server";

import { normalizeGoogleMapsUrl } from "@/lib/google-maps-url";

import {

  MAPS_RESOLVE_NO_COORDS_MESSAGE,

  resolveMapsUrl,

} from "@/lib/maps-resolve";



type ResolveSuccess = {

  latitude: number;

  longitude: number;

  resolvedUrl: string;

};



type ResolveError = {

  error: string;

};



function jsonError(message: string, status = 400) {

  return NextResponse.json({ error: message } satisfies ResolveError, {

    status,

  });

}



export async function POST(request: NextRequest) {

  let body: unknown;

  try {

    body = await request.json();

  } catch {

    return jsonError("Request body must be JSON with a url field.");

  }



  const rawUrl =

    typeof body === "object" &&

    body !== null &&

    "url" in body &&

    typeof (body as { url: unknown }).url === "string"

      ? (body as { url: string }).url

      : null;



  if (!rawUrl?.trim()) {

    return jsonError("Missing url.");

  }



  const normalized = normalizeGoogleMapsUrl(rawUrl);

  if (!normalized) {

    return jsonError(

      "URL must be a Google Maps or share.google link (maps.app.goo.gl, goo.gl/maps, share.google, etc.)."

    );

  }



  try {

    const result = await resolveMapsUrl(normalized);

    return NextResponse.json(result satisfies ResolveSuccess);

  } catch (error) {

    const message =

      error instanceof Error

        ? error.message

        : "Could not resolve Maps short link.";

    const status = message.includes("abort") ? 504 : 422;

    const friendly =

      message.includes("abort")

        ? "Timed out while resolving the Maps short link."

        : message === MAPS_RESOLVE_NO_COORDS_MESSAGE

          ? MAPS_RESOLVE_NO_COORDS_MESSAGE

          : message;

    return jsonError(friendly, status);

  }

}


