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
  { id: "football", name: "Football", icon: "⚽" },
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

function threeWay(homeOdds: number, drawOdds: number, awayOdds: number): Market {
  return {
    type: "moneyline",
    label: "Match result",
    selections: [
      { id: "home", label: "Home", odds: homeOdds },
      { id: "draw", label: "Draw", odds: drawOdds },
      { id: "away", label: "Away", odds: awayOdds },
    ],
  };
}


export const EVENTS: Event[] = [
  {
    id: "epl-1",
    sportId: "football",
    league: "Premier League",
    status: "upcoming",
    startTime: "2026-08-17T14:00:00.000Z",
    homeTeam: "Arsenal",
    awayTeam: "Manchester City",
    markets: [threeWay(155, 240, 180), spread(-0.5, -110, -110), total(2.5, -125, 105)],
  },
  {
    id: "epl-2",
    sportId: "football",
    league: "Premier League",
    status: "live",
    startTime: "2026-08-17T02:21:40.000Z",
    homeTeam: "Liverpool",
    awayTeam: "Chelsea",
    homeScore: 2,
    awayScore: 1,
    markets: [threeWay(-115, 320, 290), spread(-1, 135, -165), total(3.5, 120, -145)],
  },
  {
    id: "laliga-1",
    sportId: "football",
    league: "LaLiga",
    status: "upcoming",
    startTime: "2026-08-17T19:00:00.000Z",
    homeTeam: "Real Madrid",
    awayTeam: "Sevilla",
    markets: [threeWay(-190, 330, 480), spread(-1.5, 110, -135), total(2.5, -140, 115)],
  },
  {
    id: "ucl-1",
    sportId: "football",
    league: "Champions League",
    status: "upcoming",
    startTime: "2026-08-18T19:00:00.000Z",
    homeTeam: "Bayern Munich",
    awayTeam: "Inter Milan",
    markets: [threeWay(-135, 270, 340), spread(-0.5, -105, -115), total(2.5, -130, 110)],
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
