import { useState } from "react";
import { useAuth } from "@/lib/auth-context";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29A11.96 11.96 0 000 12c0 1.93.46 3.76 1.29 5.38l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.39-1.94 2.77-3.43 2.79-1.443.03-1.937-.86-3.61-.86-1.673 0-2.22.83-3.586.89-1.443.06-2.55-1.5-3.51-2.87-1.936-2.8-3.417-7.92-1.426-11.38.986-1.72 2.75-2.81 4.66-2.84 1.417-.03 2.75.95 3.61.95.86 0 2.48-1.18 4.18-1 .71.03 2.71.29 4 2.16-.104.06-2.39 1.4-2.37 4.17.03 3.31 2.9 4.41 2.93 4.43z" />
    </svg>
  );
}

// Shared by login.tsx (no referralCode - existing accounts only, see
// auth.callback.tsx) and register.tsx (referralCode required - the account
// is brand new and mandatory-referral still applies, just via a claim
// redeemed after the OAuth redirect instead of upfront signup metadata).
export function OAuthButtons({
  referralCode,
  onError,
}: {
  referralCode?: string;
  onError: (message: string) => void;
}) {
  const { signInWithOAuth } = useAuth();
  const [pending, setPending] = useState<"google" | "apple" | null>(null);
  const needsCode = referralCode !== undefined && referralCode.trim() === "";

  async function handleClick(provider: "google" | "apple") {
    setPending(provider);
    const result = await signInWithOAuth(provider, referralCode?.trim() || undefined);
    if (result.error) {
      onError(result.error);
      setPending(null);
    }
    // On success the browser navigates away to the provider - nothing left
    // to reset here.
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Or continue with
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => handleClick("google")}
          disabled={needsCode || pending !== null}
          className="flex items-center justify-center gap-2 rounded-lg border border-border bg-secondary py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary/70 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <GoogleIcon className="h-4 w-4" />
          {pending === "google" ? "Redirecting…" : "Google"}
        </button>
        <button
          type="button"
          onClick={() => handleClick("apple")}
          disabled={needsCode || pending !== null}
          className="flex items-center justify-center gap-2 rounded-lg border border-border bg-secondary py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary/70 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <AppleIcon className="h-4 w-4" />
          {pending === "apple" ? "Redirecting…" : "Apple"}
        </button>
      </div>
      {needsCode && (
        <p className="text-center text-xs text-muted-foreground">
          Enter your agent referral code above to continue with Google or Apple.
        </p>
      )}
    </div>
  );
}
