-- Lets the ultra_admin appoint an existing account directly into the
-- hierarchy as a super_agent or agent, without that account first being
-- promoted by a super_agent (promote_to_agent requires the caller to
-- itself be a super_agent, which the platform owner appointing a fresh
-- agent branch may not want to route through). Reuses resolve_account_id
-- from 20260826000000_account_id_lookup_schema.sql so the target can be
-- looked up by account_id/email/phone, and the same "no existing hierarchy
-- role" eligibility guard as promote_to_super_agent/promote_to_agent.
--
-- A directly-appointed agent is left with parent_id null (an unclaimed
-- branch) rather than assigned under the ultra_admin - ultra_admin isn't a
-- specific tenant row in the parent_id tree (see agent_hierarchy_schema.sql)
-- and a super_agent can still reach it later the same way any other
-- unclaimed account is claimed. A directly-appointed super_agent already
-- has no parent_id by convention (super_agents sit directly under the
-- platform), so nothing to set there either.
create function public.ultra_admin_set_hierarchy_role(p_target_identifier text, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _target_id uuid;
begin
  if not public.is_ultra_admin(auth.uid()) then
    raise exception 'Unauthorized: ultra_admin privileges required';
  end if;

  if p_role not in ('super_agent', 'agent') then
    raise exception 'Role must be either super_agent or agent';
  end if;

  _target_id := public.resolve_account_id(p_target_identifier);

  if public.is_super_agent(_target_id) or public.is_agent_tier(_target_id)
     or public.is_ultra_admin(_target_id) or public.is_admin(_target_id) then
    raise exception 'This account already has a hierarchy role';
  end if;

  insert into public.user_roles (user_id, role) values (_target_id, p_role::public.app_role);

  return jsonb_build_object('success', true, 'user_id', _target_id, 'role', p_role);
end;
$$;

revoke execute on function public.ultra_admin_set_hierarchy_role(text, text) from public;
grant execute on function public.ultra_admin_set_hierarchy_role(text, text) to authenticated;

-- One-time bootstrap of the platform owner as ultra_admin. Raises a notice
-- (rather than failing the migration) if the account hasn't signed up yet,
-- same defensive pattern as 20260823000000_demo_coin_topup.sql - and
-- refuses to silently overwrite if the account somehow already holds a
-- different hierarchy role, rather than layering ultra_admin on top of it.
do $$
declare
  _user_id uuid;
begin
  select id into _user_id
  from public.profiles
  where email = 'badranalain87@gmail.com';

  if _user_id is null then
    raise notice 'ultra_admin_bootstrap: no profile found for badranalain87@gmail.com, skipping';
    return;
  end if;

  if public.is_ultra_admin(_user_id) then
    raise notice 'ultra_admin_bootstrap: badranalain87@gmail.com is already ultra_admin, skipping';
    return;
  end if;

  if public.is_super_agent(_user_id) or public.is_agent_tier(_user_id) or public.is_admin(_user_id) then
    raise exception 'ultra_admin_bootstrap: badranalain87@gmail.com already holds a different hierarchy/admin role, refusing to overwrite';
  end if;

  insert into public.user_roles (user_id, role) values (_user_id, 'ultra_admin');
end $$;
