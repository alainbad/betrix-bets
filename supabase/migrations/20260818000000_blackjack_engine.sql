-- Real Blackjack engine: a genuine multi-step server state machine (start,
-- hit, stand, double), replacing the shared cosmetic-reveal play_casino_round
-- flow for this one game. Real 52-card deck, real dealer rules (stands on
-- all 17s), real natural-blackjack/bust/push handling, real 3:2 blackjack
-- payout, 1:1 normal win, and a stake-returned push.
--
-- The player's own cards are always dealt 100% fair from a crypto-shuffled
-- shoe (pgcrypto's gen_random_bytes, never Postgres's plain random() for
-- shuffling) and are never overridden - if the player busts, they lose,
-- full stop, regardless of anything else.
--
-- The house's mandated win-rate contract from Phase 6 (15% win / ~8% push /
-- 77% lose) is preserved by steering only the DEALER's hidden hole card and
-- subsequent hit-under-17 draws once the player stands: blackjack_stand()
-- replays the dealer's fixed hit/stand algorithm against freshly reshuffled
-- copies of the remaining shoe (up to 50 attempts) until the natural
-- comparison lands in the intended bucket, then keeps that attempt. This is
-- invisible to the player because the dealer's hole card is never exposed
-- until the round completes (enforced by RLS below, not just the frontend),
-- and every individual dealer draw still genuinely follows the real
-- hit-below-17 rule - only which specific cards come up is picked to match.
--
-- Known, accepted deviation: a two-card natural blackjack (~4.8% of hands,
-- for either side) is always dealt fully fair with no steering, since real
-- Blackjack has no rule under which a natural could plausibly lose - so the
-- realised win/push/lose split will be close to but not exactly 15/8/77.

do $$
declare
  _constraint_name text;
begin
  select conname into _constraint_name
  from pg_constraint
  where conrelid = 'public.casino_rounds'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%outcome%';

  if _constraint_name is not null then
    execute format('alter table public.casino_rounds drop constraint %I', _constraint_name);
  end if;

  alter table public.casino_rounds add constraint casino_rounds_outcome_check check (outcome in ('win', 'lose', 'push'));
end;
$$;

create table public.blackjack_rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'player_turn' check (status in ('player_turn', 'completed')),
  bet numeric(14, 2) not null check (bet > 0),
  total_bet numeric(14, 2) not null,
  shoe jsonb not null,
  player_cards jsonb not null,
  dealer_cards jsonb not null,
  intended_outcome text not null check (intended_outcome in ('win', 'push', 'lose')),
  result text check (result in ('blackjack_win', 'win', 'push', 'lose')),
  payout numeric(14, 2),
  is_doubled boolean not null default false,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index blackjack_rounds_user_id_created_at_idx on public.blackjack_rounds (user_id, created_at desc);

alter table public.blackjack_rounds enable row level security;

-- The dealer's hole card lives in dealer_cards, so a row is only readable by
-- its owner once the round is completed (the hole card is revealed) - during
-- player_turn the row is invisible to the client entirely. All in-progress
-- state is read exclusively through the sanitized JSON these RPCs return.
-- Admins can always read every row, in progress or not, for support/audit.
create policy "blackjack_rounds select own completed or admin" on public.blackjack_rounds
  for select to authenticated
  using ((auth.uid() = user_id and status = 'completed') or public.is_admin(auth.uid()));

create function public.blackjack_hand_total(_cards jsonb)
returns int
language plpgsql
immutable
as $$
declare
  _total int := 0;
  _aces int := 0;
  _card jsonb;
  _rank text;
begin
  for _card in select * from jsonb_array_elements(_cards) loop
    _rank := _card ->> 'rank';
    if _rank = 'A' then
      _total := _total + 11;
      _aces := _aces + 1;
    elsif _rank in ('K', 'Q', 'J', '10') then
      _total := _total + 10;
    else
      _total := _total + _rank::int;
    end if;
  end loop;

  while _total > 21 and _aces > 0 loop
    _total := _total - 10;
    _aces := _aces - 1;
  end loop;

  return _total;
end;
$$;

create function public.blackjack_new_shoe()
returns jsonb
language sql
as $$
  select jsonb_agg(jsonb_build_object('rank', r, 'suit', s) order by encode(gen_random_bytes(8), 'hex'))
  from unnest(array['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']) as r
  cross join unnest(array['♠', '♥', '♦', '♣']) as s;
$$;

create function public.blackjack_start(_bet numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _user_id uuid := auth.uid();
  _wallet_id uuid;
  _balance numeric;
  _shoe jsonb;
  _player jsonb;
  _dealer jsonb;
  _player_total int;
  _dealer_total int;
  _intended text;
  _r numeric;
  _round public.blackjack_rounds;
  _result text;
  _payout numeric := 0;
  _min_bet constant numeric := 2;
  _max_bet constant numeric := 1000;
  _win_probability constant numeric := 0.15;
  _push_probability constant numeric := 0.08;
begin
  if _user_id is null then
    raise exception 'not authenticated';
  end if;

  if _bet is null or _bet < _min_bet or _bet > _max_bet then
    raise exception 'bet must be between % and %', _min_bet, _max_bet;
  end if;

  select id, available_balance into _wallet_id, _balance
  from public.wallets where user_id = _user_id for update;

  if not found then
    raise exception 'wallet not found';
  end if;

  if _bet > _balance then
    raise exception 'insufficient balance';
  end if;

  update public.wallets
  set available_balance = available_balance - _bet,
      lifetime_virtual_staked = lifetime_virtual_staked + _bet
  where id = _wallet_id;

  insert into public.wallet_transactions (
    user_id, wallet_id, transaction_type, amount, balance_before, balance_after, reference_type, description
  ) values (
    _user_id, _wallet_id, 'casino_stake', _bet, _balance, _balance - _bet, 'blackjack_round', 'Blackjack bet'
  );
  _balance := _balance - _bet;

  _shoe := public.blackjack_new_shoe();
  _player := jsonb_build_array(_shoe -> 0, _shoe -> 1);
  _shoe := _shoe - 0 - 0;
  _dealer := jsonb_build_array(_shoe -> 0, _shoe -> 1);
  _shoe := _shoe - 0 - 0;

  _player_total := public.blackjack_hand_total(_player);
  _dealer_total := public.blackjack_hand_total(_dealer);

  _r := random();
  _intended := case
    when _r < _win_probability then 'win'
    when _r < _win_probability + _push_probability then 'push'
    else 'lose'
  end;

  if _player_total = 21 or _dealer_total = 21 then
    if _player_total = 21 and _dealer_total = 21 then
      _result := 'push';
      _payout := _bet;
    elsif _player_total = 21 then
      _result := 'blackjack_win';
      _payout := round(_bet * 2.5, 2);
    else
      _result := 'lose';
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
        _user_id, _wallet_id, 'casino_return', _payout, _balance, _balance + _payout, 'blackjack_round',
        'Blackjack ' || _result
      );
    end if;

    insert into public.blackjack_rounds (
      user_id, status, bet, total_bet, shoe, player_cards, dealer_cards, intended_outcome, result, payout, completed_at
    ) values (
      _user_id, 'completed', _bet, _bet, _shoe, _player, _dealer, _intended, _result, _payout, now()
    ) returning * into _round;

    insert into public.casino_rounds (user_id, game_id, stake, outcome, multiplier, payout)
    values (
      _user_id, 'blackjack-classic', _bet,
      case when _result = 'push' then 'push' when _payout > 0 then 'win' else 'lose' end,
      case when _bet > 0 then round(_payout / _bet, 3) else 0 end,
      _payout
    );

    return jsonb_build_object(
      'id', _round.id, 'status', 'completed', 'bet', _bet, 'totalBet', _bet,
      'playerCards', _player, 'dealerCards', _dealer,
      'playerTotal', _player_total, 'dealerTotal', _dealer_total,
      'result', _result, 'payout', _payout, 'isDoubled', false
    );
  end if;

  insert into public.blackjack_rounds (
    user_id, status, bet, total_bet, shoe, player_cards, dealer_cards, intended_outcome
  ) values (
    _user_id, 'player_turn', _bet, _bet, _shoe, _player, _dealer, _intended
  ) returning * into _round;

  return jsonb_build_object(
    'id', _round.id, 'status', 'player_turn', 'bet', _bet, 'totalBet', _bet,
    'playerCards', _player, 'dealerUpCard', _dealer -> 0,
    'playerTotal', _player_total, 'isDoubled', false
  );
end;
$$;

create function public.blackjack_hit(_round_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _user_id uuid := auth.uid();
  _round public.blackjack_rounds;
  _card jsonb;
  _player jsonb;
  _shoe jsonb;
  _total int;
begin
  if _user_id is null then
    raise exception 'not authenticated';
  end if;

  select * into _round from public.blackjack_rounds
  where id = _round_id and user_id = _user_id
  for update;

  if not found then
    raise exception 'round not found';
  end if;

  if _round.status <> 'player_turn' then
    raise exception 'round is not active';
  end if;

  _shoe := _round.shoe;
  _card := _shoe -> 0;
  _shoe := _shoe - 0;
  _player := _round.player_cards || jsonb_build_array(_card);
  _total := public.blackjack_hand_total(_player);

  if _total > 21 then
    update public.blackjack_rounds
    set player_cards = _player, shoe = _shoe, status = 'completed',
        result = 'lose', payout = 0, completed_at = now()
    where id = _round_id;

    insert into public.casino_rounds (user_id, game_id, stake, outcome, multiplier, payout)
    values (_user_id, 'blackjack-classic', _round.total_bet, 'lose', 0, 0);

    return jsonb_build_object(
      'id', _round_id, 'status', 'completed', 'bet', _round.bet, 'totalBet', _round.total_bet,
      'playerCards', _player, 'dealerCards', _round.dealer_cards,
      'playerTotal', _total, 'dealerTotal', public.blackjack_hand_total(_round.dealer_cards),
      'result', 'lose', 'payout', 0, 'isDoubled', _round.is_doubled
    );
  end if;

  update public.blackjack_rounds
  set player_cards = _player, shoe = _shoe
  where id = _round_id;

  return jsonb_build_object(
    'id', _round_id, 'status', 'player_turn', 'bet', _round.bet, 'totalBet', _round.total_bet,
    'playerCards', _player, 'dealerUpCard', _round.dealer_cards -> 0,
    'playerTotal', _total, 'isDoubled', _round.is_doubled
  );
end;
$$;

create function public.blackjack_stand(_round_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _user_id uuid := auth.uid();
  _round public.blackjack_rounds;
  _player_total int;
  _dealer_total int := 0;
  _attempt int;
  _working_shoe jsonb;
  _dealer jsonb := '[]'::jsonb;
  _card jsonb;
  _result text;
  _payout numeric;
  _balance numeric;
  _wallet_id uuid;
  _desired text;
begin
  if _user_id is null then
    raise exception 'not authenticated';
  end if;

  select * into _round from public.blackjack_rounds
  where id = _round_id and user_id = _user_id
  for update;

  if not found then
    raise exception 'round not found';
  end if;

  if _round.status <> 'player_turn' then
    raise exception 'round is not active';
  end if;

  _player_total := public.blackjack_hand_total(_round.player_cards);

  -- The dealer's up-card was already shown to the player during their turn
  -- (via dealerUpCard in the start/hit responses) and must never change.
  -- The hole card, never shown, is put back into the retry pool alongside
  -- the remaining shoe so it - and every hit-card - can be re-picked on
  -- each attempt while the up-card stays fixed.
  for _attempt in 1..50 loop
    select jsonb_agg(elem order by encode(gen_random_bytes(8), 'hex'))
    into _working_shoe
    from jsonb_array_elements(_round.shoe || jsonb_build_array(_round.dealer_cards -> 1)) as elem;

    _dealer := jsonb_build_array(_round.dealer_cards -> 0);
    _card := _working_shoe -> 0;
    _working_shoe := _working_shoe - 0;
    _dealer := _dealer || jsonb_build_array(_card);
    _dealer_total := public.blackjack_hand_total(_dealer);

    while _dealer_total < 17 loop
      _card := _working_shoe -> 0;
      _working_shoe := _working_shoe - 0;
      _dealer := _dealer || jsonb_build_array(_card);
      _dealer_total := public.blackjack_hand_total(_dealer);
    end loop;

    _desired := case
      when _dealer_total > 21 then 'win'
      when _dealer_total > _player_total then 'lose'
      when _dealer_total < _player_total then 'win'
      else 'push'
    end;

    exit when _desired = _round.intended_outcome or _attempt = 50;
  end loop;

  _result := case
    when _dealer_total > 21 then 'win'
    when _dealer_total > _player_total then 'lose'
    when _dealer_total < _player_total then 'win'
    else 'push'
  end;

  _payout := case
    when _result = 'win' then round(_round.total_bet * 2, 2)
    when _result = 'push' then _round.total_bet
    else 0
  end;

  select id, available_balance into _wallet_id, _balance from public.wallets where user_id = _user_id for update;

  if _payout > 0 then
    update public.wallets
    set available_balance = available_balance + _payout,
        lifetime_virtual_returned = lifetime_virtual_returned + _payout
    where id = _wallet_id;

    insert into public.wallet_transactions (
      user_id, wallet_id, transaction_type, amount, balance_before, balance_after, reference_type, description
    ) values (
      _user_id, _wallet_id, 'casino_return', _payout, _balance, _balance + _payout, 'blackjack_round',
      'Blackjack ' || _result
    );
  end if;

  update public.blackjack_rounds
  set status = 'completed', dealer_cards = _dealer, shoe = _working_shoe,
      result = _result, payout = _payout, completed_at = now()
  where id = _round_id;

  insert into public.casino_rounds (user_id, game_id, stake, outcome, multiplier, payout)
  values (
    _user_id, 'blackjack-classic', _round.total_bet, _result,
    case when _round.total_bet > 0 then round(_payout / _round.total_bet, 3) else 0 end, _payout
  );

  return jsonb_build_object(
    'id', _round_id, 'status', 'completed', 'bet', _round.bet, 'totalBet', _round.total_bet,
    'playerCards', _round.player_cards, 'dealerCards', _dealer,
    'playerTotal', _player_total, 'dealerTotal', _dealer_total,
    'result', _result, 'payout', _payout, 'isDoubled', _round.is_doubled
  );
end;
$$;

create function public.blackjack_double(_round_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _user_id uuid := auth.uid();
  _round public.blackjack_rounds;
  _wallet_id uuid;
  _balance numeric;
  _card jsonb;
  _shoe jsonb;
  _player jsonb;
  _total int;
begin
  if _user_id is null then
    raise exception 'not authenticated';
  end if;

  select * into _round from public.blackjack_rounds
  where id = _round_id and user_id = _user_id
  for update;

  if not found then
    raise exception 'round not found';
  end if;

  if _round.status <> 'player_turn' then
    raise exception 'round is not active';
  end if;

  if jsonb_array_length(_round.player_cards) <> 2 then
    raise exception 'double down only allowed on the initial two cards';
  end if;

  select id, available_balance into _wallet_id, _balance from public.wallets where user_id = _user_id for update;

  if _round.bet > _balance then
    raise exception 'insufficient balance to double down';
  end if;

  update public.wallets
  set available_balance = available_balance - _round.bet,
      lifetime_virtual_staked = lifetime_virtual_staked + _round.bet
  where id = _wallet_id;

  insert into public.wallet_transactions (
    user_id, wallet_id, transaction_type, amount, balance_before, balance_after, reference_type, description
  ) values (
    _user_id, _wallet_id, 'casino_stake', _round.bet, _balance, _balance - _round.bet, 'blackjack_round',
    'Blackjack double down'
  );

  _shoe := _round.shoe;
  _card := _shoe -> 0;
  _shoe := _shoe - 0;
  _player := _round.player_cards || jsonb_build_array(_card);
  _total := public.blackjack_hand_total(_player);

  update public.blackjack_rounds
  set player_cards = _player, shoe = _shoe, total_bet = _round.total_bet + _round.bet, is_doubled = true
  where id = _round_id;

  if _total > 21 then
    update public.blackjack_rounds
    set status = 'completed', result = 'lose', payout = 0, completed_at = now()
    where id = _round_id;

    insert into public.casino_rounds (user_id, game_id, stake, outcome, multiplier, payout)
    values (_user_id, 'blackjack-classic', _round.total_bet + _round.bet, 'lose', 0, 0);

    return jsonb_build_object(
      'id', _round_id, 'status', 'completed', 'bet', _round.bet, 'totalBet', _round.total_bet + _round.bet,
      'playerCards', _player, 'dealerCards', _round.dealer_cards,
      'playerTotal', _total, 'dealerTotal', public.blackjack_hand_total(_round.dealer_cards),
      'result', 'lose', 'payout', 0, 'isDoubled', true
    );
  end if;

  return public.blackjack_stand(_round_id);
end;
$$;

revoke execute on function public.blackjack_start(numeric) from public;
grant execute on function public.blackjack_start(numeric) to authenticated;

revoke execute on function public.blackjack_hit(uuid) from public;
grant execute on function public.blackjack_hit(uuid) to authenticated;

revoke execute on function public.blackjack_stand(uuid) from public;
grant execute on function public.blackjack_stand(uuid) to authenticated;

revoke execute on function public.blackjack_double(uuid) from public;
grant execute on function public.blackjack_double(uuid) to authenticated;
