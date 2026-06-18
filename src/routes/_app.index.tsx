import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDashboardStats, useSettings } from "@/lib/queries";
import { formatEUR, formatDateFR } from "@/lib/schemas";
import {
  ClipboardList, Euro, AlertCircle, Plus, UserPlus, FileText,
  TrendingUp, TrendingDown, Minus, Phone, AlertTriangle, Package, MapPin, FileCheck
} from "lucide-react";
import { useQuotes } from "@/lib/queries";

export const Route = createFileRoute("/_app/")({
  head: () => ({ meta: [{ title: "Tableau de bord — CITY DERAT" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data: stats, isLoading } = useDashboardStats();
  const { data: settings } = useSettings();
  const { data: devis = [] } = useQuotes();
  const navigate = useNavigate();
  const devisEnAttente = devis.filter((d) => d.statut === "brouillon" || d.statut === "envoye").length;

  const objectif = settings?.objectif_ca_mensuel ?? 3000;
  const caMonth = stats?.caMonth ?? 0;
  const caProgress = objectif > 0 ? Math.min(100, (caMonth / objectif) * 100) : 0;

  const caDiff = caMonth - (stats?.caPrevMonth ?? 0);
  const caTrend = caDiff > 0 ? "up" : caDiff < 0 ? "down" : "flat";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground">Aperçu de votre activité.</p>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-1 md:gap-3">

        {/* CA du mois — cliquable vers trésorerie */}
        <Link to="/tresorerie" className="col-span-2 order-1 md:order-2 block">
          <Card className="overflow-hidden hover:border-accent/50 transition-colors">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground md:h-12 md:w-12">
                  <Euro className="h-4 w-4 md:h-6 md:w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">CA du mois</div>
                  <div className="mt-0.5 text-xl font-bold tabular-nums md:text-2xl">
                    {isLoading ? "…" : formatEUR(caMonth)}
                  </div>
                  {!isLoading && stats?.caPrevMonth !== undefined && (
                    <div className={`flex items-center gap-1 text-xs mt-0.5 ${caTrend === "up" ? "text-green-600" : caTrend === "down" ? "text-destructive" : "text-muted-foreground"}`}>
                      {caTrend === "up" ? <TrendingUp className="h-3 w-3" /> : caTrend === "down" ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                      <span>vs mois dernier : {formatEUR(stats.caPrevMonth)}</span>
                    </div>
                  )}
                  {!isLoading && objectif > 0 && (
                    <div className="mt-2">
                      <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                        <span>Objectif mensuel</span>
                        <span>{Math.round(caProgress)}% — {formatEUR(objectif)}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${caProgress >= 100 ? "bg-green-500" : caProgress >= 50 ? "bg-accent" : "bg-orange-400"}`}
                          style={{ width: `${caProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Interventions du jour — cliquable vers interventions */}
        <Link to="/interventions" className="overflow-hidden order-2 md:order-1 block">
          <Card className="hover:border-primary/40 transition-colors h-full">
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
        </Link>

        {/* Devis en attente */}
        {devisEnAttente > 0 && (
          <Link to="/devis" className="overflow-hidden order-3 block">
            <Card className="hover:border-accent/40 transition-colors h-full">
              <CardContent className="p-3 md:p-4">
                <div className="flex items-center gap-2 md:gap-4">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent md:h-12 md:w-12">
                    <FileCheck className="h-4 w-4 md:h-6 md:w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] leading-tight text-muted-foreground uppercase tracking-wide md:text-xs">Devis en attente</div>
                    <div className="mt-0.5 text-xl font-bold tabular-nums md:text-2xl">{devisEnAttente}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        )}

        {/* Factures impayées — cliquable vers factures */}
        <Link to="/factures" search={{ statut: "retard" }} className="overflow-hidden order-3 block">
          <Card className="hover:border-destructive/40 transition-colors h-full">
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
        </Link>
      </div>

      {/* Interventions du jour avec téléphone — cliquables */}
      {!isLoading && (stats?.todayInterventions?.length ?? 0) > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Mes interventions aujourd'hui
          </h2>
          <div className="space-y-2">
            {stats!.todayInterventions.map((inv: any) => (
              <Link key={inv.id} to="/interventions/$id" params={{ id: inv.id }} className="block">
                <Card className="hover:border-primary/40 transition-colors">
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
                          onClick={(e) => e.stopPropagation()}
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
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Phone className="h-4 w-4" />
                        Appeler
                      </a>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Alertes factures en retard > 7 jours (rouge) */}
      {!isLoading && (stats?.overdueInvoices?.length ?? 0) > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div className="text-sm flex-1">
              <span className="font-semibold text-destructive">
                {stats!.overdueInvoices.length} facture{stats!.overdueInvoices.length > 1 ? "s" : ""} en retard depuis plus de 7 jours
              </span>
              <ul className="mt-1 space-y-1">
                {stats!.overdueInvoices.map((inv: any) => (
                  <li key={inv.id} className="flex items-center justify-between gap-2">
                    <span className="text-xs text-destructive/80 truncate">
                      {(inv.client as any)?.raison_sociale ?? "—"} — {formatEUR(inv.total_ttc)} ({inv.daysLate}j de retard)
                    </span>
                    <Link
                      to="/factures/$id"
                      params={{ id: inv.id }}
                      className="shrink-0 text-[10px] font-medium text-destructive underline"
                    >
                      Voir
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alertes contrats urgents (< 7 jours) — cliquable vers contrats */}
      {!isLoading && (stats?.expiringContracts?.filter((c: any) => c.urgent).length ?? 0) > 0 && (
        <Link to="/contrats" className="block">
          <Card className="border-destructive/50 bg-destructive/5 hover:border-destructive/70 transition-colors">
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
        </Link>
      )}

      {/* Alertes contrats bientôt (7–30 jours) — cliquable vers contrats */}
      {!isLoading && (stats?.expiringContracts?.filter((c: any) => !c.urgent).length ?? 0) > 0 && (
        <Link to="/contrats" className="block">
          <Card className="border-orange-300 bg-orange-50 dark:bg-orange-950/20 hover:border-orange-400 transition-colors">
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
        </Link>
      )}

      {/* Alertes stock */}
      {!isLoading && (stats?.stockAlerts?.length ?? 0) > 0 && (
        <Link to="/stock" className="block">
          <Card className="border-red-300 bg-red-50 dark:bg-red-950/20 hover:border-red-400 transition-colors">
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
        </Link>
      )}

      {/* Actions rapides */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Actions rapides</h2>
        <div className="grid grid-cols-1 gap-2">
          <Button asChild size="lg" className="h-14 justify-start bg-green-700 hover:bg-green-800 text-white">
            <Link to="/interventions/new"><Plus className="mr-2 h-5 w-5" /> Nouvelle intervention rapide</Link>
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
