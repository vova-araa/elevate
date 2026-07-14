
-- Extra tabellen voor uitgebreid klantbeheer

CREATE TYPE public.meeting_type AS ENUM ('intake','strategy','review','presentation','call','other');
CREATE TYPE public.deal_stage AS ENUM ('lead','qualified','proposal','negotiation','won','lost');
CREATE TYPE public.report_type AS ENUM ('monthly','campaign','analytics','audit','other');
CREATE TYPE public.content_status AS ENUM ('idea','draft','approved','scheduled','published','archived');
CREATE TYPE public.content_channel AS ENUM ('instagram','tiktok','linkedin','facebook','youtube','website','email','print','other');

-- Gesprekken / meetings
CREATE TABLE public.meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  title text NOT NULL,
  meeting_type meeting_type NOT NULL DEFAULT 'other',
  scheduled_at timestamptz NOT NULL,
  duration_min integer DEFAULT 60,
  location text,
  attendees text,
  summary text,
  notes text,
  action_items text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meetings TO authenticated;
GRANT ALL ON public.meetings TO service_role;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY meetings_admin_manage ON public.meetings FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY meetings_select_access ON public.meetings FOR SELECT TO authenticated USING (user_has_client_access(auth.uid(), client_id));
CREATE TRIGGER trg_meetings_updated BEFORE UPDATE ON public.meetings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Deals
CREATE TABLE public.deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  stage deal_stage NOT NULL DEFAULT 'lead',
  value_cents bigint DEFAULT 0,
  currency text DEFAULT 'EUR',
  probability integer DEFAULT 50,
  expected_close_date date,
  closed_at timestamptz,
  owner_id uuid,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deals TO authenticated;
GRANT ALL ON public.deals TO service_role;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY deals_admin_manage ON public.deals FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY deals_select_access ON public.deals FOR SELECT TO authenticated USING (user_has_client_access(auth.uid(), client_id));
CREATE TRIGGER trg_deals_updated BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Rapportages
CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  title text NOT NULL,
  report_type report_type NOT NULL DEFAULT 'monthly',
  period_start date,
  period_end date,
  summary text,
  highlights text,
  metrics jsonb DEFAULT '{}'::jsonb,
  file_path text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY reports_admin_manage ON public.reports FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY reports_select_access ON public.reports FOR SELECT TO authenticated USING (user_has_client_access(auth.uid(), client_id));
CREATE TRIGGER trg_reports_updated BEFORE UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Strategie notities
CREATE TABLE public.strategy_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  title text NOT NULL,
  category text DEFAULT 'general',
  body text,
  pinned boolean DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.strategy_notes TO authenticated;
GRANT ALL ON public.strategy_notes TO service_role;
ALTER TABLE public.strategy_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY strategy_admin_manage ON public.strategy_notes FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY strategy_select_access ON public.strategy_notes FOR SELECT TO authenticated USING (user_has_client_access(auth.uid(), client_id));
CREATE TRIGGER trg_strategy_updated BEFORE UPDATE ON public.strategy_notes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Content items (planning / kalender content)
CREATE TABLE public.content_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  title text NOT NULL,
  concept text,
  copy text,
  channel content_channel NOT NULL DEFAULT 'instagram',
  status content_status NOT NULL DEFAULT 'idea',
  scheduled_at timestamptz,
  published_at timestamptz,
  hashtags text,
  cover_path text,
  assignee_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_items TO authenticated;
GRANT ALL ON public.content_items TO service_role;
ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY content_admin_manage ON public.content_items FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY content_select_access ON public.content_items FOR SELECT TO authenticated USING (user_has_client_access(auth.uid(), client_id));
CREATE POLICY content_client_update ON public.content_items FOR UPDATE TO authenticated USING (user_has_client_access(auth.uid(), client_id));
CREATE TRIGGER trg_content_updated BEFORE UPDATE ON public.content_items FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Evaluaties
CREATE TABLE public.evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  title text NOT NULL,
  period_label text,
  score integer,
  strengths text,
  improvements text,
  next_steps text,
  body text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evaluations TO authenticated;
GRANT ALL ON public.evaluations TO service_role;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY eval_admin_manage ON public.evaluations FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY eval_select_access ON public.evaluations FOR SELECT TO authenticated USING (user_has_client_access(auth.uid(), client_id));
CREATE TRIGGER trg_eval_updated BEFORE UPDATE ON public.evaluations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_meetings_client_date ON public.meetings(client_id, scheduled_at DESC);
CREATE INDEX idx_deals_client_stage ON public.deals(client_id, stage);
CREATE INDEX idx_reports_client ON public.reports(client_id, period_end DESC NULLS LAST);
CREATE INDEX idx_content_client_status ON public.content_items(client_id, status);
CREATE INDEX idx_strategy_client ON public.strategy_notes(client_id, pinned DESC, updated_at DESC);
CREATE INDEX idx_eval_client ON public.evaluations(client_id, created_at DESC);
