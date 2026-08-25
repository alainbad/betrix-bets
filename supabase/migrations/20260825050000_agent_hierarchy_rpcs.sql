-- 3-tier agent hierarchy (Phase 3): stored procedures. Separate transaction
-- from agent_hierarchy_schema.sql so the app_role/wallet_transaction_type
-- values it added are safe to reference here.
--
-- Every function below is SECURITY DEFINER, revoked from public and granted
-- only to authenticated, and re-validates the caller's role/ownership
-- itself (never trusts the client) - same convention as admin_topup_wallet
-- and play_html5_casino_round.

-- ============================================================
-- ROLE PROVISIONING
-- Normal signup (handle_new_user) always creates a plain 'player'. These
-- two RPCs are how a player account is promoted into the agent tree - there
-- is no other path to becoming a super_agent/agent. Provisioning a brand
-- new login (rather than promoting an existing one) needs the Supabase
-- Auth admin API from an Edge Function with the service-role key, which is
-- outside what a SQL migration can do - out of scope here.
-- ============================================================

create function public.promote_to_super_agent(p_target_email text)
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

  select id into _target_id from public.profiles where email = p_target_email;
  if _target_id is null then
    raise exception 'No account found with email %', p_target_email;
  end if;

  if public.is_super_agent(_target_id) or public.is_agent_tier(_target_id)
     or public.is_ultra_admin(_target_id) or public.is_admin(_target_id) then
    raise exception 'This account already has a hierarchy role';
  end if;

  insert into public.user_roles (user_id, role) values (_target_id, 'super_agent');

  return jsonb_build_object('success', true, 'user_id', _target_id, 'role', 'super_agent');
end;
$$;

create function public.promote_to_agent(p_target_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _caller_id uuid := auth.uid();
  _target_id uuid;
begin
  if not public.is_super_agent(_caller_id) then
    raise exception 'Unauthorized: super_agent privileges required';
  end if;

  select id into _target_id from public.profiles where email = p_target_email;
  if _target_id is null then
    raise exception 'No account found with email %', p_target_email;
  end if;

  if public.is_super_agent(_target_id) or public.is_agent_tier(_target_id)
     or public.is_ultra_admin(_target_id) or public.is_admin(_target_id) then
    raise exception 'This account already has a hierarchy role';
  end if;

  insert into public.user_roles (user_id, role) values (_target_id, 'agent');

  update public.profiles set parent_id = _caller_id where id = _target_id;

  return jsonb_build_object('success', true, 'user_id', _target_id, 'role', 'agent');
end;
$$;

-- Claims an existing, not-yet-claimed player account into the caller's
-- book. Only unclaimed players (parent_id is null) can be claimed, so one
-- agent can't pull a player out from under another agent's branch.
create function public.assign_player_to_agent(p_player_email text)
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
  if not (public.is_agent_tier(_caller_id) or public.is_super_agent(_caller_id)) then
    raise exception 'Unauthorized: agent or super_agent privileges required';
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

-- ============================================================
-- BALANCE MOVEMENT
-- All of these move coins within the existing wallets/wallet_transactions
-- ledger - "minting" credits a wallet with no offsetting debit anywhere
-- (that's the platform owner's infinite-supply tap), every other operation
-- debits one wallet and credits another, always inside one function-level
-- transaction so a failure partway through rolls back cleanly.
-- ============================================================

create function public.mint_super_agent_balance(p_super_agent_id uuid, p_amount numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _wallet_id uuid;
  _balance numeric;
begin
  if not public.is_ultra_admin(auth.uid()) then
    raise exception 'Unauthorized: ultra_admin privileges required';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Mint amount must be greater than zero';
  end if;

  if not public.is_super_agent(p_super_agent_id) then
    raise exception 'Target is not a super_agent';
  end if;

  select id, available_balance into _wallet_id, _balance
  from public.wallets
  where user_id = p_super_agent_id
  for update;

  if _wallet_id is null then
    raise exception 'Wallet not found for target';
  end if;

  update public.wallets
  set available_balance = available_balance + p_amount
  where id = _wallet_id;

  insert into public.wallet_transactions (
    user_id, wallet_id, transaction_type, amount, balance_before, balance_after, reference_type, description
  ) values (
    p_super_agent_id, _wallet_id, 'agent_mint', p_amount, _balance, _balance + p_amount,
    'ultra_admin_mint', 'Minted by ultra_admin ' || auth.uid()::text
  );

  return jsonb_build_object('success', true, 'new_balance', _balance + p_amount);
end;
$$;

create function public.transfer_agent_to_agent(p_receiver_id uuid, p_amount numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _caller_id uuid := auth.uid();
  _receiver_parent uuid;
  _sender_wallet_id uuid;
  _sender_balance numeric;
  _receiver_wallet_id uuid;
  _receiver_balance numeric;
  _transfer_id uuid := gen_random_uuid();
begin
  if not public.is_super_agent(_caller_id) then
    raise exception 'Unauthorized: super_agent privileges required';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Transfer amount must be greater than zero';
  end if;

  select parent_id into _receiver_parent from public.profiles where id = p_receiver_id;
  if _receiver_parent is distinct from _caller_id then
    raise exception 'Receiver is not a direct sub-agent of the caller';
  end if;

  select id, available_balance into _sender_wallet_id, _sender_balance
  from public.wallets where user_id = _caller_id for update;
  if _sender_wallet_id is null then
    raise exception 'Sender wallet not found';
  end if;
  if _sender_balance < p_amount then
    raise exception 'Insufficient balance';
  end if;

  select id, available_balance into _receiver_wallet_id, _receiver_balance
  from public.wallets where user_id = p_receiver_id for update;
  if _receiver_wallet_id is null then
    raise exception 'Receiver wallet not found';
  end if;

  update public.wallets set available_balance = available_balance - p_amount where id = _sender_wallet_id;
  update public.wallets set available_balance = available_balance + p_amount where id = _receiver_wallet_id;

  insert into public.wallet_transactions (
    user_id, wallet_id, transaction_type, amount, balance_before, balance_after, reference_type, reference_id
  ) values (
    _caller_id, _sender_wallet_id, 'agent_allocation', -p_amount, _sender_balance, _sender_balance - p_amount,
    'agent_transfer', _transfer_id
  ), (
    p_receiver_id, _receiver_wallet_id, 'agent_allocation', p_amount, _receiver_balance, _receiver_balance + p_amount,
    'agent_transfer', _transfer_id
  );

  return jsonb_build_object('success', true, 'new_balance', _sender_balance - p_amount);
end;
$$;

create function public.reclaim_agent_balance(p_agent_id uuid, p_amount numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _caller_id uuid := auth.uid();
  _agent_parent uuid;
  _agent_wallet_id uuid;
  _agent_balance numeric;
  _caller_wallet_id uuid;
  _caller_balance numeric;
  _transfer_id uuid := gen_random_uuid();
begin
  if not public.is_super_agent(_caller_id) then
    raise exception 'Unauthorized: super_agent privileges required';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Reclaim amount must be greater than zero';
  end if;

  select parent_id into _agent_parent from public.profiles where id = p_agent_id;
  if _agent_parent is distinct from _caller_id then
    raise exception 'Target is not a direct sub-agent of the caller';
  end if;

  select id, available_balance into _agent_wallet_id, _agent_balance
  from public.wallets where user_id = p_agent_id for update;
  if _agent_wallet_id is null then
    raise exception 'Sub-agent wallet not found';
  end if;
  if _agent_balance < p_amount then
    raise exception 'Sub-agent has insufficient balance to reclaim';
  end if;

  select id, available_balance into _caller_wallet_id, _caller_balance
  from public.wallets where user_id = _caller_id for update;

  update public.wallets set available_balance = available_balance - p_amount where id = _agent_wallet_id;
  update public.wallets set available_balance = available_balance + p_amount where id = _caller_wallet_id;

  insert into public.wallet_transactions (
    user_id, wallet_id, transaction_type, amount, balance_before, balance_after, reference_type, reference_id
  ) values (
    p_agent_id, _agent_wallet_id, 'agent_reclaim', -p_amount, _agent_balance, _agent_balance - p_amount,
    'agent_reclaim', _transfer_id
  ), (
    _caller_id, _caller_wallet_id, 'agent_reclaim', p_amount, _caller_balance, _caller_balance + p_amount,
    'agent_reclaim', _transfer_id
  );

  return jsonb_build_object('success', true, 'new_balance', _caller_balance + p_amount);
end;
$$;

create function public.transfer_agent_to_player(p_player_id uuid, p_amount numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _caller_id uuid := auth.uid();
  _sender_wallet_id uuid;
  _sender_balance numeric;
  _player_wallet_id uuid;
  _player_balance numeric;
  _transfer_id uuid := gen_random_uuid();
begin
  if not (public.is_agent_tier(_caller_id) or public.is_super_agent(_caller_id)) then
    raise exception 'Unauthorized: agent or super_agent privileges required';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Top-up amount must be greater than zero';
  end if;

  if not public.has_role(p_player_id, 'player') then
    raise exception 'Target is not a player';
  end if;

  if p_player_id not in (select id from public.get_all_downline_ids(_caller_id)) then
    raise exception 'Player is not in the caller''s downline';
  end if;

  select id, available_balance into _sender_wallet_id, _sender_balance
  from public.wallets where user_id = _caller_id for update;
  if _sender_balance < p_amount then
    raise exception 'Insufficient balance';
  end if;

  select id, available_balance into _player_wallet_id, _player_balance
  from public.wallets where user_id = p_player_id for update;
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
    p_player_id, _player_wallet_id, 'agent_topup', p_amount, _player_balance, _player_balance + p_amount,
    'agent_player_topup', _transfer_id
  );

  return jsonb_build_object('success', true, 'new_balance', _sender_balance - p_amount);
end;
$$;

create function public.cashout_player_to_agent(p_player_id uuid, p_amount numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _caller_id uuid := auth.uid();
  _player_wallet_id uuid;
  _player_balance numeric;
  _agent_wallet_id uuid;
  _agent_balance numeric;
  _transfer_id uuid := gen_random_uuid();
begin
  if not (public.is_agent_tier(_caller_id) or public.is_super_agent(_caller_id)) then
    raise exception 'Unauthorized: agent or super_agent privileges required';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Cashout amount must be greater than zero';
  end if;

  if not public.has_role(p_player_id, 'player') then
    raise exception 'Target is not a player';
  end if;

  if p_player_id not in (select id from public.get_all_downline_ids(_caller_id)) then
    raise exception 'Player is not in the caller''s downline';
  end if;

  select id, available_balance into _player_wallet_id, _player_balance
  from public.wallets where user_id = p_player_id for update;
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
    p_player_id, _player_wallet_id, 'agent_cashout', -p_amount, _player_balance, _player_balance - p_amount,
    'agent_player_cashout', _transfer_id
  ), (
    _caller_id, _agent_wallet_id, 'agent_cashout', p_amount, _agent_balance, _agent_balance + p_amount,
    'agent_player_cashout', _transfer_id
  );

  return jsonb_build_object('success', true, 'new_balance', _agent_balance + p_amount);
end;
$$;

revoke execute on function public.promote_to_super_agent(text) from public;
revoke execute on function public.promote_to_agent(text) from public;
revoke execute on function public.assign_player_to_agent(text) from public;
revoke execute on function public.mint_super_agent_balance(uuid, numeric) from public;
revoke execute on function public.transfer_agent_to_agent(uuid, numeric) from public;
revoke execute on function public.reclaim_agent_balance(uuid, numeric) from public;
revoke execute on function public.transfer_agent_to_player(uuid, numeric) from public;
revoke execute on function public.cashout_player_to_agent(uuid, numeric) from public;

grant execute on function public.promote_to_super_agent(text) to authenticated;
grant execute on function public.promote_to_agent(text) to authenticated;
grant execute on function public.assign_player_to_agent(text) to authenticated;
grant execute on function public.mint_super_agent_balance(uuid, numeric) to authenticated;
grant execute on function public.transfer_agent_to_agent(uuid, numeric) to authenticated;
grant execute on function public.reclaim_agent_balance(uuid, numeric) to authenticated;
grant execute on function public.transfer_agent_to_player(uuid, numeric) to authenticated;
grant execute on function public.cashout_player_to_agent(uuid, numeric) to authenticated;
