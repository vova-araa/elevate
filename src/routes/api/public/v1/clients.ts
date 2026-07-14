import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { authenticateApiKey } from "@/lib/automation-engine.server";

export const Route = createFileRoute("/api/public/v1/clients")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticateApiKey(request);
        if (!auth.ok)
          return new Response(JSON.stringify({ error: auth.error }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        let q = sb
          .from("clients")
          .select("id,name,industry,brand_color,website,logo_url")
          .order("name");
        if (auth.key!.client_id) q = q.eq("id", auth.key!.client_id);
        const { data, error } = await q;
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        return Response.json({ data });
      },
    },
  },
});
