-- Lets Google/Apple sign-in coexist with the mandatory-referral-code rule
-- in handle_new_user(). OAuth signups can't carry our own signup metadata
-- into the new auth.users row - GoTrue creates it directly from the
-- provider's profile, with no client-controlled options.data the way
-- supabase.auth.signUp() has. So the referral code travels through a
-- short-lived side channel instead: the client stakes out a claim before
-- redirecting to the provider, then redeems it once back in the app with a
-- live session - see src/lib/auth-context.tsx (signInWithOAuth) and
-- src/routes/auth.callback.tsx.

create table public.pending_referral_claims (
  id uuid primary key default gen_random_uuid(),
  referral_code text not null,
  created_at timestamptz not null default now()
);

-- No RLS policies - same "nothing client-reachable except through the
-- SECURITY DEFINER functions below" shape as suspension_master_code
-- (20260827030000_user_suspension_master_code.sql).
alter table public.pending_referral_claims enable row level security;

-- Validates the code and stakes out a claim before the OAuth redirect, so a
-- bad code fails immediately instead of after a round trip through Google
-- or Apple. Callable while signed out (anon) - that's the whole point.
create or replace function public.create_pending_referral_claim(_referral_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _code text := upper(trim(_referral_code));
  _claim_id uuid;
begin
  if _code = '' then
    raise exception 'A referral code is required';
  end if;

  if not exists (
    select 1
    from public.profiles p
    join public.user_roles ur on ur.user_id = p.id and ur.role = 'agent'
    where p.referral_code = _code
  ) then
    raise exception 'Invalid or expired referral code';
  end if;

  delete from public.pending_referral_claims where created_at < now() - interval '30 minutes';

  insert into public.pending_referral_claims (referral_code) values (_code)
  returning id into _claim_id;

  return _claim_id;
end;
$$;

grant execute on function public.create_pending_referral_claim(text) to anon, authenticated;

-- Redeems a claim once the OAuth session exists. Re-validates the code live
-- (an agent could have been demoted in the interim) and only ever touches
-- the caller's own row, only while it has no referrer yet - never
-- overwrites an existing parent_id, so this can't be used to hijack an
-- already-referred player even if a claim id leaked.
create or replace function public.claim_pending_referral(_claim_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _referral_code text;
  _referrer_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  if exists (select 1 from public.profiles where id = auth.uid() and parent_id is not null) then
    delete from public.pending_referral_claims where id = _claim_id;
    return;
  end if;

  select referral_code into _referral_code
  from public.pending_referral_claims
  where id = _claim_id and created_at > now() - interval '30 minutes';

  if _referral_code is null then
    raise exception 'This referral link has expired. Please try again.';
  end if;

  select p.id into _referrer_id
  from public.profiles p
  join public.user_roles ur on ur.user_id = p.id and ur.role = 'agent'
  where p.referral_code = _referral_code;

  if _referrer_id is null then
    delete from public.pending_referral_claims where id = _claim_id;
    raise exception 'Invalid or expired referral code';
  end if;

  -- profiles_prevent_parent_self_assignment (20260825040000) blocks a plain
  -- self-update of parent_id from anyone but is_admin/is_ultra_admin - this
  -- transaction-local flag is that trigger's escape hatch for this one
  -- already-validated write, without loosening the guard for anything else.
  perform set_config('app.allow_parent_claim', 'on', true);
  update public.profiles set parent_id = _referrer_id where id = auth.uid();

  delete from public.pending_referral_claims where id = _claim_id;
end;
$$;

grant execute on function public.claim_pending_referral(uuid) to authenticated;

create or replace function public.prevent_profile_parent_self_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.parent_id is distinct from old.parent_id
     and auth.uid() = new.id
     and not public.is_admin(auth.uid())
     and not public.is_ultra_admin(auth.uid())
     and coalesce(current_setting('app.allow_parent_claim', true), '') <> 'on' then
    new.parent_id := old.parent_id;
  end if;
  return new;
end;
$$;

-- handle_new_user (20260909000000): email/password signups still require a
-- valid referral code up front exactly as before - register.tsx still
-- passes it as signup metadata. OAuth providers skip that check here and
-- get parent_id = null instead of a hard failure, since GoTrue creates
-- this row directly from the provider profile with no way for us to have
-- validated a code first. The pending claim above is what actually attaches
-- a referrer afterwards; until it's redeemed the account simply has none.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate_username text;
  final_username text;
  suffix text;
  new_wallet_id uuid;
  opening_balance numeric(14, 2) := 1000.00;
  _referral_code text;
  _referrer_id uuid;
  _provider text;
begin
  _provider := coalesce(new.raw_app_meta_data ->> 'provider', 'email');

  if _provider = 'email' then
    _referral_code := upper(trim(coalesce(new.raw_user_meta_data ->> 'referral_code', '')));
    if _referral_code = '' then
      raise exception 'A referral code is required to sign up';
    end if;

    select p.id into _referrer_id
    from public.profiles p
    join public.user_roles ur on ur.user_id = p.id and ur.role = 'agent'
    where p.referral_code = _referral_code;

    if _referrer_id is null then
      raise exception 'Invalid or expired referral code';
    end if;
  else
    _referrer_id := null;
  end if;

  candidate_username := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(new.email, '@', 1)
  );
  candidate_username := regexp_replace(candidate_username, '\s+', '_', 'g');
  final_username := candidate_username;

  while exists (select 1 from public.profiles where username = final_username) loop
    suffix := substr(replace(gen_random_uuid()::text, '-', ''), 1, 4);
    final_username := candidate_username || '_' || suffix;
  end loop;

  insert into public.profiles (id, username, email, parent_id)
  values (new.id, final_username, new.email, _referrer_id);

  insert into public.user_roles (user_id, role)
  values (new.id, 'player');

  insert into public.wallets (user_id, available_balance, lifetime_virtual_staked, lifetime_virtual_returned)
  values (new.id, opening_balance, 0, 0)
  returning id into new_wallet_id;

  insert into public.wallet_transactions (
    user_id, wallet_id, transaction_type, amount, balance_before, balance_after, reference_type, description
  ) values (
    new.id, new_wallet_id, 'simulation_credit', opening_balance, 0, opening_balance, 'signup_bonus',
    'Welcome simulation credits'
  );

  return new;
end;
$$;
