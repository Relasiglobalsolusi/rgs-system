import { NextRequest, NextResponse } from "next/server";
import { applyCompanyIdentityToWebsiteContent } from "@/lib/company-for-pdf";
import { prisma } from "@/lib/prisma";
import {
  defaultWebsiteContent,
  parseWebsiteContent,
} from "@/lib/website-content";

function allowedCorsOrigins(): string[] {
  const fromEnv = process.env.WEBSITE_CORS_ORIGIN?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (fromEnv?.length) {
    return fromEnv;
  }
  return ["https://rgs.co.id", "https://www.rgs.co.id"];
}

function corsHeaders(origin?: string | null) {
  const allowed = allowedCorsOrigins();
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-api-key",
    "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    Vary: "Origin",
  };

  if (origin && allowed.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  } else if (!origin) {
    // Non-browser / same-origin style callers (no Origin header)
    headers["Access-Control-Allow-Origin"] = allowed[0] ?? "*";
  }

  return headers;
}

function unauthorizedResponse(origin?: string | null) {
  return NextResponse.json(
    { error: "Unauthorized" },
    { status: 401, headers: corsHeaders(origin) }
  );
}

async function websiteContentWithCompanyIdentity(
  content: ReturnType<typeof parseWebsiteContent>
) {
  const company = await prisma.company.findFirst({
    select: {
      name: true,
      email: true,
      phone: true,
      address: true,
      website: true,
    },
    orderBy: { createdAt: "asc" },
  });
  return applyCompanyIdentityToWebsiteContent(content, company);
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request.headers.get("origin")),
  });
}

export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  const apiKey = process.env.WEBSITE_CMS_API_KEY?.trim();

  if (apiKey) {
    const providedKey = request.headers.get("x-api-key");
    if (providedKey !== apiKey) {
      return unauthorizedResponse(origin);
    }
  }

  const record = await prisma.websiteContent.findFirst({
    where: { published: true },
    orderBy: { updatedAt: "desc" },
  });

  const base = record
    ? parseWebsiteContent(record.content)
    : defaultWebsiteContent;
  const content = await websiteContentWithCompanyIdentity(base);

  if (!record) {
    return NextResponse.json(
      {
        published: false,
        updatedAt: null,
        content,
      },
      { headers: corsHeaders(origin) }
    );
  }

  return NextResponse.json(
    {
      published: true,
      updatedAt: record.updatedAt.toISOString(),
      content,
    },
    { headers: corsHeaders(origin) }
  );
}
