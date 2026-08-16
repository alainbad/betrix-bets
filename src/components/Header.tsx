import { Link } from "@tanstack/react-router";
import { Ticket, User, Wallet } from "lucide-react";
import { useBetting } from "@/lib/betting-store";
import { formatCurrency } from "@/lib/format";
import betrixLogo from "@/assets/betrix-logo.png";

export function Header() {
  const { balance, slip } = useBetting();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 lg:gap-8">
          <Link to="/" className="flex items-center gap-2 text-2xl font-black tracking-tight text-foreground">
            <img src={betrixLogo} alt="Betrix logo" width={36} height={36} className="h-9 w-9 object-contain" />
            Betrix
          </Link>
          <nav className="hidden items-center md:flex">
            <TopTab to="/sports" label="Sports" />
            <TopTab to="/live" label="Live" />
            <TopTab to="/casino" label="Casino" />
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1.5 sm:flex">
            <Wallet className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">{formatCurrency(balance)}</span>
          </div>

          <Link
            to="/bet-slip"
            className="relative inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:scale-105 active:scale-95"
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
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-secondary text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            aria-label="Account"
          >
            <User className="h-5 w-5" />
          </Link>
        </div>
      </div>

      <div className="border-t border-border md:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-2">
          <TopTab to="/sports" label="Sports" mobile />
          <TopTab to="/live" label="Live" mobile />
          <TopTab to="/casino" label="Casino" mobile />
        </div>
      </div>
    </header>
  );
}

function TopTab({ to, label, mobile = false }: { to: string; label: string; mobile?: boolean }) {
  return (
    <Link
      to={to}
      activeProps={{
        className: mobile
          ? "border-b-2 border-primary text-primary bg-primary/10"
          : "border-b-2 border-primary text-primary bg-primary/10",
      }}
      inactiveProps={{
        className: "border-b-2 border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50",
      }}
      className={`inline-flex items-center justify-center font-semibold transition-colors ${
        mobile
          ? "h-11 flex-1 px-2 text-sm"
          : "h-14 px-5 text-sm lg:px-7 lg:text-base"
      }`}
    >
      {label}
    </Link>
  );
}
