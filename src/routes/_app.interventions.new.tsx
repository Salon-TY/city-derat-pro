import { createFileRoute, useNavigate, Link, useSearch } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { InterventionForm, type StockUsageItem, type PhotoFile } from "@/components/intervention-form";
import { uploadInterventionPhotos } from "@/lib/photos";
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

  async function handleSubmit(values: IFType, stockItems: StockUsageItem[], photoFiles: PhotoFile[]) {
    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes.user?.id ?? "";
    const technicienId = values.technicien_id || null;

    // Vérification stock avant enregistrement (camion du technicien assigné, sinon garage)
    const warnings: string[] = [];
    for (const item of stockItems) {
      const level = await fetchStockLevel(item.product_id, technicienId);
      const disponible = Number(level?.quantite ?? 0);
      if (disponible < item.quantite) {
        warnings.push(`Stock insuffisant pour ${item.nom} : il reste seulement ${disponible} ${item.unite} ${technicienId ? "sur le camion" : "au garage"}`);
      }
    }
    if (warnings.length > 0) {
      const proceed = window.confirm(`⚠️ Attention :\n${warnings.join("\n")}\n\nContinuer quand même ?`);
      if (!proceed) return;
    }

    // Upload photos
    const photoUrls = await uploadInterventionPhotos(photoFiles, userId);

    const produits_utilises = stockItems.map((i) => ({
      product_id: i.product_id,
      nom: i.nom,
      quantite: i.quantite,
      unite: i.unite,
    }));

    const payload = {
      ...values,
      contract_id: values.contract_id || null,
      technicien_id: values.technicien_id || null,
      date_prochain_passage: values.date_prochain_passage || null,
      user_id: userId,
      photos: photoUrls.length > 0 ? photoUrls : null,
      produits_utilises: produits_utilises.length > 0 ? produits_utilises : [],
    };
    const { data: newIntervention, error } = await db.from("interventions").insert(payload).select().single();
    if (error) { toast.error(error.message); return; }

    if (payload.contract_id && payload.statut === "realisee") {
      const { data: contract } = await db.from("contracts").select("passages_realises, nb_passages_inclus").eq("id", payload.contract_id).maybeSingle();
      if (contract) {
        const next = Math.min(contract.nb_passages_inclus, contract.passages_realises + 1);
        await db.from("contracts").update({ passages_realises: next }).eq("id", payload.contract_id);
        qc.invalidateQueries({ queryKey: ["contracts"] });
      }
    }

    // Déduction automatique du stock — camion du technicien assigné, sinon garage.
    // Clampée à 0 ; crée la ligne de niveau si elle n'existe pas encore.
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
    toast.success("Intervention enregistrée");
    navigate({ to: "/interventions" });
  }

  return (
    <div className="space-y-4">
      <Link to="/interventions" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" /> Retour
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">Nouvelle intervention</h1>
      <InterventionForm
        defaultValues={{
          client_id: search.client_id,
          date: search.date,
        }}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
