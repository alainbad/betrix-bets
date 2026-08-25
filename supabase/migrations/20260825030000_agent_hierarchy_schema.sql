-- 3-tier agent hierarchy (Phase 1): schema for ultra_admin -> super_agent ->
-- agent -> player, layered onto the existing roles/wallets machinery rather
-- than a parallel profiles.role/profiles.balance system. See the follow-up
-- migrations (agent_hierarchy_helpers_rls, agent_hierarchy_rpcs) for the
-- privilege helpers and stored procedures - kept in separate files/
-- transactions because a newly added enum value can't be referenced in the
-- same transaction that adds it.
--
-- Balances: every tier already gets a public.wallets row via handle_new_user
-- on signup, so "minting"/"allocating"/"cashing out" coins between tiers is
-- just moves within the existing wallets/wallet_transactions ledger - one
-- ledger for the whole platform's coins, not a second profiles.balance
-- column running in parallel and able to drift out of sync with it.
--
-- Roles: reuses the existing app_role enum + roles/user_roles tables (and
-- the is_admin()/has_role() helpers already built on them) instead of a new
-- profiles.role text column, which would've been a second, ungoverned
-- source of truth for privilege sitting next to the first.

alter type public.app_role add value 'ultra_admin';
alter type public.app_role add value 'super_agent';
alter type public.app_role add value 'agent';

alter type public.wallet_transaction_type add value 'agent_mint';
alter type public.wallet_transaction_type add value 'agent_allocation';
alter type public.wallet_transaction_type add value 'agent_reclaim';
alter type public.wallet_transaction_type add value 'agent_topup';
alter type public.wallet_transaction_type add value 'agent_cashout';

-- Self-referencing tree pointer: a player's registering agent, a sub-agent's
-- super_agent, etc. Left null for house players who self-signed-up outside
-- the agent network (the existing /register flow) and for super_agents,
-- who sit directly under the platform (ultra_admin isn't itself a specific
-- row every super_agent needs to point at - "ultra_admin" is a role, not a
-- tenant).
alter table public.profiles
  add column parent_id uuid references public.profiles (id) on delete set null;

create index profiles_parent_id_idx on public.profiles (parent_id);
create index user_roles_role_idx on public.user_roles (role);

-- Every descendant (children, grandchildren, ...) of root_user_id in the
-- parent_id tree. security definer + stable so it's safe to call from RLS
-- policies on profiles/wallets/wallet_transactions without recursive RLS
-- evaluation, same rationale as has_role()/is_admin() in the foundation
-- migration.
create function public.get_all_downline_ids(root_user_id uuid)
returns table (id uuid)
language sql
stable
security definer
set search_path = public
as $$
  with recursive downline as (
    select p.id, p.parent_id
    from public.profiles p
    where p.parent_id = root_user_id
    union all
    select p.id, p.parent_id
    from public.profiles p
    join downline d on p.parent_id = d.id
  )
  select id from downline
$$;

revoke execute on function public.get_all_downline_ids(uuid) from public;
grant execute on function public.get_all_downline_ids(uuid) to authenticated;
