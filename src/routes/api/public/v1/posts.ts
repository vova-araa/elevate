import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { authenticateApiKey, dispatchEvent } from "@/lib/automation-engine.server";

function admin() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const CreateSchema = z.object({
  client_id: z.string().uuid(),
  platform: z.enum(["instagram", "tiktok", "linkedin", "youtube", "facebook"]),
  caption: z.string().max(5000).optional(),
  scheduled_at: z.string().datetime(),
  media_path: z.string().max(500).optional(),
  media_type: z.string().max(50).optional(),
  notes: z.string().max(2000).optional(),
  status: z.enum(["draft", "scheduled"]).default("scheduled"),
});

export const Route = createFileRoute("/api/public/v1/posts")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticateApiKey(request);
        if (!auth.ok)
          return new Response(JSON.stringify({ error: auth.error }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        const sb = admin();
        const url = new URL(request.url);
        let q = sb
          .from("scheduled_posts")
          .select("*")
          .is("deleted_at", null)
          .order("scheduled_at", { ascending: false })
          .limit(100);
        const clientId = url.searchParams.get("client_id");
        if (auth.key!.client_id) q = q.eq("client_id", auth.key!.client_id);
        else if (clientId) q = q.eq("client_id", clientId);
        const { data, error } = await q;
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        return Response.json({ data });
      },
      POST: async ({ request }) => {
        const auth = await authenticateApiKey(request);
        if (!auth.ok)
          return new Response(JSON.stringify({ error: auth.error }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        if (!auth.key!.scopes?.includes("write"))
          return new Response(JSON.stringify({ error: "Key missing 'write' scope" }), {
            status: 403,
          });
        const body = await request.json().catch(() => null);
        const parsed = CreateSchema.safeParse(body);
        if (!parsed.success)
          return new Response(
            JSON.stringify({ error: "Invalid input", issues: parsed.error.issues }),
            { status: 400 },
          );
        const input = parsed.data;
        if (auth.key!.client_id && auth.key!.client_id !== input.client_id) {
          return new Response(JSON.stringify({ error: "Key scoped to another client" }), {
            status: 403,
          });
        }
        const sb = admin();
        const { data, error } = await sb
          .from("scheduled_posts")
          .insert({ ...input })
          .select()
          .single();
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        await dispatchEvent("post.created", { post: data }, data.client_id);
        return Response.json({ data }, { status: 201 });
      },
    },
  },
});
