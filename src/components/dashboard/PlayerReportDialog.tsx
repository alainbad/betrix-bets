import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Printer } from "lucide-react";
import betrixLogo from "@/assets/betrix-mark.png";
import {
  fetchCasinoRounds,
  fetchLedger,
  fetchWithdrawalsForPlayer,
  type ProfileDetail,
} from "@/lib/agent-hierarchy";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// A high, not-unlimited row cap for report totals - this is a demo platform,
// so a single player realistically never approaches this many rows in one
// time frame, and it keeps the query bounded without needing pagination.
const REPORT_ROW_LIMIT = 20000;

const WITHDRAWAL_STATUS_LABEL: Record<string, string> = {
  pending_agent_review: "Pending (agent review)",
  agent_approved_pending_ultra: "Pending (Ultra Admin)",
  ultra_approved_ready_payout: "Approved, ready for payout",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled by player",
};

type Preset = "all" | "7d" | "30d" | "90d" | "month" | "custom";

const PRESET_LABEL: Record<Preset, string> = {
  all: "All time",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  month: "This month",
  custom: "Custom range",
};

function presetToRange(preset: Preset, customFrom: string, customTo: string) {
  const now = new Date();
  if (preset === "all") return {};
  if (preset === "7d") {
    const from = new Date(now);
    from.setDate(from.getDate() - 7);
    return { from: from.toISOString() };
  }
  if (preset === "30d") {
    const from = new Date(now);
    from.setDate(from.getDate() - 30);
    return { from: from.toISOString() };
  }
  if (preset === "90d") {
    const from = new Date(now);
    from.setDate(from.getDate() - 90);
    return { from: from.toISOString() };
  }
  if (preset === "month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: from.toISOString() };
  }
  // custom
  const range: { from?: string; to?: string } = {};
  if (customFrom) range.from = new Date(customFrom + "T00:00:00").toISOString();
  if (customTo) range.to = new Date(customTo + "T23:59:59.999").toISOString();
  return range;
}

interface ReportTotals {
  recharged: number;
  won: number;
  lost: number;
  withdrawals: { id: string; amount: number; status: string; createdAt: string }[];
}

export function PlayerReportDialog({
  open,
  profile,
  onClose,
}: {
  open: boolean;
  profile: ProfileDetail | null;
  onClose: () => void;
}) {
  const [preset, setPreset] = useState<Preset>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [totals, setTotals] = useState<ReportTotals | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const range = useMemo(
    () => presetToRange(preset, customFrom, customTo),
    [preset, customFrom, customTo],
  );

  useEffect(() => {
    if (!open || !profile) return;
    if (preset === "custom" && (!customFrom || !customTo)) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchLedger(profile.id, REPORT_ROW_LIMIT, range),
      fetchCasinoRounds(profile.id, REPORT_ROW_LIMIT, range),
      fetchWithdrawalsForPlayer(profile.id, REPORT_ROW_LIMIT, range),
    ])
      .then(([ledger, rounds, withdrawals]) => {
        if (cancelled) return;
        const recharged = ledger
          .filter(
            (t) =>
              (t.transactionType === "admin_adjustment" || t.transactionType === "agent_topup") &&
              t.amount > 0,
          )
          .reduce((sum, t) => sum + t.amount, 0);
        const won = rounds.filter((r) => r.outcome === "win").reduce((sum, r) => sum + r.payout, 0);
        const lost = rounds
          .filter((r) => r.outcome === "lose")
          .reduce((sum, r) => sum + r.stake, 0);
        setTotals({ recharged, won, lost, withdrawals });
        setGeneratedAt(new Date().toISOString());
      })
      .catch((err) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : "Failed to load report");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, profile, preset, range, customFrom, customTo]);

  useEffect(() => {
    if (!open) {
      setPreset("all");
      setCustomFrom("");
      setCustomTo("");
      setTotals(null);
      setGeneratedAt(null);
    }
  }, [open]);

  if (!profile) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader className="report-no-print">
          <DialogTitle>Account report — {profile.username}</DialogTitle>
        </DialogHeader>

        <div className="report-no-print flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[10rem]">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Time frame
            </label>
            <Select value={preset} onValueChange={(v) => setPreset(v as Preset)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PRESET_LABEL) as Preset[]).map((p) => (
                  <SelectItem key={p} value={p}>
                    {PRESET_LABEL[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {preset === "custom" && (
            <>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  From
                </label>
                <Input
                  type="date"
                  className="mt-1"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  To
                </label>
                <Input
                  type="date"
                  className="mt-1"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                />
              </div>
            </>
          )}
          <Button className="gap-2" disabled={!totals || loading} onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print / Export PDF
          </Button>
        </div>

        {loading && <p className="text-sm text-muted-foreground">Loading report…</p>}

        {totals && (
          <div className="report-print-area rounded-2xl border border-border bg-card p-6 print:border-0 print:bg-white print:p-0 print:text-black">
            <div className="flex items-center justify-between border-b border-border pb-4 print:border-black/20">
              <div className="flex items-center gap-3">
                <img src={betrixLogo} alt="Betrix" className="h-10 w-10" />
                <div>
                  <p className="text-lg font-black text-foreground print:text-black">TheBetrix</p>
                  <p className="text-xs text-muted-foreground print:text-black/60">
                    Player account report
                  </p>
                </div>
              </div>
              <p className="text-right text-xs text-muted-foreground print:text-black/60">
                Generated {generatedAt ? formatDateTime(generatedAt) : ""}
                <br />
                Period: {PRESET_LABEL[preset]}
              </p>
            </div>

            <div className="mt-4 grid gap-1 text-sm">
              <p className="font-bold text-foreground print:text-black">{profile.username}</p>
              <p className="text-muted-foreground print:text-black/60">{profile.email}</p>
              <p className="text-muted-foreground print:text-black/60">{profile.accountId}</p>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <ReportStat label="Recharged" value={formatCurrency(totals.recharged)} />
              <ReportStat label="Won" value={formatCurrency(totals.won)} tone="positive" />
              <ReportStat label="Lost" value={formatCurrency(totals.lost)} tone="negative" />
              <ReportStat label="Current balance" value={formatCurrency(profile.balance)} />
            </div>

            <h3 className="mb-2 mt-8 text-sm font-bold uppercase tracking-wider text-muted-foreground print:text-black">
              Withdrawal transactions
            </h3>
            {totals.withdrawals.length === 0 ? (
              <p className="text-sm text-muted-foreground print:text-black/60">
                No cash-out requests in this period.
              </p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-muted-foreground print:text-black/60">
                  <tr>
                    <th className="py-1 pr-3 font-semibold">Date</th>
                    <th className="py-1 pr-3 font-semibold">Amount</th>
                    <th className="py-1 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border print:divide-black/10">
                  {totals.withdrawals.map((w) => (
                    <tr key={w.id}>
                      <td className="py-1.5 pr-3 text-muted-foreground print:text-black/70">
                        {formatDate(w.createdAt)}
                      </td>
                      <td className="py-1.5 pr-3 font-semibold text-foreground print:text-black">
                        {formatCurrency(w.amount)}
                      </td>
                      <td className="py-1.5 text-foreground print:text-black">
                        {WITHDRAWAL_STATUS_LABEL[w.status] ?? w.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <p className="mt-8 text-[11px] text-muted-foreground print:text-black/50">
              Recharged = admin/agent top-ups credited directly to this wallet. Won/Lost are totaled
              from casino round outcomes for the selected period. Current balance is the live wallet
              balance as of report generation, not scoped to the period above.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReportStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground print:text-black/60">{label}</p>
      <p
        className={
          tone === "positive"
            ? "text-lg font-black text-primary print:text-black"
            : tone === "negative"
              ? "text-lg font-black text-destructive print:text-black"
              : "text-lg font-black text-foreground print:text-black"
        }
      >
        {value}
      </p>
    </div>
  );
}
