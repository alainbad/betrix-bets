import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Dices, Search, Sparkles } from "lucide-react";
import { CASINO_CATEGORIES, CASINO_GAMES, type CasinoCategory } from "@/lib/casino-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/casino")({
  head: () => ({
    meta: [
      { title: "Casino Simulation — Slots & Tables on Betrix" },
      { name: "description", content: "Play Betrix casino simulations: slots, instant-win originals, blackjack, roulette and live-studio tables using virtual credits." },
      { property: "og:title", content: "Betrix Casino Simulation" },
      { property: "og:description", content: "Slots, instant-win originals and table games — all played with virtual credits." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {games.map((game) => (
            <Link
              key={game.id}
              to="/casino/$gameId"
              params={{ gameId: game.id }}
              className="group overflow-hidden rounded-2xl border border-border bg-card transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
            >
              <div className="relative h-36 overflow-hidden">
                <img
                  src={casinoGameImage(game.id)}
                  alt={`${game.name} by ${game.provider}`}
                  loading="lazy"
                  width={800}
                  height={600}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />
                {game.badge && (
                  <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
                    <Sparkles className="h-3 w-3" />
                    {game.badge}
                  </span>
                )}
              </div>
              <div className="p-4">
                <p className="text-sm font-bold text-foreground">{game.name}</p>
                <p className="text-xs text-muted-foreground">{game.provider}</p>
                <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{game.tagline}</p>
                <div className="mt-3 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <span>RTP {game.rtp}%</span>
                  <span>{game.volatility} vol.</span>
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
