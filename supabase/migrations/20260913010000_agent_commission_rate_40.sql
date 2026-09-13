-- Amend the agent commission split from 45% to 40% of GGR, per updated spec.
create or replace function public.get_agent_commission_report(
  p_start_date timestamptz,
  p_end_date timestamptz
)
returns table (
  agent_id uuid,
  agent_account_id text,
  agent_username text,
  active_players bigint,
  total_bets bigint,
  total_turnover numeric(14, 2),
  total_payouts numeric(14, 2),
  ggr numeric(14, 2),
  hold_percentage numeric(6, 2),
  commission_rate numeric(4, 2),
  commission_owed numeric(14, 2)
)
language plpgsql
security definer
set search_path = public
as $$
declare
  _caller uuid := auth.uid();
  _scope_to_self boolean;
begin
  if _caller is null then
    raise exception 'Not signed in';
  end if;

  if public.is_ultra_admin(_caller) then
    _scope_to_self := false;
  elsif public.is_agent_tier(_caller) then
    _scope_to_self := true;
  else
    raise exception 'Only the ultra admin or an agent may run this report';
  end if;

  return query
  with agent_rows as (
    select p.id, p.account_id, p.username
    from public.profiles p
    join public.user_roles ur on ur.user_id = p.id and ur.role = 'agent'
    where not _scope_to_self or p.id = _caller
  ),
  round_activity as (
    select
      pl.parent_id as agent_id,
      cr.user_id as player_id,
      cr.stake,
      cr.payout
    from public.casino_rounds cr
    join public.profiles pl on pl.id = cr.user_id
    where pl.parent_id is not null
      and cr.created_at >= p_start_date
      and cr.created_at <= p_end_date
  )
  select
    a.id,
    a.account_id,
    a.username,
    count(distinct ra.player_id) filter (where ra.player_id is not null),
    count(ra.player_id),
    coalesce(round(sum(ra.stake), 2), 0.00),
    coalesce(round(sum(ra.payout), 2), 0.00),
    coalesce(round(sum(ra.stake - ra.payout), 2), 0.00),
    case
      when coalesce(sum(ra.stake), 0) > 0
        then round((sum(ra.stake - ra.payout) / sum(ra.stake)) * 100.0, 2)
      else 0.00
    end,
    0.40,
    greatest(0.00, round(coalesce(sum(ra.stake - ra.payout), 0) * 0.40, 2))
  from agent_rows a
  left join round_activity ra on ra.agent_id = a.id
  group by a.id, a.account_id, a.username
  order by commission_owed desc, total_turnover desc;
end;
$$;
