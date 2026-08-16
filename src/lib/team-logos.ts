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

  // NBA
  "boston celtics": "celtics.com",
  "los angeles lakers": "lakers.com",
  "denver nuggets": "nuggets.com",
  "phoenix suns": "suns.com",
  "golden state warriors": "warriors.com",
  "miami heat": "heat.com",
  "new york knicks": "nba.com",

  // MLB
  "new york yankees": "yankees.com",
  "houston astros": "astros.com",
  "los angeles dodgers": "dodgers.com",

  // Esports
  cloud9: "cloud9.gg",
  t1: "t1.gg",
  fnatic: "fnatic.com",
  "g2 esports": "g2esports.com",
};

/** Resolves a team crest URL, or null when the team has no known brand domain. */
export function teamLogoUrl(team: string, size = 64): string | null {
  const domain = TEAM_DOMAINS[team.trim().toLowerCase()];
  const token = import.meta.env["VITE_LOVABLE_CONNECTOR_LOGO_DEV_API_KEY"];
  if (!domain || !token) return null;
  return `https://img.logo.dev/${domain}?token=${token}&size=${size}&format=png&retina=true`;
}
