import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Users, ClipboardList, FileText, FileSignature, Settings, LogOut, Bug } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const navItems: { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }[] = [
  { to: "/", label: "Tableau", icon: LayoutDashboard, exact: true },
  { to: "/clients", label: "Clients", icon: Users },
  { to: "/interventions", label: "Interv.", icon: ClipboardList },
  { to: "/factures", label: "Factures", icon: FileText },
  { to: "/contrats", label: "Contrats", icon: FileSignature },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.success("Déconnecté");
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-primary text-primary-foreground shadow-sm" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 min-w-0">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
              <Bug className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-base font-bold tracking-tight leading-none">CITY DERAT</div>
              <div className="truncate text-[10px] uppercase tracking-wider text-primary-foreground/70 mt-0.5">Dératisation · Désinsectisation</div>
            </div>
          </Link>
          <div className="flex items-center gap-1 shrink-0">
            <Link to="/parametres" className="grid h-9 w-9 place-items-center rounded-lg hover:bg-primary-foreground/10" aria-label="Paramètres">
              <Settings className="h-5 w-5" />
            </Link>
            <button onClick={handleSignOut} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-primary-foreground/10" aria-label="Déconnexion">
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 pb-24">
        <div className="mx-auto max-w-3xl px-4 py-4">{children}</div>
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 z-30 border-t bg-card shadow-[0_-2px_10px_rgba(0,0,0,0.04)]" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="mx-auto grid max-w-3xl grid-cols-5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.exact
              ? location.pathname === item.to
              : location.pathname === item.to || location.pathname.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to as any}
                className={`flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors ${
                  active ? "text-accent" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? "stroke-[2.5]" : ""}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
