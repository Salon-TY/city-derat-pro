import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { useInterventions, type Intervention } from "@/lib/queries";
import { STATUTS_INTERVENTION, formatDateFR } from "@/lib/schemas";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, List as ListIcon, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
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

function formatHeure(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

type View = "list" | "week";

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function weekStart(date: Date): Date {
  const d = startOfDay(date);
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  return d;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// Interventions du technicien courant sur une plage de dates (filtre en dur
// sur technicien_id — jamais d'option "Tous").
function useMyRangeInterventions(userId: string | null, start: string, end: string, statut: string | undefined) {
  return useQuery({
    queryKey: ["tech_range_interventions", userId, start, end, statut],
    enabled: !!userId,
    queryFn: async (): Promise<Intervention[]> => {
      let q = db.from("interventions").select("*, client:clients(raison_sociale, telephone)")
        .eq("technicien_id", userId!)
        .gte("date", start)
        .lte("date", end)
        .order("date")
        .order("created_at");
      if (statut) q = q.eq("statut", statut);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

function TechChantiersList() {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const [view, setView] = useState<View>("list");
  const [statutFilter, setStatutFilter] = useState<string>("all");
  const today = useMemo(() => startOfDay(new Date()), []);
  const [selectedDate, setSelectedDate] = useState(today);

  // Filtre en dur sur son propre id — pas d'option "Tous". Tant que l'id
  // n'est pas résolu, on ne lance pas la requête (voir `enabled` ci-dessous).
  const { data: interventions = [], isLoading } = useInterventions(
    statutFilter === "all"
      ? { technicien_id: userId ?? "__none__" }
      : { technicien_id: userId ?? "__none__", statut: statutFilter }
  );

  const wStart = weekStart(selectedDate);
  const wEnd = addDays(wStart, 6);
  const { data: weekInterventions = [], isLoading: weekLoading } = useMyRangeInterventions(
    view === "week" ? userId : null,
    toISO(wStart),
    toISO(wEnd),
    statutFilter === "all" ? undefined : statutFilter
  );

  const byDate = useMemo(() => {
    const map: Record<string, Intervention[]> = {};
    for (const inv of weekInterventions) {
      if (!map[inv.date]) map[inv.date] = [];
      map[inv.date].push(inv);
    }
    return map;
  }, [weekInterventions]);

  const isCurrentWeek = toISO(wStart) === toISO(weekStart(today));
  const weekLabel = `Semaine du ${wStart.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} au ${wEnd.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Mes chantiers</h1>

      {/* Sélecteur de vue */}
      <div className="flex rounded-xl bg-muted p-1 gap-1">
        {([
          { v: "list" as View, label: "Liste", icon: ListIcon },
          { v: "week" as View, label: "Semaine", icon: CalendarDays },
        ] as const).map(({ v, label, icon: Icon }) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all",
              view === v ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />{label}
          </button>
        ))}
      </div>

      {/* Filtre statut — s'applique aux deux vues */}
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

      {view === "list" ? (
        isLoading || !userId ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Chargement…</div>
        ) : interventions.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
            Aucun chantier pour ce filtre.
          </CardContent></Card>
        ) : (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">{interventions.length} chantier{interventions.length > 1 ? "s" : ""}</div>
            {interventions.map((item) => (
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
        )
      ) : (
        <>
          {/* Navigation semaine */}
          <div className="flex items-center gap-2">
            <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={() => setSelectedDate((d) => addDays(d, -7))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 text-center text-sm font-medium truncate">{weekLabel}</div>
            <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={() => setSelectedDate((d) => addDays(d, 7))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            {!isCurrentWeek && (
              <Button size="sm" variant="outline" className="h-9 px-3 text-xs shrink-0" onClick={() => setSelectedDate(today)}>
                Cette semaine
              </Button>
            )}
          </div>

          {/* 7 jours empilés (mobile d'abord) */}
          {weekLoading || !userId ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Chargement…</div>
          ) : (
            <div className="space-y-3">
              {Array.from({ length: 7 }, (_, i) => addDays(wStart, i)).map((day, i) => {
                const dateStr = toISO(day);
                const dayInvs = byDate[dateStr] ?? [];
                const isToday = dateStr === toISO(today);
                return (
                  <Card key={dateStr} className={cn(isToday && "border-accent bg-accent/5")}>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className={cn("text-sm font-semibold", isToday && "text-accent")}>
                          {JOURS[i]} <span className="font-normal text-muted-foreground">{day.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
                          {isToday && <span className="ml-1.5 rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-bold uppercase text-white align-middle">Aujourd'hui</span>}
                        </div>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {dayInvs.length} chantier{dayInvs.length > 1 ? "s" : ""}
                        </span>
                      </div>

                      {dayInvs.length === 0 ? (
                        <p className="text-xs text-muted-foreground/70 py-1">—</p>
                      ) : (
                        <div className="space-y-1.5">
                          {dayInvs.map((inv) => {
                            const heure = formatHeure(inv.heure_debut);
                            return (
                              <Link key={inv.id} to="/tech/chantiers/$id" params={{ id: inv.id }} className="block">
                                <div className="rounded-lg border bg-card p-2.5 text-xs hover:border-primary/40 transition-colors">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5">
                                        {heure && <span className="font-mono font-medium text-muted-foreground shrink-0">{heure}</span>}
                                        <span className="font-semibold truncate">{inv.client?.raison_sociale ?? "Client supprimé"}</span>
                                      </div>
                                      {inv.adresse_site && (
                                        <div className="flex items-start gap-1 text-muted-foreground mt-0.5">
                                          <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                                          <span className="truncate">{inv.adresse_site}</span>
                                        </div>
                                      )}
                                    </div>
                                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[9px] font-medium uppercase", STATUT_COLORS[inv.statut] ?? "bg-muted")}>
                                      {statutLabel(inv.statut)}
                                    </span>
                                  </div>
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
