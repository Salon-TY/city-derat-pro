import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useInvoices } from "@/lib/queries";
import { formatEUR, formatDateFR, STATUTS_FACTURE } from "@/lib/schemas";
import { Plus, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { db } from "@/lib/db";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_app/factures/")({
  head: () => ({ meta: [{ title: "Factures — CITY DERAT" }] }),
  component: FacturesPage,
});

const STATUT_COLORS: Record<string, string> = {
  brouillon: "bg-muted text-muted-foreground",
  envoyee: "bg-accent/15 text-accent",
  payee: "bg-primary/15 text-primary",
  retard: "bg-destructive/15 text-destructive",
};

const FILTERS = [
  { value: "all", label: "Toutes" },
  { value: "brouillon", label: "Brouillon" },
  { value: "envoyee", label: "Envoyée" },
  { value: "payee", label: "Payée" },
  { value: "retard", label: "En retard" },
] as const;

function statutLabel(v: string) {
  return STATUTS_FACTURE.find((s) => s.value === v)?.label ?? v;
}

function FacturesPage() {
  const { data: invoices = [], isLoading } = useInvoices();
  const [filtre, setFiltre] = useState<string>("all");
  const qc = useQueryClient();

  const filtered = useMemo(
    () => (filtre === "all" ? invoices : invoices.filter((f) => f.statut === filtre)),
    [invoices, filtre]
  );

  async function updateStatut(id: string, statut: string) {
    const { error } = await db.from("invoices").update({ statut }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["invoices"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    toast.success("Statut mis à jour");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Factures</h1>
        <Button asChild size="sm" className="shrink-0">
          <Link to="/factures/new"><Plus className="mr-1 h-4 w-4" /> Nouvelle</Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFiltre(f.value)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
              filtre === f.value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:text-foreground"
            )}
          >
            {f.label}
            <span className="ml-1.5 opacity-70">
              {f.value === "all" ? invoices.length : invoices.filter((i) => i.statut === f.value).length}
            </span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center text-sm text-muted-foreground py-10">Chargement…</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          {invoices.length === 0 ? "Aucune facture. Commencez par en créer une." : "Aucune facture pour ce filtre."}
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((inv) => (
            <Card key={inv.id} className="overflow-hidden">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold">Facture N°{inv.numero}</div>
                    <div className="text-sm text-muted-foreground truncate">{inv.client?.raison_sociale ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{formatDateFR(inv.date_facture)}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-lg">{formatEUR(inv.total_ttc)}</div>
                    <span className={cn("text-[10px] font-medium uppercase rounded-full px-2 py-0.5", STATUT_COLORS[inv.statut] ?? "bg-muted")}>
                      {statutLabel(inv.statut)}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Link to="/factures/$id" params={{ id: inv.id }}>
                    <Button variant="outline" size="sm" className="h-7 text-xs"><FileText className="mr-1 h-3 w-3" />Voir</Button>
                  </Link>
                  {inv.statut === "brouillon" && (
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => updateStatut(inv.id, "envoyee")}>Marquer envoyée</Button>
                  )}
                  {inv.statut === "envoyee" && (
                    <Button variant="outline" size="sm" className="h-7 text-xs text-primary" onClick={() => updateStatut(inv.id, "payee")}>Marquer payée</Button>
                  )}
                  {(inv.statut === "envoyee" || inv.statut === "brouillon") && (
                    <Button variant="outline" size="sm" className="h-7 text-xs text-destructive" onClick={() => updateStatut(inv.id, "retard")}>En retard</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
