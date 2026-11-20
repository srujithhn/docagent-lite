CREATE OR REPLACE FUNCTION public.prevent_duplicate_user_document()
RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.user_id = OLD.user_id AND NEW.doc_type = OLD.doc_type THEN
      RETURN NEW;
    END IF;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text, 0));
  IF EXISTS (SELECT 1 FROM public.user_documents d WHERE d.user_id = NEW.user_id AND d.doc_type = NEW.doc_type AND d.id <> NEW.id) THEN
    RAISE EXCEPTION 'You''ve already added this document' USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.prevent_duplicate_user_document() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER prevent_duplicate_user_document BEFORE INSERT OR UPDATE OF user_id, doc_type ON public.user_documents FOR EACH ROW EXECUTE FUNCTION public.prevent_duplicate_user_document();

CREATE OR REPLACE FUNCTION public.admin_metrics()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = auth.uid() AND lower(u.email) = 'srujithh@gmail.com') THEN
    RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501';
  END IF;
  SELECT jsonb_build_object(
    'signups', (SELECT count(*) FROM auth.users),
    'checklists_total', (SELECT count(*) FROM checklists),
    'per_task', (SELECT coalesce(jsonb_agg(jsonb_build_object('task_name', s.task_name, 'count', (SELECT count(*) FROM checklists c WHERE c.task_key = s.task_key)) ORDER BY s.task_name), '[]'::jsonb) FROM sources s),
    'feedback_total', (SELECT count(*) FROM feedback),
    'thumbs_up', (SELECT count(*) FROM feedback WHERE is_correct),
    'returning_users', (SELECT count(*) FROM (SELECT coalesce(user_id::text, session_id) k FROM checklists WHERE coalesce(user_id::text, session_id) IS NOT NULL GROUP BY 1 HAVING max(created_at) - min(created_at) >= interval '7 days') x),
    'per_day', (SELECT jsonb_agg(jsonb_build_object('day', d::date, 'count', (SELECT count(*) FROM checklists c WHERE c.created_at::date = d::date)) ORDER BY d) FROM generate_series(current_date - 29, current_date, interval '1 day') d)
  ) INTO r;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.admin_metrics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_metrics() TO authenticated;