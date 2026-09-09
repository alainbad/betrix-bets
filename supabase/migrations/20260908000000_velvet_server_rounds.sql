-- New games use dedicated authoritative settlement. Existing games stay unchanged.
create table public.velvet_sessions (
 user_id uuid not null references auth.users(id) on delete cascade,
 game_id text not null check(game_id in ('velvet-vault','velvet-roulette','velvet-candy','velvet-thunder')),
 version bigint not null default 0,
 state jsonb,
 primary key(user_id,game_id)
);
create table public.velvet_receipts (
 user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,
 game_id text not null,
 response jsonb not null,
 created_at timestamptz not null default now(),
 primary key(user_id,request_id)
);
alter table public.velvet_sessions enable row level security;
alter table public.velvet_receipts enable row level security;
-- Session state contains unrevealed safe prizes. Service-role access only.
revoke all on public.velvet_sessions,public.velvet_receipts from anon,authenticated;
grant all on public.velvet_sessions,public.velvet_receipts to service_role;

-- Free spins and bonus picks have no new stake but still get their own history entry.
alter table public.casino_rounds drop constraint casino_rounds_stake_check;
alter table public.casino_rounds add constraint casino_rounds_stake_check check(stake>=0);

create function public.settle_velvet_round(
 p_user uuid,p_request uuid,p_game text,p_version bigint,
 p_stake numeric,p_payout numeric,p_result jsonb,p_state jsonb,p_public_state jsonb
) returns jsonb language plpgsql security definer set search_path=public as $$
declare w public.wallets; s public.velvet_sessions; receipt jsonb; rid uuid; result jsonb;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Service role required';end if;
 if p_game not in ('velvet-vault','velvet-roulette','velvet-candy','velvet-thunder') then raise exception 'Unknown game';end if;
 if p_stake is null or p_payout is null or p_stake<0 or p_payout<0 or p_stake>100000 or p_payout>999999999999 or p_stake<>round(p_stake,2) or p_payout<>round(p_payout,2) then raise exception 'Invalid amounts';end if;
 -- Match the lock order used by other wallet RPCs. No overlapping request can spend twice.
 select * into w from public.wallets where user_id=p_user for update;
 if w.id is null then raise exception 'Wallet unavailable';end if;
 select response into receipt from public.velvet_receipts where user_id=p_user and request_id=p_request;
 if found then if receipt->>'gameId'<>p_game then raise exception 'Request ID already used';end if;return receipt;end if;
 if not exists(select 1 from public.profiles where id=p_user and status='active') then raise exception 'Account is not active';end if;
 insert into public.velvet_sessions(user_id,game_id) values(p_user,p_game) on conflict do nothing;
 select * into s from public.velvet_sessions where user_id=p_user and game_id=p_game for update;
 if s.version<>p_version then raise exception 'Game state changed. Reopen the game to resume.';end if;
 if w.available_balance<p_stake then raise exception 'Insufficient balance';end if;
 update public.wallets set available_balance=available_balance-p_stake+p_payout,lifetime_virtual_staked=lifetime_virtual_staked+p_stake,lifetime_virtual_returned=lifetime_virtual_returned+p_payout where id=w.id;
 insert into public.casino_rounds(user_id,game_id,stake,outcome,multiplier,payout)
 values(p_user,p_game,p_stake,case when p_payout>0 then 'win' else 'lose' end,case when p_stake>0 then p_payout/p_stake else 0 end,p_payout) returning id into rid;
 if p_stake>0 then insert into public.wallet_transactions(user_id,wallet_id,transaction_type,amount,balance_before,balance_after,reference_type,reference_id,description) values(p_user,w.id,'casino_stake',p_stake,w.available_balance,w.available_balance-p_stake,'velvet_round',rid,p_game||' stake');end if;
 if p_payout>0 then insert into public.wallet_transactions(user_id,wallet_id,transaction_type,amount,balance_before,balance_after,reference_type,reference_id,description) values(p_user,w.id,'casino_return',p_payout,w.available_balance-p_stake,w.available_balance-p_stake+p_payout,'velvet_round',rid,p_game||' payout');end if;
 update public.velvet_sessions set state=p_state,version=version+1 where user_id=p_user and game_id=p_game;
 result=jsonb_build_object('roundId',rid,'gameId',p_game,'balanceAfter',w.available_balance-p_stake+p_payout,'payout',p_payout,'stake',p_stake,'result',p_result,'state',p_public_state,'version',s.version+1);
 insert into public.velvet_receipts(user_id,request_id,game_id,response) values(p_user,p_request,p_game,result);
 return result;
end;$$;
revoke all on function public.settle_velvet_round(uuid,uuid,text,bigint,numeric,numeric,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.settle_velvet_round(uuid,uuid,text,bigint,numeric,numeric,jsonb,jsonb,jsonb) to service_role;
