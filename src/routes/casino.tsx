import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Dices, Search, Sparkles } from "lucide-react";
import { CASINO_CATEGORIES, CASINO_GAMES, type CasinoCategory } from "@/lib/casino-data";
import { casinoGameImage } from "@/lib/casino-media";
import { cn } from "@/lib/utils";
import ogAsset from "@/assets/betrix-og.jpg.asset.json";

const CASINO_OG_IMAGE = `https://project--6a0e946c-c85b-4a07-8f34-3b6259233927.lovable.app${ogAsset.url}`;

export const Route = createFileRoute("/casino")({
  head: () => ({
    meta: [
      { title: "Casino Simulation — Slots & Tables on Betrix" },
      { name: "description", content: "Play Betrix casino simulations: slots, instant-win originals, blackjack, roulette and live-studio tables using virtual credits." },
      { property: "og:title", content: "Betrix Casino Simulation" },
      { property: "og:description", content: "Slots, instant-win originals and table games — all played with virtual credits." },
      { property: "og:type", content: "website" },
      { property: "og:image", content: CASINO_OG_IMAGE },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: CASINO_OG_IMAGE },
    ],
  }),
  component: CasinoPage,
});

function CasinoPage() {
  const [category, setCategory] = useState<CasinoCategory | "all">("all");
  const [query, setQuery] = useState("");

  const games = CASINO_GAMES.filter(
    (g) =>
      (category === "all" || g.category === category) &&
      (query.trim() === "" || `${g.name} ${g.provider}`.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <Dices className="h-3 w-3" /> Simulation credits only
          </p>
          <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">Casino</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Every round is settled by the server-side engine and logged to your history. Published RTP figures are theoretical
            over millions of rounds.
          </p>
        </header>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {CASINO_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors",
                  category === c.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
          <label className="relative flex items-center sm:w-64">
            <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search games"
              className="w-full rounded-full border border-border bg-secondary py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </label>
        </div>

        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {games.map((game) => (
            <Link
              key={game.id}
              to="/casino/$gameId"
              params={{ gameId: game.id }}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-1 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10"
            >
              <div className="relative aspect-[4/5] overflow-hidden">
                <img
                  src={casinoGameImage(game.id)}
                  alt={`${game.name} by ${game.provider}`}
                  loading="lazy"
                  width={800}
                  height={1000}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/55 to-transparent" />
                <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <div className="absolute inset-0 bg-background/45" />
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary px-5 py-2 text-xs font-black uppercase tracking-widest text-primary-foreground shadow-lg">
                    Play
                  </span>
                </div>

                {game.badge && (
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-background/85 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent backdrop-blur-sm">
                    <Sparkles className="h-3 w-3" />
                    {game.badge}
                  </span>
                )}
                <span className="absolute right-3 top-3 rounded-full bg-background/85 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary backdrop-blur-sm">
                  RTP {game.rtp}%
                </span>

                <div className="absolute inset-x-0 bottom-0 p-3">
                  <p className="truncate text-sm font-black leading-tight text-foreground">{game.name}</p>
                  <p className="mt-0.5 truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {game.provider} · {game.volatility} vol.
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {games.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
            No games match that search.
          </p>
        )}
      </div>
    </main>
  );
}
