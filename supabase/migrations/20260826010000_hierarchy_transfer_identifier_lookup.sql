-- Switches the 4 named transfer RPCs from a raw target UUID to a flexible
-- identifier (account_id / email / phone), resolved via resolve_account_id
-- from 20260826000000_account_id_lookup_schema.sql. Separate transaction so
-- that migration's functions are safe to call here.
--
-- reclaim_agent_balance and assign_player_to_agent are unchanged (not asked
-- for): reclaim always targets an already-known, already-listed sub-agent
-- row in SuperAgentView, and assign_player_to_agent already takes an email
-- specifically rather than a raw UUID.
--
-- Each function's body is otherwise identical to its
-- 20260825050000_agent_hierarchy_rpcs.sql version - only the parameter and
-- the added resolve_account_id() call at the top change.

drop function public.mint_super_agent_balance(uuid, numeric);
drop function public.transfer_agent_to_agent(uuid, numeric);
drop function public.transfer_agent_to_player(uuid, numeric);
drop function public.cashout_player_to_agent(uuid, numeric);

create function public.mint_super_agent_balance(p_target_identifier text, p_amount numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _target_id uuid;
  _wallet_id uuid;
  _balance numeric;
begin
  if not public.is_ultra_admin(auth.uid()) then
    raise exception 'Unauthorized: ultra_admin privileges required';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Mint amount must be greater than zero';
  end if;

  _target_id := public.resolve_account_id(p_target_identifier);

  if not public.is_super_agent(_target_id) then
    raise exception 'Target is not a super_agent';
  end if;

  select id, available_balance into _wallet_id, _balance
  from public.wallets
  where user_id = _target_id
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
    _target_id, _wallet_id, 'agent_mint', p_amount, _balance, _balance + p_amount,
    'ultra_admin_mint', 'Minted by ultra_admin ' || auth.uid()::text
  );

  return jsonb_build_object('success', true, 'new_balance', _balance + p_amount, 'target_user_id', _target_id);
end;
$$;

create function public.transfer_agent_to_agent(p_target_identifier text, p_amount numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _caller_id uuid := auth.uid();
  _receiver_id uuid;
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

  _receiver_id := public.resolve_account_id(p_target_identifier);

  select parent_id into _receiver_parent from public.profiles where id = _receiver_id;
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
  from public.wallets where user_id = _receiver_id for update;
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
    _receiver_id, _receiver_wallet_id, 'agent_allocation', p_amount, _receiver_balance, _receiver_balance + p_amount,
    'agent_transfer', _transfer_id
  );

  return jsonb_build_object('success', true, 'new_balance', _sender_balance - p_amount);
end;
$$;

create function public.transfer_agent_to_player(p_target_identifier text, p_amount numeric)
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
  if not (public.is_agent_tier(_caller_id) or public.is_super_agent(_caller_id)) then
    raise exception 'Unauthorized: agent or super_agent privileges required';
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

create function public.cashout_player_to_agent(p_target_identifier text, p_amount numeric)
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
  if not (public.is_agent_tier(_caller_id) or public.is_super_agent(_caller_id)) then
    raise exception 'Unauthorized: agent or super_agent privileges required';
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

revoke execute on function public.mint_super_agent_balance(text, numeric) from public;
revoke execute on function public.transfer_agent_to_agent(text, numeric) from public;
revoke execute on function public.transfer_agent_to_player(text, numeric) from public;
revoke execute on function public.cashout_player_to_agent(text, numeric) from public;

grant execute on function public.mint_super_agent_balance(text, numeric) to authenticated;
grant execute on function public.transfer_agent_to_agent(text, numeric) to authenticated;
grant execute on function public.transfer_agent_to_player(text, numeric) to authenticated;
grant execute on function public.cashout_player_to_agent(text, numeric) to authenticated;
