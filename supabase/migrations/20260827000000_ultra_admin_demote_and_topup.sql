-- Two follow-ups to the Ultra Agent Dashboard's "All Users" tab, both
-- scoped to ultra_admin like everything else in that tab:
--
-- 1. ultra_admin_set_hierarchy_role gains a 'player' target for p_role,
--    demoting an existing super_agent/agent back to a plain player by
--    dropping their hierarchy role row - the ultra_admin asked for
--    "Make Super Agent"/"Make Agent" to be reversible rather than a
--    one-way door. Deliberately just drops the role: any players/agents
--    still pointing at this account via parent_id keep doing so (that's
--    existing tree data, not something this action should silently
--    rewrite), and the wallet ledger is untouched either way - only the
--    role grant is undone.
--
-- 2. ultra_admin_topup_wallet: a manual balance credit against ANY account
--    (player, agent, or super_agent), not just an already-super_agent
--    target the way mint_super_agent_balance is scoped. Same ledger shape
--    as admin_topup_wallet (20260823010000_admin_wallet_topup.sql), but
--    gated on is_ultra_admin instead of is_admin (the ultra_admin role
--    doesn't also carry 'administrator'/'super_admin') and resolved via
--    resolve_account_id so it takes the same UID/email/phone identifier as
--    every other action in this dashboard, not just email.

create or replace function public.ultra_admin_set_hierarchy_role(p_target_identifier text, p_role text)
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

  if p_role not in ('super_agent', 'agent', 'player') then
    raise exception 'Role must be super_agent, agent, or player';
  end if;

  _target_id := public.resolve_account_id(p_target_identifier);

  if p_role = 'player' then
    if not (public.is_super_agent(_target_id) or public.is_agent_tier(_target_id)) then
      raise exception 'Target does not currently hold a super_agent or agent role';
    end if;

    delete from public.user_roles
    where user_id = _target_id and role in ('super_agent', 'agent');

    return jsonb_build_object('success', true, 'user_id', _target_id, 'role', 'player');
  end if;

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

create function public.ultra_admin_topup_wallet(p_target_identifier text, p_amount numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _target_id uuid;
  _wallet_id uuid;
  _balance numeric;
begin
  if not public.is_ultra_admin(auth.uid()) then
    raise exception 'Unauthorized: ultra_admin privileges required';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Top-up amount must be greater than zero';
  end if;

  _target_id := public.resolve_account_id(p_target_identifier);

  select id, available_balance into _wallet_id, _balance
  from public.wallets
  where user_id = _target_id
  for update;

  if _wallet_id is null then
    raise exception 'Wallet not found for target';
  end if;

  update public.wallets
  set available_balance = available_balance + p_amount
  where id = _wallet_id;

  insert into public.wallet_transactions (
    user_id, wallet_id, transaction_type, amount, balance_before, balance_after, reference_type, description
  ) values (
    _target_id, _wallet_id, 'admin_adjustment', p_amount, _balance, _balance + p_amount,
    'ultra_admin_topup', 'Top-up by ultra_admin ' || auth.uid()::text
  );

  return jsonb_build_object('success', true, 'new_balance', _balance + p_amount, 'target_user_id', _target_id);
end;
$$;

revoke execute on function public.ultra_admin_topup_wallet(text, numeric) from public;
grant execute on function public.ultra_admin_topup_wallet(text, numeric) to authenticated;
