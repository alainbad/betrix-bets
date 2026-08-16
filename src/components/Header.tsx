import { Link } from "@tanstack/react-router";
import { Ticket, User, Wallet } from "lucide-react";
import { useBetting } from "@/lib/betting-store";
import { formatCurrency } from "@/lib/format";
import betrixLogo from "@/assets/betrix-logo.png";

export function Header() {
  const { balance, slip } = useBetting();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-3 sm:px-4 lg:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-4 lg:gap-8">
          <Link to="/" className="flex shrink-0 items-center gap-2 text-xl font-black tracking-tight sm:text-2xl">
            <img src={betrixLogo} alt="Betrix logo" width={32} height={32} className="h-8 w-8 object-contain" />
            <span className="hidden bg-gradient-to-r from-primary to-betrix-green-dim bg-clip-text text-transparent drop-shadow-sm sm:inline">
              Betrix
            </span>
          </Link>
          <nav className="flex flex-1 items-center overflow-x-auto no-scrollbar sm:flex-none">
            <TopTab to="/sports" label="Sports" />
            <TopTab to="/live" label="Live" />
            <TopTab to="/casino" label="Casino" />
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1.5 sm:flex">
            <Wallet className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">{formatCurrency(balance)}</span>
          </div>

          <Link
            to="/bet-slip"
            className="relative inline-flex items-center gap-2 rounded-full bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:scale-105 active:scale-95 sm:px-4"
          >
            <Ticket className="h-4 w-4" />
            <span className="hidden sm:inline">Slip</span>
            {slip.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                {slip.length}
              </span>
            )}
          </Link>

          <Link
            to="/account"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-secondary text-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:h-10 sm:w-10"
            aria-label="Account"
          >
            <User className="h-4 w-4 sm:h-5 sm:w-5" />
          </Link>
        </div>
      </div>
    </header>
  );
}

function TopTab({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      activeProps={{ className: "border-b-2 border-primary text-primary bg-primary/10" }}
      inactiveProps={{
        className: "border-b-2 border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50",
      }}
      className="inline-flex h-14 items-center justify-center whitespace-nowrap px-3 text-sm font-semibold transition-colors sm:px-5 lg:px-7 lg:text-base"
    >
      {label}
    </Link>
  );
}
