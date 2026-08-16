import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import { EventCard } from "@/components/EventCard";
import { SportPill } from "@/components/SportPill";
import { getSportImage } from "@/lib/sport-media";
import { getEventsBySport, getSportByCode, getSports } from "@/lib/sports-data";


export const Route = createFileRoute("/sports/$sportId")({
  loader: async ({ params }) => {
    const [sport, events, sports] = await Promise.all([
      getSportByCode(params.sportId),
      getEventsBySport(params.sportId),
      getSports(),
    ]);
    if (!sport) throw notFound();
    return { sport, events, sports };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.sport?.name ?? "Sport"} — Betrix` },
      { name: "description", content: `Browse ${loaderData?.sport?.name ?? ""} events and odds on Betrix.` },
      { property: "og:title", content: `${loaderData?.sport?.name ?? "Sport"} — Betrix` },
      { property: "og:description", content: `Browse ${loaderData?.sport?.name ?? ""} events and odds on Betrix.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SportPage,
});

function SportPage() {
  const { sport, events, sports } = Route.useLoaderData();

  return (
    <main className="min-h-screen bg-background pb-16">
      <section className="relative h-52 overflow-hidden border-b border-border sm:h-64">
        <img
          src={getSportImage(sport.id)}
          alt={`${sport.name} action`}
          width={640}
          height={640}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/75 to-background/20" />
        <div className="absolute inset-0 flex items-end px-4 pb-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">
            <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">{sport.name}</h1>
            <p className="text-sm text-muted-foreground">{events.length} events with open markets</p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <div className="flex gap-3 overflow-x-auto pb-2">
          <Link
            to="/sports"
            className="flex h-24 w-28 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-border bg-secondary text-center text-foreground transition-colors hover:bg-betrix-surface-elevated"
          >
            <Trophy className="h-5 w-5" />
            <span className="text-sm font-semibold">All sports</span>
          </Link>
          {sports.map((s) => (
            <SportPill key={s.id} sport={s} />
          ))}
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      </div>
    </main>
  );
}

