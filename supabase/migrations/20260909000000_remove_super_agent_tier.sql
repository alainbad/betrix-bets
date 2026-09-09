-- Flattens the hierarchy from ultra_admin -> super_agent -> agent -> player
-- down to ultra_admin -> agent -> player. Confirmed zero accounts currently
-- hold 'super_agent' before writing this (a fresh platform), so this is a
-- pure capability removal, not a data migration - no account needs
-- reassigning.
--
-- The app_role enum value 'super_agent' itself is left in place: Postgres
-- has no ALTER TYPE ... DROP VALUE, and recreating the enum (new type, cast
-- every column across roles/user_roles/role_permissions, drop the old type,
-- rename) is real risk for zero functional benefit once nothing in the app
-- can ever grant or check for it again. It becomes a harmless, permanently
-- unused label.

-- ============================================================
-- Retire RPCs that only existed to serve the super_agent tier, or that
-- ultra_admin_set_hierarchy_role/ultra_admin_topup_wallet already make
-- redundant now that ultra_admin promotes and funds agents directly.
-- ============================================================
drop function if exists public.promote_to_super_agent(text);
drop function if exists public.promote_to_agent(text);
drop function if exists public.mint_super_agent_balance(text, numeric);
drop function if exists public.transfer_agent_to_agent(text, numeric);
drop function if exists public.reclaim_agent_balance(uuid, numeric);

-- ============================================================
-- Redefine every remaining function that referenced is_super_agent, with
-- that tier dropped from its checks. Bodies are otherwise byte-identical
-- to their current definitions.
-- ============================================================

create or replace function public.resolve_account_id(p_identifier text)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _cleaned text := trim(p_identifier);
  _user_id uuid;
begin
  if not (public.is_ultra_admin(auth.uid()) or public.is_agent_tier(auth.uid())) then
    raise exception 'Unauthorized: hierarchy tier privileges required';
  end if;

  if _cleaned is null or _cleaned = '' then
    raise exception 'Identifier must not be empty';
  end if;

  select id into _user_id from public.profiles where account_id = upper(_cleaned);
  if _user_id is not null then return _user_id; end if;

  select id into _user_id from public.profiles where email = lower(_cleaned);
  if _user_id is not null then return _user_id; end if;

  select id into _user_id from public.profiles
  where phone is not null and phone <> ''
    and regexp_replace(phone, '[^0-9+]', '', 'g') = regexp_replace(_cleaned, '[^0-9+]', '', 'g');
  if _user_id is not null then return _user_id; end if;

  raise exception 'No account found matching "%"', p_identifier;
end;
$$;

create or replace function public.preview_account(p_identifier text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _user_id uuid := public.resolve_account_id(p_identifier);
  _username text;
  _role text;
begin
  select username into _username from public.profiles where id = _user_id;

  select role into _role from public.user_roles
  where user_id = _user_id and role in ('ultra_admin', 'agent', 'player')
  limit 1;

  return jsonb_build_object(
    'user_id', _user_id,
    'username', _username,
    'role', coalesce(_role, 'player')
  );
end;
$$;

create or replace function public.assign_player_to_agent(p_player_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _caller_id uuid := auth.uid();
  _player_id uuid;
  _player_parent uuid;
begin
  if not public.is_agent_tier(_caller_id) then
    raise exception 'Unauthorized: agent privileges required';
  end if;

  select id, parent_id into _player_id, _player_parent
  from public.profiles
  where email = p_player_email;

  if _player_id is null then
    raise exception 'No account found with email %', p_player_email;
  end if;

  if not public.has_role(_player_id, 'player') then
    raise exception 'Target account is not a player';
  end if;

  if _player_parent is not null then
    raise exception 'This player is already assigned to an agent';
  end if;

  update public.profiles set parent_id = _caller_id where id = _player_id;

  return jsonb_build_object('success', true, 'player_id', _player_id);
end;
$$;

create or replace function public.transfer_agent_to_player(p_target_identifier text, p_amount numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _caller_id uuid := auth.uid();
  _player_id uuid;
  _sender_wallet_id uuid;
  _sender_balance numeric;
  _player_wallet_id uuid;
  _player_balance numeric;
  _transfer_id uuid := gen_random_uuid();
begin
  if not public.is_agent_tier(_caller_id) then
    raise exception 'Unauthorized: agent privileges required';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Top-up amount must be greater than zero';
  end if;

  _player_id := public.resolve_account_id(p_target_identifier);

  if not public.has_role(_player_id, 'player') then
    raise exception 'Target is not a player';
  end if;

  if _player_id not in (select id from public.get_all_downline_ids(_caller_id)) then
    raise exception 'Player is not in the caller''s downline';
  end if;

  select id, available_balance into _sender_wallet_id, _sender_balance
  from public.wallets where user_id = _caller_id for update;
  if _sender_balance < p_amount then
    raise exception 'Insufficient balance';
  end if;

  select id, available_balance into _player_wallet_id, _player_balance
  from public.wallets where user_id = _player_id for update;
  if _player_wallet_id is null then
    raise exception 'Player wallet not found';
  end if;

  update public.wallets set available_balance = available_balance - p_amount where id = _sender_wallet_id;
  update public.wallets set available_balance = available_balance + p_amount where id = _player_wallet_id;

  insert into public.wallet_transactions (
    user_id, wallet_id, transaction_type, amount, balance_before, balance_after, reference_type, reference_id
  ) values (
    _caller_id, _sender_wallet_id, 'agent_topup', -p_amount, _sender_balance, _sender_balance - p_amount,
    'agent_player_topup', _transfer_id
  ), (
    _player_id, _player_wallet_id, 'agent_topup', p_amount, _player_balance, _player_balance + p_amount,
    'agent_player_topup', _transfer_id
  );

  return jsonb_build_object('success', true, 'new_balance', _sender_balance - p_amount);
end;
$$;

create or replace function public.cashout_player_to_agent(p_target_identifier text, p_amount numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _caller_id uuid := auth.uid();
  _player_id uuid;
  _player_wallet_id uuid;
  _player_balance numeric;
  _agent_wallet_id uuid;
  _agent_balance numeric;
  _transfer_id uuid := gen_random_uuid();
begin
  if not public.is_agent_tier(_caller_id) then
    raise exception 'Unauthorized: agent privileges required';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Cashout amount must be greater than zero';
  end if;

  _player_id := public.resolve_account_id(p_target_identifier);

  if not public.has_role(_player_id, 'player') then
    raise exception 'Target is not a player';
  end if;

  if _player_id not in (select id from public.get_all_downline_ids(_caller_id)) then
    raise exception 'Player is not in the caller''s downline';
  end if;

  select id, available_balance into _player_wallet_id, _player_balance
  from public.wallets where user_id = _player_id for update;
  if _player_wallet_id is null then
    raise exception 'Player wallet not found';
  end if;
  if _player_balance < p_amount then
    raise exception 'Player has insufficient balance to cash out';
  end if;

  select id, available_balance into _agent_wallet_id, _agent_balance
  from public.wallets where user_id = _caller_id for update;

  update public.wallets set available_balance = available_balance - p_amount where id = _player_wallet_id;
  update public.wallets set available_balance = available_balance + p_amount where id = _agent_wallet_id;

  insert into public.wallet_transactions (
    user_id, wallet_id, transaction_type, amount, balance_before, balance_after, reference_type, reference_id
  ) values (
    _player_id, _player_wallet_id, 'agent_cashout', -p_amount, _player_balance, _player_balance - p_amount,
    'agent_player_cashout', _transfer_id
  ), (
    _caller_id, _agent_wallet_id, 'agent_cashout', p_amount, _agent_balance, _agent_balance + p_amount,
    'agent_player_cashout', _transfer_id
  );

  return jsonb_build_object('success', true, 'new_balance', _agent_balance + p_amount);
end;
$$;

create or replace function public.ultra_admin_set_hierarchy_role(p_target_identifier text, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _target_id uuid;
begin
  if not public.is_ultra_admin(auth.uid()) then
    raise exception 'Unauthorized: ultra_admin privileges required';
  end if;

  if p_role not in ('agent', 'player') then
    raise exception 'Role must be agent or player';
  end if;

  _target_id := public.resolve_account_id(p_target_identifier);

  if p_role = 'player' then
    if not public.is_agent_tier(_target_id) then
      raise exception 'Target does not currently hold an agent role';
    end if;

    delete from public.user_roles
    where user_id = _target_id and role = 'agent';

    return jsonb_build_object('success', true, 'user_id', _target_id, 'role', 'player');
  end if;

  if public.is_agent_tier(_target_id)
     or public.is_ultra_admin(_target_id) or public.is_admin(_target_id) then
    raise exception 'This account already has a hierarchy role';
  end if;

  insert into public.user_roles (user_id, role) values (_target_id, p_role::public.app_role);

  return jsonb_build_object('success', true, 'user_id', _target_id, 'role', p_role);
end;
$$;

create or replace function public.suspend_user(p_target_identifier text, p_master_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _caller_id uuid := auth.uid();
  _target_id uuid;
  _stored_hash text;
begin
  if not (public.is_ultra_admin(_caller_id) or public.is_agent_tier(_caller_id)) then
    raise exception 'Unauthorized: hierarchy tier privileges required';
  end if;

  select code_hash into _stored_hash from public.suspension_master_code where id = true;
  if _stored_hash is null then
    raise exception 'No master code has been configured yet';
  end if;
  if p_master_code is null or extensions.crypt(p_master_code, _stored_hash) <> _stored_hash then
    raise exception 'Incorrect master code';
  end if;

  _target_id := public.resolve_account_id(p_target_identifier);

  if _target_id = _caller_id then
    raise exception 'You cannot suspend your own account';
  end if;

  if public.is_ultra_admin(_target_id) then
    raise exception 'Cannot suspend the platform ultra_admin account';
  end if;

  if not public.is_ultra_admin(_caller_id)
     and _target_id not in (select id from public.get_all_downline_ids(_caller_id)) then
    raise exception 'That account is not in your downline';
  end if;

  update public.profiles set status = 'suspended' where id = _target_id;

  return jsonb_build_object('success', true, 'user_id', _target_id, 'status', 'suspended');
end;
$$;

create or replace function public.reactivate_user(p_target_identifier text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _caller_id uuid := auth.uid();
  _target_id uuid;
begin
  if not (public.is_ultra_admin(_caller_id) or public.is_agent_tier(_caller_id)) then
    raise exception 'Unauthorized: hierarchy tier privileges required';
  end if;

  _target_id := public.resolve_account_id(p_target_identifier);

  if not public.is_ultra_admin(_caller_id)
     and _target_id not in (select id from public.get_all_downline_ids(_caller_id)) then
    raise exception 'That account is not in your downline';
  end if;

  update public.profiles set status = 'active' where id = _target_id and status = 'suspended';

  return jsonb_build_object('success', true, 'user_id', _target_id, 'status', 'active');
end;
$$;

create or replace function public.player_request_withdrawal(p_amount numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _caller_id uuid := auth.uid();
  _agent_id uuid;
  _wallet_id uuid;
  _available numeric;
  _request_id uuid;
begin
  if _caller_id is null or not exists(select 1 from public.profiles where id=_caller_id and status='active') then raise exception 'Active account required'; end if;
  if public.is_ultra_admin(_caller_id) or public.is_agent_tier(_caller_id) then raise exception 'Player account required'; end if;
  if p_amount is null or p_amount <= 0 or p_amount<>round(p_amount,2) or p_amount>100000 then
    raise exception 'Withdrawal amount must be greater than zero';
  end if;

  select parent_id into _agent_id from public.profiles where id = _caller_id;
  if _agent_id is null or not exists(select 1 from public.profiles p where p.id=_agent_id and p.status='active' and public.is_agent_tier(p.id)) then
    raise exception 'Account must be assigned to an agent to request withdrawals';
  end if;

  select id, available_balance into _wallet_id, _available
  from public.wallets where user_id = _caller_id for update;

  if _wallet_id is null then raise exception 'Wallet not found'; end if;
  if _available < p_amount then
    raise exception 'Insufficient balance to request withdrawal';
  end if;

  update public.wallets
  set available_balance = available_balance - p_amount,
      reserved_balance = reserved_balance + p_amount
  where id = _wallet_id;

  insert into public.withdrawal_requests (player_id, agent_id, amount, status)
  values (_caller_id, _agent_id, p_amount, 'pending_agent_review')
  returning id into _request_id;

  insert into public.wallet_transactions (
    user_id, wallet_id, transaction_type, amount, balance_before, balance_after, reference_type, reference_id, description
  ) values (
    _caller_id, _wallet_id, 'withdrawal_lock', -p_amount, _available, _available - p_amount,
    'withdrawal_request', _request_id, 'Withdrawal request locked'
  );

  return jsonb_build_object('success', true, 'request_id', _request_id);
end;
$$;

create or replace function public.agent_approve_withdrawal(p_request_id uuid, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _caller_id uuid := auth.uid();
  _req public.withdrawal_requests%rowtype;
begin
  if _caller_id is null or not exists(select 1 from public.profiles where id=_caller_id and status='active') then raise exception 'Active account required'; end if;
  select * into _req from public.withdrawal_requests where id = p_request_id for update;
  if _req.id is null then raise exception 'Withdrawal request not found'; end if;
  if not public.is_ultra_admin(_caller_id) and (_req.agent_id <> _caller_id or not public.is_agent_tier(_caller_id)) then
    raise exception 'Unauthorized: Only the assigned agent can review this request';
  end if;
  if _req.status <> 'pending_agent_review' then
    raise exception 'Request is not in pending agent review state';
  end if;

  update public.withdrawal_requests
  set status = 'agent_approved_pending_ultra',
      agent_note = coalesce(p_note, agent_note)
  where id = p_request_id;

  return jsonb_build_object('success', true, 'status', 'agent_approved_pending_ultra');
end;
$$;

create or replace function public.settle_player_withdrawal(p_request_id uuid, p_offline_ref text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _caller_id uuid := auth.uid();
  _req public.withdrawal_requests%rowtype;
  _wallet_id uuid;
  _locked numeric;
  _avail numeric;
begin
  if _caller_id is null or not exists(select 1 from public.profiles where id=_caller_id and status='active') then raise exception 'Active account required'; end if;
  select * into _req from public.withdrawal_requests where id = p_request_id for update;
  if _req.id is null then raise exception 'Withdrawal request not found'; end if;
  if not public.is_ultra_admin(_caller_id) and (_req.agent_id <> _caller_id or not public.is_agent_tier(_caller_id)) then
    raise exception 'Unauthorized: Only the assigned agent or ultra_admin can settle';
  end if;
  if length(trim(coalesce(p_offline_ref,''))) < 3 then raise exception 'A test settlement reference is required'; end if;
  if _req.status <> 'ultra_approved_ready_payout' then
    raise exception 'Request has not received final Ultra Admin approval yet';
  end if;

  select id, reserved_balance, available_balance into _wallet_id, _locked, _avail
  from public.wallets where user_id = _req.player_id for update;

  if _locked < _req.amount then
    raise exception 'System error: Locked wallet funds do not cover requested amount';
  end if;

  update public.wallets
  set reserved_balance = reserved_balance - _req.amount
  where id = _wallet_id;

  update public.withdrawal_requests
  set status = 'completed',
      offline_payout_reference = p_offline_ref
  where id = p_request_id;

  insert into public.wallet_transactions (
    user_id, wallet_id, transaction_type, amount, balance_before, balance_after, reference_type, reference_id, description
  ) values (
    _req.player_id, _wallet_id, 'withdrawal_settlement', 0, _avail, _avail,
    'withdrawal_settlement', p_request_id, 'Test withdrawal settled; reserved credits released, available balance unchanged'
  );

  return jsonb_build_object('success', true, 'status', 'completed');
end;
$$;

create or replace function public.reject_withdrawal_request(p_request_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _caller_id uuid := auth.uid();
  _req public.withdrawal_requests%rowtype;
  _wallet_id uuid;
  _locked numeric;
  _avail numeric;
begin
  if _caller_id is null or not exists(select 1 from public.profiles where id=_caller_id and status='active') then raise exception 'Active account required'; end if;
  select * into _req from public.withdrawal_requests where id = p_request_id for update;
  if _req.id is null then raise exception 'Request not found'; end if;
  if not public.is_ultra_admin(_caller_id) and (_req.agent_id <> _caller_id or not public.is_agent_tier(_caller_id)) then
    raise exception 'Unauthorized: Only agent or ultra_admin can reject requests';
  end if;
  if length(trim(coalesce(p_reason,''))) < 3 then raise exception 'A rejection reason is required'; end if;
  if _req.status in ('completed', 'rejected') then
    raise exception 'Request has already concluded';
  end if;

  select id, reserved_balance, available_balance into _wallet_id, _locked, _avail
  from public.wallets where user_id = _req.player_id for update;

  if _wallet_id is null or _locked < _req.amount then raise exception 'Reserved credits do not cover request'; end if;
  update public.wallets
  set reserved_balance = reserved_balance - _req.amount,
      available_balance = available_balance + _req.amount
  where id = _wallet_id;

  update public.withdrawal_requests
  set status = 'rejected',
      agent_note = coalesce(p_reason, agent_note)
  where id = p_request_id;

  insert into public.wallet_transactions (
    user_id, wallet_id, transaction_type, amount, balance_before, balance_after, reference_type, reference_id, description
  ) values (
    _req.player_id, _wallet_id, 'withdrawal_refund', _req.amount, _avail, _avail + _req.amount,
    'withdrawal_rejection', p_request_id, 'Withdrawal rejected: balance restored'
  );

  return jsonb_build_object('success', true, 'status', 'rejected');
end;
$$;

-- Referral codes: only 'agent' mints/keeps one now (there is no tier above
-- it that would also need to hand codes to new signups).
create or replace function public.generate_agent_referral_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _candidate text;
  _attempts int := 0;
begin
  if new.role <> 'agent' then
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
  join public.user_roles ur on ur.user_id = p.id and ur.role = 'agent'
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

-- ============================================================
-- Drop the now-unreferenced privilege helper and the catalog rows for a
-- role nothing can grant/hold anymore. Safe: zero user_roles rows use
-- 'super_agent' (verified before writing this migration).
-- ============================================================
drop function if exists public.is_super_agent(uuid);

delete from public.role_permissions where role = 'super_agent';
delete from public.roles where role = 'super_agent';
