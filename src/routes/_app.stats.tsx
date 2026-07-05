import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMonthlyStats, useProductStats, useTechnicianStats, useCurrentRole, type TechnicianStatsEntry, type TechnicianStatsPeriod } from "@/lib/queries";
import { formatEUR } from "@/lib/schemas";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, UserPlus, ClipboardCheck, Euro, Trophy, Package, HardHat } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { cn } from "@/lib/utils";
import { PermissionGate } from "@/components/permission-gate";

export const Route = createFileRoute("/_app/stats")({
  head: () => ({ meta: [{ title: "Statistiques — CITY DERAT" }] }),
  component: () => (
    <PermissionGate perm="stats">
      <StatsPage />
    </PermissionGate>
  ),
});

function StatsPage() {
  const { data: stats, isLoading } = useMonthlyStats();
  const { data: productStats = [] } = useProductStats();

  const caEvo = stats?.caEvolution;
  const caTrend = caEvo == null ? "flat" : caEvo > 0 ? "up" : caEvo < 0 ? "down" : "flat";

  const intEvo = stats ? stats.intMonth - stats.intPrev : 0;
  const intTrend = intEvo > 0 ? "up" : intEvo < 0 ? "down" : "flat";

  const maxCa = Math.max(...(stats?.months6.map((m) => m.ca) ?? [1]));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Statistiques</h1>
        <p className="text-sm text-muted-foreground">Activité du mois en cours.</p>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Chargement…</div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid gap-3">
            <KpiCard
              icon={<Euro className="h-5 w-5" />}
              label="CA du mois"
              value={formatEUR(stats?.caMonth)}
              trend={caTrend}
              detail={
                caEvo != null
                  ? `${caEvo > 0 ? "+" : ""}${caEvo.toFixed(1)}% vs mois dernier (${formatEUR(stats?.caPrev)})`
                  : `vs mois dernier : ${formatEUR(stats?.caPrev)}`
              }
            />
            <KpiCard
              icon={<ClipboardCheck className="h-5 w-5" />}
              label="Interventions réalisées"
              value={String(stats?.intMonth ?? 0)}
              trend={intTrend}
              detail={`${intEvo > 0 ? "+" : ""}${intEvo} vs mois dernier (${stats?.intPrev ?? 0})`}
            />
            <KpiCard
              icon={<UserPlus className="h-5 w-5" />}
              label="Nouveaux clients ce mois"
              value={String(stats?.newClients ?? 0)}
              trend="flat"
            />
          </div>

          {/* Graphique CA 6 mois */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                CA des 6 derniers mois
              </h2>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats?.months6 ?? []} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => v === 0 ? "0" : `${(v / 1000).toFixed(0)}k`}
                      width={32}
                    />
                    <Tooltip
                      formatter={(v: number) => [formatEUR(v), "CA TTC"]}
                      contentStyle={{
                        fontSize: 12,
                        borderRadius: 8,
                        border: "1px solid hsl(var(--border))",
                        background: "hsl(var(--card))",
                        color: "hsl(var(--foreground))",
                      }}
                    />
                    <Bar dataKey="ca" radius={[4, 4, 0, 0]}>
                      {(stats?.months6 ?? []).map((entry, i) => {
                        const isLast = i === (stats?.months6.length ?? 0) - 1;
                        return (
                          <Cell
                            key={i}
                            fill={isLast ? "hsl(var(--accent))" : "hsl(var(--primary) / 0.5)"}
                          />
                        );
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[10px] text-muted-foreground text-right">Mois en cours en surbrillance</p>
            </CardContent>
          </Card>

          {/* Produits les plus utilisés — 30 derniers jours */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <Package className="h-4 w-4 text-accent" /> Produits les plus utilisés — 30 derniers jours
              </h2>
              {productStats.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune consommation enregistrée via le sélecteur produits.</p>
              ) : (
                <div className="space-y-2">
                  {productStats.slice(0, 8).map((p, i) => (
                    <div key={p.id} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-muted-foreground w-4 shrink-0">#{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium truncate">{p.nom}</span>
                          <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                            {p.total_qty} {p.unite}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Coût : <span className="font-medium text-foreground">{formatEUR(p.cout_total)}</span>
                          <span className="ml-1 opacity-60">({formatEUR(p.prix_achat_ht)} HT / {p.unite})</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="pt-1 border-t text-xs text-muted-foreground flex justify-between">
                    <span>Coût total produits</span>
                    <span className="font-semibold text-foreground">
                      {formatEUR(productStats.reduce((s, p) => s + p.cout_total, 0))}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top 5 clients */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <Trophy className="h-4 w-4 text-accent" /> Top 5 clients — 12 derniers mois
              </h2>
              {(stats?.top5 ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune donnée disponible.</p>
              ) : (
                <div className="space-y-2">
                  {(stats?.top5 ?? []).map((client, i) => {
                    const pct = maxCa > 0 ? (client.ca / maxCa) * 100 : 0;
                    return (
                      <div key={client.id} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-1.5 min-w-0">
                            <span className={cn(
                              "shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                              i === 0 ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
                            )}>
                              {i + 1}
                            </span>
                            <span className="truncate font-medium">{client.nom}</span>
                          </span>
                          <span className="shrink-0 font-semibold text-primary tabular-nums ml-2">{formatEUR(client.ca)}</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn("h-full rounded-full transition-all", i === 0 ? "bg-accent" : "bg-primary/40")}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Par technicien */}
          <TechnicianStatsSection />
        </>
      )}
    </div>
  );
}

// ─── Par technicien ─────────────────────────────────────────────────────────────

const TECH_PERIODS: { v: TechnicianStatsPeriod; l: string }[] = [
  { v: "mois", l: "Mois" },
  { v: "annee", l: "Année" },
  { v: "tout", l: "Tout" },
];

function TechnicianStatsSection() {
  const [period, setPeriod] = useState<TechnicianStatsPeriod>("annee");
  const { data: role } = useCurrentRole();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  useEffect(() => {
    db.auth.getUser().then(({ data }: any) => setCurrentUserId(data.user?.id ?? null));
  }, []);
  const { isLoading, technicians, nonAttribue } = useTechnicianStats(period);

  const isOwner = role === "owner";
  const visibleTechnicians = isOwner
    ? technicians
    : technicians.filter((t) => t.technicien_id === currentUserId);

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <HardHat className="h-4 w-4 text-accent" /> Par technicien
          </h2>
          <div className="flex rounded-lg border border-border overflow-hidden shrink-0">
            {TECH_PERIODS.map((p) => (
              <button
                key={p.v}
                onClick={() => setPeriod(p.v)}
                className={cn(
                  "px-2.5 py-1 text-[11px] font-medium transition-colors",
                  period === p.v ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"
                )}
              >
                {p.l}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Chargement…</p>
        ) : visibleTechnicians.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Aucune donnée pour cette période.</p>
        ) : (
          <div className="space-y-3">
            {visibleTechnicians.map((t) => <TechnicianStatCard key={t.technicien_id} tech={t} />)}
          </div>
        )}

        {isOwner && !isLoading && (
          <div className="pt-2 border-t text-xs text-muted-foreground flex justify-between gap-2">
            <span>Non attribué — factures sans intervention/technicien lié</span>
            <span className="font-semibold text-foreground shrink-0">{formatEUR(nonAttribue.caHt)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TechnicianStatCard({ tech }: { tech: TechnicianStatsEntry }) {
  const topNuisibles = Object.entries(tech.parNuisible).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const maxCount = Math.max(...topNuisibles.map(([, c]) => c), 1);

  return (
    <div className="rounded-xl border border-border p-3 space-y-2.5">
      <div className="font-semibold text-sm">{tech.display_name}</div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-base font-bold tabular-nums">{tech.nbInterventions}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Interv.</div>
        </div>
        <div>
          <div className="text-base font-bold tabular-nums text-primary">{formatEUR(tech.caHt)}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">CA HT</div>
        </div>
        <div>
          <div className="text-base font-bold tabular-nums">{formatEUR(tech.consoValue)}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Conso.</div>
        </div>
      </div>
      {topNuisibles.length > 0 && (
        <div className="space-y-1 pt-1">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Répartition par nuisible</div>
          {topNuisibles.map(([nuisible, count]) => (
            <div key={nuisible} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-24 truncate shrink-0">{nuisible}</span>
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-accent" style={{ width: `${(count / maxCount) * 100}%` }} />
              </div>
              <span className="text-xs font-medium tabular-nums w-5 text-right shrink-0">{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  trend,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  trend: "up" | "down" | "flat";
  detail?: string;
}) {
  const trendColor = trend === "up" ? "text-green-600" : trend === "down" ? "text-destructive" : "text-muted-foreground";
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const bgColor = trend === "up" ? "bg-primary" : trend === "down" ? "bg-destructive" : "bg-muted";
  const textColor = trend === "up" || trend === "down" ? "text-primary-foreground" : "text-muted-foreground";

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-xl", bgColor, textColor)}>
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
            <div className="mt-0.5 text-2xl font-bold tabular-nums">{value}</div>
            {detail && (
              <div className={cn("flex items-center gap-1 text-xs mt-0.5", trendColor)}>
                <TrendIcon className="h-3 w-3 shrink-0" />
                <span>{detail}</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
