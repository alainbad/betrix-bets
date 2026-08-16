import type {
  ProviderCompetition,
  ProviderCountry,
  ProviderFixture,
  ProviderMarket,
  ProviderSport,
  SportsDataProvider,
} from "./sports-types.ts";

// Deterministic fake "now" offsets so scheduled_start stays plausible (some
// upcoming, one live-in-progress per sport) no matter when sync runs.
const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

function moneyline(id: string, homeOdds: number, awayOdds: number): ProviderMarket {
  return {
    id: `${id}-ml`,
    type: "moneyline",
    label: "Moneyline",
    selections: [
      { id: "home", name: "Home", decimalOdds: homeOdds },
      { id: "away", name: "Away", decimalOdds: awayOdds },
    ],
  };
}

function threeWay(id: string, homeOdds: number, drawOdds: number, awayOdds: number): ProviderMarket {
  return {
    id: `${id}-3way`,
    type: "moneyline",
    label: "Match result",
    selections: [
      { id: "home", name: "Home", decimalOdds: homeOdds },
      { id: "draw", name: "Draw", decimalOdds: drawOdds },
      { id: "away", name: "Away", decimalOdds: awayOdds },
    ],
  };
}

function spread(id: string, line: number, homeOdds: number, awayOdds: number): ProviderMarket {
  return {
    id: `${id}-spread`,
    type: "spread",
    label: "Spread",
    selections: [
      { id: "home", name: "Home", decimalOdds: homeOdds, line },
      { id: "away", name: "Away", decimalOdds: awayOdds, line: -line },
    ],
  };
}

function total(id: string, line: number, overOdds: number, underOdds: number): ProviderMarket {
  return {
    id: `${id}-total`,
    type: "total",
    label: "Total",
    selections: [
      { id: "over", name: "Over", decimalOdds: overOdds, line },
      { id: "under", name: "Under", decimalOdds: underOdds, line },
    ],
  };
}

const COMPETITIONS: ProviderCompetition[] = [
  { id: "epl", sportCode: "football", countryCode: "england", name: "Premier League", slug: "premier-league" },
  { id: "laliga", sportCode: "football", countryCode: "spain", name: "LaLiga", slug: "laliga" },
  { id: "serie-a", sportCode: "football", countryCode: "italy", name: "Serie A", slug: "serie-a" },
  { id: "ucl", sportCode: "football", countryCode: "international", name: "Champions League", slug: "champions-league" },
  { id: "nba", sportCode: "basketball", countryCode: "usa", name: "NBA", slug: "nba" },
  { id: "euroleague", sportCode: "basketball", countryCode: "international", name: "EuroLeague", slug: "euroleague" },
  { id: "atp", sportCode: "tennis", countryCode: "international", name: "ATP Tour", slug: "atp" },
  { id: "wta", sportCode: "tennis", countryCode: "international", name: "WTA Tour", slug: "wta" },
];

const FIXTURES: Record<string, ProviderFixture[]> = {
  epl: [
    {
      id: "epl-1",
      competitionId: "epl",
      name: "Arsenal vs Manchester City",
      scheduledStart: hoursFromNow(22),
      status: "scheduled",
      homeParticipant: { id: "arsenal", name: "Arsenal", kind: "team", countryCode: "england" },
      awayParticipant: { id: "man-city", name: "Manchester City", kind: "team", countryCode: "england" },
      markets: [threeWay("epl-1", 2.55, 3.4, 2.8), spread("epl-1", -0.5, 1.91, 1.91), total("epl-1", 2.5, 1.8, 2.05)],
    },
    {
      id: "epl-2",
      competitionId: "epl",
      name: "Liverpool vs Chelsea",
      scheduledStart: hoursFromNow(-1),
      status: "live",
      homeParticipant: { id: "liverpool", name: "Liverpool", kind: "team", countryCode: "england" },
      awayParticipant: { id: "chelsea", name: "Chelsea", kind: "team", countryCode: "england" },
      homeScore: 2,
      awayScore: 1,
      currentPeriod: "2nd half",
      matchClock: "67'",
      markets: [threeWay("epl-2", 1.87, 4.2, 3.9), spread("epl-2", -1, 2.35, 1.65), total("epl-2", 3.5, 2.2, 1.65)],
    },
  ],
  laliga: [
    {
      id: "laliga-1",
      competitionId: "laliga",
      name: "Real Madrid vs Sevilla",
      scheduledStart: hoursFromNow(27),
      status: "scheduled",
      homeParticipant: { id: "real-madrid", name: "Real Madrid", kind: "team", countryCode: "spain" },
      awayParticipant: { id: "sevilla", name: "Sevilla", kind: "team", countryCode: "spain" },
      markets: [threeWay("laliga-1", 1.53, 4.3, 5.8), spread("laliga-1", -1.5, 2.1, 1.72), total("laliga-1", 2.5, 1.72, 2.1)],
    },
  ],
  "serie-a": [
    {
      id: "seriea-1",
      competitionId: "serie-a",
      name: "Inter Milan vs Juventus",
      scheduledStart: hoursFromNow(31),
      status: "scheduled",
      homeParticipant: { id: "inter", name: "Inter Milan", kind: "team", countryCode: "italy" },
      awayParticipant: { id: "juventus", name: "Juventus", kind: "team", countryCode: "italy" },
      markets: [threeWay("seriea-1", 2.1, 3.3, 3.5), total("seriea-1", 2.5, 1.95, 1.87)],
    },
  ],
  ucl: [
    {
      id: "ucl-1",
      competitionId: "ucl",
      name: "Bayern Munich vs Inter Milan",
      scheduledStart: hoursFromNow(48),
      status: "scheduled",
      homeParticipant: { id: "bayern", name: "Bayern Munich", kind: "team", countryCode: "germany" },
      awayParticipant: { id: "inter", name: "Inter Milan", kind: "team", countryCode: "italy" },
      markets: [threeWay("ucl-1", 1.74, 3.9, 4.6), spread("ucl-1", -0.5, 1.91, 1.91), total("ucl-1", 2.5, 1.77, 2.0)],
    },
  ],
  nba: [
    {
      id: "nba-1",
      competitionId: "nba",
      name: "Boston Celtics vs Los Angeles Lakers",
      scheduledStart: hoursFromNow(20),
      status: "scheduled",
      homeParticipant: { id: "celtics", name: "Boston Celtics", kind: "team", countryCode: "usa" },
      awayParticipant: { id: "lakers", name: "Los Angeles Lakers", kind: "team", countryCode: "usa" },
      markets: [moneyline("nba-1", 1.77, 2.05), spread("nba-1", -2.5, 1.91, 1.91), total("nba-1", 225.5, 1.91, 1.91)],
    },
    {
      id: "nba-2",
      competitionId: "nba",
      name: "Denver Nuggets vs Phoenix Suns",
      scheduledStart: hoursFromNow(-0.5),
      status: "live",
      homeParticipant: { id: "nuggets", name: "Denver Nuggets", kind: "team", countryCode: "usa" },
      awayParticipant: { id: "suns", name: "Phoenix Suns", kind: "team", countryCode: "usa" },
      homeScore: 78,
      awayScore: 82,
      currentPeriod: "Q4",
      matchClock: "6:42",
      markets: [moneyline("nba-2", 2.15, 1.74), spread("nba-2", 2.5, 1.91, 1.91), total("nba-2", 218.5, 1.91, 1.91)],
    },
  ],
  euroleague: [
    {
      id: "euroleague-1",
      competitionId: "euroleague",
      name: "Real Madrid Baloncesto vs Fenerbahce",
      scheduledStart: hoursFromNow(26),
      status: "scheduled",
      homeParticipant: { id: "rm-basket", name: "Real Madrid Baloncesto", kind: "team", countryCode: "spain" },
      awayParticipant: { id: "fenerbahce", name: "Fenerbahce", kind: "team", countryCode: "turkey" },
      markets: [moneyline("euroleague-1", 1.65, 2.25), total("euroleague-1", 161.5, 1.91, 1.91)],
    },
  ],
  atp: [
    {
      id: "atp-1",
      competitionId: "atp",
      name: "Carlos Alcaraz vs Novak Djokovic",
      scheduledStart: hoursFromNow(29),
      status: "scheduled",
      homeParticipant: { id: "alcaraz", name: "Carlos Alcaraz", kind: "individual", countryCode: "spain" },
      awayParticipant: { id: "djokovic", name: "Novak Djokovic", kind: "individual", countryCode: "serbia" },
      markets: [moneyline("atp-1", 1.91, 1.91), spread("atp-1", -1.5, 2.3, 1.62), total("atp-1", 35.5, 1.91, 1.91)],
    },
  ],
  wta: [
    {
      id: "wta-1",
      competitionId: "wta",
      name: "Iga Swiatek vs Aryna Sabalenka",
      scheduledStart: hoursFromNow(24),
      status: "scheduled",
      homeParticipant: { id: "swiatek", name: "Iga Swiatek", kind: "individual", countryCode: "poland" },
      awayParticipant: { id: "sabalenka", name: "Aryna Sabalenka", kind: "individual", countryCode: "belarus" },
      markets: [moneyline("wta-1", 1.83, 1.98), total("wta-1", 21.5, 1.91, 1.91)],
    },
  ],
};

const SPORTS: ProviderSport[] = [
  { code: "football", name: "Football", icon: "⚽" },
  { code: "basketball", name: "Basketball", icon: "🏀" },
  { code: "tennis", name: "Tennis", icon: "🎾" },
];

const COUNTRIES: ProviderCountry[] = [
  { code: "england", name: "England" },
  { code: "spain", name: "Spain" },
  { code: "italy", name: "Italy" },
  { code: "germany", name: "Germany" },
  { code: "usa", name: "USA" },
  { code: "turkey", name: "Turkey" },
  { code: "serbia", name: "Serbia" },
  { code: "poland", name: "Poland" },
  { code: "belarus", name: "Belarus" },
  { code: "international", name: "International" },
];

export class MockSportsProvider implements SportsDataProvider {
  readonly code = "mock";

  getSports(): Promise<ProviderSport[]> {
    return Promise.resolve(SPORTS);
  }

  getCountries(): Promise<ProviderCountry[]> {
    return Promise.resolve(COUNTRIES);
  }

  getCompetitions(sportCode: string): Promise<ProviderCompetition[]> {
    return Promise.resolve(COMPETITIONS.filter((c) => c.sportCode === sportCode));
  }

  getFixtures(competitionId: string): Promise<ProviderFixture[]> {
    return Promise.resolve(FIXTURES[competitionId] ?? []);
  }

  getLiveEvents(sportCode: string): Promise<ProviderFixture[]> {
    const competitionIds = COMPETITIONS.filter((c) => c.sportCode === sportCode).map((c) => c.id);
    const live = competitionIds.flatMap((id) => (FIXTURES[id] ?? []).filter((f) => f.status === "live"));
    return Promise.resolve(live);
  }
}
