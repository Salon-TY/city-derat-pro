import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/db";
import type { Intervention } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/planning")({
  head: () => ({ meta: [{ title: "Planning — CITY DERAT" }] }),
  component: PlanningPage,
});

const STATUT_CARD: Record<string, string> = {
  planifiee: "bg-accent/15 text-accent border-accent/30",
  realisee: "bg-primary/15 text-primary border-primary/30",
  annulee: "bg-muted text-muted-foreground border-muted-foreground/20",
};

const STATUT_BADGE: Record<string, string> = {
  planifiee: "bg-accent/20 text-accent",
  realisee: "bg-primary/20 text-primary",
  annulee: "bg-muted text-muted-foreground",
};

const STATUT_LABELS: Record<string, string> = {
  planifiee: "Planifiée",
  realisee: "Réalisée",
  annulee: "Annulée",
};

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
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

function useInterventionsByRange(start: string, end: string) {
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

function PlanningPage() {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [selectedDate, setSelectedDate] = useState(today);
  const [view, setView] = useState<"day" | "week">("day");

  const wStart = weekStart(selectedDate);
  const wEnd = addDays(wStart, 6);

  const rangeStart = view === "day" ? toISO(selectedDate) : toISO(wStart);
  const rangeEnd = view === "day" ? toISO(selectedDate) : toISO(wEnd);

  const { data: interventions = [], isLoading } = useInterventionsByRange(rangeStart, rangeEnd);

  function goToday() {
    setSelectedDate(startOfDay(new Date()));
  }
  function prevPeriod() {
    setSelectedDate((d) => addDays(d, view === "day" ? -1 : -7));
  }
  function nextPeriod() {
    setSelectedDate((d) => addDays(d, view === "day" ? 1 : 7));
  }

  const isCurrentPeriod =
    view === "day"
      ? toISO(selectedDate) === toISO(today)
      : toISO(wStart) === toISO(weekStart(today));

  const headerLabel =
    view === "day"
      ? selectedDate.toLocaleDateString("fr-FR", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : `Semaine du ${wStart.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} au ${wEnd.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Planning</h1>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant={view === "day" ? "default" : "outline"}
            onClick={() => setView("day")}
            className="h-8 px-3 text-xs"
          >
            Jour
          </Button>
          <Button
            size="sm"
            variant={view === "week" ? "default" : "outline"}
            onClick={() => setView("week")}
            className="h-8 px-3 text-xs"
          >
            Semaine
          </Button>
        </div>
      </div>

      {/* Navigation barre */}
      <div className="flex items-center gap-2">
        <Button
          size="icon"
          variant="outline"
          className="h-9 w-9 shrink-0"
          onClick={prevPeriod}
          aria-label="Précédent"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 text-center text-sm font-medium capitalize truncate">
          {headerLabel}
        </div>
        <Button
          size="icon"
          variant="outline"
          className="h-9 w-9 shrink-0"
          onClick={nextPeriod}
          aria-label="Suivant"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        {!isCurrentPeriod && (
          <Button
            size="sm"
            variant="outline"
            className="h-9 px-3 text-xs shrink-0"
            onClick={goToday}
          >
            Auj.
          </Button>
        )}
      </div>

      {view === "day" ? (
        <DayView
          date={selectedDate}
          interventions={interventions}
          isLoading={isLoading}
          today={today}
        />
      ) : (
        <WeekView
          wStart={wStart}
          interventions={interventions}
          selectedDate={selectedDate}
          onSelectDay={(d) => {
            setSelectedDate(d);
            setView("day");
          }}
          today={today}
        />
      )}
    </div>
  );
}

function DayView({
  date,
  interventions,
  isLoading,
  today,
}: {
  date: Date;
  interventions: Intervention[];
  isLoading: boolean;
  today: Date;
}) {
  const dateStr = toISO(date);
  const isToday = dateStr === toISO(today);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">
          {isLoading
            ? "Chargement…"
            : `${interventions.length} intervention${interventions.length !== 1 ? "s" : ""}`}
        </span>
        <Link to="/interventions/new">
          <Button size="sm" className="h-8">
            <Plus className="mr-1 h-3.5 w-3.5" />
            Nouvelle
          </Button>
        </Link>
      </div>

      {!isLoading && interventions.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            <Calendar className="mx-auto mb-2 h-8 w-8 opacity-30" />
            Aucune intervention {isToday ? "aujourd'hui" : "ce jour"}.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {interventions.map((inv) => (
            <InterventionCard key={inv.id} intervention={inv} />
          ))}
        </div>
      )}
    </div>
  );
}

function WeekView({
  wStart,
  interventions,
  selectedDate,
  onSelectDay,
  today,
}: {
  wStart: Date;
  interventions: Intervention[];
  selectedDate: Date;
  onSelectDay: (d: Date) => void;
  today: Date;
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
          <div
            key={dateStr}
            className={cn(
              "min-h-24 rounded-lg border p-1 cursor-pointer transition-colors",
              isToday && "border-accent bg-accent/5",
              isSelected && !isToday && "border-primary/40 bg-primary/5",
              !isToday && !isSelected && "border-border hover:border-primary/20"
            )}
            onClick={() => onSelectDay(day)}
          >
            <div
              className={cn(
                "mb-1 text-center",
                isToday ? "text-accent" : "text-muted-foreground"
              )}
            >
              <div className="text-[9px] uppercase tracking-wide font-medium">
                {JOURS[i]}
              </div>
              <div
                className={cn(
                  "text-xs font-semibold mx-auto w-5 h-5 flex items-center justify-center",
                  isToday && "rounded-full bg-accent text-white"
                )}
              >
                {day.getDate()}
              </div>
            </div>
            <div className="space-y-0.5">
              {dayInvs.slice(0, 3).map((inv) => (
                <Link
                  key={inv.id}
                  to="/interventions/$id"
                  params={{ id: inv.id }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    className={cn(
                      "rounded px-1 py-0.5 text-[8px] leading-tight border truncate hover:opacity-80",
                      STATUT_CARD[inv.statut] ?? "bg-muted text-muted-foreground"
                    )}
                  >
                    {(inv.client as any)?.raison_sociale ?? "Client"}
                  </div>
                </Link>
              ))}
              {dayInvs.length > 3 && (
                <div className="text-[8px] text-muted-foreground text-center">
                  +{dayInvs.length - 3}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function InterventionCard({ intervention: inv }: { intervention: Intervention }) {
  return (
    <Link to="/interventions/$id" params={{ id: inv.id }}>
      <Card className="hover:border-primary/40 transition-colors">
        <CardContent className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-sm truncate">
                {(inv.client as any)?.raison_sociale ?? "—"}
              </div>
              {inv.adresse_site && (
                <div className="text-xs text-muted-foreground truncate mt-0.5">
                  {inv.adresse_site}
                </div>
              )}
              {inv.type_intervention && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  {inv.type_intervention}
                  {inv.type_nuisible ? ` · ${inv.type_nuisible}` : ""}
                </div>
              )}
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase",
                STATUT_BADGE[inv.statut] ?? "bg-muted text-muted-foreground"
              )}
            >
              {STATUT_LABELS[inv.statut] ?? inv.statut}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
