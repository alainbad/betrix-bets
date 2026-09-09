-- Preserve large, valid storm multipliers rather than rejecting a legitimate win.
alter table public.casino_rounds alter column multiplier type numeric(14,3);

-- Old generic entrypoints must not settle a new game's ID under different
-- rules. Rewritten explicitly (full original bodies, unchanged) rather than
-- via dynamic pg_get_functiondef/regexp_replace/execute, so the guard clause
-- is plain, reviewable SQL instead of a runtime string mutation.

create or replace function public.play_casino_round(_game_id text, _stake numeric)
returns public.casino_rounds
language plpgsql
security definer
set search_path = public
as $$
declare
  _user_id uuid := auth.uid();
  _wallet_id uuid;
  _balance numeric;
  _win_probability constant numeric := 0.15;
  _multiplier constant numeric := 6.0; -- 0.15 * 6.0 = 90% theoretical RTP
  _outcome text;
  _payout numeric;
  _round public.casino_rounds;
begin
  if _game_id like 'velvet-%' then
    raise exception 'Use the Velvet game service';
  end if;

  if _user_id is null then
    raise exception 'not authenticated';
  end if;

  if _game_id is null or length(trim(_game_id)) = 0 then
    raise exception 'game_id is required';
  end if;

  if _stake is null or _stake <= 0 then
    raise exception 'invalid stake amount';
  end if;

  select id, available_balance into _wallet_id, _balance
  from public.wallets
  where user_id = _user_id
  for update;

  if not found then
    raise exception 'wallet not found';
  end if;

  if _stake > _balance then
    raise exception 'insufficient balance';
  end if;

  -- Debit the stake up front, same shape as place_simulated_bet's wager_stake step.
  update public.wallets
  set available_balance = available_balance - _stake,
      lifetime_virtual_staked = lifetime_virtual_staked + _stake
  where id = _wallet_id;

  insert into public.wallet_transactions (
    user_id, wallet_id, transaction_type, amount, balance_before, balance_after, reference_type, description
  ) values (
    _user_id, _wallet_id, 'casino_stake', _stake, _balance, _balance - _stake, 'casino_round',
    'Casino round stake: ' || _game_id
  );

  _balance := _balance - _stake;

  if random() < _win_probability then
    _outcome := 'win';
    _payout := round(_stake * _multiplier, 2);
  else
    _outcome := 'lose';
    _payout := 0;
  end if;

  if _payout > 0 then
    update public.wallets
    set available_balance = available_balance + _payout,
        lifetime_virtual_returned = lifetime_virtual_returned + _payout
    where id = _wallet_id;

    insert into public.wallet_transactions (
      user_id, wallet_id, transaction_type, amount, balance_before, balance_after, reference_type, description
    ) values (
      _user_id, _wallet_id, 'casino_return', _payout, _balance, _balance + _payout, 'casino_round',
      'Casino round payout: ' || _game_id
    );
  end if;

  insert into public.casino_rounds (user_id, game_id, stake, outcome, multiplier, payout)
  values (_user_id, _game_id, _stake, _outcome, case when _outcome = 'win' then _multiplier else 0 end, _payout)
  returning * into _round;

  return _round;
end;
$$;

create or replace function public.play_html5_casino_round(_game_id text, _stake numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _user_id uuid := auth.uid();
  _wallet_id uuid;
  _balance numeric;
  _win_probability constant numeric := 0.15;
  _multiplier constant numeric := 6.0; -- 0.15 * 6.0 = 90% theoretical RTP
  _payout numeric := 0;
  _outcome text;
  _round public.casino_rounds;
begin
  if _game_id like 'velvet-%' then
    raise exception 'Use the Velvet game service';
  end if;

  if _user_id is null then
    raise exception 'not authenticated';
  end if;

  if _game_id is null or length(trim(_game_id)) = 0 then
    raise exception 'game_id is required';
  end if;

  if _stake is null or _stake <= 0 then
    raise exception 'invalid stake amount';
  end if;

  select id, available_balance into _wallet_id, _balance
  from public.wallets
  where user_id = _user_id
  for update;

  if not found then
    raise exception 'wallet not found';
  end if;

  if _stake > _balance then
    raise exception 'insufficient balance';
  end if;

  update public.wallets
  set available_balance = available_balance - _stake,
      lifetime_virtual_staked = lifetime_virtual_staked + _stake
  where id = _wallet_id;

  insert into public.wallet_transactions (
    user_id, wallet_id, transaction_type, amount, balance_before, balance_after, reference_type, description
  ) values (
    _user_id, _wallet_id, 'casino_stake', _stake, _balance, _balance - _stake, 'html5_casino_round',
    'HTML5 casino round stake: ' || _game_id
  );

  _balance := _balance - _stake;

  if random() < _win_probability then
    _payout := round(_stake * _multiplier, 2);
  end if;

  if _payout > 0 then
    update public.wallets
    set available_balance = available_balance + _payout,
        lifetime_virtual_returned = lifetime_virtual_returned + _payout
    where id = _wallet_id;

    insert into public.wallet_transactions (
      user_id, wallet_id, transaction_type, amount, balance_before, balance_after, reference_type, description
    ) values (
      _user_id, _wallet_id, 'casino_return', _payout, _balance, _balance + _payout, 'html5_casino_round',
      'HTML5 casino round payout: ' || _game_id
    );
  end if;

  _outcome := case when _payout > 0 then 'win' else 'lose' end;

  insert into public.casino_rounds (user_id, game_id, stake, outcome, multiplier, payout)
  values (
    _user_id, _game_id, _stake, _outcome,
    case when _payout > 0 then _multiplier else 0 end,
    _payout
  )
  returning * into _round;

  return jsonb_build_object(
    'round_id', _round.id,
    'outcome', _round.outcome,
    'payout', _round.payout,
    'multiplier', _round.multiplier,
    'balance_after', _balance + _payout
  );
end;
$$;
