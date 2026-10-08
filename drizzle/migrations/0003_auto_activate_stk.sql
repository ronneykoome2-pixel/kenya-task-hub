CREATE OR REPLACE FUNCTION public.auto_activate_payment(_payment uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record; prof record;
BEGIN
  SELECT * INTO p FROM public.activation_payments WHERE id = _payment FOR UPDATE;
  IF p IS NULL OR p.status <> 'paid' THEN RETURN; END IF;
  SELECT * INTO prof FROM public.profiles WHERE id = p.user_id FOR UPDATE;
  IF prof.is_activated THEN RETURN; END IF;
  UPDATE public.activation_payments SET status = 'approved' WHERE id = _payment;
  UPDATE public.profiles SET is_activated = true, activated_at = now() WHERE id = p.user_id;
  PERFORM public.credit_wallet(p.user_id, 100, 'activation', 'Activation fee deposited to wallet');
  IF prof.referred_by IS NOT NULL AND EXISTS (SELECT 1 FROM public.profiles WHERE id = prof.referred_by AND is_activated) THEN
    PERFORM public.credit_wallet(prof.referred_by, 20, 'referral', 'Referral bonus: ' || coalesce(nullif(prof.full_name,''),'new member'));
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.auto_activate_payment(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_activate_payment(uuid) TO service_role;