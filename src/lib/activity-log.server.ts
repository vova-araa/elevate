import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";

// Server-only audittrail-helper. De .server.ts-suffix houdt dit buiten de
// client-bundle; alleen aanroepen vanuit server-fn-handlers.
export async function logActivity(
  actorId: string | null,
  action: string,
  entityType?: string,
  entityId?: string,
  meta?: Json,
) {
  await supabaseAdmin.from("activity_log").insert({
    actor_id: actorId,
    action,
    entity_type: entityType ?? null,
    entity_id: entityId ?? null,
    meta: meta ?? null,
  });
}
