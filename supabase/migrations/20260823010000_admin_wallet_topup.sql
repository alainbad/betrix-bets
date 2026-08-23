-- Admin manual wallet top-up: lets an administrator credit a player's
-- virtual-coin wallet by email after an offline/manual payment (e.g. a
-- support-handled purchase), logging a normal admin_adjustment ledger entry
-- for audit. Adapted to the existing wallets/wallet_transactions/is_admin
-- machinery from 20260816000000_foundation_auth_wallet.sql rather than the
-- separate profiles.virtual_coins column an outside spec proposed - this app
-- has one wallet, not two.

create function public.admin_topup_wallet(
  p_target_email text,
  p_coins_to_add numeric,
  p_notes text default 'Manual top-up'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _admin_id uuid := auth.uid();
  _target_user_id uuid;
  _wallet_id uuid;
  _balance numeric;
begin
  if _admin_id is null or not public.is_admin(_admin_id) then
    raise exception 'Unauthorized: administrator privileges required';
  end if;

  if p_coins_to_add is null or p_coins_to_add <= 0 then
    raise exception 'Top-up amount must be greater than zero';
  end if;

  select id into _target_user_id
  from public.profiles
  where email = p_target_email;

  if _target_user_id is null then
    raise exception 'No player found with email %', p_target_email;
  end if;

  select id, available_balance into _wallet_id, _balance
  from public.wallets
  where user_id = _target_user_id
  for update;

  if _wallet_id is null then
    raise exception 'Wallet not found for %', p_target_email;
  end if;

  update public.wallets
  set available_balance = available_balance + p_coins_to_add
  where id = _wallet_id;

  insert into public.wallet_transactions (
    user_id, wallet_id, transaction_type, amount, balance_before, balance_after, reference_type, description
  ) values (
    _target_user_id, _wallet_id, 'admin_adjustment', p_coins_to_add, _balance, _balance + p_coins_to_add,
    'admin_topup', coalesce(nullif(trim(p_notes), ''), 'Manual top-up')
  );

  return jsonb_build_object(
    'success', true,
    'target_email', p_target_email,
    'new_balance', _balance + p_coins_to_add
  );
end;
$$;

revoke execute on function public.admin_topup_wallet(text, numeric, text) from public;
grant execute on function public.admin_topup_wallet(text, numeric, text) to authenticated;
