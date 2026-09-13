import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, Search } from "lucide-react";
import { fetchAgentCommissionReport, type AgentCommissionRow } from "@/lib/agent-hierarchy";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Preset = "previous_month" | "current_month" | "custom";

const PRESET_LABEL: Record<Preset, string> = {
  previous_month: "Previous month",
  current_month: "Current month to date",
  custom: "Custom range",
};

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

interface CommissionRange {
  from: string;
  to: string;
}

function presetToRange(
  preset: Preset,
  customFrom: string,
  customTo: string,
): CommissionRange | null {
  const now = new Date();
  if (preset === "previous_month") {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: startOfDay(from).toISOString(), to: endOfDay(to).toISOString() };
  }
  if (preset === "current_month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: startOfDay(from).toISOString(), to: now.toISOString() };
  }
  if (!customFrom || !customTo) return null;
  return {
    from: startOfDay(new Date(`${customFrom}T00:00:00`)).toISOString(),
    to: endOfDay(new Date(`${customTo}T00:00:00`)).toISOString(),
  };
}

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

// Shared between the ultra_admin dashboard's "Commissions" tab (scope="all"
// - every agent, searchable, with summary KPI cards) and each agent's own
// dashboard (scope="self" - just their own row, no search box, but the
// same filters/table/export). See get_agent_commission_report in
// 20260913000000_agent_commission_report.sql for how the RPC itself
// decides which rows come back.
export function CommissionReport({ scope }: { scope: "all" | "self" }) {
  const [preset, setPreset] = useState<Preset>("previous_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<AgentCommissionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const range = useMemo(
    () => presetToRange(preset, customFrom, customTo),
    [preset, customFrom, customTo],
  );

  useEffect(() => {
    if (!range) return;
    let cancelled = false;
    setLoading(true);
    fetchAgentCommissionReport(range)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : "Failed to load commission report");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  const filteredRows = useMemo(() => {
    if (scope === "self" || query.trim() === "") return rows;
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        r.agentAccountId.toLowerCase().includes(q) || r.agentUsername.toLowerCase().includes(q),
    );
  }, [rows, query, scope]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          turnover: acc.turnover + r.totalTurnover,
          payouts: acc.payouts + r.totalPayouts,
          ggr: acc.ggr + r.ggr,
          commission: acc.commission + r.commissionOwed,
        }),
        { turnover: 0, payouts: 0, ggr: 0, commission: 0 },
      ),
    [rows],
  );

  function exportCsv() {
    if (!range) return;
    const header = [
      "Agent Code",
      "Agent Name",
      "Active Players",
      "Total Bets",
      "Turnover",
      "Payouts",
      "GGR",
      "Hold %",
      "Commission Rate",
      "Commission Owed",
    ];
    const lines = [header.join(",")];
    for (const r of filteredRows) {
      lines.push(
        [
          csvEscape(r.agentAccountId),
          csvEscape(r.agentUsername),
          String(r.activePlayers),
          String(r.totalBets),
          r.totalTurnover.toFixed(2),
          r.totalPayouts.toFixed(2),
          r.ggr.toFixed(2),
          `${r.holdPercentage.toFixed(2)}%`,
          `${Math.round(r.commissionRate * 100)}%`,
          r.commissionOwed.toFixed(2),
        ].join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agent_commission_report_${range.from.slice(0, 10)}_to_${range.to.slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[12rem]">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Period
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
        {scope === "all" && (
          <label className="relative flex min-w-[14rem] flex-1 items-center">
            <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search agent code or name"
              className="pl-9"
            />
          </label>
        )}
        <Button
          variant="outline"
          className="gap-2"
          disabled={!range || filteredRows.length === 0}
          onClick={exportCsv}
        >
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {scope === "all" && (
        <div className="grid gap-4 sm:grid-cols-4">
          <SummaryCard label="Total turnover" value={formatCurrency(totals.turnover)} />
          <SummaryCard label="Total payouts" value={formatCurrency(totals.payouts)} />
          <SummaryCard label="Total GGR" value={formatCurrency(totals.ggr)} />
          <SummaryCard
            label="Total commission payable"
            value={formatCurrency(totals.commission)}
            highlight
          />
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[60rem] text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Agent</th>
              <th className="px-4 py-3 text-right font-semibold">Active players</th>
              <th className="px-4 py-3 text-right font-semibold">Bets</th>
              <th className="px-4 py-3 text-right font-semibold">Turnover</th>
              <th className="px-4 py-3 text-right font-semibold">Payouts</th>
              <th className="px-4 py-3 text-right font-semibold">GGR</th>
              <th className="px-4 py-3 text-right font-semibold">Hold %</th>
              <th className="px-4 py-3 text-right font-semibold">Rate</th>
              <th className="px-4 py-3 text-right font-semibold">Commission owed</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && filteredRows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-muted-foreground">
                  No agent activity in this period.
                </td>
              </tr>
            )}
            {!loading &&
              filteredRows.map((r) => (
                <tr key={r.agentId} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-foreground">{r.agentUsername}</p>
                    <p className="text-xs text-muted-foreground">{r.agentAccountId}</p>
                  </td>
                  <td className="px-4 py-3 text-right text-foreground">
                    {r.activePlayers.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-foreground">
                    {r.totalBets.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-foreground">
                    {formatCurrency(r.totalTurnover)}
                  </td>
                  <td className="px-4 py-3 text-right text-foreground">
                    {formatCurrency(r.totalPayouts)}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 text-right font-semibold",
                      r.ggr >= 0 ? "text-foreground" : "text-destructive",
                    )}
                  >
                    {formatCurrency(r.ggr)}
                  </td>
                  <td className="px-4 py-3 text-right text-foreground">
                    {r.holdPercentage.toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {Math.round(r.commissionRate * 100)}%
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-primary">
                    {formatCurrency(r.commissionOwed)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-2 text-2xl font-black", highlight ? "text-primary" : "text-foreground")}>
        {value}
      </p>
    </div>
  );
}
