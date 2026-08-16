export type SportId = "football" | "basketball" | "tennis" | "esports" | "baseball";

export interface Sport {
  id: SportId;
  name: string;
  icon: string;
}

export type MarketType = "moneyline" | "spread" | "total";

export interface Market {
  type: MarketType;
  label: string;
  selections: Selection[];
}

export interface Selection {
  id: string;
  label: string;
  value?: string;
  odds: number;
}

export type EventStatus = "upcoming" | "live" | "finished";

export interface Event {
  id: string;
  sportId: SportId;
  league: string;
  status: EventStatus;
  startTime: string;
  homeTeam: string;
  awayTeam: string;
  homeScore?: number;
  awayScore?: number;
  markets: Market[];
}

export const SPORTS: Sport[] = [
  { id: "football", name: "Football", icon: "🏈" },
  { id: "basketball", name: "Basketball", icon: "🏀" },
  { id: "tennis", name: "Tennis", icon: "🎾" },
  { id: "esports", name: "Esports", icon: "🎮" },
  { id: "baseball", name: "Baseball", icon: "⚾" },
];

function moneyline(homeOdds: number, awayOdds: number): Market {
  return {
    type: "moneyline",
    label: "Moneyline",
    selections: [
      { id: "home", label: "Home", odds: homeOdds },
      { id: "away", label: "Away", odds: awayOdds },
    ],
  };
}

function spread(handicap: number, homeOdds: number, awayOdds: number): Market {
  return {
    type: "spread",
    label: "Spread",
    selections: [
      { id: "home", label: "Home", value: `${handicap > 0 ? `+${handicap}` : handicap}`, odds: homeOdds },
      { id: "away", label: "Away", value: `${-handicap > 0 ? `+${-handicap}` : -handicap}`, odds: awayOdds },
    ],
  };
}

function total(line: number, overOdds: number, underOdds: number): Market {
  return {
    type: "total",
    label: "Total",
    selections: [
      { id: "over", label: "Over", value: `${line}`, odds: overOdds },
      { id: "under", label: "Under", value: `${line}`, odds: underOdds },
    ],
  };
}

export const EVENTS: Event[] = [
  {
    id: "nfl-1",
    sportId: "football",
    league: "NFL",
    status: "upcoming",
    startTime: "2026-08-17T21:06:40.000Z",
    homeTeam: "Kansas City Chiefs",
    awayTeam: "San Francisco 49ers",
    markets: [moneyline(-145, 125), spread(-2.5, -110, -110), total(47.5, -110, -110)],
  },
  {
    id: "nfl-2",
    sportId: "football",
    league: "NFL",
    status: "live",
    startTime: "2026-08-17T02:21:40.000Z",
    homeTeam: "Buffalo Bills",
    awayTeam: "Miami Dolphins",
    homeScore: 14,
    awayScore: 10,
    markets: [moneyline(-185, 155), spread(-3.5, -110, -110), total(44.5, -105, -115)],
  },
  {
    id: "nba-1",
    sportId: "basketball",
    league: "NBA",
    status: "upcoming",
    startTime: "2026-08-17T08:06:40.000Z",
    homeTeam: "Boston Celtics",
    awayTeam: "Los Angeles Lakers",
    markets: [moneyline(-130, 110), spread(-2.5, -110, -110), total(225.5, -110, -110)],
  },
  {
    id: "nba-2",
    sportId: "basketball",
    league: "NBA",
    status: "live",
    startTime: "2026-08-17T01:36:40.000Z",
    homeTeam: "Denver Nuggets",
    awayTeam: "Phoenix Suns",
    homeScore: 78,
    awayScore: 82,
    markets: [moneyline(115, -135), spread(2.5, -110, -110), total(218.5, -110, -110)],
  },
  {
    id: "ten-1",
    sportId: "tennis",
    league: "Wimbledon",
    status: "upcoming",
    startTime: "2026-08-18T05:06:40.000Z",
    homeTeam: "Carlos Alcaraz",
    awayTeam: "Novak Djokovic",
    markets: [moneyline(-110, -110), spread(-1.5, 120, -150), total(35.5, -110, -110)],
  },
  {
    id: "esports-1",
    sportId: "esports",
    league: "LCS",
    status: "upcoming",
    startTime: "2026-08-17T06:06:40.000Z",
    homeTeam: "Cloud9",
    awayTeam: "T1",
    markets: [moneyline(-140, 115), spread(-1.5, -115, -105), total(2.5, 130, -160)],
  },
  {
    id: "mlb-1",
    sportId: "baseball",
    league: "MLB",
    status: "upcoming",
    startTime: "2026-08-17T11:06:40.000Z",
    homeTeam: "New York Yankees",
    awayTeam: "Houston Astros",
    markets: [moneyline(-120, 100), spread(-1.5, 140, -170), total(8.5, -110, -110)],
  },
];

export function getEventById(id: string): Event | undefined {
  return EVENTS.find((e) => e.id === id);
}

export function getEventsBySport(sportId: SportId): Event[] {
  return EVENTS.filter((e) => e.sportId === sportId);
}

export function getFeaturedEvents(limit = 4): Event[] {
  return EVENTS.slice(0, limit);
}

export function getSportById(id: SportId): Sport | undefined {
  return SPORTS.find((s) => s.id === id);
}
