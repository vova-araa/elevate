-- ============================================================
-- Supabase remediation — project 'Elevate design' (wydyuzplgeisrgobzfge)
-- Gegenereerd 2026-07-31 uit de Supabase security/performance advisors.
-- REVIEW voordat je toepast. NIET automatisch op productie gedraaid.
-- Aanrader: eerst op een Supabase-branch (staging-DB), testen, dan mergen.
-- ============================================================

BEGIN;

-- ==== SB2: SECURITY DEFINER-functies afschermen van anon/authenticated ====
-- Trekt directe RPC-EXECUTE in. Interne aanroepen (RLS, triggers) blijven werken.
REVOKE EXECUTE ON FUNCTION public.enqueue_postiz_provision() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_admins_on_upload() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_message_recipients() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.user_has_client_access(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_notification(uuid, text, text, text, text) FROM authenticated;

-- ==== SB1: publieke buckets — brede listing-policy verwijderen ====
-- Publieke object-URL's blijven werken; alleen 'lijst alle bestanden' vervalt.
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
DROP POLICY IF EXISTS "logos_public_read" ON storage.objects;

-- ==== SB6: ontbrekende indexen op foreign keys (24) ====
CREATE INDEX IF NOT EXISTS idx_ai_generations_user_id ON public.ai_generations (user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_client_id ON public.api_keys (client_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_client_id ON public.automation_rules (client_id);
CREATE INDEX IF NOT EXISTS idx_automation_runs_rule_id ON public.automation_runs (rule_id);
CREATE INDEX IF NOT EXISTS idx_calendar_items_client_id ON public.calendar_items (client_id);
CREATE INDEX IF NOT EXISTS idx_calendar_items_created_by ON public.calendar_items (created_by);
CREATE INDEX IF NOT EXISTS idx_calendar_items_step_id ON public.calendar_items (step_id);
CREATE INDEX IF NOT EXISTS idx_client_intakes_client_id ON public.client_intakes (client_id);
CREATE INDEX IF NOT EXISTS idx_client_members_user_id ON public.client_members (user_id);
CREATE INDEX IF NOT EXISTS idx_clients_created_by ON public.clients (created_by);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_client_id ON public.post_comments (client_id);
CREATE INDEX IF NOT EXISTS idx_roadmap_steps_roadmap_id ON public.roadmap_steps (roadmap_id);
CREATE INDEX IF NOT EXISTS idx_roadmaps_client_id ON public.roadmaps (client_id);
CREATE INDEX IF NOT EXISTS idx_roadmaps_created_by ON public.roadmaps (created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON public.tasks (assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_client_id ON public.tasks (client_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON public.tasks (created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_step_id ON public.tasks (step_id);
CREATE INDEX IF NOT EXISTS idx_uploads_calendar_item_id ON public.uploads (calendar_item_id);
CREATE INDEX IF NOT EXISTS idx_uploads_client_id ON public.uploads (client_id);
CREATE INDEX IF NOT EXISTS idx_uploads_uploader_id ON public.uploads (uploader_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint_id ON public.webhook_deliveries (endpoint_id);
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_client_id ON public.webhook_endpoints (client_id);

-- ==== SB7: ongebruikte indexen opruimen (22) ====
-- Verifieer eerst dat ze echt niet nodig zijn.
DROP INDEX IF EXISTS public.idx_messages_client_created;
DROP INDEX IF EXISTS public.idx_sched_client_date;
DROP INDEX IF EXISTS public.idx_social_conn_connection_id;
DROP INDEX IF EXISTS public.idx_scheduled_posts_parent_recurring;
DROP INDEX IF EXISTS public.idx_rules_active;
DROP INDEX IF EXISTS public.idx_wh_events;
DROP INDEX IF EXISTS public.idx_apikeys_prefix;
DROP INDEX IF EXISTS public.uploads_folder_id_idx;
DROP INDEX IF EXISTS public.ai_generations_client_idx;
DROP INDEX IF EXISTS public.idx_provision_queue_status;
DROP INDEX IF EXISTS public.idx_conn_err_client;
DROP INDEX IF EXISTS public.idx_post_comments_post;
DROP INDEX IF EXISTS public.idx_client_assignments_user;
DROP INDEX IF EXISTS public.idx_client_assignments_client;
DROP INDEX IF EXISTS public.idx_activity_log_created_at;
DROP INDEX IF EXISTS public.idx_approval_links_client;
DROP INDEX IF EXISTS public.idx_approval_links_token_hash;
DROP INDEX IF EXISTS public.idx_metrics_snapshots_client_platform_time;
DROP INDEX IF EXISTS public.idx_client_intake_client;
DROP INDEX IF EXISTS public.idx_client_strategy_client;
DROP INDEX IF EXISTS public.idx_channel_invites_client;
DROP INDEX IF EXISTS public.idx_channel_invites_token_hash;

-- ==== SB4 (82x) & SB5 (36x): RLS-performance ====
-- SB4: vervang auth.uid()/auth.role() in RLS door (select auth.uid()) — 1x i.p.v. per rij.
-- SB5: consolideer meerdere permissive policies per rol+actie tot één.
-- Policy-specifiek; exacte statements genereer ik op akkoord (pg_policies 1-op-1 herschrijven).

COMMIT;
