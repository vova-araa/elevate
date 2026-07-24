import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";
import { runTick } from "@/lib/automation-engine.server";

/** Constante-tijd vergelijking zodat de secret niet byte-voor-byte te raden is. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed if secret not configured
  const header = request.headers.get("x-cron-secret") ?? "";
  const url = new URL(request.url);
  const query = url.searchParams.get("secret") ?? "";
  const bearer = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  return safeEqual(header, secret) || safeEqual(query, secret) || safeEqual(bearer, secret);
}

export const Route = createFileRoute("/api/public/automation-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
        const result = await runTick();
        return Response.json({ ok: true, ...result });
      },
      GET: async ({ request }) => {
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
        const result = await runTick();
        return Response.json({ ok: true, ...result });
      },
    },
  },
});
