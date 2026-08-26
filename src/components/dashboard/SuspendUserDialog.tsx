import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

// The master-code confirmation gate for suspend_user - see
// 20260827030000_user_suspension_master_code.sql. Every hierarchy tier
// (ultra_admin/super_agent/agent) uses this same dialog; the RPC itself
// enforces who's allowed to reach the target account.
export function SuspendUserDialog({
  open,
  targetUsername,
  targetAccountId,
  onClose,
  onDone,
}: {
  open: boolean;
  targetUsername: string | undefined;
  targetAccountId: string | undefined;
  onClose: () => void;
  onDone: () => void;
}) {
  const [masterCode, setMasterCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setMasterCode("");
      onClose();
    }
  }

  async function handleConfirm() {
    if (!targetAccountId) return;
    if (!masterCode.trim()) {
      toast.error("Enter the master code");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.rpc("suspend_user", {
      p_target_identifier: targetAccountId,
      p_master_code: masterCode.trim(),
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${targetUsername ?? "Account"} suspended`);
    setMasterCode("");
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Suspend {targetUsername}?</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          This blocks the account from playing or logging in until it's reactivated. Enter the
          master code to confirm.
        </p>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Master code
          </label>
          <Input
            value={masterCode}
            onChange={(e) => setMasterCode(e.target.value)}
            type="password"
            autoComplete="off"
            placeholder="Enter master code"
            className="mt-1"
          />
        </div>

        <DialogFooter>
          <Button variant="destructive" onClick={handleConfirm} disabled={submitting}>
            {submitting ? "Suspending…" : "Confirm suspension"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
