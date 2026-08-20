import { useMemo, useState } from "react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { ChevronDown, Clock, Radio, Star } from "lucide-react";
import { MarketRow } from "@/components/MarketRow";
import { TeamLogo } from "@/components/TeamLogo";
import { LeagueBadge } from "@/components/LeagueLogo";
import { MarketStatusBadge } from "@/components/MarketStatusBadge";
import { useBetting } from "@/lib/betting-store";
import { getEventById } from "@/lib/sports-data";
import { formatDateTime } from "@/lib/format";
import { useLiveUpdates } from "@/lib/use-live-updates";
import { cn } from "@/lib/utils";
import type { Event, Market, Selection } from "@/lib/betting-data";

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
        content: `All betting markets — money line, handicaps and totals — for ${loaderData?.event?.awayTeam ?? ""} @ ${loaderData?.event?.homeTeam ?? ""} on Betrix.`,
      },
      {
        property: "og:title",
        content: `${loaderData?.event?.awayTeam ?? ""} @ ${loaderData?.event?.homeTeam ?? ""} — Betrix`,
      },
      {
        property: "og:description",
        content: `All betting markets — money line, handicaps and totals — for ${loaderData?.event?.awayTeam ?? ""} @ ${loaderData?.event?.homeTeam ?? ""} on Betrix.`,
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EventDetailPage,
});

type Category = "main" | "handicap" | "totals" | "specials";

const CATEGORY_LABEL: Record<Category, string> = {
  main: "Main",
  handicap: "Handicap",
  totals: "Over/Under",
  specials: "Specials",
};

interface MarketGroup {
  key: string;
  label: string;
  category: Category;
  status: Market["status"];
  columns: 2 | 3;
  rows: { selection: Selection; label: string; sublabel?: string | undefined }[];
}

function categoryOf(market: Market): Category {
  if (market.type === "total") return "totals";
  if (market.type === "moneyline") return "main";
  if (market.type === "spread") return "handicap";
  // Secondary markets from the feed (both teams to score, double chance,
  // draw no bet, halves, corners...) land in their own tab.
  return "specials";
}

const SPECIAL_LABELS: Record<string, string> = {
  "1X": "Home or Draw",
  X2: "Draw or Away",
  "12": "Home or Away",
};

function rowLabel(market: Market, selection: Selection, event: Event) {
  if (market.type === "moneyline") {
    if (selection.label === "Home") return { label: event.homeTeam };
    if (selection.label === "Away") return { label: event.awayTeam };
    if (selection.label === "Draw") return { label: "Draw (X)" };
    return { label: selection.label };
  }
  if (market.type === "total") {
    return {
      label: `${selection.label.toUpperCase()} ${selection.value ?? ""}`.trim(),
    };
  }
  if (market.type === "spread") {
    const team =
      selection.label === "Home"
        ? event.homeTeam
        : selection.label === "Away"
          ? event.awayTeam
          : selection.label;
    return { label: team, sublabel: selection.value ? `Handicap ${selection.value}` : undefined };
  }
  const special = SPECIAL_LABELS[selection.label];
  if (special) {
    const named = special
      .replace("Home", event.homeTeam)
      .replace("Away", event.awayTeam);
    return { label: selection.label, sublabel: named };
  }
  if (selection.label === "Home") return { label: event.homeTeam };
  if (selection.label === "Away") return { label: event.awayTeam };
  return {
    label: selection.label,
    sublabel: selection.value ? `Line ${selection.value}` : undefined,
  };
}

/** Merges markets that share a label (e.g. several total lines) into one board section. */
function buildGroups(event: Event): MarketGroup[] {
  const groups = new Map<string, MarketGroup>();
  for (const market of event.markets) {
    if (market.selections.length === 0) continue;
    const key = `${market.type}:${market.label}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        label: market.label,
        category: categoryOf(market),
        status: market.status,
        columns: market.selections.length === 3 && market.type === "moneyline" ? 3 : 2,
        rows: [],
      };
      groups.set(key, group);
    }
    if (market.status !== "open") group.status = market.status;
    for (const selection of market.selections) {
      const { label, sublabel } = rowLabel(market, selection, event);
      group.rows.push({ selection, label, sublabel });
    }
  }
  const list = [...groups.values()];
  // Totals read best as ordered Over/Under ladders: 1.5, 2.5, 3.5 ...
  for (const group of list) {
    if (group.category !== "totals") continue;
    group.rows.sort((a, b) => {
      const lineA = Number(a.selection.value ?? 0);
      const lineB = Number(b.selection.value ?? 0);
      if (lineA !== lineB) return lineA - lineB;
      return a.selection.label.localeCompare(b.selection.label);
    });
  }
  const order: Category[] = ["main", "handicap", "totals", "specials"];
  return list.sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));
}

function EventDetailPage() {
  const { event } = Route.useLoaderData();
  useLiveUpdates({ pollMs: event.status === "live" ? 10_000 : 30_000 });
  const { addToSlip, isInSlip } = useBetting();

  const groups = useMemo(() => buildGroups(event), [event]);
  const categories = useMemo(() => {
    const seen: Category[] = [];
    for (const group of groups) if (!seen.includes(group.category)) seen.push(group.category);
    return seen;
  }, [groups]);

  const [filter, setFilter] = useState<Category | "all">("all");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const visible = filter === "all" ? groups : groups.filter((g) => g.category === filter);

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

        {/* Market filter tabs — All / Main / Handicap / Over-Under */}
        <div className="sticky top-0 z-20 -mx-4 mb-4 border-b border-border bg-background/95 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-3">
          <div className="flex items-center gap-1 overflow-x-auto">
            <FilterTab active={filter === "all"} onClick={() => setFilter("all")}>
              All ({groups.length})
            </FilterTab>
            {categories.map((category) => (
              <FilterTab
                key={category}
                active={filter === category}
                onClick={() => setFilter(category)}
              >
                {CATEGORY_LABEL[category]}
              </FilterTab>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {visible.map((group) => {
            const isCollapsed = collapsed[group.key] ?? false;
            return (
              <section
                key={group.key}
                className="overflow-hidden rounded-2xl border border-border bg-card"
              >
                <button
                  type="button"
                  onClick={() => setCollapsed((prev) => ({ ...prev, [group.key]: !isCollapsed }))}
                  aria-expanded={!isCollapsed}
                  className="flex w-full items-center justify-between gap-2 bg-betrix-surface-elevated px-4 py-3 text-left"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Star className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="truncate text-sm font-bold uppercase tracking-wide text-foreground">
                      {group.label}
                    </span>
                    <MarketStatusBadge status={group.status} />
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                      isCollapsed && "-rotate-90",
                    )}
                  />
                </button>
                {!isCollapsed && (
                  <div
                    className={cn(
                      "grid gap-2 p-3",
                      group.columns === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2",
                    )}
                  >
                    {group.rows.map((row) => (
                      <MarketRow
                        key={row.selection.id}
                        selection={row.selection}
                        label={row.label}
                        sublabel={row.sublabel}
                        active={isInSlip(event.id, row.selection.id)}
                        onClick={() => addToSlip(event, group.label, row.selection)}
                        marketStatus={group.status}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
          {visible.length === 0 && (
            <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              No markets priced for this fixture yet.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

function FilterTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-bold transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
    >
      {children}
    </button>
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
