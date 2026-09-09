import { useWallet } from "@/lib/wallet-store";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import type { Html5CasinoGame } from "@/lib/casino-data";
import { setupVelvetBridge } from "@/lib/velvet-bridge";
import { setupGameBridge } from "@/lib/game-bridge";
import loadingBg from "@/assets/game-loading-bg.jpg";

// Loading bar never promises what it can't deliver: it eases toward 90% on
// its own (fast at first, tapering off, like a real download) and only ever
// completes once the iframe's real "load" event fires - see handleLoad.
const PROGRESS_CEILING = 90;
const PROGRESS_TIME_CONSTANT = 1.8; // seconds

export function GameModal({
  game,
  balance,
  onClose,
  onBalanceUpdate,
  preview = false,
}: {
  game: Html5CasinoGame;
  balance: number;
  preview?: boolean;
  onClose: () => void;
  onBalanceUpdate: (newBalance: number) => void;
}) {
  const { refresh } = useWallet();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || preview) return;
    const update = (n: number) => {
      onBalanceUpdate(n);
      void refresh();
    };
    if (game.id.startsWith("velvet-"))
      return setupVelvetBridge(game.id, iframe, update, (message) => toast.error(message));
    return setupGameBridge(game.id, iframe, update, (message) => toast.error(message));
  }, [game.id, onBalanceUpdate, preview, refresh]);

  const gameUrl = game.id.startsWith("velvet-")
    ? `${game.path}?preview=1${preview ? "" : "&wallet=1"}`
    : `${game.path}?coins=${Math.floor(balance)}`;

  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const progressDoneRef = useRef(false);

  useEffect(() => {
    setLoading(true);
    setProgress(0);
    progressDoneRef.current = false;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setProgress(PROGRESS_CEILING);
      return;
    }
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      if (progressDoneRef.current) return;
      const elapsed = (now - start) / 1000;
      setProgress(PROGRESS_CEILING * (1 - Math.exp(-elapsed / PROGRESS_TIME_CONSTANT)));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      progressDoneRef.current = true;
      cancelAnimationFrame(raf);
    };
  }, [gameUrl]);

  const handleIframeLoad = () => {
    progressDoneRef.current = true;
    setProgress(100);
    window.setTimeout(() => setLoading(false), 450);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4">
      <div className="flex w-full max-w-7xl items-center justify-between pb-3 text-white">
        <h2 className="text-xl font-bold">
          {game.name}
          {preview ? " · Practice preview" : ""}
        </h2>
        <button
          onClick={onClose}
          className="cursor-pointer rounded-lg bg-destructive px-4 py-1.5 text-sm font-semibold text-destructive-foreground transition hover:opacity-90"
        >
          <span className="inline-flex items-center gap-1.5">
            <X className="h-4 w-4" /> Exit game
          </span>
        </button>
      </div>

      <div className="relative h-[min(78vh,850px)] w-full max-w-7xl overflow-hidden rounded-xl border border-border bg-black shadow-2xl">
        <iframe
          ref={iframeRef}
          title={game.name}
          src={gameUrl}
          onLoad={handleIframeLoad}
          className="h-full w-full border-0"
          allow="autoplay; fullscreen"
          sandbox="allow-scripts allow-same-origin"
        />

        <div
          className={`absolute inset-0 z-10 flex flex-col items-center justify-end bg-black transition-opacity duration-500 ${
            loading ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          aria-hidden={!loading}
        >
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${loadingBg})` }}
          />
          <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black via-black/80 to-transparent" />

          <div className="relative z-10 mb-10 flex w-full max-w-md flex-col items-center gap-3 px-6 sm:mb-14">
            <p className="text-xs font-semibold uppercase tracking-[0.5em] text-violet-200/90">
              Loading…
            </p>
            <div className="h-4 w-full overflow-hidden rounded-full border border-white/25 bg-black/60 shadow-[inset_0_2px_4px_rgba(0,0,0,0.7)]">
              <div
                className="relative h-full rounded-full bg-gradient-to-r from-violet-600 via-fuchsia-400 to-violet-200 shadow-[0_0_16px_3px_rgba(168,85,247,0.7)] transition-[width] duration-150 ease-out"
                style={{ width: `${progress}%` }}
              >
                <div className="absolute inset-0 overflow-hidden">
                  <div className="absolute inset-y-0 left-0 w-1/3 animate-[casino-shimmer_1.6s_linear_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
