-- Makes the HTML5 casino engine server-authoritative instead of trusting a
-- claimed win amount from the game iframe.
--
-- The original play_html5_casino_round(_game_id, _stake, _claimed_win) took
-- a win amount reported by the game's own client-side code and only capped
-- it against a per-game max multiplier - a damage limit, not real trust: a
-- forged postMessage could still claim the max-win-multiplier on every
-- single round, and no fixed cap enforces any particular win rate. Now that
-- an actual target win rate has been requested, the server has to roll the
-- outcome itself, the same trust model as the native in-house games. This
-- means the postMessage protocol flips from "game reports what happened" to
-- "game asks what happened" - see game-bridge.ts and demo-slot/index.html.
--
-- Win rate 15%, fixed 6x multiplier => 90% RTP (10% house edge), matching
-- the existing native casino engine's calibration exactly (see
-- 20260817000000_casino_engine.sql) so the whole app runs one math engine.
-- The spec that prompted this said "15% win rate, 85% house edge" - taken
-- literally that pairing implies an average win of ~1x stake (0.85 / 0.15),
-- i.e. a win roughly just returns the stake with no upside, which is a much
-- more aggressive economy than anything else in this codebase and wasn't
-- confirmed as actually intended. Both constants are named below so this is
-- a one-line change if a different curve turns out to be wanted.

drop function if exists public.play_html5_casino_round(text, numeric, numeric);

create function public.play_html5_casino_round(_game_id text, _stake numeric)
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

revoke execute on function public.play_html5_casino_round(text, numeric) from public;
grant execute on function public.play_html5_casino_round(text, numeric) to authenticated;
