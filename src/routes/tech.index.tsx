import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { useMyTodoCount, useMyVanStock } from "@/lib/queries";
import { STATUTS_INTERVENTION } from "@/lib/schemas";
import { Card, CardContent } from "@/components/ui/card";
import { ClipboardList, MapPin, Phone, Package } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tech/")({
  head: () => ({ meta: [{ title: "Ma journée — CITY DERAT" }] }),
  component: TechToday,
});

const STATUT_COLORS: Record<string, string> = {
  planifiee: "bg-accent/15 text-accent",
  en_cours: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  realisee: "bg-primary/15 text-primary",
  rapport_transmis: "bg-success/15 text-success",
  annulee: "bg-muted text-muted-foreground",
};

function statutLabel(v: string) {
  return STATUTS_INTERVENTION.find((s) => s.value === v)?.label ?? v;
}

function localDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function useMyTodayInterventions(userId: string | null) {
  return useQuery({
    queryKey: ["tech_today_interventions", userId],
    enabled: !!userId,
    queryFn: async () => {
      const today = localDateStr(new Date());
      const { data, error } = await db
        .from("interventions")
        .select("*, client:clients(raison_sociale, telephone)")
        .eq("technicien_id", userId!)
        .eq("date", today)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
}

function TechToday() {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const { data: todoCount = 0 } = useMyTodoCount();
  const { data: todayInterventions = [], isLoading } = useMyTodayInterventions(userId);
  const { data: vanLevels = [] } = useMyVanStock();
  const lowStock = vanLevels.filter((l) => l.product && l.quantite <= l.product.seuil_alerte);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ma journée</h1>
        <p className="text-sm text-muted-foreground">Bonne route !</p>
      </div>

      {todoCount > 0 && (
        <Link to="/tech/chantiers" className="block">
          <Card className="border-primary/40 bg-primary/5 hover:border-primary/60 transition-colors">
            <CardContent className="p-3 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm font-semibold text-primary">
                {todoCount} chantier{todoCount > 1 ? "s" : ""} à faire
              </span>
            </CardContent>
          </Card>
        </Link>
      )}

      {lowStock.length > 0 && (
        <Link to="/tech/camion" className="block">
          <Card className="border-red-300 bg-red-50 dark:bg-red-950/20 hover:border-red-400 transition-colors">
            <CardContent className="p-3 flex items-start gap-2">
              <Package className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              <div className="text-sm">
                <span className="font-semibold text-red-700 dark:text-red-400">
                  {lowStock.length} produit{lowStock.length > 1 ? "s" : ""} bas sur mon camion
                </span>
                <ul className="mt-1 space-y-0.5">
                  {lowStock.map((l) => (
                    <li key={l.id} className="text-xs text-red-600 dark:text-red-300">
                      {l.product?.nom} — {l.quantite} {l.product?.unite}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </Link>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Aujourd'hui
        </h2>
        {isLoading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Chargement…</div>
        ) : todayInterventions.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
            Aucun chantier aujourd'hui.
          </CardContent></Card>
        ) : (
          <div className="space-y-2">
            {todayInterventions.map((inv: any) => (
              <Link key={inv.id} to="/tech/chantiers/$id" params={{ id: inv.id }} className="block">
                <Card className="hover:border-primary/40 transition-colors">
                  <CardContent className="p-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm truncate">{inv.client?.raison_sociale ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{inv.type_intervention}</div>
                      </div>
                      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase", STATUT_COLORS[inv.statut] ?? "bg-muted")}>
                        {statutLabel(inv.statut)}
                      </span>
                    </div>
                    {inv.adresse_site && (
                      <div className="flex items-start gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                        <span className="truncate">{inv.adresse_site}</span>
                      </div>
                    )}
                    {inv.client?.telephone && (
                      <a
                        href={`tel:${inv.client.telephone}`}
                        className="flex items-center gap-1.5 w-fit rounded-lg bg-primary/10 px-2.5 py-1 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Phone className="h-3 w-3" /> Appeler
                      </a>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
