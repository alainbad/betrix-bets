import { Link } from "@tanstack/react-router";
import { Clock, Radio } from "lucide-react";
import { useBetting } from "@/lib/betting-store";
import { formatDateTime, formatOdds } from "@/lib/format";
import { OddsButton } from "./OddsButton";
import { LeagueBadge } from "./LeagueLogo";
import { MarketStatusBadge } from "./MarketStatusBadge";
import { TeamLogo } from "./TeamLogo";
import type { Event } from "@/lib/betting-data";

export function EventCard({ event }: { event: Event }) {
  const { addToSlip, isInSlip } = useBetting();
  // Prefer the headline 1X2/moneyline market, but never leave a card blank:
  // some feeds only price handicaps or totals for a fixture.
  const moneyline =
    event.markets.find((m) => m.type === "moneyline" && m.selections.length > 0) ??
    event.markets.find((m) => m.selections.length > 0);
  const threeWay = moneyline?.selections.length === 3;

  return (
    <article className="group flex flex-col rounded-2xl border border-border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
      <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <div className="flex min-w-0 items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <LeagueBadge league={event.league} />
          {event.status === "live" ? (
            <span className="flex shrink-0 items-center gap-1 text-accent">
              <Radio className="h-3 w-3 animate-pulse" />
              Live
            </span>
          ) : (
            <span className="flex min-w-0 items-center gap-1">
              <Clock className="h-3 w-3 shrink-0" />
              <span className="truncate">{formatDateTime(event.startTime)}</span>
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {moneyline && <MarketStatusBadge status={moneyline.status} />}
        <Link
          to="/events/$eventId"
          params={{ eventId: event.id }}
          className="shrink-0 whitespace-nowrap text-xs font-medium text-primary hover:underline"
        >
          More markets
        </Link>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-3">
        <TeamColumn name={event.awayTeam} />
        <span className="shrink-0 text-lg font-black text-muted-foreground">@</span>
        <TeamColumn name={event.homeTeam} align="right" />
      </div>

      {event.status === "live" && (
        <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 rounded-xl bg-betrix-surface-elevated px-3 py-2">
          <Score value={event.awayScore ?? 0} label={event.awayTeam} />
          <span className="shrink-0 text-xs font-bold uppercase text-muted-foreground">Score</span>
          <Score value={event.homeScore ?? 0} label={event.homeTeam} />
        </div>
      )}

      <div className="mt-auto">
        <div
          className={`mb-1 grid gap-2 ${threeWay ? "grid-cols-3" : "grid-cols-2"} text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground`}
        >
          {threeWay ? (
            <>
              <span>1</span>
              <span>X</span>
              <span>2</span>
            </>
          ) : (
            <>
              <span className="truncate">{moneyline?.label ?? ""}</span>
              <span />
            </>
          )}
        </div>
        <div className={`grid gap-2 ${threeWay ? "grid-cols-3" : "grid-cols-2"}`}>
          {moneyline?.selections.map((selection) => {
            const active = isInSlip(event.id, selection.id);
            const caption =
              selection.label === "Draw"
                ? "Draw"
                : selection.label === "Home"
                  ? event.homeTeam
                  : selection.label === "Away"
                    ? event.awayTeam
                    : selection.label;
            return (
              <OddsButton
                key={selection.id}
                selection={selection}
                caption={caption}
                active={active}
                onClick={() => addToSlip(event, moneyline.label, selection)}
                marketStatus={moneyline.status}
                size="sm"
              />
            );
          })}
        </div>
      </div>

    </article>
  );
}

function TeamColumn({ name, align = "left" }: { name: string; align?: "left" | "right" }) {
  return (
    <div
      className={`flex min-w-0 items-center gap-2 sm:gap-3 ${align === "right" ? "flex-row-reverse text-right" : "text-left"}`}
    >
      <TeamLogo team={name} size={44} />
      <p className="min-w-0 break-words text-sm font-bold leading-tight text-foreground line-clamp-2">
        {name}
      </p>
    </div>
  );
}

function Score({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-0 text-center">
      <p className="text-2xl font-black text-foreground">{value}</p>
      <p className="truncate text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
