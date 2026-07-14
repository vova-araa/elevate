
-- Extend scheduled_posts
ALTER TABLE public.scheduled_posts
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS recurring_rule jsonb,
  ADD COLUMN IF NOT EXISTS parent_recurring_id uuid,
  ADD COLUMN IF NOT EXISTS is_queued boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_deleted_at ON public.scheduled_posts(deleted_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_parent_recurring ON public.scheduled_posts(parent_recurring_id);

-- Queue slots
CREATE TABLE IF NOT EXISTS public.queue_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  platform social_platform NOT NULL,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  time_of_day time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.queue_slots TO authenticated;
GRANT ALL ON public.queue_slots TO service_role;

ALTER TABLE public.queue_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY queue_slots_admin_manage ON public.queue_slots FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY queue_slots_select_access ON public.queue_slots FOR SELECT TO authenticated
  USING (user_has_client_access(auth.uid(), client_id));

-- Best-time benchmarks (general benchmarks, not per client)
CREATE TABLE IF NOT EXISTS public.best_time_benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform social_platform NOT NULL,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  time_of_day time NOT NULL,
  score smallint NOT NULL DEFAULT 50,
  rationale text
);

GRANT SELECT ON public.best_time_benchmarks TO authenticated, anon;
GRANT ALL ON public.best_time_benchmarks TO service_role;

ALTER TABLE public.best_time_benchmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY benchmarks_read_all ON public.best_time_benchmarks FOR SELECT
  TO anon, authenticated USING (true);

-- Seed benchmarks based on common industry data
INSERT INTO public.best_time_benchmarks (platform, day_of_week, time_of_day, score, rationale) VALUES
  -- Instagram (peak: weekdays 11-13, evenings 19-21)
  ('instagram', 1, '11:00', 90, 'Lunchpauze, hoge engagement'),
  ('instagram', 1, '19:00', 85, 'Avondbrowsing'),
  ('instagram', 2, '11:00', 88, 'Lunchpauze'),
  ('instagram', 3, '11:00', 92, 'Beste werkdag voor Instagram'),
  ('instagram', 3, '19:00', 86, 'Avond'),
  ('instagram', 4, '11:00', 87, 'Lunchpauze'),
  ('instagram', 5, '12:00', 80, 'Vrijdag lunch'),
  ('instagram', 6, '10:00', 75, 'Weekend ochtend'),
  ('instagram', 0, '10:00', 78, 'Zondag ochtend'),
  -- TikTok (evenings)
  ('tiktok', 1, '19:00', 88, 'Avondscrollen'),
  ('tiktok', 2, '20:00', 90, 'Piek scrolltijd'),
  ('tiktok', 3, '19:00', 89, ''),
  ('tiktok', 4, '20:00', 92, 'Donderdagavond piek'),
  ('tiktok', 5, '17:00', 85, 'Vroege avond'),
  ('tiktok', 6, '11:00', 82, 'Weekend ochtend'),
  ('tiktok', 0, '20:00', 88, 'Zondagavond'),
  -- LinkedIn (workdays mornings)
  ('linkedin', 1, '08:00', 85, 'Werkdag start'),
  ('linkedin', 2, '08:00', 92, 'Beste dag voor LinkedIn'),
  ('linkedin', 2, '12:00', 88, 'Lunchpauze pro''s'),
  ('linkedin', 3, '08:00', 90, ''),
  ('linkedin', 3, '17:00', 82, 'Einde werkdag'),
  ('linkedin', 4, '09:00', 87, ''),
  ('linkedin', 5, '10:00', 70, 'Vrijdag minder actief'),
  -- YouTube (evenings + weekends)
  ('youtube', 4, '15:00', 85, 'Donderdagmiddag'),
  ('youtube', 5, '15:00', 82, ''),
  ('youtube', 6, '10:00', 90, 'Zaterdagochtend piek'),
  ('youtube', 0, '10:00', 88, 'Zondagochtend'),
  -- Facebook (afternoons)
  ('facebook', 1, '13:00', 80, 'Middagpauze'),
  ('facebook', 2, '15:00', 85, ''),
  ('facebook', 3, '13:00', 88, 'Beste dag'),
  ('facebook', 4, '13:00', 82, ''),
  ('facebook', 5, '13:00', 78, '')
ON CONFLICT DO NOTHING;
