-- Lets a player close out their own cash-out request once it's fully
-- authorized (ultra_approved_ready_payout) and they've actually received
-- the payout off-platform, instead of waiting on an agent/ultra_admin to
-- separately click Settle. Identical wallet-release mechanics to
-- settle_player_withdrawal - releases the reserved credits, marks the
-- request completed - just player-initiated and with no offline reference
-- to type in (the player is self-attesting receipt, not recording one).
-- Staff can still use the existing Settle button too; whichever happens
-- first wins, since both gate on the same status.
create or replace function public.confirm_withdrawal_received(p_request_id uuid)
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
  if _req.player_id <> _caller_id then raise exception 'Unauthorized: you can only confirm your own request'; end if;
  if _req.status <> 'ultra_approved_ready_payout' then
    raise exception 'Request is not ready for payout confirmation yet';
  end if;

  select id, reserved_balance, available_balance into _wallet_id, _locked, _avail
  from public.wallets where user_id = _req.player_id for update;

  if _wallet_id is null or _locked < _req.amount then
    raise exception 'System error: Locked wallet funds do not cover requested amount';
  end if;

  update public.wallets
  set reserved_balance = reserved_balance - _req.amount
  where id = _wallet_id;

  update public.withdrawal_requests
  set status = 'completed',
      offline_payout_reference = coalesce(offline_payout_reference, 'Confirmed received by player')
  where id = p_request_id;

  insert into public.wallet_transactions (
    user_id, wallet_id, transaction_type, amount, balance_before, balance_after, reference_type, reference_id, description
  ) values (
    _req.player_id, _wallet_id, 'withdrawal_settlement', 0, _avail, _avail,
    'withdrawal_settlement', p_request_id, 'Withdrawal confirmed received by player; reserved credits released'
  );

  return jsonb_build_object('success', true, 'status', 'completed');
end;
$$;

revoke execute on function public.confirm_withdrawal_received(uuid) from public;
grant execute on function public.confirm_withdrawal_received(uuid) to authenticated;
