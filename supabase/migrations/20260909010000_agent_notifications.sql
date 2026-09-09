-- In-app agent notifications for two player-initiated requests:
-- - 'topup_request': the player wants their agent to add credits. No wallet
--   movement happens here at all - it's purely an alert; the agent still
--   tops up through the existing transfer_agent_to_player RPC from their
--   own dashboard, same as if the player had messaged them directly.
-- - 'cashout_request': raised from inside player_request_withdrawal itself
--   (same transaction as the balance freeze), so an agent is never left
--   unaware of a request that's already locking the player's credits.

create table public.agent_notifications (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.profiles (id) on delete cascade,
  player_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('topup_request', 'cashout_request')),
  amount numeric(14, 2) not null check (amount > 0),
  withdrawal_request_id uuid references public.withdrawal_requests (id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index agent_notifications_agent_unread_idx
  on public.agent_notifications (agent_id, created_at desc)
  where read_at is null;

alter table public.agent_notifications enable row level security;

create policy "agent_notifications select own or admin" on public.agent_notifications
  for select to authenticated
  using (auth.uid() = agent_id or public.is_ultra_admin(auth.uid()));

-- No insert/update/delete policy: rows are only ever written by the
-- SECURITY DEFINER RPCs below, never directly by a client.
grant select on public.agent_notifications to authenticated;

create function public.player_request_topup(p_amount numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _caller_id uuid := auth.uid();
  _agent_id uuid;
  _notification_id uuid;
begin
  if _caller_id is null or not exists(select 1 from public.profiles where id=_caller_id and status='active') then raise exception 'Active account required'; end if;
  if public.is_ultra_admin(_caller_id) or public.is_agent_tier(_caller_id) then raise exception 'Player account required'; end if;
  if p_amount is null or p_amount <= 0 or p_amount<>round(p_amount,2) or p_amount>100000 then
    raise exception 'Top-up amount must be greater than zero';
  end if;

  select parent_id into _agent_id from public.profiles where id = _caller_id;
  if _agent_id is null or not exists(select 1 from public.profiles p where p.id=_agent_id and p.status='active' and public.is_agent_tier(p.id)) then
    raise exception 'Account must be assigned to an agent to request a top-up';
  end if;

  insert into public.agent_notifications (agent_id, player_id, kind, amount)
  values (_agent_id, _caller_id, 'topup_request', p_amount)
  returning id into _notification_id;

  return jsonb_build_object('success', true, 'notification_id', _notification_id);
end;
$$;

revoke execute on function public.player_request_topup(numeric) from public;
grant execute on function public.player_request_topup(numeric) to authenticated;

create function public.mark_notification_read(p_notification_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _caller_id uuid := auth.uid();
begin
  update public.agent_notifications
  set read_at = now()
  where id = p_notification_id and agent_id = _caller_id and read_at is null;

  if not found then
    raise exception 'Notification not found';
  end if;

  return jsonb_build_object('success', true);
end;
$$;

revoke execute on function public.mark_notification_read(uuid) from public;
grant execute on function public.mark_notification_read(uuid) to authenticated;

-- Redefines player_request_withdrawal (unchanged behavior otherwise, see
-- 20260908020000_withdrawal_review.sql / 20260909000000_remove_super_agent_tier.sql
-- for its prior bodies) to additionally raise a 'cashout_request'
-- notification for the assigned agent, in the same transaction as the
-- balance freeze.
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

  insert into public.agent_notifications (agent_id, player_id, kind, amount, withdrawal_request_id)
  values (_agent_id, _caller_id, 'cashout_request', p_amount, _request_id);

  return jsonb_build_object('success', true, 'request_id', _request_id);
end;
$$;
