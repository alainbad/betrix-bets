-- Mandatory referral-code signup: every super_agent/agent gets a shareable
-- code, and every NEW signup from here on must supply one to be listed
-- under that agent - the only way parent_id gets set at signup time now
-- (previously null / unassigned until an agent later claimed the player via
-- assign_player_to_agent, which still works for pre-existing unclaimed
-- accounts but is no longer how a *new* signup ends up assigned).

alter table public.profiles add column referral_code text;
alter table public.profiles add constraint profiles_referral_code_unique unique (referral_code);

-- Auto-generates a code the first time an account is granted super_agent or
-- agent, from any of the existing promotion paths (promote_to_super_agent,
-- promote_to_agent, ultra_admin_set_hierarchy_role) - a single trigger here
-- instead of duplicating generation logic into each of those RPCs. Fires on
-- every user_roles insert (including the 'player' row every signup gets)
-- but no-ops immediately for any role other than super_agent/agent, and
-- again if the account already has a code - so re-promotion after a
-- Make Player demotion reuses the same code rather than minting a new one,
-- keeping previously shared links/codes working.
create function public.generate_agent_referral_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _candidate text;
  _attempts int := 0;
begin
  if new.role not in ('super_agent', 'agent') then
    return new;
  end if;

  if exists (select 1 from public.profiles where id = new.user_id and referral_code is not null) then
    return new;
  end if;

  loop
    _candidate := 'REF-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    exit when not exists (select 1 from public.profiles where referral_code = _candidate);
    _attempts := _attempts + 1;
    if _attempts > 20 then
      raise exception 'Unable to generate a unique referral code after % attempts', _attempts;
    end if;
  end loop;

  update public.profiles set referral_code = _candidate where id = new.user_id;
  return new;
end;
$$;

create trigger user_roles_generate_referral_code
  after insert on public.user_roles
  for each row execute function public.generate_agent_referral_code();

-- Backfill: every account that's already a super_agent or agent (bootstrap,
-- earlier promotions in this session) gets a code retroactively too, not
-- just future ones.
do $$
declare
  _row record;
  _candidate text;
  _attempts int;
begin
  for _row in
    select p.id
    from public.profiles p
    join public.user_roles ur on ur.user_id = p.id and ur.role in ('super_agent', 'agent')
    where p.referral_code is null
  loop
    _attempts := 0;
    loop
      _candidate := 'REF-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
      exit when not exists (select 1 from public.profiles where referral_code = _candidate);
      _attempts := _attempts + 1;
      if _attempts > 20 then
        raise exception 'Unable to generate a unique referral code after % attempts', _attempts;
      end if;
    end loop;
    update public.profiles set referral_code = _candidate where id = _row.id;
  end loop;
end $$;

-- Requires + resolves a referral code at signup, same transaction as the
-- rest of provisioning - an invalid/missing code raises, which rolls back
-- the whole auth.users insert too (GoTrue's signup and this AFTER INSERT
-- trigger run in one transaction), so no orphaned auth user is ever left
-- behind by a rejected signup. Validated against a LIVE super_agent/agent
-- role check (not just "a code exists") - see the docstring above the
-- referral-code generation trigger for why: a demoted account's code stops
-- working immediately with no separate cleanup step, and starts working
-- again automatically if they're re-promoted.
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
begin
  _referral_code := upper(trim(coalesce(new.raw_user_meta_data ->> 'referral_code', '')));
  if _referral_code = '' then
    raise exception 'A referral code is required to sign up';
  end if;

  select p.id into _referrer_id
  from public.profiles p
  join public.user_roles ur on ur.user_id = p.id and ur.role in ('super_agent', 'agent')
  where p.referral_code = _referral_code;

  if _referrer_id is null then
    raise exception 'Invalid or expired referral code';
  end if;

  candidate_username := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
    split_part(new.email, '@', 1)
  );
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
