
-- Tighten notifications insert: only allow inserting your own
DROP POLICY IF EXISTS notif_insert_authenticated ON public.notifications;
CREATE POLICY notif_insert_own ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Restrict benchmarks to authenticated
DROP POLICY IF EXISTS benchmarks_read_all ON public.best_time_benchmarks;
CREATE POLICY benchmarks_read_authenticated ON public.best_time_benchmarks
  FOR SELECT TO authenticated
  USING (true);
REVOKE SELECT ON public.best_time_benchmarks FROM anon;
