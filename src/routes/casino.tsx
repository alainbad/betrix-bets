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
    if (!practice && !user && !game.demoOnly) {
      toast.error("Sign in to play with your Betrix wallet.");
      return;
    }

    setPreview(practice || !!game.demoOnly);
    setLiveBalance(balance);
    setActiveGame(game);
  }

  function closeGame() {
    setActiveGame(null);
    void refresh();
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-background px-4 py-8 sm:px-6 lg:px-8">
      {/* Real casino floor (tables + slot machines) as a watermark behind the
          page - scrimmed just enough to keep the game cards on top of it
          legible. Deliberately position:absolute (scoped to this <main>,
          which is position:relative), not position:fixed: a fixed,
          full-viewport layer keeps painting as you scroll past the end of
          the page content, and since it doesn't share a stacking context
          with the page's static-positioned <footer>, it paints over that
          footer instead of behind it. Scoping the layer to main's own box
          makes that overlap impossible regardless of stacking order. */}
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-top opacity-[0.32]"
        style={{ backgroundImage: `url(${heroCasino})` }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/30 via-background/55 to-background/80"
        aria-hidden="true"
      />
      <div className="relative mx-auto max-w-7xl">
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

        <div className="grid grid-cols-3 gap-3 sm:gap-4 lg:grid-cols-4">
          {games.map((game, index) => (
            <article
              key={game.id}
              className="group overflow-hidden rounded-xl border border-border bg-card shadow-md transition-shadow hover:shadow-lg"
            >
              <button
                type="button"
                onClick={() => openGame(game)}
                className="relative block aspect-square w-full overflow-hidden text-left"
                aria-label={`Play ${game.name}`}
              >
                <img
                  src={game.thumbnail ?? heroCasino}
                  alt={game.name}
                  width={1672}
                  height={941}
                  loading={index < 8 ? "eager" : "lazy"}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                <span className="absolute left-2 top-2 rounded-full border border-white/25 bg-black/40 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                  {game.category}
                </span>
                <div className="absolute inset-x-0 bottom-0 p-2.5 text-white">
                  <p className="truncate text-[10px] uppercase tracking-[.2em] text-amber-200">
                    {game.provider}
                  </p>
                  <h2 className="truncate text-sm font-bold leading-tight sm:text-base">
                    {game.name}
                  </h2>
                </div>
              </button>
              <div className="p-2.5">
                {game.demoOnly ? (
                  <button
                    onClick={() => openGame(game, true)}
                    className="w-full rounded-lg bg-primary py-1.5 text-xs font-bold text-primary-foreground"
                  >
                    Play demo
                  </button>
                ) : (
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => openGame(game, true)}
                      className="flex-1 rounded-lg border border-border py-1.5 text-xs font-semibold hover:bg-secondary"
                    >
                      Preview
                    </button>
                    <button
                      onClick={() => openGame(game)}
                      className="flex-1 rounded-lg bg-primary py-1.5 text-xs font-bold text-primary-foreground"
                    >
                      Play
                    </button>
                  </div>
                )}
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
