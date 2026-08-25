import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, XCircle } from "lucide-react";
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

type TransferRpc =
  | "mint_super_agent_balance"
  | "transfer_agent_to_agent"
  | "transfer_agent_to_player"
  | "cashout_player_to_agent";

interface AccountPreview {
  user_id: string;
  username: string;
  role: string;
}

// Shared by the Ultra Admin mint modal, the Super Agent allocate modal, and
// the Agent top-up/cash-out modals: a single "UID, email, or phone" field
// that debounces a call to preview_account so the operator can see who
// they're about to move coins to/from before confirming, then submits the
// same string straight through to whichever RPC's p_target_identifier -
// each of those RPCs resolves it server-side via resolve_account_id and
// re-validates hierarchy/ownership independently of this preview.
export function IdentifierTransferModal({
  open,
  title,
  actionLabel,
  amountLabel,
  rpcName,
  initialIdentifier,
  onClose,
  onDone,
}: {
  open: boolean;
  title: string;
  actionLabel: string;
  amountLabel: string;
  rpcName: TransferRpc;
  initialIdentifier?: string | undefined;
  onClose: () => void;
  onDone: () => void;
}) {
  const [identifier, setIdentifier] = useState(initialIdentifier ?? "");
  const [amount, setAmount] = useState("");
  const [preview, setPreview] = useState<AccountPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setIdentifier(initialIdentifier ?? "");
      setAmount("");
      setPreview(null);
      setPreviewError(null);
    }
    // Only reset when the modal opens, not on every initialIdentifier change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    const trimmed = identifier.trim();
    if (trimmed.length < 3) {
      setPreview(null);
      setPreviewError(null);
      setPreviewLoading(false);
      return;
    }

    setPreviewLoading(true);
    const handle = setTimeout(() => {
      supabase.rpc("preview_account", { p_identifier: trimmed }).then(({ data, error }) => {
        if (error) {
          setPreview(null);
          setPreviewError(error.message);
        } else {
          setPreview(data as AccountPreview);
          setPreviewError(null);
        }
        setPreviewLoading(false);
      });
    }, 400);

    return () => clearTimeout(handle);
  }, [identifier]);

  async function handleSubmit() {
    const trimmedIdentifier = identifier.trim();
    const coins = Number(amount);
    if (!trimmedIdentifier) {
      toast.error("Enter a UID, email, or phone number");
      return;
    }
    if (!Number.isFinite(coins) || coins <= 0) {
      toast.error("Enter a positive coin amount");
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase.rpc(rpcName, {
      p_target_identifier: trimmedIdentifier,
      p_amount: coins,
    });
    setSubmitting(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    const result = data as { new_balance: number };
    toast.success(
      `${actionLabel} ${coins.toLocaleString()} coins - new balance ${result.new_balance.toLocaleString()}`,
    );
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            UID, email, or phone number
          </label>
          <Input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="BET-482910, name@example.com, or +1 555 000 0000"
            className="mt-1"
          />
          <div className="mt-1.5 min-h-[1.25rem] text-xs">
            {previewLoading && <span className="text-muted-foreground">Looking up…</span>}
            {!previewLoading && preview && (
              <span className="inline-flex items-center gap-1.5 font-medium text-primary">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {preview.username} · {preview.role}
              </span>
            )}
            {!previewLoading && previewError && (
              <span className="inline-flex items-center gap-1.5 font-medium text-destructive">
                <XCircle className="h-3.5 w-3.5" />
                {previewError}
              </span>
            )}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {amountLabel}
          </label>
          <Input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            type="number"
            min="1"
            step="1"
            placeholder="1000"
            className="mt-1"
          />
        </div>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Processing…" : actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
