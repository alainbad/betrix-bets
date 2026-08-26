import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface MasterCodeStatus {
  configured: boolean;
  updatedAt: string | null;
}

// ultra_admin-only: create or rotate the shared master code that gates
// suspend_user for every hierarchy tier (see
// 20260827030000_user_suspension_master_code.sql). Whoever holds this code
// - not just whoever's logged in as ultra_admin at the time - can confirm a
// suspension, so treat rotating it the same as changing a shared password.
export function MasterCodeSettings() {
  const [status, setStatus] = useState<MasterCodeStatus | null>(null);
  const [newCode, setNewCode] = useState("");
  const [saving, setSaving] = useState(false);

  async function reload() {
    const { data, error } = await supabase.rpc("suspension_master_code_status");
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data) {
      setStatus({ configured: false, updatedAt: null });
      return;
    }
    const result = data as { configured: boolean; updated_at: string | null };
    setStatus({ configured: result.configured, updatedAt: result.updated_at });
  }

  useEffect(() => {
    void reload();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newCode.trim().length < 6) {
      toast.error("Master code must be at least 6 characters");
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("set_suspension_master_code", {
      p_new_code: newCode.trim(),
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(status?.configured ? "Master code updated" : "Master code created");
    setNewCode("");
    void reload();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-3 rounded-2xl border border-border bg-card p-5 sm:grid-cols-[2fr_auto] sm:items-end"
    >
      <div>
        <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <KeyRound className="h-3.5 w-3.5" />
          {status?.configured ? "Rotate suspension master code" : "Create suspension master code"}
        </label>
        <Input
          value={newCode}
          onChange={(e) => setNewCode(e.target.value)}
          type="password"
          autoComplete="off"
          placeholder="At least 6 characters"
          className="mt-1"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          {status?.configured
            ? `Currently set - last updated ${status.updatedAt ? formatDateTime(status.updatedAt) : "unknown"}. Share this code only with staff trusted to suspend accounts.`
            : "Not set yet - ultra_admin, super_agent and agent can't suspend anyone until a master code exists."}
        </p>
      </div>
      <Button type="submit" disabled={saving}>
        {saving ? "Saving…" : status?.configured ? "Rotate code" : "Set code"}
      </Button>
    </form>
  );
}
