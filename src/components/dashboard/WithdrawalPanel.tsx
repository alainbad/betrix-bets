import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useWallet } from "@/lib/wallet-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { toast } from "sonner";
const format = (n: number) =>
  Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const labels: Record<string, string> = {
  pending_agent_review: "Agent review",
  agent_approved_pending_ultra: "Awaiting Ultra Admin",
  ultra_approved_ready_payout: "Ready to settle",
  completed: "Completed",
  rejected: "Rejected",
};
type Withdrawal = {
  id: string;
  player_id: string;
  agent_id: string;
  amount: number;
  status: string;
  agent_note: string | null;
  ultra_note: string | null;
  offline_payout_reference: string | null;
  created_at: string;
  player: { username: string; account_id: string } | null;
};
export function WithdrawalPanel({
  tier = "player",
}: {
  tier?: "player" | "agent" | "super_agent" | "ultra_admin";
}) {
  const { user } = useAuth(),
    { refresh } = useWallet();
  const [rows, setRows] = useState<Withdrawal[]>([]),
    [reserved, setReserved] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [modal, setModal] = useState<{ action: string; id?: string } | null>(null);
  const load = useCallback(async () => {
    if (!user) return;
    setError("");
    setLoading(true);
    try {
      const [requests, wallet] = await Promise.all([
        supabase
          .from("withdrawal_requests")
          .select("*,player:profiles!withdrawal_requests_player_id_fkey(username,account_id)")
          .order("created_at", { ascending: false })
          .limit(100),
        supabase.from("wallets").select("reserved_balance").eq("user_id", user.id).single(),
      ]);
      if (requests.error) throw requests.error;
      if (wallet.error) throw wallet.error;
      setRows(requests.data as Withdrawal[]);
      setReserved(Number(wallet.data.reserved_balance));
    } catch {
      setError(
        "Credit requests are unavailable. The withdrawal migration must be installed before this feature can be used.",
      );
    } finally {
      setLoading(false);
    }
  }, [user]);
  useEffect(() => {
    void load();
  }, [load]);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!modal) return;
    const form = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const action = modal.action;
      let args: Record<string, unknown> = { p_request_id: modal.id };
      if (action === "player_request_withdrawal") {
        const raw = String(form.get("amount"));
        if (!/^\d+(\.\d{1,2})?$/.test(raw) || Number(raw) <= 0)
          throw new Error("Enter a positive credit amount with up to two decimals");
        args = { p_amount: Number(raw) };
      } else if (action === "settle_player_withdrawal") args["p_offline_ref"] = form.get("note");
      else if (action === "reject_withdrawal_request") args["p_reason"] = form.get("note");
      else args["p_note"] = form.get("note");
      const { error } = await supabase.rpc(action, args);
      if (error) throw error;
      setModal(null);
      await Promise.all([load(), refresh()]);
      toast.success("Credit request updated");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : (e as { message?: string }).message || "Request failed",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!user) return null;
  return (
    <section className="mx-auto my-6 max-w-7xl rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Test-credit withdrawal requests</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Agent review → Ultra Admin approval → Test settlement. No cash payment is made.
          </p>
          <p className="mt-2 text-sm">
            Your reserved credits: <b>{format(reserved)}</b>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={loading} onClick={() => void load()}>
            Refresh
          </Button>
          {tier === "player" && (
            <Button
              disabled={!!error || loading}
              onClick={() => setModal({ action: "player_request_withdrawal" })}
            >
              New request
            </Button>
          )}
        </div>
      </div>
      {error ? (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      ) : loading ? (
        <p className="py-5 text-muted-foreground">Loading requests…</p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                {["Player", "Credits", "Stage", "Notes / reference", "Actions"].map((s) => (
                  <TableHead key={s}>{s}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((w) => (
                <TableRow key={w.id}>
                  <TableCell>
                    {w.player?.username || "Player"}
                    <div className="text-xs text-muted-foreground">{w.player?.account_id}</div>
                  </TableCell>
                  <TableCell>{format(w.amount)}</TableCell>
                  <TableCell>{labels[w.status]}</TableCell>
                  <TableCell>
                    {w.ultra_note || w.agent_note || "—"}
                    <div className="text-xs text-muted-foreground">
                      {w.offline_payout_reference}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {tier !== "player" && (w.agent_id === user.id || tier === "ultra_admin") && (
                        <>
                          {w.status === "pending_agent_review" && (
                            <Button
                              size="sm"
                              onClick={() =>
                                setModal({ action: "agent_approve_withdrawal", id: w.id })
                              }
                            >
                              Approve
                            </Button>
                          )}
                          {w.status === "agent_approved_pending_ultra" &&
                            tier === "ultra_admin" && (
                              <Button
                                size="sm"
                                onClick={() =>
                                  setModal({ action: "ultra_admin_approve_withdrawal", id: w.id })
                                }
                              >
                                Authorize
                              </Button>
                            )}
                          {w.status === "ultra_approved_ready_payout" && (
                            <Button
                              size="sm"
                              onClick={() =>
                                setModal({ action: "settle_player_withdrawal", id: w.id })
                              }
                            >
                              Settle
                            </Button>
                          )}
                          {!["completed", "rejected"].includes(w.status) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setModal({ action: "reject_withdrawal_request", id: w.id })
                              }
                            >
                              Reject
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!rows.length && (
            <p className="py-8 text-center text-muted-foreground">No requests yet.</p>
          )}
        </>
      )}
      <Dialog
        open={!!modal}
        onOpenChange={(v) => {
          if (!v && !busy) setModal(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {modal?.action === "player_request_withdrawal"
                ? "Request test credits"
                : "Review credit request"}
            </DialogTitle>
            <DialogDescription>
              Requested credits stay reserved until settlement or rejection. Rejected requests
              return their credits.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submit}>
            {modal?.action === "player_request_withdrawal" ? (
              <label className="block text-sm">
                Amount
                <Input name="amount" required inputMode="decimal" placeholder="0.00" />
              </label>
            ) : (
              <label className="block text-sm">
                {modal?.action === "settle_player_withdrawal"
                  ? "Test settlement reference"
                  : "Review note"}
                <Input
                  name="note"
                  required={["settle_player_withdrawal", "reject_withdrawal_request"].includes(
                    modal?.action || "",
                  )}
                  minLength={3}
                  maxLength={500}
                />
              </label>
            )}
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Confirm"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
