-- HTML5 casino engine: settles rounds for self-hosted HTML5 games running in
-- a sandboxed iframe (see src/lib/game-bridge.ts, src/components/casino/GameModal.tsx).
--
-- This replaces play_casino_round() as the active engine, but does NOT drop
-- it or its table/data - that RPC and casino_rounds stay in place, just
-- unused by the frontend now, in case native in-house games come back later.
-- casino_rounds itself is reused as-is (game_id is already a free-form text
-- column, no schema change needed there).
--
-- KNOWN LIMITATION, unlike play_casino_round: a self-hosted HTML5 game
-- decides its own win/lose outcome client-side (we don't control or run its
-- code), so the server can't roll the result the way play_casino_round does
-- - it only ever finds out the claimed outcome after the fact, via the
-- postMessage bridge. _max_win_multiplier is a blunt backstop against a
-- forged postMessage (e.g. someone calling this RPC directly with an
-- inflated _claimed_win): it bounds the damage, it does not make the
-- reported outcome trustworthy. This is a flat global cap across every
-- HTML5 game for now; if a future game genuinely needs a higher ceiling
-- than other games, this will need a per-game lookup (e.g. a small
-- html5_casino_games table) instead of one constant.

create function public.play_html5_casino_round(_game_id text, _stake numeric, _claimed_win numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _user_id uuid := auth.uid();
  _wallet_id uuid;
  _balance numeric;
  _max_win_multiplier constant numeric := 50;
  _payout numeric;
  _outcome text;
  _round public.casino_rounds;
begin
  if _user_id is null then
    raise exception 'not authenticated';
  end if;

  if _game_id is null or length(trim(_game_id)) = 0 then
    raise exception 'game_id is required';
  end if;

  if _stake is null or _stake <= 0 then
    raise exception 'invalid stake amount';
  end if;

  if _claimed_win is null or _claimed_win < 0 then
    raise exception 'invalid win amount';
  end if;

  -- Backstop cap - see header comment. A legitimate result never exceeds
  -- this; anything above it is clamped rather than trusted outright.
  _payout := least(_claimed_win, _stake * _max_win_multiplier);

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
    case when _stake > 0 then round(_payout / _stake, 3) else 0 end,
    _payout
  )
  returning * into _round;

  return jsonb_build_object(
    'round_id', _round.id,
    'outcome', _round.outcome,
    'payout', _round.payout,
    'balance_after', _balance + _payout
  );
end;
$$;

revoke execute on function public.play_html5_casino_round(text, numeric, numeric) from public;
grant execute on function public.play_html5_casino_round(text, numeric, numeric) to authenticated;
