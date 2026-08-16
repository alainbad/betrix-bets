import lakersLogo from "@/assets/team-logos/lakers.svg.asset.json";
import celticsLogo from "@/assets/team-logos/celtics.svg.asset.json";
import nuggetsLogo from "@/assets/team-logos/nuggets.svg.asset.json";
import sunsLogo from "@/assets/team-logos/suns.svg.asset.json";

/**
 * Real club/franchise crests are served by Logo.dev from each team's official
 * domain, so we never ship hand-drawn imitations of trademarks.
 */

export const TEAM_DOMAINS: Record<string, string> = {
  // Football (soccer)
  arsenal: "arsenal.com",
  "manchester city": "mancity.com",
  liverpool: "liverpoolfc.com",
  chelsea: "chelseafc.com",
  "real madrid": "realmadrid.com",
  sevilla: "sevillafc.com",
  "bayern munich": "fcbayern.de",
  "inter milan": "inter.it",
  barcelona: "fcbarcelona.com",
  "atletico madrid": "atleticodemadrid.com",
  "manchester united": "manutd.com",
  tottenham: "tottenhamhotspur.com",
  "paris saint-germain": "psg.fr",
  juventus: "juventus.com",
  "ac milan": "acmilan.com",
  "borussia dortmund": "bvb.de",

  // NBA / MLB crests come from ESPN's public team-logo CDN, which serves the
  // individual franchise mark rather than the league mark.

  // Esports
  cloud9: "cloud9.gg",
  t1: "t1.gg",
  fnatic: "fnatic.com",
  "g2 esports": "g2esports.com",
};

/** Resolves a team crest URL, or null when the team has no known brand domain. */
/** ESPN team-logo CDN slugs, keyed by team name. */
export const ESPN_TEAM_LOGOS: Record<string, string> = {
  // NBA
  "boston celtics": "nba/500/bos",
  "los angeles lakers": "nba/500/lal",
  "denver nuggets": "nba/500/den",
  "phoenix suns": "nba/500/phx",
  "golden state warriors": "nba/500/gs",
  "miami heat": "nba/500/mia",
  "new york knicks": "nba/500/ny",
  "milwaukee bucks": "nba/500/mil",
  "dallas mavericks": "nba/500/dal",
  "philadelphia 76ers": "nba/500/phi",
  "atlanta hawks": "nba/500/atl",
  "brooklyn nets": "nba/500/bkn",
  "charlotte hornets": "nba/500/cha",
  "chicago bulls": "nba/500/chi",
  "cleveland cavaliers": "nba/500/cle",
  "detroit pistons": "nba/500/det",
  "indiana pacers": "nba/500/ind",
  "los angeles clippers": "nba/500/lac",
  "memphis grizzlies": "nba/500/mem",
  "minnesota timberwolves": "nba/500/min",
  "new orleans pelicans": "nba/500/no",
  "oklahoma city thunder": "nba/500/okc",
  "orlando magic": "nba/500/orl",
  "portland trail blazers": "nba/500/por",
  "sacramento kings": "nba/500/sac",
  "san antonio spurs": "nba/500/sa",
  "toronto raptors": "nba/500/tor",
  "utah jazz": "nba/500/utah",
  "washington wizards": "nba/500/wsh",
  "houston rockets": "nba/500/hou",

  // MLB
  "new york yankees": "mlb/500/nyy",
  "houston astros": "mlb/500/hou",
  "los angeles dodgers": "mlb/500/lad",
};

/** Official NBA crests hosted with the app so browser anti-tracking cannot block them. */
const HOSTED_TEAM_LOGOS: Record<string, string> = {
  "los angeles lakers": lakersLogo.url,
  "boston celtics": celticsLogo.url,
  "denver nuggets": nuggetsLogo.url,
  "phoenix suns": sunsLogo.url,
};

export function teamLogoUrl(team: string, size = 64): string | null {
  const key = team.trim().toLowerCase();
  const hosted = HOSTED_TEAM_LOGOS[key];
  if (hosted) return hosted;
  const espn = ESPN_TEAM_LOGOS[key];
  if (espn) return `https://a.espncdn.com/i/teamlogos/${espn}.png`;
  const domain = TEAM_DOMAINS[key];
  const token = import.meta.env["VITE_LOVABLE_CONNECTOR_LOGO_DEV_API_KEY"];
  if (!domain || !token) return null;
  return `https://img.logo.dev/${domain}?token=${token}&size=${size}&format=png&retina=true`;
}
