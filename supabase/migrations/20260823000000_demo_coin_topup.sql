-- One-time admin top-up so the account owner can test the HTML5 casino
-- pipeline (demo-slot) without waiting on normal play to build up a balance.
-- Not a reusable faucet - just credits the existing wallet once via the
-- same admin_adjustment ledger path an admin correction would use.

do $$
declare
  _user_id uuid;
  _wallet_id uuid;
  _balance numeric;
  _topup constant numeric := 100000.00;
begin
  select id into _user_id
  from public.profiles
  where email = 'badranalain87@gmail.com';

  if _user_id is null then
    raise notice 'demo_coin_topup: no profile found for badranalain87@gmail.com, skipping';
    return;
  end if;

  select id, available_balance into _wallet_id, _balance
  from public.wallets
  where user_id = _user_id
  for update;

  if _wallet_id is null then
    raise notice 'demo_coin_topup: no wallet found for badranalain87@gmail.com, skipping';
    return;
  end if;

  update public.wallets
  set available_balance = available_balance + _topup
  where id = _wallet_id;

  insert into public.wallet_transactions (
    user_id, wallet_id, transaction_type, amount, balance_before, balance_after, reference_type, description
  ) values (
    _user_id, _wallet_id, 'admin_adjustment', _topup, _balance, _balance + _topup, 'demo_coin_topup',
    'One-time test top-up for HTML5 casino demo game'
  );
end $$;
