CREATE TABLE public.poll_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  poll_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'Africa/Nairobi')::date),
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  reward numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, poll_date)
);
GRANT SELECT ON public.poll_completions TO authenticated;
GRANT ALL ON public.poll_completions TO service_role;
ALTER TABLE public.poll_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own polls" ON public.poll_completions FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.claim_daily_poll(_answers jsonb)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _reward numeric := 10; _today date := (now() AT TIME ZONE 'Africa/Nairobi')::date;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_activated) THEN RAISE EXCEPTION 'Activate your account first'; END IF;
  IF jsonb_typeof(_answers) <> 'object' OR (SELECT count(*) FROM jsonb_object_keys(_answers)) < 8 THEN RAISE EXCEPTION 'Please answer all 8 questions'; END IF;
  IF EXISTS (SELECT 1 FROM public.poll_completions WHERE user_id = auth.uid() AND poll_date = _today) THEN RAISE EXCEPTION 'You already did today''s poll. Come back tomorrow!'; END IF;
  INSERT INTO public.poll_completions (user_id, poll_date, answers, reward) VALUES (auth.uid(), _today, _answers, _reward);
  PERFORM public.credit_wallet(auth.uid(), _reward, 'poll', 'Daily poll bonus');
  RETURN _reward;
END $$;
REVOKE ALL ON FUNCTION public.claim_daily_poll(jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_daily_poll(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _code text; _ref uuid; _first boolean;
BEGIN
  PERFORM pg_advisory_xact_lock(4242);
  _first := NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin');
  LOOP
    _code := upper(substr(md5(random()::text), 1, 7));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = _code);
  END LOOP;
  SELECT id INTO _ref FROM public.profiles WHERE referral_code = upper(coalesce(new.raw_user_meta_data->>'ref','')) AND is_activated;
  INSERT INTO public.profiles (id, full_name, email, phone, referral_code, referred_by)
  VALUES (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
          new.email, coalesce(new.raw_user_meta_data->>'phone',''), _code, _ref);
  INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'user');
  IF _first THEN INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'admin'); END IF;
  RETURN new;
END $$;