DROP POLICY IF EXISTS "tasks_update_assignee" ON public.tasks;
CREATE POLICY "tasks_update_assignee" ON public.tasks
  FOR UPDATE TO authenticated
  USING (assignee_id = auth.uid() OR public.user_has_client_access(auth.uid(), client_id))
  WITH CHECK (public.user_has_client_access(auth.uid(), client_id));