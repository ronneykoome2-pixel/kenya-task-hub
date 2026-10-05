
create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create policy "own roles readable" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create table public.profiles (
  id uuid primary key,
  full_name text not null default '',
  email text,
  phone text not null default '',
  referral_code text not null unique,
  referred_by uuid references public.profiles(id) on delete set null,
  is_activated boolean not null default false,
  activated_at timestamptz,
  balance numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "read own or admin" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12,2) not null,
  kind text not null,
  description text not null default '',
  created_at timestamptz not null default now()
);
grant select on public.transactions to authenticated;
grant all on public.transactions to service_role;
alter table public.transactions enable row level security;
create policy "read own tx or admin" on public.transactions for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create table public.activation_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  phone text not null,
  amount numeric(12,2) not null default 100,
  method text not null default 'stk',
  checkout_request_id text unique,
  mpesa_receipt text,
  status text not null default 'pending',
  note text,
  created_at timestamptz not null default now()
);
grant select on public.activation_payments to authenticated;
grant all on public.activation_payments to service_role;
alter table public.activation_payments enable row level security;
create policy "read own payments or admin" on public.activation_payments for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create table public.videos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  youtube_url text not null,
  reward numeric(12,2) not null default 10,
  duration_seconds int not null default 30,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.videos to authenticated;
grant all on public.videos to service_role;
alter table public.videos enable row level security;
create policy "activated or admin read videos" on public.videos for select to authenticated
  using (public.has_role(auth.uid(),'admin') or (active and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_activated)));

create table public.video_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, video_id)
);
grant select on public.video_views to authenticated;
grant all on public.video_views to service_role;
alter table public.video_views enable row level security;
create policy "read own views" on public.video_views for select to authenticated using (user_id = auth.uid());

create table public.survey_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  trans_id text not null unique,
  amount numeric(12,2) not null,
  status text not null default 'credited',
  created_at timestamptz not null default now()
);
grant select on public.survey_completions to authenticated;
grant all on public.survey_completions to service_role;
alter table public.survey_completions enable row level security;
create policy "read own surveys" on public.survey_completions for select to authenticated using (user_id = auth.uid());

create table public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12,2) not null,
  phone text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
grant select on public.withdrawals to authenticated;
grant all on public.withdrawals to service_role;
alter table public.withdrawals enable row level security;
create policy "read own withdrawals or admin" on public.withdrawals for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- New user -> profile
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare _code text; _ref uuid;
begin
  loop
    _code := upper(substr(md5(random()::text), 1, 7));
    exit when not exists (select 1 from public.profiles where referral_code = _code);
  end loop;
  select id into _ref from public.profiles where referral_code = upper(coalesce(new.raw_user_meta_data->>'ref',''));
  insert into public.profiles (id, full_name, email, phone, referral_code, referred_by)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
          new.email, coalesce(new.raw_user_meta_data->>'phone',''), _code, _ref);
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.credit_wallet(_user uuid, _amount numeric, _kind text, _desc text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set balance = balance + _amount where id = _user;
  insert into public.transactions (user_id, amount, kind, description) values (_user, _amount, _kind, _desc);
end $$;
revoke all on function public.credit_wallet(uuid, numeric, text, text) from public, anon, authenticated;
grant execute on function public.credit_wallet(uuid, numeric, text, text) to service_role;

create or replace function public.update_my_profile(_full_name text, _phone text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if length(_full_name) > 100 or length(_phone) > 20 then raise exception 'Invalid input'; end if;
  update public.profiles set full_name = _full_name, phone = _phone where id = auth.uid();
end $$;

create or replace function public.submit_manual_payment(_phone text, _code text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.profiles where id = auth.uid() and is_activated) then raise exception 'Already activated'; end if;
  if length(_code) < 8 or length(_code) > 15 or length(_phone) > 20 then raise exception 'Invalid M-Pesa code'; end if;
  insert into public.activation_payments (user_id, phone, method, mpesa_receipt, status)
  values (auth.uid(), _phone, 'manual', upper(_code), 'paid');
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
    perform public.credit_wallet(prof.referred_by, 50, 'referral', 'Referral bonus: ' || coalesce(nullif(prof.full_name,''),'new member'));
  end if;
end $$;

create or replace function public.claim_video_reward(_video uuid)
returns numeric language plpgsql security definer set search_path = public as $$
declare v record;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_activated) then raise exception 'Activate your account first'; end if;
  select * into v from public.videos where id = _video and active;
  if v is null then raise exception 'Video not found'; end if;
  insert into public.video_views (user_id, video_id) values (auth.uid(), _video);
  perform public.credit_wallet(auth.uid(), v.reward, 'video', 'Watched: ' || v.title);
  return v.reward;
exception when unique_violation then raise exception 'You already earned from this video';
end $$;

create or replace function public.request_withdrawal(_amount numeric, _phone text)
returns void language plpgsql security definer set search_path = public as $$
declare prof record;
begin
  select * into prof from public.profiles where id = auth.uid() for update;
  if not prof.is_activated then raise exception 'Activate your account first'; end if;
  if _amount < 800 then raise exception 'Minimum withdrawal is 800 KSh'; end if;
  if prof.balance < _amount then raise exception 'Insufficient balance'; end if;
  if length(_phone) < 10 or length(_phone) > 13 then raise exception 'Invalid phone'; end if;
  update public.profiles set balance = balance - _amount where id = auth.uid();
  insert into public.transactions (user_id, amount, kind, description) values (auth.uid(), -_amount, 'withdrawal', 'Withdrawal to ' || _phone);
  insert into public.withdrawals (user_id, amount, phone) values (auth.uid(), _amount, _phone);
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
    perform public.credit_wallet(w.user_id, w.amount, 'refund', 'Withdrawal rejected - refunded');
  end if;
end $$;

create or replace function public.admin_save_video(_id uuid, _title text, _url text, _reward numeric, _duration int, _active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Forbidden'; end if;
  if _reward < 0 or _reward > 1000 then raise exception 'Invalid reward'; end if;
  if _id is null then
    insert into public.videos (title, youtube_url, reward, duration_seconds, active) values (_title, _url, _reward, _duration, _active);
  else
    update public.videos set title=_title, youtube_url=_url, reward=_reward, duration_seconds=_duration, active=_active where id=_id;
  end if;
end $$;

create or replace function public.admin_delete_video(_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Forbidden'; end if;
  delete from public.videos where id = _id;
end $$;

create or replace function public.referral_count(_user uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.profiles where referred_by = _user and is_activated and _user = auth.uid()
$$;
