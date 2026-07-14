
-- 1. webhook_endpoints: restrict global rows (client_id IS NULL) to admins only
DROP POLICY IF EXISTS wh_select_access ON public.webhook_endpoints;
CREATE POLICY wh_select_access ON public.webhook_endpoints
  FOR SELECT TO authenticated
  USING (
    (client_id IS NULL AND is_admin(auth.uid()))
    OR (client_id IS NOT NULL AND user_has_client_access(auth.uid(), client_id))
  );

-- 2. automation_rules: restrict global rows to admins
DROP POLICY IF EXISTS rules_select_access ON public.automation_rules;
CREATE POLICY rules_select_access ON public.automation_rules
  FOR SELECT TO authenticated
  USING (
    (client_id IS NULL AND is_admin(auth.uid()))
    OR (client_id IS NOT NULL AND user_has_client_access(auth.uid(), client_id))
  );

-- 3. client_intakes: restrict global/unassigned rows to admins
DROP POLICY IF EXISTS intake_select_access ON public.client_intakes;
CREATE POLICY intake_select_access ON public.client_intakes
  FOR SELECT TO authenticated
  USING (
    (client_id IS NULL AND is_admin(auth.uid()))
    OR (client_id IS NOT NULL AND user_has_client_access(auth.uid(), client_id))
  );

-- 4. calendar_items: add WITH CHECK to client UPDATE
DROP POLICY IF EXISTS cal_client_update_status ON public.calendar_items;
CREATE POLICY cal_client_update_status ON public.calendar_items
  FOR UPDATE TO authenticated
  USING (user_has_client_access(auth.uid(), client_id))
  WITH CHECK (user_has_client_access(auth.uid(), client_id));

-- 5. content_items: add WITH CHECK to client UPDATE
DROP POLICY IF EXISTS content_client_update ON public.content_items;
CREATE POLICY content_client_update ON public.content_items
  FOR UPDATE TO authenticated
  USING (user_has_client_access(auth.uid(), client_id))
  WITH CHECK (user_has_client_access(auth.uid(), client_id));

-- 6. scheduled_posts: add WITH CHECK to client UPDATE
DROP POLICY IF EXISTS sched_client_update ON public.scheduled_posts;
CREATE POLICY sched_client_update ON public.scheduled_posts
  FOR UPDATE TO authenticated
  USING (user_has_client_access(auth.uid(), client_id))
  WITH CHECK (user_has_client_access(auth.uid(), client_id));

-- 7. profiles: allow reading profiles of users who share a client membership (for sender names/avatars)
DROP POLICY IF EXISTS profiles_select_own_or_admin ON public.profiles;
CREATE POLICY profiles_select_shared ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR is_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.client_members cm1
      JOIN public.client_members cm2 ON cm1.client_id = cm2.client_id
      WHERE cm1.user_id = auth.uid() AND cm2.user_id = profiles.id
    )
  );
