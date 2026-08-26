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

// ultra_admin-only: sets a temporary password directly for an account via
// the admin-reset-password Edge Function (service-role, Auth Admin API) -
// see that function for why this exists instead of relying on the email
// reset flow. No master code needed here (unlike suspend_user) - this is a
// support action, not one with financial/adversarial stakes.
export function AdminResetPasswordDialog({
  open,
  targetUsername,
  targetAccountId,
  onClose,
}: {
  open: boolean;
  targetUsername: string | undefined;
  targetAccountId: string | undefined;
  onClose: () => void;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setNewPassword("");
      onClose();
    }
  }

  async function handleConfirm() {
    if (!targetAccountId) return;
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("admin-reset-password", {
      body: { target_identifier: targetAccountId, new_password: newPassword },
    });
    setSubmitting(false);

    const result = data as { ok: boolean; error?: string } | null;
    if (error || !result?.ok) {
      toast.error(result?.error ?? error?.message ?? "Failed to reset password");
      return;
    }

    toast.success(
      `Password reset for ${targetUsername ?? "account"} - share it with them securely`,
    );
    setNewPassword("");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password for {targetUsername}</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Sets a new password directly, bypassing the email reset flow. Share it with the account
          holder yourself - they can change it again once logged in.
        </p>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            New temporary password
          </label>
          <Input
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            type="text"
            autoComplete="off"
            placeholder="At least 6 characters"
            className="mt-1"
          />
        </div>

        <DialogFooter>
          <Button onClick={handleConfirm} disabled={submitting}>
            {submitting ? "Resetting…" : "Reset password"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
