// Keeps route loader data in sync with live score/odds changes.
//
// Two mechanisms, on purpose:
//  1. Supabase Realtime (postgres_changes) on `events` and `selections`, so a
//     score change or a re-priced market pushes to the browser within ~1s.
//  2. A polling fallback, because Realtime can silently drop (sleeping tab,
//     flaky socket, publication not replicating yet) and a sportsbook that
//     quietly freezes on a stale score is worse than one that's a few
//     seconds behind.
//
// Both paths do the same thing: `router.invalidate()`, which re-runs the
// current route's loader. The loaders already fetch from Supabase, so every
// page that shows scores or odds gets fresh data with no per-page plumbing.

import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "./supabase";

const DEFAULT_POLL_MS = 20_000;
// Coalesce bursts: a single provider sync can rewrite hundreds of selection
// rows at once, and each one fires its own realtime event.
const DEBOUNCE_MS = 800;

export function useLiveUpdates(options: { pollMs?: number; enabled?: boolean } = {}) {
  const { pollMs = DEFAULT_POLL_MS, enabled = true } = options;
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    const refresh = () => {
      if (disposed) return;
      if (typeof document !== "undefined" && document.hidden) return;
      void router.invalidate();
    };

    const scheduleRefresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(refresh, DEBOUNCE_MS);
    };

    const channel = supabase
      .channel("live-sports-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, scheduleRefresh)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "selections" },
        scheduleRefresh,
      )
      .subscribe();

    const interval = setInterval(refresh, pollMs);
    // A tab that was backgrounded skipped its polls; catch up immediately.
    const onVisible = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [router, pollMs, enabled]);
}
