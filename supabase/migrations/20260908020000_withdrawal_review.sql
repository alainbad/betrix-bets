-- Extends the existing hierarchy. Simulation credits only, no payment execution.

create type public.withdrawal_status as enum (
  'pending_agent_review',
  'agent_approved_pending_ultra',
  'ultra_approved_ready_payout',
  'completed',
  'rejected'
);

create table public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles (id) on delete cascade,
  agent_id uuid not null references public.profiles (id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  status public.withdrawal_status not null default 'pending_agent_review',
  agent_note text,
  ultra_note text,
  offline_payout_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index withdrawal_requests_player_id_idx on public.withdrawal_requests (player_id);
create index withdrawal_requests_agent_id_idx on public.withdrawal_requests (agent_id);
create index withdrawal_requests_status_idx on public.withdrawal_requests (status);

create trigger withdrawal_requests_set_updated_at
  before update on public.withdrawal_requests
  for each row execute function public.set_updated_at();

alter table public.withdrawal_requests enable row level security;

create policy "withdrawal_requests visibility" on public.withdrawal_requests
  for select to authenticated
  using (
    auth.uid() = player_id
    or auth.uid() = agent_id
    or public.is_ultra_admin(auth.uid())
    or public.is_admin(auth.uid())
  );

-- 1. Player submits cashout request -> locks available balance
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
  if public.is_ultra_admin(_caller_id) or public.is_super_agent(_caller_id) or public.is_agent_tier(_caller_id) then raise exception 'Player account required'; end if;
  if p_amount is null or p_amount <= 0 or p_amount<>round(p_amount,2) or p_amount>100000 then
    raise exception 'Withdrawal amount must be greater than zero';
  end if;

  select parent_id into _agent_id from public.profiles where id = _caller_id;
  if _agent_id is null or not exists(select 1 from public.profiles p where p.id=_agent_id and p.status='active' and (public.is_agent_tier(p.id) or public.is_super_agent(p.id))) then
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

-- 2. Agent checks player and escalates to Ultra Admin
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
  if not public.is_ultra_admin(_caller_id) and (_req.agent_id <> _caller_id or not (public.is_agent_tier(_caller_id) or public.is_super_agent(_caller_id))) then
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

-- 3. Ultra Admin authorizes liquidity release to Agent
create or replace function public.ultra_admin_approve_withdrawal(p_request_id uuid, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _caller_id uuid := auth.uid();
  _req public.withdrawal_requests%rowtype;
begin
  if not public.is_ultra_admin(_caller_id) then
    raise exception 'Unauthorized: ultra_admin privileges required';
  end if;

  if _caller_id is null or not exists(select 1 from public.profiles where id=_caller_id and status='active') then raise exception 'Active account required'; end if;
  select * into _req from public.withdrawal_requests where id = p_request_id for update;
  if _req.id is null then raise exception 'Withdrawal request not found'; end if;
  if _req.status <> 'agent_approved_pending_ultra' then
    raise exception 'Request must be agent-approved before Ultra Admin authorization';
  end if;

  update public.withdrawal_requests
  set status = 'ultra_approved_ready_payout',
      ultra_note = coalesce(p_note, ultra_note)
  where id = p_request_id;

  return jsonb_build_object('success', true, 'status', 'ultra_approved_ready_payout');
end;
$$;

-- 4. Agent records a test settlement and removes reserved simulation credits.
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
  if not public.is_ultra_admin(_caller_id) and (_req.agent_id <> _caller_id or not (public.is_agent_tier(_caller_id) or public.is_super_agent(_caller_id))) then
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

-- 5. Cancellation: restores locked coins back to available balance
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
  if not public.is_ultra_admin(_caller_id) and (_req.agent_id <> _caller_id or not (public.is_agent_tier(_caller_id) or public.is_super_agent(_caller_id))) then
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

revoke execute on function public.player_request_withdrawal(numeric) from public;
revoke execute on function public.agent_approve_withdrawal(uuid, text) from public;
revoke execute on function public.ultra_admin_approve_withdrawal(uuid, text) from public;
revoke execute on function public.settle_player_withdrawal(uuid, text) from public;
revoke execute on function public.reject_withdrawal_request(uuid, text) from public;

grant execute on function public.player_request_withdrawal(numeric) to authenticated;
grant execute on function public.agent_approve_withdrawal(uuid, text) to authenticated;
grant execute on function public.ultra_admin_approve_withdrawal(uuid, text) to authenticated;
grant execute on function public.settle_player_withdrawal(uuid, text) to authenticated;
grant execute on function public.reject_withdrawal_request(uuid, text) to authenticated;

grant select on public.withdrawal_requests to authenticated;
