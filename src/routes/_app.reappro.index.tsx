import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PackagePlus, CheckCircle2, XCircle, Clock, Truck } from "lucide-react";
import {
  useStockRequests, useStockLevels, useAssignableMembers, resolveTechnicianName,
  getGarageLevel, getVanLevel, logStockMovement,
  type StockRequest,
} from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";
import { PermissionGate } from "@/components/permission-gate";

export const Route = createFileRoute("/_app/reappro/")({
  head: () => ({ meta: [{ title: "Réappro — CITY DERAT" }] }),
  component: () => (
    <PermissionGate perm="reappro">
      <ReapproPage />
    </PermissionGate>
  ),
});

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function invalidateReappro(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["stock_requests"] });
  qc.invalidateQueries({ queryKey: ["my_stock_requests"] });
  qc.invalidateQueries({ queryKey: ["stock_requests_pending_count"] });
  qc.invalidateQueries({ queryKey: ["stock_levels"] });
  qc.invalidateQueries({ queryKey: ["my_van_stock"] });
  qc.invalidateQueries({ queryKey: ["stock_movements"] });
  qc.invalidateQueries({ queryKey: ["my_van_movements"] });
  qc.invalidateQueries({ queryKey: ["dashboard"] });
}

function ReapproPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"en_attente" | "traitees">("en_attente");
  const { data: pending = [], isLoading: pendingLoading } = useStockRequests("en_attente");
  const { data: allRequests = [], isLoading: allLoading } = useStockRequests();
  const { data: levels = [] } = useStockLevels();
  const { data: members = [] } = useAssignableMembers();

  const traitees = allRequests.filter((r) => r.statut !== "en_attente");

  // Sert la demande : transfert garage → camion (même logique que "Réapprovisionner"
  // dans Stock), puis marque la demande comme servie.
  async function handleServe(request: StockRequest) {
    const garage = getGarageLevel(levels, request.product_id);
    const garageQty = garage?.quantite ?? 0;
    if (garageQty < request.quantite) {
      toast.error(`Stock garage insuffisant (${garageQty} disponible)`);
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    const newGarageQty = garageQty - request.quantite;
    const van = getVanLevel(levels, request.product_id, request.technicien_id);
    const newVanQty = (van?.quantite ?? 0) + request.quantite;

    if (garage) {
      const { error } = await db.from("stock_levels").update({ quantite: newGarageQty }).eq("id", garage.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await db.from("stock_levels").insert({ product_id: request.product_id, technicien_id: null, quantite: newGarageQty, user_id: user?.id });
      if (error) { toast.error(error.message); return; }
    }
    if (van) {
      const { error } = await db.from("stock_levels").update({ quantite: newVanQty }).eq("id", van.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await db.from("stock_levels").insert({ product_id: request.product_id, technicien_id: request.technicien_id, quantite: newVanQty, user_id: user?.id });
      if (error) { toast.error(error.message); return; }
    }
    await logStockMovement({ product_id: request.product_id, type: "transfert", technicien_id: request.technicien_id, quantite: request.quantite });

    const { error } = await db.from("stock_requests").update({
      statut: "servie", traite_par: user?.id ?? null, traite_at: new Date().toISOString(),
    }).eq("id", request.id);
    if (error) { toast.error(error.message); return; }

    invalidateReappro(qc);
    toast.success("Demande servie");
  }

  async function handleRefuse(request: StockRequest) {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await db.from("stock_requests").update({
      statut: "refusee", traite_par: user?.id ?? null, traite_at: new Date().toISOString(),
    }).eq("id", request.id);
    if (error) { toast.error(error.message); return; }
    invalidateReappro(qc);
    toast.success("Demande refusée");
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <PackagePlus className="h-6 w-6 text-primary" /> Réappro
        </h1>
        <p className="text-sm text-muted-foreground">Demandes de réapprovisionnement des techniciens.</p>
      </div>

      <div className="flex rounded-xl bg-muted p-1 gap-1">
        {([
          { v: "en_attente" as const, label: `En attente${pending.length > 0 ? ` (${pending.length})` : ""}` },
          { v: "traitees" as const, label: "Traitées" },
        ]).map(({ v, label }) => (
          <button
            key={v}
            onClick={() => setTab(v)}
            className={cn(
              "flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all",
              tab === v ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "en_attente" ? (
        pendingLoading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Chargement…</div>
        ) : pending.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
            <CheckCircle2 className="mx-auto mb-2 h-8 w-8 opacity-50" />
            Aucune demande en attente.
          </CardContent></Card>
        ) : (
          <div className="space-y-2">
            {pending.map((r) => (
              <Card key={r.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{r.product?.nom ?? "Produit"} — {r.quantite} {r.product?.unite}</p>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                        <Truck className="h-3 w-3 shrink-0" />
                        {resolveTechnicianName(members, r.technicien_id) ?? "Technicien"}
                        <span className="opacity-50">·</span>
                        <span>{formatDateTime(r.created_at)}</span>
                      </div>
                      {r.note && <p className="text-xs text-muted-foreground italic mt-1">{r.note}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1" onClick={() => handleServe(r)}>
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Servir
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 text-destructive hover:text-destructive" onClick={() => handleRefuse(r)}>
                      <XCircle className="mr-1.5 h-3.5 w-3.5" /> Refuser
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : (
        allLoading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Chargement…</div>
        ) : traitees.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
            <Clock className="mx-auto mb-2 h-8 w-8 opacity-50" />
            Aucune demande traitée pour le moment.
          </CardContent></Card>
        ) : (
          <div className="space-y-2">
            {traitees.map((r) => (
              <Card key={r.id}>
                <CardContent className="p-3 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{r.product?.nom ?? "Produit"} — {r.quantite} {r.product?.unite}</p>
                    <span className={cn(
                      "shrink-0 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                      r.statut === "servie" ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"
                    )}>
                      {r.statut === "servie" ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      {r.statut === "servie" ? "Servie" : "Refusée"}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {resolveTechnicianName(members, r.technicien_id) ?? "Technicien"} · {formatDateTime(r.created_at)}
                  </div>
                  {r.note && <p className="text-xs text-muted-foreground italic">{r.note}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )
      )}

      <Link to="/stock" className="block text-center text-xs text-muted-foreground hover:text-foreground underline">
        Voir le stock
      </Link>
    </div>
  );
}
