import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useInterventions } from "@/lib/queries";
import { STATUTS_INTERVENTION } from "@/lib/schemas";
import { formatDateFR } from "@/lib/schemas";
import { Plus, ChevronLeft, ChevronRight, List as ListIcon, CalendarDays, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  view: fallback(z.enum(["calendar", "list"]), "calendar").default("calendar"),
  statut: fallback(z.enum(["all", "planifiee", "realisee", "annulee"]), "all").default("all"),
});
type SearchParams = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/_app/interventions/")({
  head: () => ({ meta: [{ title: "Interventions — CITY DERAT" }] }),
  validateSearch: zodValidator(searchSchema),
  component: InterventionsPage,
});

const STATUT_COLORS: Record<string, string> = {
  planifiee: "bg-accent/15 text-accent",
  realisee: "bg-primary/15 text-primary",
  annulee: "bg-muted text-muted-foreground line-through",
};

function statutLabel(v: string) {
  return STATUTS_INTERVENTION.find((s) => s.value === v)?.label ?? v;
}

const STATUT_FILTERS = [
  { value: "all", label: "Toutes" },
  { value: "planifiee", label: "Planifiées" },
  { value: "realisee", label: "Réalisées" },
  { value: "annulee", label: "Annulées" },
] as const;

function InterventionsPage() {
  const { data: interventions = [], isLoading } = useInterventions();
  const { view, statut } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const filtered = useMemo(
    () => (statut === "all" ? interventions : interventions.filter((i) => i.statut === statut)),
    [interventions, statut],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Interventions</h1>
        <Button asChild size="sm" className="shrink-0">
          <Link to="/interventions/new"><Plus className="mr-1 h-4 w-4" />Ajouter</Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border bg-card p-0.5">
          <button
            type="button"
            onClick={() => navigate({ search: (p: SearchParams) => ({ ...p, view: "calendar" }) })}
            className={cn(
              "inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors",
              view === "calendar" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            )}
          >
            <CalendarDays className="h-4 w-4" /> Calendrier
          </button>
          <button
            type="button"
            onClick={() => navigate({ search: (p: SearchParams) => ({ ...p, view: "list" }) })}
            className={cn(
              "inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors",
              view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            )}
          >
            <ListIcon className="h-4 w-4" /> Liste
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {STATUT_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => navigate({ search: (p: SearchParams) => ({ ...p, statut: f.value }) })}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
              statut === f.value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:text-foreground"
            )}
          >
            {f.label}
            <span className="ml-1.5 opacity-70">
              {f.value === "all"
                ? interventions.length
                : interventions.filter((i) => i.statut === f.value).length}
            </span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center text-sm text-muted-foreground py-10">Chargement…</div>
      ) : view === "calendar" ? (
        <MonthCalendar cursor={cursor} setCursor={setCursor} interventions={filtered} />
      ) : (
        <ListView interventions={filtered} />
      )}
    </div>
  );
}

function MonthCalendar({
  cursor,
  setCursor,
  interventions,
}: {
  cursor: Date;
  setCursor: (d: Date) => void;
  interventions: any[];
}) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);

  const startWeekday = (first.getDay() + 6) % 7;
  const daysInMonth = last.getDate();

  const cells: { date: Date | null }[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push({ date: null });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ date: new Date(year, month, d) });
  while (cells.length % 7 !== 0) cells.push({ date: null });

  const byDate = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const i of interventions) {
      const k = (i.date as string).slice(0, 10);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(i);
    }
    return m;
  }, [interventions]);

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  const monthLabel = cursor.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const dayItems = selectedDay ? byDate.get(selectedDay) ?? [] : [];

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center justify-between mb-2">
            <Button variant="ghost" size="icon" onClick={() => setCursor(new Date(year, month - 1, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="font-semibold capitalize">{monthLabel}</div>
            <Button variant="ghost" size="icon" onClick={() => setCursor(new Date(year, month + 1, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium uppercase text-muted-foreground mb-1">
            {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => <div key={i}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((c, i) => {
              if (!c.date) return <div key={i} className="aspect-square" />;
              const key = c.date.toISOString().slice(0, 10);
              const items = byDate.get(key) ?? [];
              const isToday = key === today;
              const isSelected = key === selectedDay;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedDay(key)}
                  className={cn(
                    "aspect-square rounded-md text-xs flex flex-col items-center justify-center gap-0.5 transition-colors border",
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary"
                      : isToday
                      ? "border-accent bg-accent/10"
                      : "border-transparent hover:bg-muted",
                  )}
                >
                  <span className={cn("font-medium", items.length > 0 && !isSelected && "text-foreground")}>
                    {c.date.getDate()}
                  </span>
                  {items.length > 0 && (
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        isSelected ? "bg-primary-foreground" : "bg-accent",
                      )}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {selectedDay && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              {formatDateFR(selectedDay)} · {dayItems.length} intervention{dayItems.length > 1 ? "s" : ""}
            </h2>
            <Button asChild size="sm" variant="outline">
              <Link to="/interventions/new" search={{ date: selectedDay }}>
                <Plus className="mr-1 h-3 w-3" /> Ajouter
              </Link>
            </Button>
          </div>
          {dayItems.length === 0 ? (
            <Card><CardContent className="py-6 text-center text-xs text-muted-foreground">Aucune intervention ce jour.</CardContent></Card>
          ) : (
            dayItems.map((i) => <InterventionCard key={i.id} item={i} />)
          )}
        </div>
      )}
    </div>
  );
}

function ListView({ interventions }: { interventions: any[] }) {
  if (interventions.length === 0) {
    return (
      <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
        Aucune intervention pour ce filtre.
      </CardContent></Card>
    );
  }
  return (
    <div className="space-y-2">
      {interventions.map((i) => <InterventionCard key={i.id} item={i} />)}
    </div>
  );
}

function InterventionCard({ item }: { item: any }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-semibold truncate">{item.client?.raison_sociale ?? "Client supprimé"}</div>
            <div className="text-xs text-muted-foreground">
              {formatDateFR(item.date)} · {item.type_intervention}
            </div>
          </div>
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium uppercase", STATUT_COLORS[item.statut] ?? "bg-muted")}>
            {statutLabel(item.statut)}
          </span>
        </div>
        {item.adresse_site && (
          <div className="flex items-start gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
            <span className="truncate">{item.adresse_site}</span>
          </div>
        )}
        {item.date_prochain_passage && (
          <div className="text-xs text-accent font-medium">
            Prochain passage : {formatDateFR(item.date_prochain_passage)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
