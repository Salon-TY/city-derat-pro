import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useClients } from "@/lib/queries";
import { Plus, Search, Phone, MapPin, ChevronRight, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PermissionGate } from "@/components/permission-gate";

export const Route = createFileRoute("/_app/clients/")({
  head: () => ({ meta: [{ title: "Clients — CITY DERAT" }] }),
  component: () => (
    <PermissionGate perm="clients">
      <ClientsList />
    </PermissionGate>
  ),
});

function ClientsList() {
  const { data: clients = [], isLoading } = useClients();
  const [q, setQ] = useState("");
  const [nuisibleFilter, setNuisibleFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const nuisibleTypes = useMemo(() => {
    const s = new Set(clients.map((c) => c.type_nuisible).filter(Boolean));
    return [...s].sort();
  }, [clients]);

  const activeFiltersCount = [nuisibleFilter !== "all" ? 1 : 0].reduce((a, b) => a + b, 0);

  const filtered = useMemo(() => {
    let list = [...clients];
    const s = q.trim().toLowerCase();
    if (s) {
      list = list.filter((c) =>
        [c.raison_sociale, c.adresse_site, c.telephone, c.email, c.type_nuisible]
          .filter(Boolean)
          .some((v) => v.toLowerCase().includes(s))
      );
    }
    if (nuisibleFilter !== "all") list = list.filter((c) => c.type_nuisible === nuisibleFilter);
    return list;
  }, [clients, q, nuisibleFilter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
        <Button asChild size="sm" className="shrink-0">
          <Link to="/clients/new"><Plus className="mr-1 h-4 w-4" /> Ajouter</Link>
        </Button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un client…" className="pl-9" />
        </div>
        {nuisibleTypes.length > 0 && (
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className={cn(
              "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors",
              filtersOpen || activeFiltersCount > 0
                ? "bg-accent/10 border-accent text-accent"
                : "bg-card border-border text-muted-foreground"
            )}
          >
            <Filter className="h-4 w-4" />
            {activeFiltersCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-white">
                {activeFiltersCount}
              </span>
            )}
          </button>
        )}
      </div>

      {filtersOpen && nuisibleTypes.length > 0 && (
        <Card>
          <CardContent className="p-3 space-y-3">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Type nuisible</div>
              <div className="flex flex-wrap gap-1">
                <button onClick={() => setNuisibleFilter("all")}
                  className={cn("rounded-full px-2.5 py-1 text-xs font-medium border",
                    nuisibleFilter === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border")}
                >Tous</button>
                {nuisibleTypes.map((t) => (
                  <button key={t} onClick={() => setNuisibleFilter(t)}
                    className={cn("rounded-full px-2.5 py-1 text-xs font-medium border",
                      nuisibleFilter === t ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border")}
                  >{t}</button>
                ))}
              </div>
            </div>
            {activeFiltersCount > 0 && (
              <button onClick={() => setNuisibleFilter("all")}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" /> Réinitialiser
              </button>
            )}
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="text-center text-sm text-muted-foreground py-10">Chargement…</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          {clients.length === 0 ? "Aucun client. Commencez par en ajouter un." : "Aucun résultat."}
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">{filtered.length} client{filtered.length > 1 ? "s" : ""}</div>
          {filtered.map((c) => (
            <Link key={c.id} to="/clients/$id" params={{ id: c.id }} className="block">
              <Card className="hover:border-primary/50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold truncate">{c.raison_sociale}</div>
                      {c.adresse_site && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0" /> <span className="truncate">{c.adresse_site}</span>
                        </div>
                      )}
                      <div className="mt-1 flex items-center gap-3 text-xs">
                        {c.telephone && <span className="flex items-center gap-1 text-muted-foreground"><Phone className="h-3 w-3" />{c.telephone}</span>}
                        {c.type_nuisible && <span className="inline-flex items-center rounded-full bg-accent/15 px-2 py-0.5 text-accent font-medium">{c.type_nuisible}</span>}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
