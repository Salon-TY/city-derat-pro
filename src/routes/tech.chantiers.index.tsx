import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useInterventions } from "@/lib/queries";
import { STATUTS_INTERVENTION, formatDateFR } from "@/lib/schemas";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tech/chantiers/")({
  head: () => ({ meta: [{ title: "Mes chantiers — CITY DERAT" }] }),
  component: TechChantiersList,
});

const STATUT_COLORS: Record<string, string> = {
  planifiee: "bg-accent/15 text-accent",
  en_cours: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  realisee: "bg-primary/15 text-primary",
  rapport_transmis: "bg-success/15 text-success",
  annulee: "bg-muted text-muted-foreground",
};

// Sous-ensemble de statuts pertinents pour le technicien (pas "Annulée").
const TECH_STATUT_FILTERS = STATUTS_INTERVENTION.filter((s) => s.value !== "annulee");

function statutLabel(v: string) {
  return STATUTS_INTERVENTION.find((s) => s.value === v)?.label ?? v;
}

function TechChantiersList() {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const [statutFilter, setStatutFilter] = useState<string>("all");
  // Filtre en dur sur son propre id — pas d'option "Tous". Tant que l'id
  // n'est pas résolu, on ne lance pas la requête (voir `enabled` ci-dessous).
  const { data: interventions = [], isLoading } = useInterventions(
    statutFilter === "all"
      ? { technicien_id: userId ?? "__none__" }
      : { technicien_id: userId ?? "__none__", statut: statutFilter }
  );

  const filtered = interventions;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Mes chantiers</h1>

      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setStatutFilter("all")}
          className={cn("rounded-full px-3 py-1.5 text-xs font-medium border",
            statutFilter === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border")}
        >
          Toutes
        </button>
        {TECH_STATUT_FILTERS.map((s) => (
          <button
            key={s.value}
            onClick={() => setStatutFilter(s.value)}
            className={cn("rounded-full px-3 py-1.5 text-xs font-medium border",
              statutFilter === s.value ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border")}
          >
            {s.label}
          </button>
        ))}
      </div>

      {isLoading || !userId ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Chargement…</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          Aucun chantier pour ce filtre.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">{filtered.length} chantier{filtered.length > 1 ? "s" : ""}</div>
          {filtered.map((item) => (
            <Link key={item.id} to="/tech/chantiers/$id" params={{ id: item.id }}>
              <Card className="hover:border-primary/40 transition-colors cursor-pointer">
                <CardContent className="p-4 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{item.client?.raison_sociale ?? "Client supprimé"}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDateFR(item.date)} · {item.type_intervention}
                      </div>
                    </div>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase", STATUT_COLORS[item.statut] ?? "bg-muted")}>
                      {statutLabel(item.statut)}
                    </span>
                  </div>
                  {item.adresse_site && (
                    <div className="flex items-start gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                      <span className="truncate">{item.adresse_site}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
