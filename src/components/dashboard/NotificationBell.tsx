import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, Coins, HandCoins } from "lucide-react";
import { toast } from "sonner";
import {
  fetchAgentNotifications,
  markNotificationRead,
  type AgentNotification,
} from "@/lib/notifications";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const POLL_INTERVAL_MS = 20_000;

// Player-initiated top-up/cash-out requests, surfaced to the assigned
// agent as a live-ish feed (polled, not a websocket subscription - see
// fetchAgentNotifications). Purely informational: acting on a request
// (topping up, or approving/rejecting the linked withdrawal) still happens
// through the existing IdentifierTransferModal / WithdrawalPanel tools -
// this only marks the alert itself as read once the agent has seen it.
export function NotificationBell({ agentId }: { agentId: string }) {
  const [notifications, setNotifications] = useState<AgentNotification[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
    fetchAgentNotifications(agentId)
      .then(setNotifications)
      .catch(() => {
        // Silent: a failed poll shouldn't interrupt the dashboard. The next
        // interval retries.
      });
  }, [agentId]);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  const unread = notifications.filter((n) => !n.readAt);

  async function handleRead(notification: AgentNotification) {
    if (notification.readAt) return;
    try {
      await markNotificationRead(notification.id);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notification.id ? { ...n, readAt: new Date().toISOString() } : n,
        ),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to mark notification read");
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-secondary text-foreground transition-colors hover:bg-betrix-surface-elevated"
          aria-label={`Notifications${unread.length ? `, ${unread.length} unread` : ""}`}
        >
          <Bell className="h-4 w-4" />
          {unread.length > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unread.length > 9 ? "9+" : unread.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-bold text-foreground">Player requests</p>
          <p className="text-xs text-muted-foreground">
            Top-up and cash-out requests from your book
          </p>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No requests yet.</p>
          )}
          {notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => void handleRead(n)}
              className={cn(
                "flex w-full items-start gap-3 border-b border-border/60 px-4 py-3 text-left last:border-0 hover:bg-betrix-surface-elevated",
                !n.readAt && "bg-primary/5",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                  n.kind === "topup_request"
                    ? "bg-primary/10 text-primary"
                    : "bg-accent/10 text-accent",
                )}
              >
                {n.kind === "topup_request" ? (
                  <Coins className="h-3.5 w-3.5" />
                ) : (
                  <HandCoins className="h-3.5 w-3.5" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm">
                  <Link
                    to="/dashboard/users/$accountId"
                    params={{ accountId: n.playerAccountId }}
                    className="truncate font-semibold text-foreground hover:text-primary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {n.playerUsername}
                  </Link>
                  {!n.readAt && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {n.kind === "topup_request" ? "Requested a top up" : "Requested a cash out"} of{" "}
                  <b className="text-foreground">{formatCurrency(n.amount)}</b>
                </span>
                <span className="block text-[10px] text-muted-foreground">
                  {formatDateTime(n.createdAt)}
                </span>
              </span>
            </button>
          ))}
        </div>
        {unread.length > 0 && (
          <div className="border-t border-border p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => {
                unread.forEach((n) => void handleRead(n));
              }}
            >
              Mark all as read
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
