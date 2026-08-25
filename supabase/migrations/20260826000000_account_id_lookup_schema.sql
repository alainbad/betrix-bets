-- Unique, human-readable account IDs + multi-field account resolution
-- (UID / email / phone), for looking up any account across the hierarchy
-- without needing to already have its raw UUID on hand.
--
-- Reuses the existing profiles.phone column as the "phone_number" this
-- feature asks for, rather than adding a second phone column next to it -
-- profile.tsx already collects/edits profiles.phone, so a separate
-- phone_number column would just be the same data living in two places.
-- profiles.email is already indexed (profiles_email_idx, foundation
-- migration), so nothing needed there either.

alter table public.profiles add column account_id text;

-- Deterministic, collision-free backfill for existing rows (no retry loop
-- needed like the trigger below - row_number() guarantees each existing
-- profile gets a distinct suffix in one pass).
update public.profiles p
set account_id = 'BET-' || lpad((100000 + sub.rn)::text, 6, '0')
from (
  select id, row_number() over (order by created_at) as rn
  from public.profiles
) sub
where p.id = sub.id;

alter table public.profiles alter column account_id set not null;
alter table public.profiles add constraint profiles_account_id_unique unique (account_id);
alter table public.profiles add constraint profiles_phone_unique unique (phone);

-- Auto-generates a 'BET-XXXXXX' account_id for new signups that don't
-- supply one (the normal case - handle_new_user's insert never sets it).
-- Not security definer: the only INSERT path into profiles is
-- handle_new_user, itself security definer, so this trigger's collision
-- check already runs with RLS bypassed via that enclosing context.
create function public.generate_profile_account_id()
returns trigger
language plpgsql
as $$
declare
  _candidate text;
  _attempts int := 0;
begin
  if new.account_id is not null and trim(new.account_id) <> '' then
    new.account_id := upper(trim(new.account_id));
    return new;
  end if;

  loop
    _candidate := 'BET-' || lpad(floor(random() * 1000000)::int::text, 6, '0');
    exit when not exists (select 1 from public.profiles where account_id = _candidate);
    _attempts := _attempts + 1;
    if _attempts > 20 then
      raise exception 'Unable to generate a unique account_id after % attempts', _attempts;
    end if;
  end loop;

  new.account_id := _candidate;
  return new;
end;
$$;

create trigger profiles_generate_account_id
  before insert on public.profiles
  for each row execute function public.generate_profile_account_id();

-- Resolves an arbitrary identifier (account_id, email, or phone) to the
-- matching profile's UUID, for the transfer RPCs below. Gated to hierarchy
-- tiers (ultra_admin/super_agent/agent) since it's directly client-callable
-- and, unlike the tier-scoped RLS on profiles, deliberately searches every
-- account regardless of the caller's downline - a plain player has no
-- legitimate reason to probe UIDs/emails/phones for other accounts.
create function public.resolve_account_id(p_identifier text)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _cleaned text := trim(p_identifier);
  _user_id uuid;
begin
  if not (public.is_ultra_admin(auth.uid()) or public.is_super_agent(auth.uid()) or public.is_agent_tier(auth.uid())) then
    raise exception 'Unauthorized: hierarchy tier privileges required';
  end if;

  if _cleaned is null or _cleaned = '' then
    raise exception 'Identifier must not be empty';
  end if;

  select id into _user_id from public.profiles where account_id = upper(_cleaned);
  if _user_id is not null then return _user_id; end if;

  select id into _user_id from public.profiles where email = lower(_cleaned);
  if _user_id is not null then return _user_id; end if;

  -- profiles.phone is stored exactly as the user typed it (profile.tsx does
  -- no normalization on save), so both sides must be cleaned the same way
  -- here - comparing the raw stored value against a cleaned input would
  -- only ever match if the user re-typed the identical formatting.
  select id into _user_id from public.profiles
  where phone is not null and phone <> ''
    and regexp_replace(phone, '[^0-9+]', '', 'g') = regexp_replace(_cleaned, '[^0-9+]', '', 'g');
  if _user_id is not null then return _user_id; end if;

  raise exception 'No account found matching "%"', p_identifier;
end;
$$;

revoke execute on function public.resolve_account_id(text) from public;
grant execute on function public.resolve_account_id(text) to authenticated;

-- resolve_account_id only returns a UUID (matching the spec exactly, since
-- the transfer RPCs below only need the id) - this is the client-facing
-- counterpart for the modals' "resolving... target user's username/role"
-- preview, which needs to work for ANY account the caller identifies, not
-- just ones already visible to them under the hierarchy RLS policies.
create function public.preview_account(p_identifier text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _user_id uuid := public.resolve_account_id(p_identifier);
  _username text;
  _role text;
begin
  select username into _username from public.profiles where id = _user_id;

  select role into _role from public.user_roles
  where user_id = _user_id and role in ('ultra_admin', 'super_agent', 'agent', 'player')
  limit 1;

  return jsonb_build_object(
    'user_id', _user_id,
    'username', _username,
    'role', coalesce(_role, 'player')
  );
end;
$$;

revoke execute on function public.preview_account(text) from public;
grant execute on function public.preview_account(text) to authenticated;
