-- User suspension, gated by a shared "master code" the ultra_admin creates
-- and hands to trusted staff - a second-factor confirmation against
-- accidental or unauthorized suspensions, independent of whoever's actually
-- logged in as ultra_admin/super_agent/agent at the time.

-- prevent_profile_status_self_escalation (foundation migration) blocked
-- EVERY status change unless the caller was is_admin() - including a
-- legitimate cross-account write from a SECURITY DEFINER RPC like
-- suspend_user below, since is_admin() only recognizes
-- 'administrator'/'super_admin', not the agent hierarchy roles. Narrowed to
-- only guard true self-updates (auth.uid() = new.id), same shape as
-- prevent_profile_parent_self_assignment in
-- 20260825040000_agent_hierarchy_helpers_rls.sql - a cross-account update
-- is already gated by suspend_user/reactivate_user's own authorization
-- checks below, not by this trigger.
create or replace function public.prevent_profile_status_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status
     and auth.uid() = new.id
     and not public.is_admin(auth.uid())
     and not public.is_ultra_admin(auth.uid()) then
    new.status := old.status;
  end if;
  return new;
end;
$$;

-- Single-row secret store (the "id boolean ... check (id)" trick makes a
-- second row impossible - only the value true satisfies both the primary
-- key and the check). No RLS policy is defined, so - RLS being default-deny
-- once enabled - literally nothing is client-reachable here except through
-- the SECURITY DEFINER functions below, which bypass RLS as their owner.
create table public.suspension_master_code (
  id boolean primary key default true check (id),
  code_hash text not null,
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);

alter table public.suspension_master_code enable row level security;

-- ultra_admin-only: create or rotate the master code. Hashed with pgcrypto's
-- bcrypt (already installed into "extensions" by the blackjack shuffle
-- migration) - never stored or returned in plaintext.
create function public.set_suspension_master_code(p_new_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_ultra_admin(auth.uid()) then
    raise exception 'Unauthorized: ultra_admin privileges required';
  end if;

  if p_new_code is null or length(trim(p_new_code)) < 6 then
    raise exception 'Master code must be at least 6 characters';
  end if;

  insert into public.suspension_master_code (id, code_hash, updated_by, updated_at)
  values (true, extensions.crypt(p_new_code, extensions.gen_salt('bf')), auth.uid(), now())
  on conflict (id) do update
  set code_hash = excluded.code_hash, updated_by = excluded.updated_by, updated_at = excluded.updated_at;

  return jsonb_build_object('success', true);
end;
$$;

revoke execute on function public.set_suspension_master_code(text) from public;
grant execute on function public.set_suspension_master_code(text) to authenticated;

-- Whether a master code exists yet (not what it is) - lets the "create
-- master code" section in the dashboard show its current state without
-- ever exposing the hash.
create function public.suspension_master_code_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_ultra_admin(auth.uid()) then
    raise exception 'Unauthorized: ultra_admin privileges required';
  end if;

  return (
    select jsonb_build_object('configured', true, 'updated_at', updated_at)
    from public.suspension_master_code
    where id = true
  );
end;
$$;

revoke execute on function public.suspension_master_code_status() from public;
grant execute on function public.suspension_master_code_status() to authenticated;

-- Suspends any account the caller can reach: ultra_admin reaches everyone,
-- super_agent/agent are limited to their own downline (get_all_downline_ids
-- - the same scoping every other hierarchy RPC uses). Requires the current
-- master code regardless of caller tier - the code is what's being trusted
-- here, not the caller's role alone.
create function public.suspend_user(p_target_identifier text, p_master_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _caller_id uuid := auth.uid();
  _target_id uuid;
  _stored_hash text;
begin
  if not (public.is_ultra_admin(_caller_id) or public.is_super_agent(_caller_id) or public.is_agent_tier(_caller_id)) then
    raise exception 'Unauthorized: hierarchy tier privileges required';
  end if;

  select code_hash into _stored_hash from public.suspension_master_code where id = true;
  if _stored_hash is null then
    raise exception 'No master code has been configured yet';
  end if;
  if p_master_code is null or extensions.crypt(p_master_code, _stored_hash) <> _stored_hash then
    raise exception 'Incorrect master code';
  end if;

  _target_id := public.resolve_account_id(p_target_identifier);

  if _target_id = _caller_id then
    raise exception 'You cannot suspend your own account';
  end if;

  if public.is_ultra_admin(_target_id) then
    raise exception 'Cannot suspend the platform ultra_admin account';
  end if;

  if not public.is_ultra_admin(_caller_id)
     and _target_id not in (select id from public.get_all_downline_ids(_caller_id)) then
    raise exception 'That account is not in your downline';
  end if;

  update public.profiles set status = 'suspended' where id = _target_id;

  return jsonb_build_object('success', true, 'user_id', _target_id, 'status', 'suspended');
end;
$$;

revoke execute on function public.suspend_user(text, text) from public;
grant execute on function public.suspend_user(text, text) to authenticated;

-- Reactivating is the low-risk direction (undoing a suspension, not
-- imposing one), so it does not require the master code - same asymmetry
-- as ultra_admin_set_hierarchy_role's 'player' demote path needing no
-- extra gate beyond the caller's own tier.
create function public.reactivate_user(p_target_identifier text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _caller_id uuid := auth.uid();
  _target_id uuid;
begin
  if not (public.is_ultra_admin(_caller_id) or public.is_super_agent(_caller_id) or public.is_agent_tier(_caller_id)) then
    raise exception 'Unauthorized: hierarchy tier privileges required';
  end if;

  _target_id := public.resolve_account_id(p_target_identifier);

  if not public.is_ultra_admin(_caller_id)
     and _target_id not in (select id from public.get_all_downline_ids(_caller_id)) then
    raise exception 'That account is not in your downline';
  end if;

  update public.profiles set status = 'active' where id = _target_id and status = 'suspended';

  return jsonb_build_object('success', true, 'user_id', _target_id, 'status', 'active');
end;
$$;

revoke execute on function public.reactivate_user(text) from public;
grant execute on function public.reactivate_user(text) to authenticated;
