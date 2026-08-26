import { Link } from "@tanstack/react-router";
import { User, Wallet } from "lucide-react";
import { useWallet } from "@/lib/wallet-store";
import { useAuth } from "@/lib/auth-context";
import { useProfile } from "@/lib/profile-store";
import { formatCurrency } from "@/lib/format";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import betrixLogo from "@/assets/betrix-mark.png";

export function Header() {
  const { balance } = useWallet();
  const { user, loading } = useAuth();
  const { avatarUrl, username } = useProfile();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-3 sm:px-4 lg:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-4 lg:gap-8">
          <Link
            to="/"
            className="flex shrink-0 items-center gap-2 text-xl font-black tracking-tight sm:text-2xl"
          >
            <img
              src={betrixLogo}
              alt="TheBetrix logo"
              width={40}
              height={40}
              className="h-9 w-9 rounded-lg object-contain shadow-lg shadow-black/30 ring-1 ring-white/10 sm:h-10 sm:w-10"
            />
            <span className="inline bg-gradient-to-r from-primary to-betrix-green-dim bg-clip-text text-transparent drop-shadow-sm">
              TheBetrix
            </span>
          </Link>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1.5 sm:flex">
            <Wallet className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">{formatCurrency(balance)}</span>
          </div>

          {!loading && !user ? (
            <div className="hidden items-center gap-2 sm:flex">
              <Link
                to="/login"
                className="rounded-full px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:text-primary"
              >
                Log in
              </Link>
              <Link
                to="/register"
                className="rounded-full border border-border bg-secondary px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-betrix-surface-elevated"
              >
                Sign up
              </Link>
            </div>
          ) : null}

          <Link
            to={user ? "/account" : "/login"}
            className="inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary text-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:h-10 sm:w-10"
            aria-label="Account"
          >
            {user && avatarUrl ? (
              <Avatar className="h-full w-full">
                <AvatarImage src={avatarUrl} alt={username ?? "avatar"} />
                <AvatarFallback className="bg-transparent">
                  <User className="h-4 w-4 sm:h-5 sm:w-5" />
                </AvatarFallback>
              </Avatar>
            ) : (
              <User className="h-4 w-4 sm:h-5 sm:w-5" />
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
