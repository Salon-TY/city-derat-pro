import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDashboardStats } from "@/lib/queries";
import { formatEUR } from "@/lib/schemas";
import { ClipboardList, Euro, AlertCircle, Plus, UserPlus, FileText, PackageX } from "lucide-react";

export const Route = createFileRoute("/_app/")({
  head: () => ({ meta: [{ title: "Tableau de bord — CITY DERAT" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data: stats, isLoading } = useDashboardStats();

<<<<<<< HEAD
  const caDiff = (stats?.caMonth ?? 0) - (stats?.caPrevMonth ?? 0);
  const caTrend = caDiff > 0 ? "up" : caDiff < 0 ? "down" : "flat";
=======
  const cards = [
    {
      label: "Interventions du jour",
      value: stats?.interventionsToday ?? 0,
      icon: ClipboardList,
      tone: "bg-primary text-primary-foreground",
    },
    {
      label: "CA du mois",
      value: formatEUR(stats?.caMonth),
      icon: Euro,
      tone: "bg-accent text-accent-foreground",
    },
    {
      label: `Factures impayées (${stats?.unpaidCount ?? 0})`,
      value: formatEUR(stats?.unpaidTotal),
      icon: AlertCircle,
      tone: "bg-destructive text-destructive-foreground",
    },
    {
      label: "Stock bas",
      value: stats?.lowStockCount ?? 0,
      icon: PackageX,
      tone: "bg-destructive text-destructive-foreground",
    },
  ];
>>>>>>> dc150051b1677361174da1062a3a2c70954041e2

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground">Aperçu de votre activité.</p>
      </div>

      {/* KPIs */}
      <div className="grid gap-3">
        <Card className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
                <ClipboardList className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Interventions du jour</div>
                <div className="mt-0.5 text-2xl font-bold tabular-nums">
                  {isLoading ? "…" : stats?.interventionsToday ?? 0}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
                <Euro className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">CA du mois</div>
                <div className="mt-0.5 text-2xl font-bold tabular-nums">
                  {isLoading ? "…" : formatEUR(stats?.caMonth)}
                </div>
                {!isLoading && stats?.caPrevMonth !== undefined && (
                  <div className={`flex items-center gap-1 text-xs mt-0.5 ${caTrend === "up" ? "text-green-600" : caTrend === "down" ? "text-destructive" : "text-muted-foreground"}`}>
                    {caTrend === "up" ? <TrendingUp className="h-3 w-3" /> : caTrend === "down" ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                    <span>vs mois dernier : {formatEUR(stats.caPrevMonth)}</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-destructive text-destructive-foreground">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  Factures impayées ({stats?.unpaidCount ?? 0})
                </div>
                <div className="mt-0.5 text-2xl font-bold tabular-nums">
                  {isLoading ? "…" : formatEUR(stats?.unpaidTotal)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Interventions du jour avec téléphone */}
      {!isLoading && (stats?.todayInterventions?.length ?? 0) > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Mes interventions aujourd'hui
          </h2>
          <div className="space-y-2">
            {stats!.todayInterventions.map((inv: any) => (
              <Card key={inv.id}>
                <CardContent className="p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">{inv.client?.raison_sociale ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{inv.type_intervention} · {inv.adresse_site}</div>
                  </div>
                  {inv.client?.telephone && (
                    <a
                      href={`tel:${inv.client.telephone}`}
                      className="flex items-center gap-1.5 shrink-0 rounded-lg bg-primary/10 px-3 py-2 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
                    >
                      <Phone className="h-4 w-4" />
                      Appeler
                    </a>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Alertes contrats */}
      {!isLoading && (stats?.expiringContracts?.length ?? 0) > 0 && (
        <Card className="border-orange-300 bg-orange-50 dark:bg-orange-950/20">
          <CardContent className="p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
            <div className="text-sm">
              <span className="font-semibold text-orange-700 dark:text-orange-400">
                {stats!.expiringContracts.length} contrat{stats!.expiringContracts.length > 1 ? "s" : ""} expirant bientôt
              </span>
              <ul className="mt-1 space-y-0.5">
                {stats!.expiringContracts.map((c: any) => (
                  <li key={c.id} className="text-xs text-orange-600 dark:text-orange-300">
                    {c.client?.raison_sociale ?? "—"} — expire le {formatDateFR(c.date_fin)}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alertes stock */}
      {!isLoading && (stats?.stockAlerts?.length ?? 0) > 0 && (
        <Card className="border-red-300 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-3 flex items-start gap-2">
            <Package className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <div className="text-sm">
              <span className="font-semibold text-red-700 dark:text-red-400">
                {stats!.stockAlerts.length} produit{stats!.stockAlerts.length > 1 ? "s" : ""} en stock bas
              </span>
              <ul className="mt-1 space-y-0.5">
                {stats!.stockAlerts.map((p: any) => (
                  <li key={p.id} className="text-xs text-red-600 dark:text-red-300">
                    {p.nom} — {p.quantite} {p.unite} restant{p.quantite > 1 ? "s" : ""}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions rapides */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Actions rapides</h2>
        <div className="grid grid-cols-1 gap-2">
          <Button asChild size="lg" className="h-14 justify-start bg-primary hover:bg-primary/90">
            <Link to="/interventions/new"><Plus className="mr-2 h-5 w-5" /> Nouvelle intervention</Link>
          </Button>
          <Button asChild size="lg" variant="secondary" className="h-14 justify-start">
            <Link to="/clients/new"><UserPlus className="mr-2 h-5 w-5" /> Nouveau client</Link>
          </Button>
          <Button asChild size="lg" className="h-14 justify-start bg-accent text-accent-foreground hover:bg-accent/90">
            <Link to="/factures/new"><FileText className="mr-2 h-5 w-5" /> Nouvelle facture</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
