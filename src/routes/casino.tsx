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
import { useAuth } from "@/lib/auth-context";
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
      { property: "og:title", content: "TheBetrix — Free-to-Play Social Casino" },
      {
        property: "og:description",
        content: "Four original games played with virtual coins. No real money, no cash-out.",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "TheBetrix" },
      { property: "og:url", content: "https://thebetrix.com/casino" },
      { property: "og:image", content: "https://thebetrix.com/og-image.jpg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "TheBetrix — free-to-play social casino" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://thebetrix.com/og-image.jpg" },
    ],
    links: [{ rel: "canonical", href: "https://thebetrix.com/casino" }],
  }),
  component: CasinoPage,
});

function CasinoPage() {
  const { balance, refresh } = useWallet();
  const { user } = useAuth();
  const [preview, setPreview] = useState(false);
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

  function openGame(game: Html5CasinoGame, practice = false) {
    if (!practice && !user) {
      toast.error("Sign in to play with your Betrix wallet.");
      return;
    }

    setPreview(practice);
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

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {games.map((game, index) => (
            <article
              key={game.id}
              className="group overflow-hidden rounded-2xl border border-border bg-card shadow-lg"
            >
              <button
                type="button"
                onClick={() => openGame(game)}
                className="relative block aspect-[16/10] w-full overflow-hidden text-left"
                aria-label={`Play ${game.name}`}
              >
                <img
                  src={game.thumbnail ?? heroCasino}
                  alt={game.name}
                  width={1672}
                  height={941}
                  loading={index < 2 ? "eager" : "lazy"}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <span className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" />
                <span className="absolute left-6 top-5 rounded-full border border-white/25 bg-black/35 px-3 py-1 text-xs uppercase tracking-widest text-white">
                  0{index + 1} / {game.category}
                </span>
                <div className="absolute bottom-6 left-6 right-6 text-white">
                  <p className="mb-2 text-xs uppercase tracking-[.25em] text-amber-200">
                    Velvet Originals
                  </p>
                  <h2 className="font-serif text-4xl sm:text-5xl">{game.name}</h2>
                </div>
              </button>
              <div className="flex flex-wrap items-center justify-between gap-4 p-5">
                <p className="max-w-xs text-sm text-muted-foreground">{game.tagline}</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => openGame(game, true)}
                    className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary"
                  >
                    ▷ Preview
                  </button>
                  <button
                    onClick={() => openGame(game)}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
                  >
                    Play game →
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>

        {games.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
            {CASINO_GAMES.length === 0 ? "New games coming soon." : "No games match that search."}
          </p>
        )}
      </div>

      {activeGame && (
        <GameModal
          game={activeGame}
          preview={preview}
          balance={liveBalance}
          onClose={closeGame}
          onBalanceUpdate={setLiveBalance}
        />
      )}
    </main>
  );
}
