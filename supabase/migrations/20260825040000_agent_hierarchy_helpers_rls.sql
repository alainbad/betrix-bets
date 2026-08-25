-- 3-tier agent hierarchy (Phase 2): privilege helpers + RLS visibility.
-- Separate transaction from agent_hierarchy_schema.sql so the new app_role
-- values it added are safe to reference here.

create function public.is_ultra_admin(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(_user_id, 'ultra_admin')
$$;

create function public.is_super_agent(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(_user_id, 'super_agent')
$$;

-- Named for the tier, not the generic English word - "is_agent" would read
-- ambiguously next to is_admin()/is_super_agent().
create function public.is_agent_tier(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(_user_id, 'agent')
$$;

-- A player can update their own profile row (existing "profiles update own"
-- policy), but parent_id - who their registering agent/super_agent is -
-- must never be client-settable, or any player could assign themselves into
-- an agent's downline and receive/siphon transfers meant for that agent's
-- real book. Cross-account changes made by the hierarchy RPCs below (e.g.
-- assign_player_to_agent) update a *different* row than the caller's own,
-- so auth.uid() <> new.id there and this guard doesn't touch them - only a
-- direct self-update is blocked, mirroring
-- prevent_profile_status_self_escalation in the foundation migration.
create function public.prevent_profile_parent_self_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.parent_id is distinct from old.parent_id
     and auth.uid() = new.id
     and not public.is_admin(auth.uid())
     and not public.is_ultra_admin(auth.uid()) then
    new.parent_id := old.parent_id;
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_parent_self_assignment
  before update on public.profiles
  for each row execute function public.prevent_profile_parent_self_assignment();

-- ============================================================
-- RLS: hierarchy visibility on top of the existing "own row or admin" reads.
-- ultra_admin sees everything; a super_agent/agent sees their own row plus
-- every descendant in their branch (get_all_downline_ids); nothing here
-- grants any write access - balance changes still only happen through the
-- SECURITY DEFINER RPCs in agent_hierarchy_rpcs.sql, and wallets/
-- wallet_transactions still have no client insert/update/delete policy.
-- ============================================================

alter policy "profiles select own or admin" on public.profiles
  using (
    auth.uid() = id
    or public.is_admin(auth.uid())
    or public.is_ultra_admin(auth.uid())
    or id in (select id from public.get_all_downline_ids(auth.uid()))
  );

alter policy "user_roles select own or admin" on public.user_roles
  using (
    auth.uid() = user_id
    or public.is_admin(auth.uid())
    or public.is_ultra_admin(auth.uid())
    or user_id in (select id from public.get_all_downline_ids(auth.uid()))
  );

alter policy "wallets select own or admin" on public.wallets
  using (
    auth.uid() = user_id
    or public.is_admin(auth.uid())
    or public.is_ultra_admin(auth.uid())
    or user_id in (select id from public.get_all_downline_ids(auth.uid()))
  );

alter policy "wallet_transactions select own or admin" on public.wallet_transactions
  using (
    auth.uid() = user_id
    or public.is_admin(auth.uid())
    or public.is_ultra_admin(auth.uid())
    or user_id in (select id from public.get_all_downline_ids(auth.uid()))
  );

-- Lets a super_agent/agent compute win/loss turnover for the players in
-- their branch (SuperAgentView's "aggregate player stats"). Scoped to the
-- HTML5 casino ledger only for now - blackjack_rounds/holdem_rounds have
-- their own "select own completed or admin" policies that would need the
-- same treatment if hierarchy visibility is ever needed there too.
alter policy "casino_rounds select own or admin" on public.casino_rounds
  using (
    auth.uid() = user_id
    or public.is_admin(auth.uid())
    or public.is_ultra_admin(auth.uid())
    or user_id in (select id from public.get_all_downline_ids(auth.uid()))
  );
