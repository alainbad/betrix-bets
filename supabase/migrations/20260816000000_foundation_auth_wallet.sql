-- Phase 1 (Foundation): roles, profiles, virtual wallet ledger, RLS.
-- Spec refs: MASTER PROJECT SPECIFICATION sections 19-24, 77.

-- ============================================================
-- ROLES
-- ============================================================

create type public.app_role as enum (
  'player',
  'support',
  'odds_manager',
  'risk_manager',
  'casino_manager',
  'content_manager',
  'administrator',
  'super_admin'
);

create table public.roles (
  role public.app_role primary key,
  description text not null
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text not null
);

create table public.role_permissions (
  role public.app_role not null references public.roles (role) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  primary key (role, permission_id)
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null references public.roles (role),
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create index user_roles_user_id_idx on public.user_roles (user_id);

-- security definer: safe to call from RLS policies without recursive RLS evaluation
create function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

create function public.is_admin(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(_user_id, 'administrator') or public.has_role(_user_id, 'super_admin')
$$;

-- ============================================================
-- PROFILES
-- ============================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  email text not null,
  first_name text,
  last_name text,
  phone text,
  country text,
  preferred_language text not null default 'en',
  preferred_odds_format text not null default 'american'
    check (preferred_odds_format in ('decimal', 'fractional', 'american')),
  preferred_display_currency text not null default 'USD',
  avatar_url text,
  status text not null default 'active'
    check (status in ('active', 'suspended', 'restricted', 'self_excluded', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz
);

create index profiles_email_idx on public.profiles (email);
create index profiles_username_idx on public.profiles (username);

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Players can update their own profile (RLS below), but must never be able to
-- self-escalate by changing their own account status (e.g. clearing a
-- 'restricted'/'self_excluded' flag). Only an admin-driven update may change it.
create function public.prevent_profile_status_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status and not public.is_admin(auth.uid()) then
    new.status := old.status;
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_status_self_escalation
  before update on public.profiles
  for each row execute function public.prevent_profile_status_self_escalation();

-- ============================================================
-- VIRTUAL WALLET
-- ============================================================

create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  available_balance numeric(14, 2) not null default 0 check (available_balance >= 0),
  reserved_balance numeric(14, 2) not null default 0 check (reserved_balance >= 0),
  lifetime_virtual_staked numeric(14, 2) not null default 0,
  lifetime_virtual_returned numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger wallets_set_updated_at
  before update on public.wallets
  for each row execute function public.set_updated_at();

create type public.wallet_transaction_type as enum (
  'simulation_credit',
  'simulation_debit',
  'wager_stake',
  'wager_return',
  'casino_stake',
  'casino_return',
  'promotional_credit',
  'admin_adjustment'
);

-- Immutable ledger: no update/delete policies are defined anywhere in this migration,
-- and inserts are only ever performed by SECURITY DEFINER functions (never directly
-- by the authenticated client role). See spec section 23-24.
create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  wallet_id uuid not null references public.wallets (id) on delete cascade,
  transaction_type public.wallet_transaction_type not null,
  amount numeric(14, 2) not null,
  balance_before numeric(14, 2) not null,
  balance_after numeric(14, 2) not null,
  reference_type text,
  reference_id uuid,
  description text,
  created_at timestamptz not null default now()
);

create index wallet_transactions_user_id_created_at_idx
  on public.wallet_transactions (user_id, created_at desc);

-- ============================================================
-- NEW USER PROVISIONING
-- Creates profile + wallet + default 'player' role + opening ledger entry
-- whenever a new auth.users row is created.
-- ============================================================

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate_username text;
  final_username text;
  suffix text;
  new_wallet_id uuid;
  opening_balance numeric(14, 2) := 1000.00;
begin
  candidate_username := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
    split_part(new.email, '@', 1)
  );
  final_username := candidate_username;

  while exists (select 1 from public.profiles where username = final_username) loop
    suffix := substr(replace(gen_random_uuid()::text, '-', ''), 1, 4);
    final_username := candidate_username || '_' || suffix;
  end loop;

  insert into public.profiles (id, username, email)
  values (new.id, final_username, new.email);

  insert into public.user_roles (user_id, role)
  values (new.id, 'player');

  insert into public.wallets (user_id, available_balance, lifetime_virtual_staked, lifetime_virtual_returned)
  values (new.id, opening_balance, 0, 0)
  returning id into new_wallet_id;

  insert into public.wallet_transactions (
    user_id, wallet_id, transaction_type, amount, balance_before, balance_after, reference_type, description
  ) values (
    new.id, new_wallet_id, 'simulation_credit', opening_balance, 0, opening_balance, 'signup_bonus',
    'Welcome simulation credits'
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;

-- Reference tables: readable by any authenticated user, writable only by future
-- SECURITY DEFINER admin functions (no client insert/update/delete policy exists).
create policy "roles readable by authenticated" on public.roles
  for select to authenticated using (true);

create policy "permissions readable by authenticated" on public.permissions
  for select to authenticated using (true);

create policy "role_permissions readable by authenticated" on public.role_permissions
  for select to authenticated using (true);

-- user_roles: a player can see their own role rows; admins can see everyone's.
-- No client-side insert/update/delete policy — role grants happen through a
-- future admin RPC (SECURITY DEFINER) so the browser can never self-elevate.
create policy "user_roles select own or admin" on public.user_roles
  for select to authenticated
  using (auth.uid() = user_id or public.is_admin(auth.uid()));

-- profiles: a player can see and edit their own profile; admins can see everyone's.
create policy "profiles select own or admin" on public.profiles
  for select to authenticated
  using (auth.uid() = id or public.is_admin(auth.uid()));

create policy "profiles update own" on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- wallets: a player can see their own balance; admins can see everyone's.
-- No client insert/update/delete policy — balances only change through
-- SECURITY DEFINER functions such as the future place_simulated_bet().
create policy "wallets select own or admin" on public.wallets
  for select to authenticated
  using (auth.uid() = user_id or public.is_admin(auth.uid()));

-- wallet_transactions: same read model, and never client-writable (immutable ledger).
create policy "wallet_transactions select own or admin" on public.wallet_transactions
  for select to authenticated
  using (auth.uid() = user_id or public.is_admin(auth.uid()));
