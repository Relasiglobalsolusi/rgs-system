import { getToken } from "next-auth/jwt";
import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  sessionLiveness,
  subscribeLoginSessionWatch,
} from "@/lib/session-watch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = String(token.id);
  const jwtSessionToken = token.sessionToken ? String(token.sessionToken) : "";
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      const send = (payload: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
          );
        } catch {
          closed = true;
        }
      };

      const kickIfNeeded = (
        dbToken: string | null | undefined,
        active: boolean
      ) => {
        const status = sessionLiveness(jwtSessionToken, dbToken, active);
        if (status !== "ok") {
          send({ status });
        }
      };

      const unsubscribe = subscribeLoginSessionWatch(userId, (claimedToken) => {
        if (claimedToken !== jwtSessionToken) {
          send({ status: "replaced" });
        }
      });

      const poll = async () => {
        if (closed) return;
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { sessionToken: true, active: true },
        });
        kickIfNeeded(user?.sessionToken, Boolean(user?.active));
      };

      void poll();
      const interval = setInterval(() => {
        void poll();
      }, 1000);

      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          closed = true;
        }
      }, 15000);

      const shutdown = () => {
        if (closed) return;
        closed = true;
        unsubscribe();
        clearInterval(interval);
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      request.signal.addEventListener("abort", shutdown);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
