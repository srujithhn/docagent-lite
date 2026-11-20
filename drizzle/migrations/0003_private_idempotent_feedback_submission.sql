CREATE OR REPLACE FUNCTION public.submit_checklist_feedback(p_task_key text, p_session_id text, p_is_correct boolean, p_checklist_id uuid DEFAULT NULL, p_comment text DEFAULT '') RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_session_id IS NULL OR length(p_session_id) = 0 OR length(p_session_id) > 100 OR p_is_correct IS NULL OR length(coalesce(p_comment, '')) > 1000 THEN
    RAISE EXCEPTION 'Invalid feedback' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.sources s WHERE s.task_key = p_task_key) THEN
    RAISE EXCEPTION 'Invalid task' USING ERRCODE = '22023';
  END IF;
  IF p_checklist_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.checklists c WHERE c.id = p_checklist_id AND c.task_key = p_task_key AND c.session_id = p_session_id AND c.user_id IS NOT DISTINCT FROM auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.feedback (checklist_id, task_key, session_id, is_correct, comment, user_id)
  VALUES (p_checklist_id, p_task_key, p_session_id, p_is_correct, nullif(btrim(p_comment), ''), auth.uid())
  ON CONFLICT (checklist_id, session_id) DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_checklist_feedback(text, text, boolean, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_checklist_feedback(text, text, boolean, uuid, text) TO anon, authenticated, service_role;