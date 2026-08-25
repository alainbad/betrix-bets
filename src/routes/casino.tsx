import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Dices, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  CASINO_CATEGORIES,
  CASINO_GAMES,
  type CasinoCategory,
  type Html5CasinoGame,
} from "@/lib/casino-data";
import { GameModal } from "@/components/casino/GameModal";
import { useWallet } from "@/lib/wallet-store";
import { cn } from "@/lib/utils";
import heroCasino from "@/assets/hero-casino.jpg";

export const Route = createFileRoute("/casino")({
  head: () => ({
    meta: [
      { title: "Casino — TheBetrix" },
      {
        name: "description",
        content: "TheBetrix free-to-play social casino: no real money, virtual coins only.",
      },
      { property: "og:title", content: "TheBetrix Casino" },
      {
        property: "og:description",
        content: "Free-to-play social casino games, played with virtual coins.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CasinoPage,
});

function CasinoPage() {
  const { balance, refresh } = useWallet();
  const [category, setCategory] = useState<CasinoCategory | "all">("all");
  const [query, setQuery] = useState("");
  const [activeGame, setActiveGame] = useState<Html5CasinoGame | null>(null);
  const [liveBalance, setLiveBalance] = useState(balance);

  const games = CASINO_GAMES.filter(
    (g) =>
      (category === "all" || g.category === category) &&
      (query.trim() === "" ||
        `${g.name} ${g.provider}`.toLowerCase().includes(query.toLowerCase())),
  );

  function openGame(game: Html5CasinoGame) {
    setLiveBalance(balance);
    setActiveGame(game);
  }

  function closeGame() {
    setActiveGame(null);
    void refresh();
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <Dices className="h-3 w-3" /> Free-to-play · virtual coins only
          </p>
          <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">Casino</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            No real money, no cash-out - every round is played with virtual coins and logged to your
            account history.
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
                    : "border-border bg-secondary text-muted-foreground hover:text-foreground",
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

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {games.map((game) => (
            <button
              key={game.id}
              type="button"
              onClick={() => {
                if (!balance) {
                  toast.error("You need a virtual coin balance to play.");
                  return;
                }
                openGame(game);
              }}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card text-left transition-all hover:-translate-y-1 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10"
            >
              <div className="relative aspect-[4/5] overflow-hidden">
                <img
                  src={game.thumbnail ?? heroCasino}
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

                <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-background/85 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent backdrop-blur-sm">
                  <Sparkles className="h-3 w-3" />
                  Free play
                </span>

                <div className="absolute inset-x-0 bottom-0 p-3">
                  <p className="truncate text-sm font-black leading-tight text-foreground">
                    {game.name}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {game.provider}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {games.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
            No games match that search.
          </p>
        )}
      </div>

      {activeGame && (
        <GameModal
          game={activeGame}
          balance={liveBalance}
          onClose={closeGame}
          onBalanceUpdate={setLiveBalance}
        />
      )}
    </main>
  );
}
