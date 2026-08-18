-- Real Casino Hold'em engine: a genuine single-player-vs-dealer poker table
-- game, replacing Texas Hold'em's old single-shot cosmetic reveal with a
-- real multi-step state machine (start, fold, call) built on a real
-- best-5-of-7 poker hand evaluator - the same rules used by real "Casino
-- Hold'em" / "Ultimate Texas Hold'em" tables:
--   1. Player posts an Ante. Two hole cards are dealt to the player and to
--      the (hidden) dealer, then the flop (3 community cards) is dealt face
--      up - all real, all crypto-shuffled, all visible to the player at
--      this point.
--   2. Player decides: Fold (lose the ante) or Call (an extra bet of 2x the
--      ante). This is the one genuine decision point, same as the real game.
--   3. The turn and river are dealt, the dealer's hole cards are revealed,
--      and the dealer must "qualify" with a pair or better. If the dealer
--      doesn't qualify, the ante pays even money and the call pushes. If
--      the dealer qualifies, the best 5-of-7 hands are compared: the call
--      bet pays 1:1 on a win, and the ante pays a real Casino Hold'em bonus
--      table (Royal Flush 100:1 down to a Pair or worse at 1:1).
--
-- Exactly like Blackjack, the player's own hole cards and the flop (already
-- dealt and shown before the fold/call decision) are always 100% fair and
-- never overridden - a fold is always a real, freely-chosen loss based on
-- real cards. The platform's mandated win-rate contract (~15% win / ~8%
-- push / ~77% lose) is preserved the same way Blackjack does it: only once
-- the player calls does holdem_call() privately roll an intended outcome
-- bucket, then replay the dealer's hidden hole cards plus the turn and
-- river against freshly reshuffled copies of the remaining shoe (up to 50
-- attempts) until the natural showdown lands in that bucket. A fold never
-- goes through this at all, since the player's decision to fold is real and
-- unsteerable, same as the rest of their own cards.

create table public.holdem_rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'awaiting_decision' check (status in ('awaiting_decision', 'completed')),
  ante numeric(14, 2) not null check (ante > 0),
  call_bet numeric(14, 2),
  total_bet numeric(14, 2) not null,
  shoe jsonb not null,
  player_cards jsonb not null,
  flop jsonb not null,
  dealer_cards jsonb,
  turn jsonb,
  river jsonb,
  intended_outcome text check (intended_outcome in ('win', 'push', 'lose')),
  result text check (result in ('fold', 'no_qualify', 'win', 'push', 'lose')),
  dealer_qualified boolean,
  hand_category int,
  payout numeric(14, 2),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index holdem_rounds_user_id_created_at_idx on public.holdem_rounds (user_id, created_at desc);

alter table public.holdem_rounds enable row level security;

-- Same information-hiding shape as blackjack_rounds: the dealer's hole
-- cards, the turn, and the river all live in this row, so it's only
-- readable by its owner once the round is completed. All in-progress state
-- is read exclusively through the sanitized JSON these RPCs return.
create policy "holdem_rounds select own completed or admin" on public.holdem_rounds
  for select to authenticated
  using ((auth.uid() = user_id and status = 'completed') or public.is_admin(auth.uid()));

create function public.holdem_rank_value(_rank text)
returns int
language sql
immutable
as $$
  select case _rank
    when 'A' then 14
    when 'K' then 13
    when 'Q' then 12
    when 'J' then 11
    else _rank::int
  end;
$$;

-- Scores a single 5-card hand as one comparable integer: category (0 high
-- card .. 8 straight flush) times 15^5, plus up to five rank-value
-- tiebreakers (each 0-14) in descending significance - so any two hands can
-- be ranked with a plain integer comparison. A straight flush whose top
-- tiebreaker is 14 is specifically a royal flush.
create function public.holdem_score5(_cards jsonb)
returns int
language plpgsql
immutable
as $$
declare
  _ranks int[];
  _suits text[];
  _distinct_desc int[];
  _sorted_desc int[];
  _is_flush boolean;
  _straight_high int := null;
  _groups_val int[] := '{}';
  _groups_cnt int[] := '{}';
  _rec record;
  _t int[] := array[0, 0, 0, 0, 0];
  _category int;
begin
  select array_agg(public.holdem_rank_value(c ->> 'rank')), array_agg(c ->> 'suit')
  into _ranks, _suits
  from jsonb_array_elements(_cards) c;

  _is_flush := (select count(distinct s) from unnest(_suits) s) = 1;
  select array_agg(v order by v desc) into _sorted_desc from unnest(_ranks) v;
  select array_agg(distinct v order by v desc) into _distinct_desc from unnest(_ranks) v;

  if array_length(_distinct_desc, 1) = 5 then
    if _distinct_desc[1] - _distinct_desc[5] = 4 then
      _straight_high := _distinct_desc[1];
    elsif _distinct_desc = array[14, 5, 4, 3, 2] then
      _straight_high := 5; -- wheel: A-2-3-4-5 plays as a 5-high straight
    end if;
  end if;

  for _rec in
    select v as val, count(*) as cnt from unnest(_ranks) v group by v order by count(*) desc, v desc
  loop
    _groups_val := _groups_val || _rec.val;
    _groups_cnt := _groups_cnt || _rec.cnt::int;
  end loop;

  if _straight_high is not null and _is_flush then
    _category := 8;
    _t[1] := _straight_high;
  elsif _groups_cnt[1] = 4 then
    _category := 7;
    _t[1] := _groups_val[1];
    _t[2] := _groups_val[2];
  elsif _groups_cnt[1] = 3 and _groups_cnt[2] = 2 then
    _category := 6;
    _t[1] := _groups_val[1];
    _t[2] := _groups_val[2];
  elsif _is_flush then
    _category := 5;
    _t := _sorted_desc;
  elsif _straight_high is not null then
    _category := 4;
    _t[1] := _straight_high;
  elsif _groups_cnt[1] = 3 then
    _category := 3;
    _t[1] := _groups_val[1];
    _t[2] := _groups_val[2];
    _t[3] := _groups_val[3];
  elsif _groups_cnt[1] = 2 and _groups_cnt[2] = 2 then
    _category := 2;
    _t[1] := _groups_val[1];
    _t[2] := _groups_val[2];
    _t[3] := _groups_val[3];
  elsif _groups_cnt[1] = 2 then
    _category := 1;
    _t[1] := _groups_val[1];
    _t[2] := _groups_val[2];
    _t[3] := _groups_val[3];
    _t[4] := _groups_val[4];
  else
    _category := 0;
    _t := _sorted_desc;
  end if;

  return _category * 759375 + _t[1] * 50625 + _t[2] * 3375 + _t[3] * 225 + _t[4] * 15 + _t[5];
end;
$$;

-- Best 5-of-7 score: tries all C(7,5) = 21 five-card subsets of a 7-card
-- hand (2 hole cards + 5 community cards) and returns the highest score.
create function public.holdem_best_score(_cards jsonb)
returns int
language plpgsql
immutable
as $$
declare
  _best int := -1;
  _score int;
  _i1 int;
  _i2 int;
  _i3 int;
  _i4 int;
  _i5 int;
  _combo jsonb;
begin
  for _i1 in 0..2 loop
    for _i2 in _i1 + 1..3 loop
      for _i3 in _i2 + 1..4 loop
        for _i4 in _i3 + 1..5 loop
          for _i5 in _i4 + 1..6 loop
            _combo := jsonb_build_array(_cards -> _i1, _cards -> _i2, _cards -> _i3, _cards -> _i4, _cards -> _i5);
            _score := public.holdem_score5(_combo);
            if _score > _best then
              _best := _score;
            end if;
          end loop;
        end loop;
      end loop;
    end loop;
  end loop;
  return _best;
end;
$$;

-- Real Casino Hold'em ante bonus paytable, applied to the player's best
-- hand category (0-8) when they win at showdown. A pair or worse pays even
-- money same as the call bet; only the bigger hands carry a bonus.
create function public.holdem_ante_multiplier(_category int, _is_royal boolean)
returns numeric
language sql
immutable
as $$
  select case
    when _category = 8 and _is_royal then 100
    when _category = 8 then 20
    when _category = 7 then 10
    when _category = 6 then 3
    when _category = 5 then 2
    else 1
  end;
$$;

create function public.holdem_start(_ante numeric)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  _user_id uuid := auth.uid();
  _wallet_id uuid;
  _balance numeric;
  _shoe jsonb;
  _player jsonb;
  _flop jsonb;
  _round public.holdem_rounds;
  _min_ante constant numeric := 2;
  _max_ante constant numeric := 500;
  _score int;
  _category int;
  _is_royal boolean;
begin
  if _user_id is null then
    raise exception 'not authenticated';
  end if;

  if _ante is null or _ante < _min_ante or _ante > _max_ante then
    raise exception 'ante must be between % and %', _min_ante, _max_ante;
  end if;

  select id, available_balance into _wallet_id, _balance
  from public.wallets where user_id = _user_id for update;

  if not found then
    raise exception 'wallet not found';
  end if;

  if _ante > _balance then
    raise exception 'insufficient balance';
  end if;

  update public.wallets
  set available_balance = available_balance - _ante,
      lifetime_virtual_staked = lifetime_virtual_staked + _ante
  where id = _wallet_id;

  insert into public.wallet_transactions (
    user_id, wallet_id, transaction_type, amount, balance_before, balance_after, reference_type, description
  ) values (
    _user_id, _wallet_id, 'casino_stake', _ante, _balance, _balance - _ante, 'holdem_round', 'Casino Hold''em ante'
  );

  _shoe := public.blackjack_new_shoe();
  _player := jsonb_build_array(_shoe -> 0, _shoe -> 1);
  _shoe := _shoe - 0 - 0;
  _flop := jsonb_build_array(_shoe -> 0, _shoe -> 1, _shoe -> 2);
  _shoe := _shoe - 0 - 0 - 0;

  _score := public.holdem_score5(_player || _flop);
  _category := _score / 759375;
  _is_royal := _category = 8 and (_score - _category * 759375) / 50625 = 14;

  insert into public.holdem_rounds (
    user_id, status, ante, total_bet, shoe, player_cards, flop
  ) values (
    _user_id, 'awaiting_decision', _ante, _ante, _shoe, _player, _flop
  ) returning * into _round;

  return jsonb_build_object(
    'id', _round.id, 'status', 'awaiting_decision', 'ante', _ante, 'totalBet', _ante,
    'playerCards', _player, 'flop', _flop, 'handCategory', _category, 'isRoyal', _is_royal
  );
end;
$$;

create function public.holdem_fold(_round_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  _user_id uuid := auth.uid();
  _round public.holdem_rounds;
begin
  if _user_id is null then
    raise exception 'not authenticated';
  end if;

  select * into _round from public.holdem_rounds
  where id = _round_id and user_id = _user_id
  for update;

  if not found then
    raise exception 'round not found';
  end if;

  if _round.status <> 'awaiting_decision' then
    raise exception 'round is not active';
  end if;

  update public.holdem_rounds
  set status = 'completed', result = 'fold', payout = 0, completed_at = now()
  where id = _round_id;

  insert into public.casino_rounds (user_id, game_id, stake, outcome, multiplier, payout)
  values (_user_id, 'texas-holdem', _round.total_bet, 'lose', 0, 0);

  return jsonb_build_object(
    'id', _round_id, 'status', 'completed', 'ante', _round.ante, 'totalBet', _round.total_bet,
    'playerCards', _round.player_cards, 'flop', _round.flop, 'result', 'fold', 'payout', 0
  );
end;
$$;

create function public.holdem_call(_round_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  _user_id uuid := auth.uid();
  _round public.holdem_rounds;
  _call_bet numeric;
  _wallet_id uuid;
  _balance numeric;
  _r numeric;
  _intended text;
  _attempt int;
  _working_shoe jsonb;
  _dealer jsonb;
  _turn jsonb;
  _river jsonb;
  _remaining_shoe jsonb;
  _player_full jsonb;
  _dealer_full jsonb;
  _player_score int;
  _dealer_score int;
  _player_category int;
  _dealer_category int;
  _player_royal boolean;
  _dealer_qualified boolean;
  _bucket text;
  _result text;
  _ante_multiplier numeric;
  _payout numeric;
  _win_probability constant numeric := 0.15;
  _push_probability constant numeric := 0.08;
begin
  if _user_id is null then
    raise exception 'not authenticated';
  end if;

  select * into _round from public.holdem_rounds
  where id = _round_id and user_id = _user_id
  for update;

  if not found then
    raise exception 'round not found';
  end if;

  if _round.status <> 'awaiting_decision' then
    raise exception 'round is not active';
  end if;

  _call_bet := _round.ante * 2;

  select id, available_balance into _wallet_id, _balance from public.wallets where user_id = _user_id for update;

  if _call_bet > _balance then
    raise exception 'insufficient balance to call';
  end if;

  update public.wallets
  set available_balance = available_balance - _call_bet,
      lifetime_virtual_staked = lifetime_virtual_staked + _call_bet
  where id = _wallet_id;

  insert into public.wallet_transactions (
    user_id, wallet_id, transaction_type, amount, balance_before, balance_after, reference_type, description
  ) values (
    _user_id, _wallet_id, 'casino_stake', _call_bet, _balance, _balance - _call_bet, 'holdem_round', 'Casino Hold''em call'
  );
  _balance := _balance - _call_bet;

  _r := random();
  _intended := case
    when _r < _win_probability then 'win'
    when _r < _win_probability + _push_probability then 'push'
    else 'lose'
  end;

  -- The player's hole cards and the flop were already dealt and shown
  -- before this decision, so only the dealer's hole cards, the turn, and
  -- the river (none of it ever shown yet) are redrawn on each attempt.
  for _attempt in 1..50 loop
    select jsonb_agg(elem order by encode(gen_random_bytes(8), 'hex'))
    into _working_shoe
    from jsonb_array_elements(_round.shoe) as elem;

    _dealer := jsonb_build_array(_working_shoe -> 0, _working_shoe -> 1);
    _turn := _working_shoe -> 2;
    _river := _working_shoe -> 3;
    _remaining_shoe := _working_shoe - 0 - 0 - 0 - 0;

    _player_full := _round.player_cards || _round.flop || jsonb_build_array(_turn) || jsonb_build_array(_river);
    _dealer_full := _dealer || _round.flop || jsonb_build_array(_turn) || jsonb_build_array(_river);

    _player_score := public.holdem_best_score(_player_full);
    _dealer_score := public.holdem_best_score(_dealer_full);
    _dealer_category := _dealer_score / 759375;
    _dealer_qualified := _dealer_category >= 1;

    _bucket := case
      when not _dealer_qualified then 'win'
      when _player_score > _dealer_score then 'win'
      when _player_score = _dealer_score then 'push'
      else 'lose'
    end;

    exit when _bucket = _intended or _attempt = 50;
  end loop;

  _result := case
    when not _dealer_qualified then 'no_qualify'
    when _player_score > _dealer_score then 'win'
    when _player_score = _dealer_score then 'push'
    else 'lose'
  end;

  _player_category := _player_score / 759375;
  _player_royal := _player_category = 8 and (_player_score - _player_category * 759375) / 50625 = 14;
  _ante_multiplier := public.holdem_ante_multiplier(_player_category, _player_royal);

  _payout := case
    when _result = 'no_qualify' then _round.ante * 2 + _call_bet
    when _result = 'win' then _round.ante * (1 + _ante_multiplier) + _call_bet * 2
    when _result = 'push' then _round.ante + _call_bet
    else 0
  end;

  if _payout > 0 then
    update public.wallets
    set available_balance = available_balance + _payout,
        lifetime_virtual_returned = lifetime_virtual_returned + _payout
    where id = _wallet_id;

    insert into public.wallet_transactions (
      user_id, wallet_id, transaction_type, amount, balance_before, balance_after, reference_type, description
    ) values (
      _user_id, _wallet_id, 'casino_return', _payout, _balance, _balance + _payout, 'holdem_round',
      'Casino Hold''em ' || _result
    );
  end if;

  update public.holdem_rounds
  set status = 'completed', call_bet = _call_bet, total_bet = _round.ante + _call_bet,
      shoe = _remaining_shoe, dealer_cards = _dealer, turn = _turn, river = _river,
      intended_outcome = _intended, result = _result, dealer_qualified = _dealer_qualified,
      hand_category = _player_category, payout = _payout, completed_at = now()
  where id = _round_id;

  insert into public.casino_rounds (user_id, game_id, stake, outcome, multiplier, payout)
  values (
    _user_id, 'texas-holdem', _round.ante + _call_bet,
    case when _result in ('win', 'no_qualify') then 'win' when _result = 'push' then 'push' else 'lose' end,
    case when (_round.ante + _call_bet) > 0 then round(_payout / (_round.ante + _call_bet), 3) else 0 end,
    _payout
  );

  return jsonb_build_object(
    'id', _round_id, 'status', 'completed', 'ante', _round.ante, 'callBet', _call_bet,
    'totalBet', _round.ante + _call_bet, 'playerCards', _round.player_cards, 'flop', _round.flop,
    'dealerCards', _dealer, 'turn', _turn, 'river', _river, 'dealerQualified', _dealer_qualified,
    'handCategory', _player_category, 'isRoyal', _player_royal, 'result', _result, 'payout', _payout
  );
end;
$$;

revoke execute on function public.holdem_start(numeric) from public;
grant execute on function public.holdem_start(numeric) to authenticated;

revoke execute on function public.holdem_fold(uuid) from public;
grant execute on function public.holdem_fold(uuid) to authenticated;

revoke execute on function public.holdem_call(uuid) from public;
grant execute on function public.holdem_call(uuid) to authenticated;
