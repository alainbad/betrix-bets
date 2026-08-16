import { Link } from "@tanstack/react-router";

export function Footer() {
  return (
    <footer className="border-t border-border bg-betrix-surface">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-lg font-black tracking-tight text-foreground">Betrix</p>
            <p className="mt-2 max-w-xs text-xs leading-relaxed text-muted-foreground">
              A sportsbook and casino simulation platform. Virtual credits have no monetary value and cannot be purchased,
              withdrawn or exchanged.
            </p>
          </div>
          <FooterCol title="Sportsbook">
            <FooterLink to="/sports">All sports</FooterLink>
            <FooterLink to="/live">Live betting</FooterLink>
            <FooterLink to="/bet-slip">Bet slip</FooterLink>
          </FooterCol>
          <FooterCol title="Casino">
            <FooterLink to="/casino">Game lobby</FooterLink>
            <FooterLink to="/account">Round history</FooterLink>
          </FooterCol>
          <FooterCol title="Account">
            <FooterLink to="/account">Dashboard</FooterLink>
            <FooterLink to="/admin">Operator console</FooterLink>
          </FooterCol>
        </div>
        <p className="mt-10 border-t border-border pt-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Betrix. Simulation platform for entertainment purposes only. 18+.
        </p>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</p>
      <ul className="space-y-2 text-sm">{children}</ul>
    </div>
  );
}

function FooterLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <li>
      <Link to={to} className="text-muted-foreground transition-colors hover:text-foreground">
        {children}
      </Link>
    </li>
  );
}
