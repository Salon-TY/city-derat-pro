import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, ClipboardList, FileText, FileSignature,
  Settings, LogOut, Bug, Plus, Package, Search, X, TrendingUp, FileCheck
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState, useEffect, useRef } from "react";
import { db } from "@/lib/db";
import { formatEUR, formatDateFR, TYPES_INTERVENTION } from "@/lib/schemas";
import { useClients, useSettings } from "@/lib/queries";

const navItems = [
  { to: "/", label: "Accueil", icon: LayoutDashboard, exact: true },
  { to: "/clients", label: "Clients", icon: Users },
  { to: "/interventions", label: "Terrain", icon: ClipboardList },
  { to: "/tresorerie", label: "Tréso", icon: TrendingUp },
  { to: "/stock", label: "Stock", icon: Package },
  { to: "/factures", label: "Factures", icon: FileText },
  { to: "/devis", label: "Devis", icon: FileCheck },
  { to: "/contrats", label: "Contrats", icon: FileSignature },
];

type SearchResult = {
  type: "client" | "facture" | "intervention";
  id: string;
  label: string;
  sub: string;
  href: string;
};

function GlobalSearch({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const term = q.trim().toLowerCase();
        const [clients, factures, interventions] = await Promise.all([
          db.from("clients").select("id, raison_sociale, adresse_site, telephone").ilike("raison_sociale", `%${term}%`).limit(5),
          db.from("invoices").select("id, numero, total_ttc, statut, client:clients(raison_sociale)").or(`numero.eq.${Number(term) || 0}`).limit(5),
          db.from("interventions").select("id, date, adresse_site, client:clients(raison_sociale)").or(`adresse_site.ilike.%${term}%`).limit(5),
        ]);

        // Also search factures by client name
        const facturesClient = await db
          .from("invoices")
          .select("id, numero, total_ttc, statut, client:clients(raison_sociale)")
          .limit(5);

        const out: SearchResult[] = [];

        for (const c of clients.data ?? []) {
          out.push({
            type: "client",
            id: c.id,
            label: c.raison_sociale,
            sub: c.adresse_site ?? c.telephone ?? "",
            href: `/clients/${c.id}`,
          });
        }

        const seenFac = new Set<string>();
        for (const f of [...(factures.data ?? []), ...(facturesClient.data ?? [])]) {
          if (seenFac.has(f.id)) continue;
          const clientName = (f.client as any)?.raison_sociale ?? "";
          if (!clientName.toLowerCase().includes(term) && !String(f.numero).includes(term)) continue;
          seenFac.add(f.id);
          out.push({
            type: "facture",
            id: f.id,
            label: `Facture N°${f.numero} — ${formatEUR(f.total_ttc)}`,
            sub: clientName,
            href: `/factures/${f.id}`,
          });
        }

        for (const i of interventions.data ?? []) {
          out.push({
            type: "intervention",
            id: i.id,
            label: (i.client as any)?.raison_sociale ?? "—",
            sub: `${formatDateFR(i.date)}${i.adresse_site ? ` · ${i.adresse_site}` : ""}`,
            href: `/interventions/${i.id}`,
          });
        }

        setResults(out.slice(0, 15));
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  function go(href: string) {
    navigate({ to: href as any });
    onClose();
  }

  const TYPE_ICON: Record<string, string> = {
    client: "👤",
    facture: "🧾",
    intervention: "🔧",
  };

  const TYPE_LABEL: Record<string, string> = {
    client: "Clients",
    facture: "Factures",
    intervention: "Interventions",
  };

  const groups = ["client", "facture", "intervention"] as const;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col items-center pt-16 px-4" onClick={onClose}>
      <div className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="rounded-2xl bg-card shadow-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher un client, une facture, une intervention…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              onKeyDown={(e) => e.key === "Escape" && onClose()}
            />
            {q && (
              <button onClick={() => setQ("")} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {loading && (
              <div className="py-6 text-center text-sm text-muted-foreground">Recherche…</div>
            )}
            {!loading && q.trim() && results.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">Aucun résultat pour « {q} »</div>
            )}
            {!loading && !q.trim() && (
              <div className="py-6 text-center text-sm text-muted-foreground">Tapez pour chercher…</div>
            )}
            {!loading && results.length > 0 && (
              <div className="py-2">
                {groups.map((type) => {
                  const items = results.filter((r) => r.type === type);
                  if (!items.length) return null;
                  return (
                    <div key={type}>
                      <div className="px-4 py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                        {TYPE_LABEL[type]}
                      </div>
                      {items.map((r) => (
                        <button
                          key={r.id}
                          onClick={() => go(r.href)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted transition-colors text-left"
                        >
                          <span className="text-base">{TYPE_ICON[r.type]}</span>
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{r.label}</div>
                            {r.sub && <div className="text-xs text-muted-foreground truncate">{r.sub}</div>}
                          </div>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div className="mt-2 text-center text-xs text-white/60">Échap pour fermer</div>
      </div>
    </div>
  );
}

function localDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function QuickInterventionModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { data: clients = [] } = useClients();
  const [clientId, setClientId] = useState("");
  const [type, setType] = useState<string>(TYPES_INTERVENTION[0]);
  const [date, setDate] = useState(localDateStr(new Date()));
  const [saving, setSaving] = useState(false);
  const [showMore, setShowMore] = useState(false);

  async function handleCreate() {
    if (!clientId) { toast.error("Sélectionnez un client"); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await db.from("interventions").insert({
        user_id: user.id,
        client_id: clientId,
        date,
        type_intervention: type,
        statut: "planifiee",
        adresse_site: "",
        type_nuisible: "",
        produits: "",
        quantite: "",
        observations: "",
      }).select().single();
      if (error) { toast.error(error.message); return; }
      toast.success("Intervention créée");
      onClose();
      navigate({ to: "/interventions/$id", params: { id: data.id } });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-card shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-bold text-base">Intervention rapide</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Client *</label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">Sélectionner un client…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.raison_sociale}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Type</label>
            <div className="flex gap-2">
              {TYPES_INTERVENTION.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex-1 rounded-lg border py-2 text-xs font-medium transition-colors ${type === t ? "bg-accent border-accent text-white" : "border-border text-muted-foreground hover:border-accent/50"}`}
                >
                  {t === "Les deux" ? "Les 2" : t}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={saving || !clientId}
            className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving ? "Création…" : "Créer en 1 clic"}
          </button>
          <div className="border-t pt-3 space-y-2">
            <button
              onClick={() => setShowMore((v) => !v)}
              className="text-xs text-muted-foreground hover:text-foreground w-full text-center"
            >
              Plus d'options {showMore ? "▲" : "▼"}
            </button>
            {showMore && (
              <div className="space-y-2">
                {[
                  { label: "Intervention complète", to: "/interventions/new", color: "bg-primary/10 text-primary" },
                  { label: "Nouveau client", to: "/clients/new", color: "bg-primary/10 text-primary" },
                  { label: "Nouvelle facture", to: "/factures/new", color: "bg-accent/10 text-accent" },
                  { label: "Nouveau devis", to: "/devis/new", color: "bg-accent/10 text-accent" },
                ].map((a) => (
                  <Link
                    key={a.to}
                    to={a.to as any}
                    onClick={onClose}
                    className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${a.color} hover:opacity-80`}
                  >
                    <Plus className="h-4 w-4" /> {a.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [fabOpen, setFabOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { data: settings } = useSettings();

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut({ scope: "local" });
    toast.success("Déconnecté");
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}
      {fabOpen && <QuickInterventionModal onClose={() => setFabOpen(false)} />}

      {/* Header premium */}
      <header
        className="sticky top-0 z-30 header-gradient text-primary-foreground"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-3 min-w-0">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-accent shadow-lg shadow-accent/30 overflow-hidden">
              {settings?.logo_url
                ? <img src={settings.logo_url} alt="Logo" className="h-full w-full object-contain" />
                : <Bug className="h-5 w-5 text-white" />}
            </div>
            <div className="min-w-0">
              <div className="truncate text-base font-bold tracking-tight leading-none">{settings?.nom ?? "CITY DERAT"}</div>
              <div className="truncate text-[10px] uppercase tracking-widest text-primary-foreground/60 mt-0.5">
                Dératisation · Désinsectisation
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setSearchOpen(true)}
              className="grid h-9 w-9 place-items-center rounded-xl hover:bg-white/10 transition-colors"
              aria-label="Recherche"
            >
              <Search className="h-5 w-5" />
            </button>
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

      {/* FAB — intervention rapide */}
      <div className="fixed bottom-20 right-4 z-40">
        <button
          onClick={() => setFabOpen(true)}
          className="fab"
          aria-label="Intervention rapide"
          style={{ position: "relative", bottom: "auto", right: "auto" }}
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>

      {/* Bottom navigation premium */}
      <nav
        className="fixed bottom-0 inset-x-0 z-30 bg-card border-t border-border"
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
          boxShadow: "0 -4px 24px rgba(0,0,0,0.08), 0 -1px 4px rgba(0,0,0,0.04)",
        }}
      >
        <div className="mx-auto grid max-w-3xl grid-cols-8">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.exact
              ? location.pathname === item.to
              : location.pathname === item.to || location.pathname.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to as any}
                className={`relative flex flex-col items-center justify-center gap-0.5 py-2.5 text-[9px] font-medium transition-all ${
                  active
                    ? "text-accent nav-active"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className={`grid h-8 w-8 place-items-center rounded-xl transition-all duration-200 ${
                  active ? "bg-accent/12 scale-105" : ""
                }`}>
                  <Icon className={`h-[18px] w-[18px] transition-all ${active ? "stroke-[2.5]" : "stroke-[1.8]"}`} />
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
