import { createFileRoute, notFound } from "@tanstack/react-router";
import { Clock, Radio } from "lucide-react";
import { OddsButton } from "@/components/OddsButton";
import { TeamLogo } from "@/components/TeamLogo";
import { LeagueBadge } from "@/components/LeagueLogo";
import { MarketStatusBadge } from "@/components/MarketStatusBadge";
import { useBetting } from "@/lib/betting-store";
import { getEventById } from "@/lib/sports-data";
import { formatDateTime } from "@/lib/format";
import { useLiveUpdates } from "@/lib/use-live-updates";

export const Route = createFileRoute("/events/$eventId")({
  loader: async ({ params }) => {
    const event = await getEventById(params.eventId);
    if (!event) throw notFound();
    return { event };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: `${loaderData?.event?.awayTeam ?? ""} @ ${loaderData?.event?.homeTeam ?? ""} — Betrix`,
      },
      {
        name: "description",
        content: `View odds and markets for ${loaderData?.event?.awayTeam ?? ""} @ ${loaderData?.event?.homeTeam ?? ""} on Betrix.`,
      },
      {
        property: "og:title",
        content: `${loaderData?.event?.awayTeam ?? ""} @ ${loaderData?.event?.homeTeam ?? ""} — Betrix`,
      },
      {
        property: "og:description",
        content: `View odds and markets for ${loaderData?.event?.awayTeam ?? ""} @ ${loaderData?.event?.homeTeam ?? ""} on Betrix.`,
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EventDetailPage,
});

function EventDetailPage() {
  const { event } = Route.useLoaderData();
  useLiveUpdates({ pollMs: event.status === "live" ? 10_000 : 30_000 });
  const { addToSlip, isInSlip } = useBetting();

  return (
    <main className="min-h-screen bg-background px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <LeagueBadge league={event.league} size={34} />
            {event.status === "live" ? (
              <span className="flex items-center gap-1 text-accent">
                <Radio className="h-3 w-3 animate-pulse" />
                Live
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDateTime(event.startTime)}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between rounded-3xl border border-border bg-card p-6 sm:p-10">
            <TeamBlock name={event.awayTeam} score={event.awayScore} />
            <div className="px-4 text-center">
              <p className="text-2xl font-black text-muted-foreground">VS</p>
              {event.status === "live" && (
                <p className="mt-1 text-xs font-bold uppercase text-accent">
                  {event.awayScore ?? 0} — {event.homeScore ?? 0}
                </p>
              )}
            </div>
            <TeamBlock name={event.homeTeam} score={event.homeScore} align="right" />
          </div>
        </div>

        <div className="space-y-6">
          {event.markets.map((market) => (
            <section key={market.type} className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-foreground">{market.label}</h2>
                <MarketStatusBadge status={market.status} showOpen />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {market.selections.map((selection) => {
                  const active = isInSlip(event.id, selection.id);
                  return (
                    <OddsButton
                      key={selection.id}
                      selection={selection}
                      active={active}
                      onClick={() => addToSlip(event, market.label, selection)}
                      marketStatus={market.status}
                      showHistory
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}

function TeamBlock({
  name,
  score,
  align = "left",
}: {
  name: string;
  score?: number | undefined;
  align?: "left" | "right";
}) {
  return (
    <div
      className={`flex flex-col gap-3 ${align === "right" ? "items-end text-right" : "items-start text-left"}`}
    >
      <TeamLogo team={name} size={64} />
      <p className="text-lg font-bold text-foreground sm:text-2xl">{name}</p>
      {score !== undefined && <p className="mt-1 text-3xl font-black text-primary">{score}</p>}
    </div>
  );
}
