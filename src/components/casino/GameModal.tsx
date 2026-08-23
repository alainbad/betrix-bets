import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import type { Html5CasinoGame } from "@/lib/casino-data";
import { setupGameBridge } from "@/lib/game-bridge";

export function GameModal({
  game,
  balance,
  onClose,
  onBalanceUpdate,
}: {
  game: Html5CasinoGame;
  balance: number;
  onClose: () => void;
  onBalanceUpdate: (newBalance: number) => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    return setupGameBridge(game.id, iframe, onBalanceUpdate, (message) => toast.error(message));
  }, [game.id, onBalanceUpdate]);

  const gameUrl = `${game.path}?coins=${Math.floor(balance)}`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4">
      <div className="flex w-full max-w-5xl items-center justify-between pb-3 text-white">
        <h2 className="text-xl font-bold">{game.name}</h2>
        <button
          onClick={onClose}
          className="cursor-pointer rounded-lg bg-destructive px-4 py-1.5 text-sm font-semibold text-destructive-foreground transition hover:opacity-90"
        >
          <span className="inline-flex items-center gap-1.5">
            <X className="h-4 w-4" /> Exit game
          </span>
        </button>
      </div>

      <div className="h-[650px] w-full max-w-5xl overflow-hidden rounded-xl border border-border bg-black shadow-2xl">
        <iframe
          ref={iframeRef}
          title={game.name}
          src={gameUrl}
          className="h-full w-full border-0"
          allow="autoplay"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
    </div>
  );
}
