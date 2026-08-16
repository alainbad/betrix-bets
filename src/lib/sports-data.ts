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

function decimalToAmerican(decimalOdds: number): number {
  if (decimalOdds >= 2) return Math.round((decimalOdds - 1) * 100);
  return Math.round(-100 / (decimalOdds - 1));
}

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

async function queryEvents(opts: { sportCode?: string; statuses?: string[]; limit?: number } = {}): Promise<Event[]> {
  let query = supabase
    .from("events")
    .select(EVENT_SELECT)
    .order("scheduled_start", { ascending: true });

  if (opts.sportCode) query = query.eq("sports.code", opts.sportCode);
  if (opts.statuses) query = query.in("status", opts.statuses);
  if (opts.limit) query = query.limit(opts.limit);

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown as EventRow[]).map(mapEvent);
}

export async function getSports(): Promise<Sport[]> {
  const { data, error } = await supabase.from("sports").select("code, name, icon").order("display_order");
  if (error) throw error;
  return (data ?? []).map((s) => ({ id: s.code, name: s.name, icon: s.icon ?? "🏆" }));
}

export async function getSportByCode(code: string): Promise<Sport | undefined> {
  const { data, error } = await supabase.from("sports").select("code, name, icon").eq("code", code).maybeSingle();
  if (error) throw error;
  return data ? { id: data.code, name: data.name, icon: data.icon ?? "🏆" } : undefined;
}

export function getAllEvents(limit = 50): Promise<Event[]> {
  return queryEvents({ limit });
}

export function getFeaturedEvents(limit = 4): Promise<Event[]> {
  return queryEvents({ limit });
}

export function getEventsBySport(sportCode: string): Promise<Event[]> {
  return queryEvents({ sportCode });
}

export function getLiveEvents(): Promise<Event[]> {
  return queryEvents({ statuses: ["live", "halftime", "suspended"] });
}

export function getUpcomingEvents(limit?: number): Promise<Event[]> {
  const opts: { statuses: string[]; limit?: number } = { statuses: ["scheduled"] };
  if (limit) opts.limit = limit;
  return queryEvents(opts);
}

export async function getEventById(id: string): Promise<Event | undefined> {
  const { data, error } = await supabase.from("events").select(EVENT_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapEvent(data as unknown as EventRow) : undefined;
}
