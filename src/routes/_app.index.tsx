import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDashboardStats } from "@/lib/queries";
import { formatEUR, formatDateFR } from "@/lib/schemas";
import { ClipboardList, Euro, AlertCircle, Plus, UserPlus, FileText, TrendingUp, TrendingDown, Minus, Phone, AlertTriangle, Package, MapPin } from "lucide-react";

export const Route = createFileRoute("/_app/")({
  head: () => ({ meta: [{ title: "Tableau de bord — CITY DERAT" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data: stats, isLoading } = useDashboardStats();

  const caDiff = (stats?.caMonth ?? 0) - (stats?.caPrevMonth ?? 0);
  const caTrend = caDiff > 0 ? "up" : caDiff < 0 ? "down" : "flat";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground">Aperçu de votre activité.</p>
      </div>

      {/* KPIs
          Mobile  : grille 2 colonnes compacte — CA pleine largeur (col-span-2), les 2 autres côte à côte
          Desktop : colonne unique, cartes pleine largeur (comportement actuel) */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-1 md:gap-3">

        {/* CA du mois — col-span-2 sur mobile (pleine largeur), order-1 desktop */}
        <Card className="col-span-2 overflow-hidden order-1 md:order-2">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground md:h-12 md:w-12">
                <Euro className="h-4 w-4 md:h-6 md:w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">CA du mois</div>
                <div className="mt-0.5 text-xl font-bold tabular-nums md:text-2xl">
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

        {/* Interventions du jour — col-span-1 sur mobile, order-1 desktop */}
        <Card className="overflow-hidden order-2 md:order-1">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 md:gap-4">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground md:h-12 md:w-12">
                <ClipboardList className="h-4 w-4 md:h-6 md:w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] leading-tight text-muted-foreground uppercase tracking-wide md:text-xs">Interventions du jour</div>
                <div className="mt-0.5 text-xl font-bold tabular-nums md:text-2xl">
                  {isLoading ? "…" : stats?.interventionsToday ?? 0}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Factures impayées — col-span-1 sur mobile, order-3 desktop */}
        <Card className="overflow-hidden order-3">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 md:gap-4">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-destructive text-destructive-foreground md:h-12 md:w-12">
                <AlertCircle className="h-4 w-4 md:h-6 md:w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] leading-tight text-muted-foreground uppercase tracking-wide md:text-xs">
                  Impayées ({stats?.unpaidCount ?? 0})
                </div>
                <div className="mt-0.5 text-xl font-bold tabular-nums md:text-2xl">
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
                    <div className="text-xs text-muted-foreground">{inv.type_intervention}</div>
                    {inv.adresse_site && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(inv.adresse_site)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-primary hover:underline mt-0.5"
                      >
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{inv.adresse_site}</span>
                      </a>
                    )}
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

      {/* Alertes contrats urgents (< 7 jours) */}
      {!isLoading && (stats?.expiringContracts?.filter((c: any) => c.urgent).length ?? 0) > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div className="text-sm">
              <span className="font-semibold text-destructive">
                {stats!.expiringContracts.filter((c: any) => c.urgent).length} contrat{stats!.expiringContracts.filter((c: any) => c.urgent).length > 1 ? "s" : ""} expirent dans moins de 7 jours !
              </span>
              <ul className="mt-1 space-y-0.5">
                {stats!.expiringContracts.filter((c: any) => c.urgent).map((c: any) => (
                  <li key={c.id} className="text-xs text-destructive/80">
                    {c.client?.raison_sociale ?? "—"} — expire le {formatDateFR(c.date_fin)}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alertes contrats bientôt (7–30 jours) */}
      {!isLoading && (stats?.expiringContracts?.filter((c: any) => !c.urgent).length ?? 0) > 0 && (
        <Card className="border-orange-300 bg-orange-50 dark:bg-orange-950/20">
          <CardContent className="p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
            <div className="text-sm">
              <span className="font-semibold text-orange-700 dark:text-orange-400">
                {stats!.expiringContracts.filter((c: any) => !c.urgent).length} contrat{stats!.expiringContracts.filter((c: any) => !c.urgent).length > 1 ? "s" : ""} expirant bientôt
              </span>
              <ul className="mt-1 space-y-0.5">
                {stats!.expiringContracts.filter((c: any) => !c.urgent).map((c: any) => (
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
