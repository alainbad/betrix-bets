-- Phase 4b (Settlement): admin-triggered event settlement + bet payout.
--
-- There's no live results feed yet (MockSportsProvider fixtures never
-- transition to 'finished' on their own), so settlement here is an explicit
-- admin action: declare a final score for an event, and the whole chain
-- (selections -> markets -> bet_selections -> bets -> wallet payout) settles
-- atomically off of it. A future live provider would call the same RPC from
-- the ingestion job instead of a human typing in a score.
--
-- Outcome determination keys off the selection's `name` ("Home"/"Away"/
-- "Draw"/"Over"/"Under"), matching the convention MockSportsProvider already
-- uses and that EventCard.tsx relies on for its own display logic.

create or replace function public.evaluate_selection_result(
  _market_type text,
  _selection_name text,
  _line numeric,
  _home_score int,
  _away_score int
) returns text
language plpgsql
immutable
as $$
declare
  _total int;
  _adjusted numeric;
begin
  -- Two-way moneylines (no Draw selection, e.g. NBA/tennis) never tie in
  -- practice; a genuine tie would resolve both Home and Away as 'lost'
  -- rather than void, since this function has no visibility into whether a
  -- sibling Draw selection exists on the market.
  if _market_type = 'moneyline' then
    if _selection_name = 'Home' then
      if _home_score > _away_score then return 'won'; else return 'lost'; end if;
    elsif _selection_name = 'Away' then
      if _away_score > _home_score then return 'won'; else return 'lost'; end if;
    elsif _selection_name = 'Draw' then
      if _home_score = _away_score then return 'won'; else return 'lost'; end if;
    else
      return 'void';
    end if;

  elsif _market_type = 'spread' then
    if _line is null then return 'void'; end if;
    if _selection_name = 'Home' then
      _adjusted := _home_score + _line;
    elsif _selection_name = 'Away' then
      _adjusted := _away_score + _line;
    else
      return 'void';
    end if;
    if _selection_name = 'Home' then
      if _adjusted > _away_score then return 'won';
      elsif _adjusted = _away_score then return 'void';
      else return 'lost'; end if;
    else
      if _adjusted > _home_score then return 'won';
      elsif _adjusted = _home_score then return 'void';
      else return 'lost'; end if;
    end if;

  elsif _market_type = 'total' then
    if _line is null then return 'void'; end if;
    _total := _home_score + _away_score;
    if _total = _line then return 'void'; end if;
    if _selection_name = 'Over' then
      if _total > _line then return 'won'; else return 'lost'; end if;
    elsif _selection_name = 'Under' then
      if _total < _line then return 'won'; else return 'lost'; end if;
    else
      return 'void';
    end if;

  else
    return 'void';
  end if;
end;
$$;

create or replace function public.settle_event(_event_id uuid, _home_score int, _away_score int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _market record;
  _selection record;
  _bet_selection record;
  _bet public.bets;
  _wallet_id uuid;
  _balance numeric;
  _payout numeric;
  _txn_type public.wallet_transaction_type;
  _outcome text;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'not authorized';
  end if;

  if _home_score < 0 or _away_score < 0 then
    raise exception 'scores must be non-negative';
  end if;

  update public.events
  set home_score = _home_score,
      away_score = _away_score,
      status = 'finished',
      actual_start = coalesce(actual_start, scheduled_start)
  where id = _event_id and status <> 'finished';

  if not found then
    raise exception 'event not found or already settled';
  end if;

  for _market in select id, market_type from public.markets where event_id = _event_id and status = 'open' loop
    for _selection in select id, name, line from public.selections where market_id = _market.id and status = 'open' loop
      _outcome := public.evaluate_selection_result(_market.market_type, _selection.name, _selection.line, _home_score, _away_score);
      update public.selections set result = _outcome, status = 'settled' where id = _selection.id;
    end loop;
    update public.markets set status = 'settled' where id = _market.id;
  end loop;

  for _bet_selection in
    select bs.id, bs.bet_id, s.result
    from public.bet_selections bs
    join public.selections s on s.id = bs.selection_id
    where bs.event_id = _event_id and bs.result = 'pending'
  loop
    update public.bet_selections set result = _bet_selection.result where id = _bet_selection.id;

    select * into _bet from public.bets where id = _bet_selection.bet_id;

    if _bet.status <> 'pending' then
      continue;
    end if;

    if _bet_selection.result = 'won' then
      _payout := _bet.potential_return;
      _txn_type := 'wager_return';
    elsif _bet_selection.result = 'void' then
      _payout := _bet.total_stake;
      _txn_type := 'wager_return';
    else
      _payout := 0;
    end if;

    if _payout > 0 then
      select id, available_balance into _wallet_id, _balance from public.wallets where user_id = _bet.user_id for update;

      update public.wallets
      set available_balance = available_balance + _payout,
          lifetime_virtual_returned = lifetime_virtual_returned + _payout
      where id = _wallet_id;

      insert into public.wallet_transactions (
        user_id, wallet_id, transaction_type, amount, balance_before, balance_after, reference_type, reference_id, description
      ) values (
        _bet.user_id, _wallet_id, _txn_type, _payout, _balance, _balance + _payout, 'bet', _bet.id,
        case when _bet_selection.result = 'won' then 'Bet settled: won' else 'Bet settled: void, stake refunded' end
      );
    end if;

    update public.bets set status = _bet_selection.result, settled_at = now() where id = _bet.id;
  end loop;
end;
$$;

revoke execute on function public.settle_event(uuid, int, int) from public;
grant execute on function public.settle_event(uuid, int, int) to authenticated;
