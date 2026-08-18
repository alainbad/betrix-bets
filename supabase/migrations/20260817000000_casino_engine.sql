-- Phase 6 (Casino Engine): a single generic round-resolution RPC shared by
-- every game in the lobby (spec's CASINO_GAMES catalog), instead of building
-- distinct reel/card/wheel mechanics per title. Every round the client plays
-- is: place a stake, the server rolls the outcome, wins pay out - the actual
-- game skin (slot reels, coin flip, mine tiles, ...) is just the frontend's
-- presentation of that same win/lose/payout result.
--
-- Win rate is fixed at 15% (player wins roughly 1 in ~6.7 rounds) with a flat
-- 6x payout multiplier on a win, giving a theoretical RTP of 0.15 * 6 = 90%
-- (10% house edge) - both are named constants in play_casino_round() so they
-- can be tuned later without touching the call sites.

create table public.casino_rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  game_id text not null,
  stake numeric(14, 2) not null check (stake > 0),
  outcome text not null check (outcome in ('win', 'lose')),
  multiplier numeric(8, 3) not null,
  payout numeric(14, 2) not null check (payout >= 0),
  created_at timestamptz not null default now()
);

create index casino_rounds_user_id_created_at_idx on public.casino_rounds (user_id, created_at desc);

alter table public.casino_rounds enable row level security;

-- Read-only from the client, same read model as bets/wallet_transactions.
-- No insert/update/delete policy: rows are only ever written by
-- play_casino_round() below (SECURITY DEFINER, bypasses RLS).
create policy "casino_rounds select own or admin" on public.casino_rounds
  for select to authenticated
  using (auth.uid() = user_id or public.is_admin(auth.uid()));

create function public.play_casino_round(_game_id text, _stake numeric)
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

revoke execute on function public.play_casino_round(text, numeric) from public;
grant execute on function public.play_casino_round(text, numeric) to authenticated;
