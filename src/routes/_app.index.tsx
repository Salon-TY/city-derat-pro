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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground">Aperçu de votre activité.</p>
      </div>

      <div className="grid gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${c.tone}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide">{c.label}</div>
                    <div className="mt-0.5 text-2xl font-bold tabular-nums">
                      {isLoading ? "…" : c.value}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

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
