
alter table public.profiles add column referral_balance numeric(12,2) not null default 0;
alter table public.withdrawals add column wallet text not null default 'earnings';

create or replace function public.credit_wallet(_user uuid, _amount numeric, _kind text, _desc text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if _kind = 'referral' or _kind = 'referral_refund' then
    update public.profiles set referral_balance = referral_balance + _amount where id = _user;
  else
    update public.profiles set balance = balance + _amount where id = _user;
  end if;
  insert into public.transactions (user_id, amount, kind, description) values (_user, _amount, _kind, _desc);
end $$;
revoke all on function public.credit_wallet(uuid, numeric, text, text) from public, anon, authenticated;
grant execute on function public.credit_wallet(uuid, numeric, text, text) to service_role;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare _code text; _ref uuid; _first boolean;
begin
  perform pg_advisory_xact_lock(4242);
  _first := not exists (select 1 from public.user_roles where role = 'admin');
  loop
    _code := upper(substr(md5(random()::text), 1, 7));
    exit when not exists (select 1 from public.profiles where referral_code = _code);
  end loop;
  select id into _ref from public.profiles where referral_code = upper(coalesce(new.raw_user_meta_data->>'ref',''));
  insert into public.profiles (id, full_name, email, phone, referral_code, referred_by)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
          new.email, coalesce(new.raw_user_meta_data->>'phone',''), _code, _ref);
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  if _first then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $$;

create or replace function public.admin_approve_activation(_payment uuid, _approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare p record; prof record;
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Forbidden'; end if;
  select * into p from public.activation_payments where id = _payment for update;
  if p is null or p.status in ('approved','rejected') then raise exception 'Payment already handled'; end if;
  if not _approve then
    update public.activation_payments set status = 'rejected' where id = _payment; return;
  end if;
  select * into prof from public.profiles where id = p.user_id for update;
  if prof.is_activated then raise exception 'User already activated'; end if;
  update public.activation_payments set status = 'approved' where id = _payment;
  update public.profiles set is_activated = true, activated_at = now() where id = p.user_id;
  perform public.credit_wallet(p.user_id, 100, 'activation', 'Activation fee deposited to wallet');
  if prof.referred_by is not null and exists (select 1 from public.profiles where id = prof.referred_by and is_activated) then
    perform public.credit_wallet(prof.referred_by, 20, 'referral', 'Referral bonus: ' || coalesce(nullif(prof.full_name,''),'new member'));
  end if;
end $$;

drop function public.request_withdrawal(numeric, text);
create or replace function public.request_withdrawal(_amount numeric, _phone text, _wallet text)
returns void language plpgsql security definer set search_path = public as $$
declare prof record; refs int;
begin
  select * into prof from public.profiles where id = auth.uid() for update;
  if not prof.is_activated then raise exception 'Activate your account first'; end if;
  if length(_phone) < 10 or length(_phone) > 13 then raise exception 'Invalid phone'; end if;
  if _amount <= 0 then raise exception 'Invalid amount'; end if;
  if _wallet = 'referral' then
    select count(*) into refs from public.profiles where referred_by = auth.uid() and is_activated;
    if refs < 3 then raise exception 'You need at least 3 activated referrals to withdraw'; end if;
    if prof.referral_balance < 60 then raise exception 'Referral wallet must reach KSh 60'; end if;
    if _amount > prof.referral_balance then raise exception 'Insufficient referral balance'; end if;
    update public.profiles set referral_balance = referral_balance - _amount where id = auth.uid();
  elsif _wallet = 'earnings' then
    if prof.balance < 600 then raise exception 'Earnings wallet must reach KSh 600'; end if;
    if _amount > prof.balance - 100 then raise exception 'KSh 100 activation fee must stay in your account'; end if;
    update public.profiles set balance = balance - _amount where id = auth.uid();
  else
    raise exception 'Invalid wallet';
  end if;
  insert into public.transactions (user_id, amount, kind, description) values (auth.uid(), -_amount, 'withdrawal', initcap(_wallet) || ' withdrawal to ' || _phone);
  insert into public.withdrawals (user_id, amount, phone, wallet) values (auth.uid(), _amount, _phone, _wallet);
end $$;

create or replace function public.admin_process_withdrawal(_id uuid, _paid boolean)
returns void language plpgsql security definer set search_path = public as $$
declare w record;
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Forbidden'; end if;
  select * into w from public.withdrawals where id = _id for update;
  if w is null or w.status <> 'pending' then raise exception 'Already processed'; end if;
  if _paid then
    update public.withdrawals set status = 'paid', processed_at = now() where id = _id;
  else
    update public.withdrawals set status = 'rejected', processed_at = now() where id = _id;
    perform public.credit_wallet(w.user_id, w.amount, case when w.wallet = 'referral' then 'referral_refund' else 'refund' end, 'Withdrawal rejected - refunded');
  end if;
end $$;
