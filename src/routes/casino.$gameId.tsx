import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Info, ShieldCheck } from "lucide-react";
import { getGameById } from "@/lib/casino-data";
import { formatCurrency } from "@/lib/format";
import { useBetting } from "@/lib/betting-store";

export const Route = createFileRoute("/casino/$gameId")({
  loader: ({ params }) => {
    const game = getGameById(params.gameId);
    if (!game) throw notFound();
    return { game };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Game unavailable — Betrix" }, { name: "robots", content: "noindex" }] };
    }
    const { game } = loaderData;
    return {
      meta: [
        { title: `${game.name} — Betrix Casino Simulation` },
        { name: "description", content: `${game.tagline} ${game.name} by ${game.provider}, RTP ${game.rtp}%, played with Betrix virtual credits.` },
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

function GamePage() {
  const { game } = Route.useLoaderData();
  const { balance } = useBetting();

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <Link to="/casino" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to casino
        </Link>

        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <section className={`rounded-2xl border border-border bg-gradient-to-br ${game.hue} p-8`}>
            <div className="flex flex-col items-center justify-center rounded-xl border border-border/60 bg-background/60 py-20 text-center backdrop-blur">
              <p className="text-4xl font-black tracking-tighter text-foreground">{game.name}</p>
              <p className="mt-2 text-sm text-muted-foreground">{game.tagline}</p>
              <p className="mt-8 max-w-sm text-xs text-muted-foreground">
                The game client connects to the server-side round engine. Outcomes are generated and settled server-side —
                nothing is decided in this browser.
              </p>
              <span className="mt-6 rounded-full border border-border bg-secondary px-4 py-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Engine pending
              </span>
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Virtual balance</p>
              <p className="text-2xl font-black text-foreground">{formatCurrency(balance)}</p>
            </div>

            <dl className="space-y-2 rounded-2xl border border-border bg-card p-4 text-sm">
              <Row label="Provider" value={game.provider} />
              <Row label="Category" value={game.category} />
              <Row label="Theoretical RTP" value={`${game.rtp}%`} />
              <Row label="Volatility" value={game.volatility} />
              <Row label="Stake range" value={`${formatCurrency(game.minStake)} – ${formatCurrency(game.maxStake)}`} />
            </dl>

            <p className="flex gap-2 rounded-2xl border border-border bg-secondary p-4 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              Credits carry no monetary value and cannot be purchased, withdrawn or exchanged.
            </p>
            <p className="flex gap-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Round history appears in your account once a round has been settled.
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
      <p className="text-sm text-muted-foreground">This title may have been retired from the lobby.</p>
      <Link to="/casino" className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground">
        Back to casino
      </Link>
    </main>
  );
}
