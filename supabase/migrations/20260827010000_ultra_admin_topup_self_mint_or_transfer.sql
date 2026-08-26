-- Splits ultra_admin_topup_wallet's single "credit the target, mint from
-- nothing" behavior into two cases, matching the single-source-of-supply
-- model already used one tier down (transfer_agent_to_agent/
-- transfer_agent_to_player both debit the sender and credit the receiver -
-- neither mints):
--
--   - Target is the caller's own account: this stays a mint (credit only,
--     no debit source) - the ultra_admin is the platform's one unlimited
--     tap, and "top up my own balance" is how new supply enters the ledger
--     at all.
--   - Target is any other account: now a real transfer out of the
--     ultra_admin's own wallet - debits the caller, credits the target,
--     fails on insufficient balance. Distributing coins downstream should
--     draw down the same pool the ultra_admin minted into themselves, not
--     open a second, parallel mint that only they can reach.

create or replace function public.ultra_admin_topup_wallet(p_target_identifier text, p_amount numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _caller_id uuid := auth.uid();
  _target_id uuid;
  _target_wallet_id uuid;
  _target_balance numeric;
  _caller_wallet_id uuid;
  _caller_balance numeric;
  _transfer_id uuid := gen_random_uuid();
begin
  if not public.is_ultra_admin(_caller_id) then
    raise exception 'Unauthorized: ultra_admin privileges required';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Top-up amount must be greater than zero';
  end if;

  _target_id := public.resolve_account_id(p_target_identifier);

  select id, available_balance into _target_wallet_id, _target_balance
  from public.wallets
  where user_id = _target_id
  for update;

  if _target_wallet_id is null then
    raise exception 'Wallet not found for target';
  end if;

  if _target_id = _caller_id then
    update public.wallets
    set available_balance = available_balance + p_amount
    where id = _target_wallet_id;

    insert into public.wallet_transactions (
      user_id, wallet_id, transaction_type, amount, balance_before, balance_after, reference_type, description
    ) values (
      _target_id, _target_wallet_id, 'admin_adjustment', p_amount, _target_balance, _target_balance + p_amount,
      'ultra_admin_topup', 'Self-mint by ultra_admin'
    );

    return jsonb_build_object('success', true, 'new_balance', _target_balance + p_amount, 'target_user_id', _target_id);
  end if;

  select id, available_balance into _caller_wallet_id, _caller_balance
  from public.wallets
  where user_id = _caller_id
  for update;

  if _caller_wallet_id is null then
    raise exception 'Ultra admin wallet not found';
  end if;
  if _caller_balance < p_amount then
    raise exception 'Insufficient balance';
  end if;

  update public.wallets set available_balance = available_balance - p_amount where id = _caller_wallet_id;
  update public.wallets set available_balance = available_balance + p_amount where id = _target_wallet_id;

  insert into public.wallet_transactions (
    user_id, wallet_id, transaction_type, amount, balance_before, balance_after, reference_type, reference_id
  ) values (
    _caller_id, _caller_wallet_id, 'admin_adjustment', -p_amount, _caller_balance, _caller_balance - p_amount,
    'ultra_admin_topup', _transfer_id
  ), (
    _target_id, _target_wallet_id, 'admin_adjustment', p_amount, _target_balance, _target_balance + p_amount,
    'ultra_admin_topup', _transfer_id
  );

  return jsonb_build_object('success', true, 'new_balance', _target_balance + p_amount, 'target_user_id', _target_id);
end;
$$;

revoke execute on function public.ultra_admin_topup_wallet(text, numeric) from public;
grant execute on function public.ultra_admin_topup_wallet(text, numeric) to authenticated;
