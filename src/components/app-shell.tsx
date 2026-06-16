import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Users, ClipboardList, FileText, FileSignature, Settings, LogOut, Bug, Plus, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";

const navItems = [
  { to: "/", label: "Accueil", icon: LayoutDashboard, exact: true },
  { to: "/clients", label: "Clients", icon: Users },
  { to: "/interventions", label: "Terrain", icon: ClipboardList },
  { to: "/stock", label: "Stock", icon: Package },
  { to: "/factures", label: "Factures", icon: FileText },
  { to: "/contrats", label: "Contrats", icon: FileSignature },
];

const FAB_ACTIONS = [
  { label: "Intervention", to: "/interventions/new", color: "bg-primary" },
  { label: "Client", to: "/clients/new", color: "bg-primary/80" },
  { label: "Facture", to: "/factures/new", color: "bg-accent" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [fabOpen, setFabOpen] = useState(false);

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.success("Déconnecté");
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Header premium */}
      <header
        className="sticky top-0 z-30 header-gradient text-primary-foreground"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-3 min-w-0">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-accent shadow-lg shadow-accent/30">
              <Bug className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-base font-bold tracking-tight leading-none">CITY DERAT</div>
              <div className="truncate text-[10px] uppercase tracking-widest text-primary-foreground/60 mt-0.5">
                Dératisation · Désinsectisation
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-1 shrink-0">
            <Link
              to="/parametres"
              className="grid h-9 w-9 place-items-center rounded-xl hover:bg-white/10 transition-colors"
              aria-label="Paramètres"
            >
              <Settings className="h-5 w-5" />
            </Link>
            <button
              onClick={handleSignOut}
              className="grid h-9 w-9 place-items-center rounded-xl hover:bg-white/10 transition-colors"
              aria-label="Déconnexion"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 pb-28">
        <div className="mx-auto max-w-3xl px-4 py-5 animate-in-up">
          {children}
        </div>
      </main>

      {/* FAB — bouton d'action rapide */}
      <div className="fixed bottom-20 right-4 z-40 flex flex-col-reverse items-end gap-2">
        {fabOpen && (
          <>
            {FAB_ACTIONS.map((action) => (
              <Link
                key={action.to}
                to={action.to as any}
                onClick={() => setFabOpen(false)}
                className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-all animate-in-up ${action.color}`}
              >
                <Plus className="h-4 w-4" />
                {action.label}
              </Link>
            ))}
            <div
              className="fixed inset-0 -z-10"
              onClick={() => setFabOpen(false)}
            />
          </>
        )}
        <button
          onClick={() => setFabOpen((v) => !v)}
          className="fab"
          aria-label="Actions rapides"
          style={{ position: "relative", bottom: "auto", right: "auto" }}
        >
          <Plus
            className="h-6 w-6 transition-transform duration-200"
            style={{ transform: fabOpen ? "rotate(45deg)" : "rotate(0deg)" }}
          />
        </button>
      </div>

      {/* Bottom navigation premium */}
      <nav
        className="fixed bottom-0 inset-x-0 z-30 bg-card border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
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
                className={`relative flex flex-col items-center justify-center gap-1 py-3 text-[10px] font-medium transition-all ${
                  active
                    ? "text-accent nav-active"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className={`grid h-8 w-8 place-items-center rounded-xl transition-all ${
                  active ? "bg-accent/10" : ""
                }`}>
                  <Icon className={`h-5 w-5 transition-all ${active ? "stroke-[2.5]" : ""}`} />
                </div>
                <span className={active ? "font-semibold" : ""}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
