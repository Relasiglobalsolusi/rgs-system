import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import {
  assignProjectsToMultiProjectGroup,
  createMultiProjectGroup,
  deleteMultiProjectGroup,
  generateMultiProjectSecurityCode,
  loadClientMultiProjectAdminState,
  saveMultiProjectSettings,
} from "@/lib/client-multi-project-admin";
import { toActionError } from "@/lib/prisma-errors";

type RouteContext = {
  params: Promise<{ clientId: string }>;
};

function errorResponse(error: unknown, fallback: string) {
  const message = toActionError(error, fallback).message;
  const unauthorized = /not authorized/i.test(message);
  return NextResponse.json(
    { error: message },
    { status: unauthorized ? 403 : 400 }
  );
}

function revalidateClientPaths(clientId: string) {
  revalidatePath("/clients");
  revalidatePath("/projects");
  revalidatePath(`/billing/${clientId}`);
}

export async function GET(_request: Request, context: RouteContext) {
  const { clientId } = await context.params;
  try {
    const state = await loadClientMultiProjectAdminState(clientId);
    return NextResponse.json(state);
  } catch (error) {
    return errorResponse(error, "Could not load Multi-Project Access.");
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { clientId } = await context.params;
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const op = String(body.op ?? "").trim();

  try {
    if (op === "saveSettings") {
      const result = await saveMultiProjectSettings(clientId, {
        enabled: body.enabled === true,
        mode:
          String(body.mode ?? "").toUpperCase() === "GROUP_ONLY"
            ? "GROUP_ONLY"
            : "MASTER_AND_GROUP",
      });
      revalidateClientPaths(clientId);
      const state = await loadClientMultiProjectAdminState(clientId);
      return NextResponse.json({ ...state, readyPrompt: result.readyPrompt });
    }

    if (op === "addGroup") {
      const created = await createMultiProjectGroup(clientId, {
        name: String(body.name ?? ""),
      });
      revalidateClientPaths(clientId);
      const state = await loadClientMultiProjectAdminState(clientId);
      return NextResponse.json({ ...state, id: created.id, code: created.code });
    }

    if (op === "deleteGroup") {
      await deleteMultiProjectGroup(String(body.groupId ?? ""));
      revalidateClientPaths(clientId);
      const state = await loadClientMultiProjectAdminState(clientId);
      return NextResponse.json(state);
    }

    if (op === "assign") {
      await assignProjectsToMultiProjectGroup(
        clientId,
        String(body.groupId ?? ""),
        Array.isArray(body.projectIds)
          ? body.projectIds.map((id) => String(id))
          : []
      );
      revalidateClientPaths(clientId);
      const state = await loadClientMultiProjectAdminState(clientId);
      return NextResponse.json(state);
    }

    if (op === "generateCode") {
      const kind =
        String(body.kind ?? "").toUpperCase() === "GROUP" ? "GROUP" : "MASTER";
      const issued = await generateMultiProjectSecurityCode({
        clientId,
        kind,
        groupId: body.groupId ? String(body.groupId) : null,
      });
      revalidateClientPaths(clientId);
      const state = await loadClientMultiProjectAdminState(clientId);
      return NextResponse.json({ ...state, code: issued.code });
    }

    return NextResponse.json({ error: "Unknown operation." }, { status: 400 });
  } catch (error) {
    return errorResponse(error, "Failed to update Multi-Project Access.");
  }
}
