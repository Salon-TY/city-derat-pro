import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useInterventions, type Intervention } from "@/lib/queries";
import { STATUTS_INTERVENTION, formatDateFR } from "@/lib/schemas";
import {
  Plus, Search, Filter, X, List as ListIcon, Sun, CalendarDays,
  ChevronLeft, ChevronRight, MapPin, Phone
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/interventions/")({
  head: () => ({ meta: [{ title: "Interventions — CITY DERAT" }] }),
  component: InterventionsPage,
});

type View = "list" | "day" | "week";

const STATUT_COLORS: Record<string, string> = {
  planifiee: "bg-accent/15 text-accent",
  realisee: "bg-primary/15 text-primary",
  rapport_transmis: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  annulee: "bg-muted text-muted-foreground line-through",
};

const STATUT_BADGE: Record<string, string> = {
  planifiee: "bg-accent/20 text-accent",
  realisee: "bg-primary/20 text-primary",
  rapport_transmis: "bg-blue-100 text-blue-700",
  annulee: "bg-muted text-muted-foreground",
};

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

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

function statutLabel(v: string) {
  return STATUTS_INTERVENTION.find((s) => s.value === v)?.label ?? v;
}

function useRangeInterventions(start: string, end: string) {
  return useQuery({
    queryKey: ["interventions_range", start, end],
    queryFn: async (): Promise<Intervention[]> => {
      const { data, error } = await db
        .from("interventions")
        .select("*, client:clients(raison_sociale, telephone)")
        .gte("date", start)
        .lte("date", end)
        .order("date")
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
}

function InterventionsPage() {
  const [view, setView] = useState<View>("list");
  const today = useMemo(() => startOfDay(new Date()), []);
  const [selectedDate, setSelectedDate] = useState(today);

  // List filters
  const [q, setQ] = useState("");
  const [statutFilter, setStatutFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { data: allInterventions = [], isLoading } = useInterventions();

  const activeFiltersCount = [
    q.trim() ? 1 : 0,
    statutFilter !== "all" ? 1 : 0,
    typeFilter !== "all" ? 1 : 0,
    periodFilter !== "all" ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const filteredList = useMemo(() => {
    let list = [...allInterventions];
    const s = q.trim().toLowerCase();
    if (s) {
      list = list.filter((i) =>
        [i.client ? (i.client as any).raison_sociale : "", i.adresse_site, i.type_nuisible, i.produits]
          .filter(Boolean)
          .some((v) => v.toLowerCase().includes(s))
      );
    }
    if (statutFilter !== "all") list = list.filter((i) => i.statut === statutFilter);
    if (typeFilter !== "all") list = list.filter((i) => i.type_nuisible === typeFilter);
    if (periodFilter !== "all") {
      const now = new Date();
      const todayStr = toISO(now);
      if (periodFilter === "today") list = list.filter((i) => i.date === todayStr);
      else if (periodFilter === "week") {
        const ws = toISO(weekStart(now));
        const we = toISO(addDays(weekStart(now), 6));
        list = list.filter((i) => i.date >= ws && i.date <= we);
      } else if (periodFilter === "month") {
        const ms = toISO(new Date(now.getFullYear(), now.getMonth(), 1));
        list = list.filter((i) => i.date >= ms && i.date <= todayStr);
      }
    }
    list.sort((a, b) => (a.date < b.date ? 1 : -1) * (sortDir === "desc" ? 1 : -1));
    return list;
  }, [allInterventions, q, statutFilter, typeFilter, periodFilter, sortDir]);

  const nuisibleTypes = useMemo(() => {
    const s = new Set(allInterventions.map((i) => i.type_nuisible).filter(Boolean));
    return [...s].sort();
  }, [allInterventions]);

  // Day/Week navigation
  const wStart = weekStart(selectedDate);
  const wEnd = addDays(wStart, 6);
  const rangeStart = view === "day" ? toISO(selectedDate) : toISO(wStart);
  const rangeEnd = view === "day" ? toISO(selectedDate) : toISO(wEnd);
  const { data: rangeInvs = [], isLoading: rangeLoading } = useRangeInterventions(
    view !== "list" ? rangeStart : "9999-01-01",
    view !== "list" ? rangeEnd : "9999-01-01"
  );

  function prevPeriod() { setSelectedDate((d) => addDays(d, view === "day" ? -1 : -7)); }
  function nextPeriod() { setSelectedDate((d) => addDays(d, view === "day" ? 1 : 7)); }
  const isCurrentPeriod = view === "day"
    ? toISO(selectedDate) === toISO(today)
    : toISO(wStart) === toISO(weekStart(today));

  const headerLabel = view === "day"
    ? selectedDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
    : `Semaine du ${wStart.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} au ${wEnd.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`;

  function resetFilters() {
    setQ(""); setStatutFilter("all"); setTypeFilter("all"); setPeriodFilter("all"); setSortDir("desc");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Terrain</h1>
        <Button asChild size="sm" className="shrink-0">
          <Link to="/interventions/new"><Plus className="mr-1 h-4 w-4" />Ajouter</Link>
        </Button>
      </div>

      {/* 3 view toggles */}
      <div className="flex rounded-xl bg-muted p-1 gap-1">
        {([
          { v: "list" as View, label: "Liste", icon: ListIcon },
          { v: "day" as View, label: "Jour", icon: Sun },
          { v: "week" as View, label: "Semaine", icon: CalendarDays },
        ] as const).map(({ v, label, icon: Icon }) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all ${
              view === v ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />{label}
          </button>
        ))}
      </div>

      {view === "list" && (
        <>
          {/* Search bar */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Client, adresse, nuisible…"
                className="pl-9"
              />
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

          {/* Filter panel */}
          {filtersOpen && (
            <Card>
              <CardContent className="p-3 space-y-3">
                {/* Période */}
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Période</div>
                  <div className="flex flex-wrap gap-1">
                    {[
                      { v: "all", l: "Toutes" },
                      { v: "today", l: "Aujourd'hui" },
                      { v: "week", l: "Cette semaine" },
                      { v: "month", l: "Ce mois" },
                    ].map(({ v, l }) => (
                      <button key={v} onClick={() => setPeriodFilter(v)}
                        className={cn("rounded-full px-2.5 py-1 text-xs font-medium border",
                          periodFilter === v ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border")}
                      >{l}</button>
                    ))}
                  </div>
                </div>
                {/* Statut */}
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Statut</div>
                  <div className="flex flex-wrap gap-1">
                    {[{ value: "all", label: "Tous" }, ...STATUTS_INTERVENTION].map((f) => (
                      <button key={f.value} onClick={() => setStatutFilter(f.value)}
                        className={cn("rounded-full px-2.5 py-1 text-xs font-medium border",
                          statutFilter === f.value ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border")}
                      >{f.label}</button>
                    ))}
                  </div>
                </div>
                {/* Type nuisible */}
                {nuisibleTypes.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Type nuisible</div>
                    <div className="flex flex-wrap gap-1">
                      <button onClick={() => setTypeFilter("all")}
                        className={cn("rounded-full px-2.5 py-1 text-xs font-medium border",
                          typeFilter === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border")}
                      >Tous</button>
                      {nuisibleTypes.map((t) => (
                        <button key={t} onClick={() => setTypeFilter(t)}
                          className={cn("rounded-full px-2.5 py-1 text-xs font-medium border",
                            typeFilter === t ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border")}
                        >{t}</button>
                      ))}
                    </div>
                  </div>
                )}
                {/* Tri */}
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Tri</div>
                  <div className="flex gap-1">
                    {[{ v: "desc", l: "Date ↓" }, { v: "asc", l: "Date ↑" }].map(({ v, l }) => (
                      <button key={v} onClick={() => setSortDir(v as any)}
                        className={cn("rounded-full px-2.5 py-1 text-xs font-medium border",
                          sortDir === v ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border")}
                      >{l}</button>
                    ))}
                  </div>
                </div>
                {activeFiltersCount > 0 && (
                  <button onClick={resetFilters} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" /> Réinitialiser les filtres
                  </button>
                )}
              </CardContent>
            </Card>
          )}

          {isLoading ? (
            <div className="text-center text-sm text-muted-foreground py-10">Chargement…</div>
          ) : filteredList.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
              {allInterventions.length === 0 ? "Aucune intervention. Commencez par en créer une." : "Aucun résultat pour ces filtres."}
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">{filteredList.length} intervention{filteredList.length > 1 ? "s" : ""}</div>
              {filteredList.map((i) => <InterventionListCard key={i.id} item={i} />)}
            </div>
          )}
        </>
      )}

      {(view === "day" || view === "week") && (
        <>
          {/* Navigation */}
          <div className="flex items-center gap-2">
            <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={prevPeriod}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 text-center text-sm font-medium capitalize truncate">{headerLabel}</div>
            <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={nextPeriod}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            {!isCurrentPeriod && (
              <Button size="sm" variant="outline" className="h-9 px-3 text-xs shrink-0"
                onClick={() => setSelectedDate(startOfDay(new Date()))}>Auj.</Button>
            )}
          </div>

          {view === "day" && (
            <DayView date={selectedDate} interventions={rangeInvs} isLoading={rangeLoading} today={today} />
          )}
          {view === "week" && (
            <WeekView wStart={wStart} interventions={rangeInvs} selectedDate={selectedDate}
              onSelectDay={(d) => { setSelectedDate(d); setView("day"); }} today={today} />
          )}
        </>
      )}
    </div>
  );
}

function InterventionListCard({ item }: { item: any }) {
  return (
    <Link to="/interventions/$id" params={{ id: item.id }}>
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
  );
}

function DayView({ date, interventions, isLoading, today }: {
  date: Date; interventions: Intervention[]; isLoading: boolean; today: Date;
}) {
  const dateStr = toISO(date);
  const isToday = dateStr === toISO(today);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">
          {isLoading ? "Chargement…" : `${interventions.length} intervention${interventions.length !== 1 ? "s" : ""}`}
        </span>
        <Link to="/interventions/new">
          <Button size="sm" className="h-8">
            <Plus className="mr-1 h-3.5 w-3.5" />Nouvelle
          </Button>
        </Link>
      </div>
      {!isLoading && interventions.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          Aucune intervention {isToday ? "aujourd'hui" : "ce jour"}.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {interventions.map((inv) => <PlanningCard key={inv.id} intervention={inv} />)}
        </div>
      )}
    </div>
  );
}

function WeekView({ wStart, interventions, selectedDate, onSelectDay, today }: {
  wStart: Date; interventions: Intervention[]; selectedDate: Date;
  onSelectDay: (d: Date) => void; today: Date;
}) {
  const todayStr = toISO(today);
  const selectedStr = toISO(selectedDate);
  const byDate = useMemo(() => {
    const map: Record<string, Intervention[]> = {};
    for (const inv of interventions) {
      if (!map[inv.date]) map[inv.date] = [];
      map[inv.date].push(inv);
    }
    return map;
  }, [interventions]);

  const days = Array.from({ length: 7 }, (_, i) => addDays(wStart, i));
  return (
    <div className="grid grid-cols-7 gap-1">
      {days.map((day, i) => {
        const dateStr = toISO(day);
        const dayInvs = byDate[dateStr] ?? [];
        const isToday = dateStr === todayStr;
        const isSelected = dateStr === selectedStr;
        return (
          <div key={dateStr}
            className={cn(
              "min-h-24 rounded-lg border p-1 cursor-pointer transition-colors",
              isToday && "border-accent bg-accent/5",
              isSelected && !isToday && "border-primary/40 bg-primary/5",
              !isToday && !isSelected && "border-border hover:border-primary/20"
            )}
            onClick={() => onSelectDay(day)}
          >
            <div className={cn("mb-1 text-center", isToday ? "text-accent" : "text-muted-foreground")}>
              <div className="text-[9px] uppercase tracking-wide font-medium">{JOURS[i]}</div>
              <div className={cn("text-xs font-semibold mx-auto w-5 h-5 flex items-center justify-center",
                isToday && "rounded-full bg-accent text-white")}>
                {day.getDate()}
              </div>
            </div>
            <div className="space-y-0.5">
              {dayInvs.slice(0, 3).map((inv) => (
                <Link key={inv.id} to="/interventions/$id" params={{ id: inv.id }} onClick={(e) => e.stopPropagation()}>
                  <div className={cn(
                    "rounded px-1 py-0.5 text-[8px] leading-tight border truncate hover:opacity-80",
                    STATUT_BADGE[inv.statut] ?? "bg-muted text-muted-foreground"
                  )}>
                    {(inv.client as any)?.raison_sociale ?? "Client"}
                  </div>
                </Link>
              ))}
              {dayInvs.length > 3 && (
                <div className="text-[8px] text-muted-foreground text-center">+{dayInvs.length - 3}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PlanningCard({ intervention: inv }: { intervention: Intervention }) {
  return (
    <Link to="/interventions/$id" params={{ id: inv.id }}>
      <Card className="hover:border-primary/40 transition-colors">
        <CardContent className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-sm truncate">{(inv.client as any)?.raison_sociale ?? "—"}</div>
              {inv.adresse_site && (
                <div className="text-xs text-muted-foreground truncate mt-0.5">{inv.adresse_site}</div>
              )}
              {inv.type_intervention && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  {inv.type_intervention}{inv.type_nuisible ? ` · ${inv.type_nuisible}` : ""}
                </div>
              )}
              {(inv.client as any)?.telephone && (
                <a href={`tel:${(inv.client as any).telephone}`}
                  className="flex items-center gap-1 text-xs text-primary mt-0.5"
                  onClick={(e) => e.stopPropagation()}>
                  <Phone className="h-3 w-3" />{(inv.client as any).telephone}
                </a>
              )}
            </div>
            <span className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase",
              STATUT_BADGE[inv.statut] ?? "bg-muted text-muted-foreground"
            )}>
              {statutLabel(inv.statut)}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
