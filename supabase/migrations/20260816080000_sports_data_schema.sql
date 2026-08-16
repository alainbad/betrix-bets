-- Phase 2 (Sports Data): normalized sports/events/markets schema + provider mapping.
-- Spec refs: MASTER PROJECT SPECIFICATION sections 5-11, 16-17, 82.
--
-- Design note: the spec lists `participants` and `teams` as separate tables, and
-- `provider_sports`/`provider_competitions`/`provider_events`/`provider_markets`
-- as four parallel mapping tables. Both pairs are structurally identical, so this
-- migration collapses them: one `participants` table (kind = team | individual,
-- so it covers both team sports and tennis/individual sports) and one generic
-- `provider_mappings` table (entity_type + internal_id + provider_ref) instead of
-- four near-duplicate mapping tables. Same guarantee either way: the frontend and
-- betting engine only ever see internal uuids, never a provider's own id.

-- ============================================================
-- PROVIDERS
-- ============================================================

create table public.providers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.provider_mappings (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers (id) on delete cascade,
  entity_type text not null check (entity_type in ('sport', 'competition', 'participant', 'event', 'market', 'selection')),
  internal_id uuid not null,
  provider_ref text not null,
  created_at timestamptz not null default now(),
  unique (provider_id, entity_type, provider_ref)
);

create index provider_mappings_lookup_idx on public.provider_mappings (provider_id, entity_type, internal_id);

-- ============================================================
-- SPORTS HIERARCHY: sport -> country -> competition -> season
-- ============================================================

create table public.sports (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  icon text,
  display_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.countries (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null
);

create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  sport_id uuid not null references public.sports (id) on delete cascade,
  country_id uuid references public.countries (id),
  name text not null,
  slug text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sport_id, slug)
);

create index competitions_sport_id_idx on public.competitions (sport_id);

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions (id) on delete cascade,
  name text not null,
  start_date date,
  end_date date,
  is_current boolean not null default true
);

create index seasons_competition_id_idx on public.seasons (competition_id);

-- ============================================================
-- PARTICIPANTS (teams or individual athletes)
-- ============================================================

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  sport_id uuid not null references public.sports (id) on delete cascade,
  kind text not null default 'team' check (kind in ('team', 'individual')),
  name text not null,
  short_name text,
  country_id uuid references public.countries (id),
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sport_id, name)
);

-- ============================================================
-- EVENTS
-- ============================================================

create table public.events (
  id uuid primary key default gen_random_uuid(),
  sport_id uuid not null references public.sports (id) on delete cascade,
  competition_id uuid not null references public.competitions (id) on delete cascade,
  season_id uuid references public.seasons (id),
  name text not null,
  scheduled_start timestamptz not null,
  actual_start timestamptz,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'live', 'halftime', 'suspended', 'finished', 'postponed', 'cancelled', 'abandoned')),
  home_score int,
  away_score int,
  current_period text,
  match_clock text,
  venue text,
  metadata jsonb not null default '{}'::jsonb,
  provider_updated_at timestamptz,
  ingested_at timestamptz not null default now(),
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index events_scheduled_start_idx on public.events (scheduled_start);
create index events_sport_id_idx on public.events (sport_id);
create index events_competition_id_idx on public.events (competition_id);
create index events_status_idx on public.events (status);

create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

create table public.event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  participant_id uuid not null references public.participants (id),
  side text not null check (side in ('home', 'away')),
  unique (event_id, side)
);

create index event_participants_event_id_idx on public.event_participants (event_id);

-- ============================================================
-- MARKETS + SELECTIONS
-- ============================================================

create table public.markets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  market_type text not null,
  label text not null,
  status text not null default 'open' check (status in ('open', 'suspended', 'closed', 'settled')),
  display_order int not null default 0,
  provider_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index markets_event_id_idx on public.markets (event_id);
create index markets_status_idx on public.markets (status);

create trigger markets_set_updated_at
  before update on public.markets
  for each row execute function public.set_updated_at();

-- Canonical odds storage is always DECIMAL (spec section 16); the frontend
-- converts to American/fractional for display.
create table public.selections (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets (id) on delete cascade,
  name text not null,
  decimal_odds numeric(8, 3) not null check (decimal_odds > 1),
  line numeric,
  status text not null default 'open' check (status in ('open', 'suspended', 'closed', 'settled')),
  result text not null default 'pending' check (result in ('pending', 'won', 'lost', 'void')),
  display_order int not null default 0,
  provider_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index selections_market_id_idx on public.selections (market_id);
create index selections_status_idx on public.selections (status);

create trigger selections_set_updated_at
  before update on public.selections
  for each row execute function public.set_updated_at();

create table public.odds_history (
  id uuid primary key default gen_random_uuid(),
  selection_id uuid not null references public.selections (id) on delete cascade,
  old_odds numeric(8, 3),
  new_odds numeric(8, 3) not null,
  provider_timestamp timestamptz,
  received_at timestamptz not null default now()
);

create index odds_history_selection_id_idx on public.odds_history (selection_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.sports enable row level security;
alter table public.countries enable row level security;
alter table public.competitions enable row level security;
alter table public.seasons enable row level security;
alter table public.participants enable row level security;
alter table public.events enable row level security;
alter table public.event_participants enable row level security;
alter table public.markets enable row level security;
alter table public.selections enable row level security;
alter table public.odds_history enable row level security;
alter table public.providers enable row level security;
alter table public.provider_mappings enable row level security;

-- Fixture/odds data is public sportsbook content — readable by anyone, signed in
-- or not, same as a real sportsbook home page. No insert/update/delete policy
-- exists for any of these tables: only the service-role ingestion job (which
-- bypasses RLS entirely) writes to them, never the browser.
create policy "sports are public" on public.sports for select using (true);
create policy "countries are public" on public.countries for select using (true);
create policy "competitions are public" on public.competitions for select using (true);
create policy "seasons are public" on public.seasons for select using (true);
create policy "participants are public" on public.participants for select using (true);
create policy "events are public" on public.events for select using (true);
create policy "event_participants are public" on public.event_participants for select using (true);
create policy "markets are public" on public.markets for select using (true);
create policy "selections are public" on public.selections for select using (true);
create policy "odds_history are public" on public.odds_history for select using (true);

-- providers / provider_mappings intentionally have NO select policy for
-- anon/authenticated — nothing provider-specific should ever be readable from
-- the browser (spec section 7). Only the service role can see these.
