CREATE TABLE public.sources (
  task_key text PRIMARY KEY,
  task_name text NOT NULL,
  official_url text NOT NULL,
  source_text text NOT NULL,
  last_verified date NOT NULL,
  status_note text NOT NULL DEFAULT 'Draft: verify against the official page'
);
GRANT SELECT ON public.sources TO anon, authenticated;
GRANT ALL ON public.sources TO service_role;
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sources are public" ON public.sources FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_key text NOT NULL REFERENCES public.sources(task_key),
  user_id uuid,
  session_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.checklists TO authenticated;
GRANT ALL ON public.checklists TO service_role;
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own checklists" ON public.checklists FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id uuid REFERENCES public.checklists(id) ON DELETE SET NULL,
  task_key text NOT NULL,
  is_correct boolean NOT NULL,
  comment text,
  user_id uuid,
  session_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.feedback TO anon;
GRANT SELECT, INSERT ON public.feedback TO authenticated;
GRANT ALL ON public.feedback TO service_role;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon can submit feedback" ON public.feedback FOR INSERT TO anon WITH CHECK (user_id IS NULL AND (comment IS NULL OR length(comment) <= 1000));
CREATE POLICY "Users submit own feedback" ON public.feedback FOR INSERT TO authenticated WITH CHECK ((user_id IS NULL OR user_id = auth.uid()) AND (comment IS NULL OR length(comment) <= 1000));
CREATE POLICY "Users read own feedback" ON public.feedback FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.user_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  doc_type text NOT NULL CHECK (doc_type IN ('Aadhaar','PAN','Passport','Driving licence','Voter ID','10th marksheet','12th marksheet','Birth certificate','Bank passbook','Income certificate','Caste certificate','Other')),
  expiry_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_documents TO authenticated;
GRANT ALL ON public.user_documents TO service_role;
ALTER TABLE public.user_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own docs select" ON public.user_documents FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own docs insert" ON public.user_documents FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own docs update" ON public.user_documents FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own docs delete" ON public.user_documents FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.admin_metrics()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  IF coalesce(lower(auth.jwt() ->> 'email'), '') <> 'srujithh@gmail.com' THEN
    RAISE EXCEPTION 'forbidden';
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
REVOKE ALL ON FUNCTION public.admin_metrics() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_metrics() TO authenticated;

INSERT INTO public.sources (task_key, task_name, official_url, source_text, last_verified) VALUES
('passport_fresh_adult','Fresh passport (adult)','https://www.passportindia.gov.in','Applicants need proof of present address, proof of date of birth and identity documents. Proof of present address: one document such as Aadhaar, Voter ID, water/electricity/telephone/gas bill, bank account passbook or statement, rent agreement, or Income Tax assessment order. The address on the proof must match the address in the application form. Proof of date of birth: one document such as birth certificate, school leaving or matriculation certificate, PAN card, Aadhaar, driving licence or voter ID with the full date of birth. Carry originals and self-attested photocopies to the Passport Seva Kendra. Use the official Document Advisor on Passport Seva for your exact case.','2026-11-19'),
('learner_licence_ka','Learner''s licence (Karnataka)','https://sarathi.parivahan.gov.in','Apply on the Parivahan Sarathi portal. Documents: Form 2 (application for learner''s licence), proof of age, proof of address, recent passport-size photographs, and Form 1 (self-declaration of physical fitness). Form 1A medical certificate is needed for transport vehicles and for older applicants. Accepted age proof includes birth certificate, school leaving certificate, Aadhaar or passport; address proof includes Aadhaar, passport, voter ID or utility bills. Minimum age is 18 for a motor vehicle with gears, 16 for gearless vehicles up to 50cc with guardian consent.','2026-11-19'),
('pan_new','New PAN card','https://www.incometaxindia.gov.in','Individuals need proof of identity, proof of address and proof of date of birth. Accepted documents include Aadhaar, Indian passport, driving licence and voter ID. The name on every document must match the name in the application exactly. Rules changed in 2026: check whether Aadhaar alone is accepted for date of birth or whether a separate proof of date of birth is needed. Apply through the Protean (NSDL) or UTIITSL portals.','2026-11-19'),
('nsp_scholarship','National Scholarship Portal application','https://scholarships.gov.in','Register once on NSP (One-Time Registration). Commonly needed: Aadhaar (or Aadhaar enrolment receipt), a bank account in the student''s own name seeded with Aadhaar for direct benefit transfer, income certificate, caste or community certificate if applying under a category, previous year marksheet, fee receipt, bonafide or student certificate from the institution, passport-size photo. Exact documents depend on the scheme. Note: Karnataka state scholarships go through the state SSP portal, not NSP.','2026-11-19'),
('bank_kyc','Open a bank account (KYC)','https://www.rbi.org.in','Banks need PAN (or Form 60 if you have no PAN) and one Officially Valid Document (OVD): passport, driving licence, proof of possession of Aadhaar, voter ID, NREGA job card signed by a state official, or letter from the National Population Register. If the OVD shows your current address, it works as both identity and address proof. People without any OVD can open a ''small account'' with limits.','2026-11-19');