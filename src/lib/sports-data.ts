// Supabase-backed sportsbook data (Phase 3). Replaces the hardcoded arrays
// that used to live in betting-data.ts with live queries against the
// normalized schema from Phase 2 (supabase/migrations/*_sports_data_schema.sql).
//
// Returns data shaped exactly like the old mock Event/Sport types so the
// existing UI components (EventCard, OddsButton, SportPill, ...) don't need
// to change. Odds are converted decimal -> American here, at the query
// boundary, since the rest of the frontend (betting-store.tsx, format.ts)
// still assumes American format.

import { supabase } from "./supabase";
import type { Event, EventStatus, Market, MarketType, Selection, Sport } from "./betting-data";
import { decimalToAmerican } from "./format";

const STATUS_MAP: Record<string, EventStatus> = {
  scheduled: "upcoming",
  live: "live",
  halftime: "live",
  suspended: "live",
  finished: "finished",
  postponed: "finished",
  cancelled: "finished",
  abandoned: "finished",
};

const MARKET_ORDER: Record<string, number> = { moneyline: 0, spread: 1, total: 2 };

function formatLine(line: number, marketType: string): string {
  if (marketType === "spread") return line > 0 ? `+${line}` : `${line}`;
  return `${line}`;
}

interface SelectionRow {
  id: string;
  name: string;
  decimal_odds: number;
  line: number | null;
  display_order: number | null;
}

interface MarketRow {
  id: string;
  market_type: string;
  label: string;
  selections: SelectionRow[];
}

interface EventRow {
  id: string;
  name: string;
  scheduled_start: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  sports: { code: string } | null;
  competitions: { name: string } | null;
  event_participants: { side: string; participants: { name: string } | null }[];
  markets: MarketRow[];
}

// sport_id is NOT NULL on events, so the inner join never drops rows -
// it's only here so `.eq("sports.code", ...)` can filter on it.
const EVENT_SELECT = `
  id,
  name,
  scheduled_start,
  status,
  home_score,
  away_score,
  sports!inner ( code ),
  competitions ( name ),
  event_participants ( side, participants ( name ) ),
  markets ( id, market_type, label, selections ( id, name, decimal_odds, line, display_order ) )
`;

function mapEvent(row: EventRow): Event {
  const home = row.event_participants.find((p) => p.side === "home")?.participants?.name ?? "Home";
  const away = row.event_participants.find((p) => p.side === "away")?.participants?.name ?? "Away";

  const markets: Market[] = [...row.markets]
    .sort((a, b) => (MARKET_ORDER[a.market_type] ?? 99) - (MARKET_ORDER[b.market_type] ?? 99))
    .map((m) => ({
      type: (m.market_type as MarketType) ?? "moneyline",
      label: m.label,
      selections: [...m.selections]
        .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
        .map((s): Selection => {
          const selection: Selection = {
            id: s.id,
            label: s.name,
            odds: decimalToAmerican(s.decimal_odds),
          };
          if (s.line !== null) selection.value = formatLine(s.line, m.market_type);
          return selection;
        }),
    }));

  const event: Event = {
    id: row.id,
    sportId: row.sports?.code ?? "",
    league: row.competitions?.name ?? "",
    status: STATUS_MAP[row.status] ?? "upcoming",
    startTime: row.scheduled_start,
    homeTeam: home,
    awayTeam: away,
    markets,
  };
  if (row.home_score !== null) event.homeScore = row.home_score;
  if (row.away_score !== null) event.awayScore = row.away_score;
  return event;
}

// Round-robins events across competitions (earliest game from each
// competition first, then the next-earliest from each, ...) instead of a
// flat chronological sort. A single competition can otherwise flood a
// mixed "all sports" list - e.g. an ATP Challenger event runs dozens of
// same-day morning matches, which sorts ahead of every evening football
// fixture for the rest of the week and buries them past the fold.
function interleaveByCompetition(events: Event[]): Event[] {
  const byCompetition = new Map<string, Event[]>();
  for (const event of events) {
    const group = byCompetition.get(event.league);
    if (group) group.push(event);
    else byCompetition.set(event.league, [event]);
  }
  const groups = [...byCompetition.values()];
  const out: Event[] = [];
  for (let i = 0; out.length < events.length; i++) {
    for (const group of groups) {
      if (i < group.length) out.push(group[i]!);
    }
  }
  return out;
}

async function queryEvents(
  opts: {
    sportCode?: string;
    competitionName?: string;
    statuses?: string[];
    limit?: number;
    balanced?: boolean;
  } = {},
): Promise<Event[]> {
  let query = supabase
    .from("events")
    .select(EVENT_SELECT)
    .order("scheduled_start", { ascending: true });

  if (opts.sportCode) query = query.eq("sports.code", opts.sportCode);
  if (opts.competitionName) query = query.eq("competitions.name", opts.competitionName);
  if (opts.statuses) query = query.in("status", opts.statuses);
  // Balanced queries interleave after fetching, so the DB-side limit would
  // cut the pool before balancing could help - only cap unbalanced queries.
  if (opts.limit && !opts.balanced) query = query.limit(opts.limit);

  const { data, error } = await query;
  if (error) throw error;
  const events = ((data ?? []) as unknown as EventRow[]).map(mapEvent);
  if (!opts.balanced) return events;
  const interleaved = interleaveByCompetition(events);
  return opts.limit ? interleaved.slice(0, opts.limit) : interleaved;
}

export async function getSports(): Promise<Sport[]> {
  const { data, error } = await supabase
    .from("sports")
    .select("code, name, icon")
    .order("display_order");
  if (error) throw error;
  return (data ?? []).map((s) => ({ id: s.code, name: s.name, icon: s.icon ?? "🏆" }));
}

export async function getSportByCode(code: string): Promise<Sport | undefined> {
  const { data, error } = await supabase
    .from("sports")
    .select("code, name, icon")
    .eq("code", code)
    .maybeSingle();
  if (error) throw error;
  return data ? { id: data.code, name: data.name, icon: data.icon ?? "🏆" } : undefined;
}

export function getAllEvents(limit = 50): Promise<Event[]> {
  return queryEvents({ limit, balanced: true });
}

export function getFeaturedEvents(limit = 4): Promise<Event[]> {
  return queryEvents({ limit, balanced: true });
}

export function getEventsBySport(sportCode: string): Promise<Event[]> {
  return queryEvents({ sportCode });
}

export function getEventsByCompetition(
  sportCode: string,
  competitionName: string,
): Promise<Event[]> {
  return queryEvents({ sportCode, competitionName });
}

export function getLiveEvents(): Promise<Event[]> {
  return queryEvents({ statuses: ["live", "halftime", "suspended"] });
}

export function getUpcomingEvents(limit?: number): Promise<Event[]> {
  const opts: { statuses: string[]; limit?: number; balanced: boolean } = {
    statuses: ["scheduled"],
    balanced: true,
  };
  if (limit) opts.limit = limit;
  return queryEvents(opts);
}

export async function getEventById(id: string): Promise<Event | undefined> {
  const { data, error } = await supabase
    .from("events")
    .select(EVENT_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapEvent(data as unknown as EventRow) : undefined;
}

// Live price check for selections sitting in a user's bet slip. A slip can be
// open for a long time; odds move and markets suspend, so the slip re-reads
// the authoritative price before the user commits money to it.
export interface LiveSelectionPrice {
  id: string;
  odds: number; // American, matching the rest of the UI
  available: boolean;
}

export async function getSelectionPrices(ids: string[]): Promise<LiveSelectionPrice[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("selections")
    .select("id, decimal_odds, status, markets ( status, events ( status ) )")
    .in("id", ids);
  if (error) throw error;
  return (data ?? []).map((row) => {
    const r = row as unknown as {
      id: string;
      decimal_odds: number;
      status: string;
      markets: { status: string; events: { status: string } | null } | null;
    };
    const eventStatus = r.markets?.events?.status ?? "scheduled";
    return {
      id: r.id,
      odds: decimalToAmerican(r.decimal_odds),
      available:
        r.status === "open" &&
        (r.markets?.status ?? "open") === "open" &&
        !["finished", "postponed", "cancelled", "abandoned"].includes(eventStatus),
    };
  });
}
