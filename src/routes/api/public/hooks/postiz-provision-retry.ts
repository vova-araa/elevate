import { createFileRoute } from "@tanstack/react-router";
import { runProvisionQueue } from "@/lib/postiz-provision.functions";

/**
 * Cron-endpoint: verwerk de Postiz provisioning queue.
 * Aangeroepen door pg_cron via net.http_post.
 */
export const Route = createFileRoute("/api/public/hooks/postiz-provision-retry")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const result = await runProvisionQueue();
          return Response.json({ ok: true, ...result });
        } catch (e: any) {
          console.error("[postiz-provision-retry]", e);
          return Response.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
        }
      },
    },
  },
});
