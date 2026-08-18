export interface AdminPlayer {
  id: string;
  username: string;
  email: string;
  status: "active" | "restricted" | "review";
  credits: number;
  sportsNet: number;
  casinoNet: number;
  betsPlaced: number;
  lastActive: string;
  country: string;
}

export interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  target: string;
  detail: string;
  at: string;
}

export interface ExposureRow {
  event: string;
  league: string;
  liability: number;
  stakeVolume: number;
  margin: number;
}

export const ADMIN_PLAYERS: AdminPlayer[] = [
  {
    id: "p-1041",
    username: "quietrunner",
    email: "j.mercer@mailbox.io",
    status: "active",
    credits: 4820,
    sportsNet: 615,
    casinoNet: -240,
    betsPlaced: 187,
    lastActive: "4 min ago",
    country: "UK",
  },
  {
    id: "p-1042",
    username: "halftime_hal",
    email: "hal.rios@mailbox.io",
    status: "review",
    credits: 12750,
    sportsNet: 3410,
    casinoNet: 1180,
    betsPlaced: 964,
    lastActive: "12 min ago",
    country: "CA",
  },
  {
    id: "p-1043",
    username: "moneyline_mo",
    email: "m.oduya@mailbox.io",
    status: "active",
    credits: 310,
    sportsNet: -890,
    casinoNet: -120,
    betsPlaced: 402,
    lastActive: "1 h ago",
    country: "NG",
  },
  {
    id: "p-1044",
    username: "parlay_pia",
    email: "pia.k@mailbox.io",
    status: "active",
    credits: 2065,
    sportsNet: 122,
    casinoNet: 640,
    betsPlaced: 233,
    lastActive: "3 h ago",
    country: "DE",
  },
  {
    id: "p-1045",
    username: "chalkonly",
    email: "d.ferreira@mailbox.io",
    status: "restricted",
    credits: 0,
    sportsNet: -2400,
    casinoNet: -95,
    betsPlaced: 1288,
    lastActive: "2 d ago",
    country: "BR",
  },
  {
    id: "p-1046",
    username: "late_line",
    email: "s.tanaka@mailbox.io",
    status: "active",
    credits: 7440,
    sportsNet: 1930,
    casinoNet: -510,
    betsPlaced: 71,
    lastActive: "6 h ago",
    country: "JP",
  },
];

export const AUDIT_LOG: AuditEntry[] = [
  {
    id: "a-9",
    actor: "admin@betrix",
    action: "credit_adjustment",
    target: "p-1042",
    detail: "+2,500 simulation credits — support goodwill",
    at: "Today 09:41",
  },
  {
    id: "a-8",
    actor: "system",
    action: "settlement_run",
    target: "NFL / Bills vs Dolphins",
    detail: "412 bets settled, 0 duplicates",
    at: "Today 08:55",
  },
  {
    id: "a-7",
    actor: "risk@betrix",
    action: "market_suspended",
    target: "NBA / Nuggets vs Suns — Total",
    detail: "Line move > 6 pts in 90 s",
    at: "Today 08:12",
  },
  {
    id: "a-6",
    actor: "admin@betrix",
    action: "player_restricted",
    target: "p-1045",
    detail: "Self-exclusion request honoured",
    at: "Yesterday 22:03",
  },
  {
    id: "a-5",
    actor: "system",
    action: "provider_failover",
    target: "Feed: primary → secondary",
    detail: "Primary latency 4.2 s for 60 s",
    at: "Yesterday 19:47",
  },
];

export const EXPOSURE: ExposureRow[] = [
  { event: "Chiefs vs 49ers", league: "NFL", liability: 48200, stakeVolume: 96400, margin: 4.6 },
  { event: "Celtics vs Lakers", league: "NBA", liability: 31150, stakeVolume: 71800, margin: 5.1 },
  {
    event: "Alcaraz vs Djokovic",
    league: "Wimbledon",
    liability: 22600,
    stakeVolume: 40300,
    margin: 3.8,
  },
  { event: "Cloud9 vs T1", league: "LCS", liability: 9400, stakeVolume: 18900, margin: 6.2 },
];

export const PLATFORM_METRICS = {
  activePlayers: 1284,
  betsToday: 18422,
  stakeVolume: 942310,
  houseMargin: 4.9,
  casinoRounds: 64891,
  casinoRtp: 96.4,
  openLiability: 111350,
  feedLatencyMs: 340,
};

export const TRAFFIC_SERIES = [
  { hour: "00", bets: 210 },
  { hour: "03", bets: 140 },
  { hour: "06", bets: 260 },
  { hour: "09", bets: 620 },
  { hour: "12", bets: 980 },
  { hour: "15", bets: 1240 },
  { hour: "18", bets: 1810 },
  { hour: "21", bets: 1490 },
];
