-- Phase 4 (Betting Engine): wallet-backed simulated bet placement.
-- Spec refs: MASTER PROJECT SPECIFICATION sections 19-24 (wallet), place_simulated_bet()
-- was already anticipated by name in the Phase 1 migration's wallets/wallet_transactions
-- RLS comments.
--
-- Scope: bet placement only. A bet is created 'pending' and stays that way until a
-- future settlement step (results ingestion + payout) marks it won/lost/void and
-- credits the wallet back - that's not part of this migration.
--
-- Each row in the app's bet slip becomes its own single bet (no parlay combining),
-- matching how the frontend bet slip already works: one stake per selection.

-- ============================================================
-- BETS
-- ============================================================

create table public.bets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'won', 'lost', 'void')),
  total_stake numeric(14, 2) not null check (total_stake > 0),
  total_odds numeric(8, 3) not null check (total_odds > 1),
  potential_return numeric(14, 2) not null,
  placed_at timestamptz not null default now(),
  settled_at timestamptz
);

create index bets_user_id_placed_at_idx on public.bets (user_id, placed_at desc);

-- Snapshots event/market/selection names and the odds at placement time, so a
-- bet's history record never changes even if the underlying selection is later
-- repriced or the market's label is edited.
create table public.bet_selections (
  id uuid primary key default gen_random_uuid(),
  bet_id uuid not null references public.bets (id) on delete cascade,
  selection_id uuid not null references public.selections (id),
  event_id uuid not null references public.events (id),
  event_name text not null,
  market_label text not null,
  selection_label text not null,
  decimal_odds_at_placement numeric(8, 3) not null,
  result text not null default 'pending' check (result in ('pending', 'won', 'lost', 'void')),
  created_at timestamptz not null default now()
);

create index bet_selections_bet_id_idx on public.bet_selections (bet_id);

alter table public.bets enable row level security;
alter table public.bet_selections enable row level security;

-- Read-only from the client, same read model as wallets/wallet_transactions.
-- No insert/update/delete policy exists for either table: rows are only ever
-- written by place_simulated_bet() below (SECURITY DEFINER, runs as the table
-- owner, so RLS doesn't block its inserts).
create policy "bets select own or admin" on public.bets
  for select to authenticated
  using (auth.uid() = user_id or public.is_admin(auth.uid()));

create policy "bet_selections select own or admin" on public.bet_selections
  for select to authenticated
  using (
    exists (
      select 1 from public.bets b
      where b.id = bet_id and (b.user_id = auth.uid() or public.is_admin(auth.uid()))
    )
  );

-- ============================================================
-- PLACE_SIMULATED_BET
-- Atomically: locks the caller's wallet, validates + sums stakes, debits the
-- wallet once for the whole slip, then inserts one bets + bet_selections row
-- per leg. Runs entirely inside the function's implicit transaction, so a
-- failure partway through (e.g. a selection closed between page load and
-- submit) rolls back the wallet debit too.
-- ============================================================

create function public.place_simulated_bet(_legs jsonb)
returns setof public.bets
language plpgsql
security definer
set search_path = public
as $$
declare
  _user_id uuid := auth.uid();
  _wallet_id uuid;
  _wallet_balance numeric;
  _leg jsonb;
  _stake numeric;
  _total numeric := 0;
  _selection record;
  _bet public.bets;
  _balance_before numeric;
  _balance_after numeric;
begin
  if _user_id is null then
    raise exception 'not authenticated';
  end if;

  if _legs is null or jsonb_typeof(_legs) <> 'array' or jsonb_array_length(_legs) = 0 then
    raise exception 'bet slip is empty';
  end if;

  select id, available_balance into _wallet_id, _wallet_balance
  from public.wallets
  where user_id = _user_id
  for update;

  if not found then
    raise exception 'wallet not found';
  end if;

  for _leg in select * from jsonb_array_elements(_legs)
  loop
    _stake := (_leg ->> 'stake')::numeric;
    if _stake is null or _stake <= 0 then
      raise exception 'invalid stake amount';
    end if;
    _total := _total + _stake;
  end loop;

  if _total > _wallet_balance then
    raise exception 'insufficient balance';
  end if;

  _balance_before := _wallet_balance;
  _balance_after := _wallet_balance - _total;

  update public.wallets
  set available_balance = _balance_after,
      lifetime_virtual_staked = lifetime_virtual_staked + _total
  where id = _wallet_id;

  insert into public.wallet_transactions (
    user_id, wallet_id, transaction_type, amount, balance_before, balance_after, reference_type, description
  ) values (
    _user_id, _wallet_id, 'wager_stake', _total, _balance_before, _balance_after, 'bet_slip', 'Bet slip placed'
  );

  for _leg in select * from jsonb_array_elements(_legs)
  loop
    select
      s.id as selection_id,
      s.decimal_odds as decimal_odds,
      s.name as selection_name,
      m.label as market_label,
      e.id as event_id,
      e.name as event_name
    into _selection
    from public.selections s
    join public.markets m on m.id = s.market_id
    join public.events e on e.id = m.event_id
    where s.id = (_leg ->> 'selection_id')::uuid
      and s.status = 'open'
      and m.status = 'open'
      and e.status in ('scheduled', 'live')
    for update of s;

    if not found then
      raise exception 'selection % is not open for betting', (_leg ->> 'selection_id');
    end if;

    _stake := (_leg ->> 'stake')::numeric;

    insert into public.bets (user_id, status, total_stake, total_odds, potential_return)
    values (_user_id, 'pending', _stake, _selection.decimal_odds, round(_stake * _selection.decimal_odds, 2))
    returning * into _bet;

    insert into public.bet_selections (
      bet_id, selection_id, event_id, event_name, market_label, selection_label,
      decimal_odds_at_placement, result
    ) values (
      _bet.id, _selection.selection_id, _selection.event_id, _selection.event_name,
      _selection.market_label, _selection.selection_name, _selection.decimal_odds, 'pending'
    );

    return next _bet;
  end loop;

  return;
end;
$$;

revoke execute on function public.place_simulated_bet(jsonb) from public;
grant execute on function public.place_simulated_bet(jsonb) to authenticated;
