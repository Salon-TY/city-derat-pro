import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useQuotes } from "@/lib/queries";
import { formatEUR, formatDateFR, STATUTS_DEVIS } from "@/lib/schemas";
import { Plus, Search, ChevronRight, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/devis/")({
  head: () => ({ meta: [{ title: "Devis — CITY DERAT" }] }),
  component: DevisListPage,
});

const STATUT_COLORS: Record<string, string> = {
  brouillon: "bg-gray-100 text-gray-600",
  envoye: "bg-blue-100 text-blue-700",
  accepte: "bg-green-100 text-green-700",
  refuse: "bg-red-100 text-red-700",
  converti: "bg-purple-100 text-purple-700",
};

function statutLabel(v: string) {
  return STATUTS_DEVIS.find((s) => s.value === v)?.label ?? v;
}

function DevisListPage() {
  const { data: devis = [], isLoading } = useQuotes();
  const [q, setQ] = useState("");
  const [statutFilter, setStatutFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const activeFiltersCount = statutFilter !== "all" ? 1 : 0;

  const filtered = useMemo(() => {
    let list = [...devis];
    const s = q.trim().toLowerCase();
    if (s) {
      list = list.filter((d) =>
        [d.numero, d.client?.raison_sociale, d.notes]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(s))
      );
    }
    if (statutFilter !== "all") list = list.filter((d) => d.statut === statutFilter);
    return list;
  }, [devis, q, statutFilter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Devis</h1>
        <Button asChild size="sm" className="shrink-0">
          <Link to="/devis/new"><Plus className="mr-1 h-4 w-4" /> Nouveau</Link>
        </Button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un devis…" className="pl-9" />
        </div>
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
      </div>

      {filtersOpen && (
        <Card>
          <CardContent className="p-3 space-y-3">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Statut</div>
              <div className="flex flex-wrap gap-1">
                <button onClick={() => setStatutFilter("all")}
                  className={cn("rounded-full px-2.5 py-1 text-xs font-medium border",
                    statutFilter === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border")}
                >Tous</button>
                {STATUTS_DEVIS.map((s) => (
                  <button key={s.value} onClick={() => setStatutFilter(s.value)}
                    className={cn("rounded-full px-2.5 py-1 text-xs font-medium border",
                      statutFilter === s.value ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border")}
                  >{s.label}</button>
                ))}
              </div>
            </div>
            {activeFiltersCount > 0 && (
              <button onClick={() => setStatutFilter("all")}
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
          {devis.length === 0 ? "Aucun devis. Créez-en un !" : "Aucun résultat."}
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">{filtered.length} devis</div>
          {filtered.map((d) => (
            <Link key={d.id} to="/devis/$id" params={{ id: d.id }} className="block">
              <Card className="hover:border-accent/50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{d.numero}</span>
                        <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold", STATUT_COLORS[d.statut] ?? "bg-gray-100 text-gray-600")}>
                          {statutLabel(d.statut)}
                        </span>
                      </div>
                      <div className="mt-0.5 text-sm text-muted-foreground">{d.client?.raison_sociale ?? "—"}</div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{formatDateFR(d.date_devis)}</span>
                        <span>Validité : {formatDateFR(d.date_validite)}</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-bold text-sm">{formatEUR(d.total_ttc)}</div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto mt-1" />
                    </div>
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
