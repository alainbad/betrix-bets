-- Lets a player cancel their own cash-out request while it's still
-- anywhere in the pending pipeline (pending_agent_review,
-- agent_approved_pending_ultra, or ultra_approved_ready_payout - grouped
-- together as one "Pending" status on the player's own view). No real
-- money has moved yet at any of those stages, only reserved, so this is
-- safe right up until settlement.
create or replace function public.cancel_withdrawal_request(p_request_id uuid)
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
  if _req.player_id <> _caller_id then raise exception 'Unauthorized: you can only cancel your own request'; end if;
  if _req.status in ('completed', 'rejected', 'cancelled') then raise exception 'Request has already concluded'; end if;

  select id, reserved_balance, available_balance into _wallet_id, _locked, _avail
  from public.wallets where user_id = _req.player_id for update;

  if _wallet_id is null or _locked < _req.amount then raise exception 'Reserved credits do not cover request'; end if;
  update public.wallets
  set reserved_balance = reserved_balance - _req.amount,
      available_balance = available_balance + _req.amount
  where id = _wallet_id;

  update public.withdrawal_requests
  set status = 'cancelled'
  where id = p_request_id;

  insert into public.wallet_transactions (
    user_id, wallet_id, transaction_type, amount, balance_before, balance_after, reference_type, reference_id, description
  ) values (
    _req.player_id, _wallet_id, 'withdrawal_refund', _req.amount, _avail, _avail + _req.amount,
    'withdrawal_cancellation', p_request_id, 'Withdrawal request cancelled by player: balance restored'
  );

  return jsonb_build_object('success', true, 'status', 'cancelled');
end;
$$;

revoke execute on function public.cancel_withdrawal_request(uuid) from public;
grant execute on function public.cancel_withdrawal_request(uuid) to authenticated;

-- Also close a real gap the new status opens up: without this, an agent
-- could still "reject" a request the player already cancelled, which would
-- run the reserved-balance refund a second time (it was already refunded
-- by cancel_withdrawal_request above). Identical to the live function
-- otherwise - only the terminal-state guard changes.
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
  if _req.status in ('completed', 'rejected', 'cancelled') then
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
