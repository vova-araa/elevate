CREATE TABLE public.client_intakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Bedrijf
  brand_name text NOT NULL,
  industry text,
  website text,
  target_audience text,
  brand_values text,
  usp text,
  competitors text,

  -- Doelstellingen & strategie
  main_goal text,
  goals_3_months text,
  goals_12_months text,
  kpis text,
  budget_range text,
  content_pillars text,
  tone_of_voice text,
  preferred_formats text,
  posting_frequency text,

  -- Huidige social awareness per platform (jsonb: {handle, followers, engagement, monthly_reach, post_freq, notes})
  instagram jsonb DEFAULT '{}'::jsonb,
  tiktok jsonb DEFAULT '{}'::jsonb,
  linkedin jsonb DEFAULT '{}'::jsonb,
  youtube jsonb DEFAULT '{}'::jsonb,
  facebook jsonb DEFAULT '{}'::jsonb,

  -- Awareness self-assessment (1-10)
  brand_awareness_score int,
  perceived_strengths text,
  perceived_weaknesses text,
  top_performing_content text,
  worst_performing_content text,
  paid_ads_history text,
  influencer_history text,

  -- Resources
  has_photographer boolean DEFAULT false,
  has_videographer boolean DEFAULT false,
  has_copywriter boolean DEFAULT false,
  internal_team_notes text,

  -- Vrije ruimte
  extra_notes text,
  status text NOT NULL DEFAULT 'in_progress'
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_intakes TO authenticated;
GRANT ALL ON public.client_intakes TO service_role;

ALTER TABLE public.client_intakes ENABLE ROW LEVEL SECURITY;

CREATE POLICY intake_admin_manage ON public.client_intakes
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY intake_select_access ON public.client_intakes
  FOR SELECT TO authenticated
  USING (client_id IS NULL OR public.user_has_client_access(auth.uid(), client_id));

CREATE TRIGGER touch_client_intakes_updated_at
  BEFORE UPDATE ON public.client_intakes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();