import { useEffect, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, BookOpen, Info, Minus, Plus, ShieldCheck } from "lucide-react";
import { casinoGameImage } from "@/lib/casino-media";
import { getGameById } from "@/lib/casino-data";
import { formatCurrency } from "@/lib/format";
import { useBetting } from "@/lib/betting-store";
import { useAuth } from "@/lib/auth-context";
import { getRecentRounds, playCasinoRound, type CasinoRound } from "@/lib/casino-engine";
import { GameStage } from "@/components/casino/GameStage";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/casino/$gameId")({
  loader: ({ params }) => {
    const game = getGameById(params.gameId);
    if (!game) throw notFound();
    return { game };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Game unavailable — Betrix" }, { name: "robots", content: "noindex" }],
      };
    }
    const { game } = loaderData;
    return {
      meta: [
        { title: `${game.name} — Betrix Casino Simulation` },
        {
          name: "description",
          content: `${game.tagline} ${game.name} by ${game.provider}, RTP ${game.rtp}%, played with Betrix virtual credits.`,
        },
        { property: "og:title", content: `${game.name} on Betrix` },
        { property: "og:description", content: game.tagline },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  notFoundComponent: GameNotFound,
  errorComponent: GameNotFound,
  component: GamePage,
});

const STAKE_STEP = 5;
const REVEAL_DELAY_MS = 1600;

function GamePage() {
  const { game } = Route.useLoaderData();
  const { balance, refresh } = useBetting();
  const { user } = useAuth();
  const [stake, setStake] = useState(() => Math.max(game.minStake, Math.min(game.maxStake, 10)));
  const [phase, setPhase] = useState<"idle" | "spinning" | "revealed">("idle");
  const [roundKey, setRoundKey] = useState(0);
  const [lastResult, setLastResult] = useState<CasinoRound | null>(null);
  const [rounds, setRounds] = useState<CasinoRound[]>([]);
  const playing = phase === "spinning";

  useEffect(() => {
    if (!user) {
      setRounds([]);
      return;
    }
    let cancelled = false;
    getRecentRounds(user.id, game.id, 8)
      .then((r) => {
        if (!cancelled) setRounds(r);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user, game.id]);

  const insufficientFunds = stake > balance;

  async function handlePlay() {
    if (!user || playing) return;
    if (stake < game.minStake || stake > game.maxStake) {
      toast.error(
        `Stake must be between ${formatCurrency(game.minStake)} and ${formatCurrency(game.maxStake)}.`,
      );
      return;
    }
    if (insufficientFunds) {
      toast.error("Insufficient balance.");
      return;
    }
    setRoundKey((k) => k + 1);
    setPhase("spinning");
    setLastResult(null);
    try {
      const result = await playCasinoRound(game.id, stake);
      if (!result.ok || !result.round) {
        toast.error(result.error ?? "Round failed. Try again.");
        setPhase("idle");
        return;
      }
      // The outcome is already decided server-side by this point - this
      // delay just gives the game stage animation room to play out before
      // the reveal, it never affects what the reveal shows.
      await new Promise((resolve) => setTimeout(resolve, REVEAL_DELAY_MS));
      setLastResult(result.round);
      setPhase("revealed");
      setRounds((prev) => [result.round!, ...prev].slice(0, 8));
      await refresh();
    } catch {
      toast.error("Round failed. Try again.");
      setPhase("idle");
    }
  }

  return (
    <main
      data-testid="casino-game-page"
      className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-5xl">
        <Link
          to="/casino"
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to casino
        </Link>

        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <section className="relative overflow-hidden rounded-2xl border border-border">
            <img
              src={casinoGameImage(game.id)}
              alt={`${game.name} by ${game.provider}`}
              width={800}
              height={600}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-background/75 backdrop-blur-[2px]" />
            <div className="relative flex flex-col items-center justify-center px-4 py-14 text-center">
              <p className="text-4xl font-black tracking-tighter text-foreground drop-shadow">
                {game.name}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{game.tagline}</p>

              <div className="mt-8 flex flex-col items-center gap-3">
                <GameStage
                  key={roundKey}
                  mechanic={game.mechanic}
                  phase={phase}
                  outcome={lastResult?.outcome ?? null}
                />
                {phase === "revealed" && lastResult && (
                  <p
                    className={cn(
                      "text-lg font-black",
                      lastResult.outcome === "win" ? "text-primary" : "text-destructive",
                    )}
                  >
                    {lastResult.outcome === "win"
                      ? `+${formatCurrency(lastResult.payout)}`
                      : "Lost"}
                  </p>
                )}
              </div>

              {user ? (
                <div className="mt-8 flex flex-col items-center gap-3">
                  <div className="flex items-center rounded-xl border border-border bg-background/90">
                    <button
                      type="button"
                      onClick={() => setStake((s) => Math.max(game.minStake, s - STAKE_STEP))}
                      className="px-3 py-2 text-muted-foreground hover:text-foreground"
                      aria-label="Decrease stake"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <div className="min-w-[5rem] text-center text-base font-bold text-foreground">
                      {formatCurrency(stake)}
                    </div>
                    <button
                      type="button"
                      onClick={() => setStake((s) => Math.min(game.maxStake, s + STAKE_STEP))}
                      className="px-3 py-2 text-muted-foreground hover:text-foreground"
                      aria-label="Increase stake"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handlePlay()}
                    disabled={playing || insufficientFunds}
                    className="rounded-full bg-primary px-8 py-3 text-sm font-bold text-primary-foreground transition-transform hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
                  >
                    {playing ? "Rolling…" : `Play for ${formatCurrency(stake)}`}
                  </button>
                  {insufficientFunds && (
                    <p className="text-xs font-medium text-destructive">Insufficient balance</p>
                  )}
                </div>
              ) : (
                <Link
                  to="/login"
                  className="mt-8 rounded-full bg-primary px-8 py-3 text-sm font-bold text-primary-foreground transition-transform hover:scale-105 active:scale-95"
                >
                  Log in to play
                </Link>
              )}
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Virtual balance
              </p>
              <p className="text-2xl font-black text-foreground">{formatCurrency(balance)}</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                <BookOpen className="h-3.5 w-3.5" /> How to play
              </p>
              <ul className="space-y-2 text-sm text-foreground">
                {game.howToPlay.map((line, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-primary" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            <dl className="space-y-2 rounded-2xl border border-border bg-card p-4 text-sm">
              <Row label="Provider" value={game.provider} />
              <Row label="Category" value={game.category} />
              <Row label="Theoretical RTP" value={`${game.rtp}%`} />
              <Row label="Volatility" value={game.volatility} />
              <Row
                label="Stake range"
                value={`${formatCurrency(game.minStake)} – ${formatCurrency(game.maxStake)}`}
              />
            </dl>

            {user && rounds.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">
                  Recent rounds
                </p>
                <ul className="space-y-2">
                  {rounds.map((round) => (
                    <li key={round.id} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {formatCurrency(round.stake)} stake
                      </span>
                      <span
                        className={cn(
                          "font-semibold",
                          round.outcome === "win" ? "text-primary" : "text-destructive",
                        )}
                      >
                        {round.outcome === "win" ? `+${formatCurrency(round.payout)}` : "Lost"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="flex gap-2 rounded-2xl border border-border bg-secondary p-4 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              Credits carry no monetary value and cannot be purchased, withdrawn or exchanged.
            </p>
            <p className="flex gap-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Every round is generated and settled server-side - nothing is decided in this browser.
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-2 last:border-0 last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold capitalize text-foreground">{value}</dd>
    </div>
  );
}

function GameNotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <h1 className="text-2xl font-black text-foreground">Game not found</h1>
      <p className="text-sm text-muted-foreground">
        This title may have been retired from the lobby.
      </p>
      <Link
        to="/casino"
        className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground"
      >
        Back to casino
      </Link>
    </main>
  );
}
