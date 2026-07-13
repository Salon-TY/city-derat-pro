import { createFileRoute, useNavigate, Link, useSearch } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { InterventionForm, type StockUsageItem } from "@/components/intervention-form";
import { logStockMovement } from "@/lib/queries";
import { db } from "@/lib/db";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { InterventionForm as IFType } from "@/lib/schemas";

export const Route = createFileRoute("/_app/interventions/new")({
  head: () => ({ meta: [{ title: "Nouvelle intervention — CITY DERAT" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    client_id: typeof s.client_id === "string" ? s.client_id : undefined,
    date: typeof s.date === "string" ? s.date : undefined,
  }),
  component: NewIntervention,
});

// Récupère le niveau de stock d'un produit à l'emplacement voulu (camion du
// technicien si assigné, sinon garage). Retourne null si aucune ligne n'existe.
async function fetchStockLevel(productId: string, technicienId: string | null) {
  let q = db.from("stock_levels").select("id, quantite").eq("product_id", productId);
  q = technicienId ? q.eq("technicien_id", technicienId) : q.is("technicien_id", null);
  const { data } = await q.maybeSingle();
  return data as { id: string; quantite: number } | null;
}

function NewIntervention() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const search = useSearch({ from: "/_app/interventions/new" });

  // Création = planification uniquement : aucun produit/stock n'est saisi ici,
  // le compte-rendu (produits, observations, photos, signature) se remplit
  // depuis la page détail une fois l'intervention démarrée par l'assigné.
  async function handleSubmit(values: IFType, stockItems: StockUsageItem[]) {
    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes.user?.id ?? "";
    const technicienId = values.technicien_id || null;

    const payload = {
      ...values,
      contract_id: values.contract_id || null,
      technicien_id: values.technicien_id || null,
      date_prochain_passage: values.date_prochain_passage || null,
      user_id: userId,
    };
    const { data: newIntervention, error } = await db.from("interventions").insert(payload).select().single();
    if (error) { toast.error(error.message); return; }

    // Filet de sécurité : si des produits ont malgré tout été fournis (compat.
    // futur), on applique la même déduction qu'avant plutôt que de la perdre.
    for (const item of stockItems) {
      const level = await fetchStockLevel(item.product_id, technicienId);
      const current = Number(level?.quantite ?? 0);
      const next = Math.max(0, current - item.quantite);
      if (level) {
        await db.from("stock_levels").update({ quantite: next }).eq("id", level.id);
      } else {
        await db.from("stock_levels").insert({ product_id: item.product_id, technicien_id: technicienId, quantite: next, user_id: userId });
      }
      await logStockMovement({
        product_id: item.product_id,
        type: "consommation",
        technicien_id: technicienId,
        intervention_id: newIntervention?.id ?? null,
        quantite: item.quantite,
      });
    }
    if (stockItems.length > 0) {
      qc.invalidateQueries({ queryKey: ["stock_levels"] });
      qc.invalidateQueries({ queryKey: ["my_van_stock"] });
      qc.invalidateQueries({ queryKey: ["product_stats"] });
    }

    qc.invalidateQueries({ queryKey: ["interventions"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["my_todo_count"] });
    toast.success("Intervention planifiée");
    navigate({ to: "/interventions" });
  }

  return (
    <div className="space-y-4">
      <Link to="/interventions" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" /> Retour
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">Nouvelle intervention</h1>
      <InterventionForm
        mode="planification"
        defaultValues={{
          client_id: search.client_id,
          date: search.date,
        }}
        onSubmit={handleSubmit}
        submitLabel="Planifier l'intervention"
      />
    </div>
  );
}
