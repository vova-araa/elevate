import { createFileRoute } from "@tanstack/react-router";
import { runTick } from "@/lib/automation-engine.server";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed if secret not configured
  const header = request.headers.get("x-cron-secret") ?? "";
  const url = new URL(request.url);
  const query = url.searchParams.get("secret") ?? "";
  const bearer = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  return header === secret || query === secret || bearer === secret;
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
