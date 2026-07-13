// Shell dédié aux techniciens — indépendant de app-shell.tsx.
// Volontairement minimal : 3 entrées de navigation, aucun accès aux pages
// admin (recherche, FAB de création, menu "Plus", paramètres, factures…).
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, ClipboardList, Truck, LogOut, Bug } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSettings, useMyTodoCount } from "@/lib/queries";

const techNavItems = [
  { to: "/tech", label: "Ma journée", icon: LayoutDashboard, exact: true },
  { to: "/tech/chantiers", label: "Mes chantiers", icon: ClipboardList },
  { to: "/tech/camion", label: "Mon camion", icon: Truck },
] as const;

export function TechShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: settings } = useSettings();
  const { data: todoCount = 0 } = useMyTodoCount();

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut({ scope: "local" });
    toast.success("Déconnecté");
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header
        className="sticky top-0 z-30 header-gradient text-primary-foreground"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-accent shadow-lg shadow-accent/30 overflow-hidden">
              {settings?.logo_url
                ? <img src={settings.logo_url} alt="Logo" className="h-full w-full object-contain" />
                : <Bug className="h-5 w-5 text-white" />}
            </div>
            <div className="min-w-0">
              <div className="truncate text-base font-bold tracking-tight leading-none">{settings?.nom ?? "CITY DERAT"}</div>
              <div className="truncate text-[10px] uppercase tracking-widest text-primary-foreground/60 mt-0.5">
                Espace technicien
              </div>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl hover:bg-white/10 transition-colors"
            aria-label="Déconnexion"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 pb-24">
        <div className="mx-auto max-w-3xl px-4 py-5 animate-in-up">
          {children}
        </div>
      </main>

      <nav
        className="fixed bottom-0 inset-x-0 z-30 bg-card border-t border-border"
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
          boxShadow: "0 -4px 24px rgba(0,0,0,0.08), 0 -1px 4px rgba(0,0,0,0.04)",
        }}
      >
        <div className="mx-auto grid max-w-3xl grid-cols-3">
          {techNavItems.map((item) => {
            const Icon = item.icon;
            const active = item.exact
              ? location.pathname === item.to
              : location.pathname === item.to || location.pathname.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`relative flex flex-col items-center justify-center gap-0.5 py-2.5 text-[9px] font-medium transition-all ${
                  active ? "text-accent nav-active" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className={`relative grid h-8 w-8 place-items-center rounded-xl transition-all duration-200 ${active ? "bg-accent/12 scale-105" : ""}`}>
                  <Icon className={`h-[18px] w-[18px] transition-all ${active ? "stroke-[2.5]" : "stroke-[1.8]"}`} />
                  {item.to === "/tech/chantiers" && todoCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                      {todoCount}
                    </span>
                  )}
                </div>
                <span className={active ? "font-bold" : ""}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
