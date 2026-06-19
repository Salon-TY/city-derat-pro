import { createFileRoute, useNavigate, Link, useSearch } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { InterventionForm, type StockUsageItem, type PhotoFile } from "@/components/intervention-form";
import { uploadInterventionPhotos } from "@/lib/photos";
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

function NewIntervention() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const search = useSearch({ from: "/_app/interventions/new" });

  async function handleSubmit(values: IFType, stockItems: StockUsageItem[], photoFiles: PhotoFile[]) {
    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes.user?.id ?? "";

    // Vérification stock avant enregistrement
    const warnings: string[] = [];
    for (const item of stockItems) {
      const { data: current } = await db.from("stock_products").select("quantite, nom, unite").eq("id", item.product_id).maybeSingle();
      if (current && Number(current.quantite) < item.quantite) {
        warnings.push(`Stock insuffisant pour ${current.nom} : il reste seulement ${current.quantite} ${current.unite}`);
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
      date_prochain_passage: values.date_prochain_passage || null,
      user_id: userId,
      photos: photoUrls.length > 0 ? photoUrls : null,
      produits_utilises: produits_utilises.length > 0 ? produits_utilises : [],
    };
    const { error } = await db.from("interventions").insert(payload);
    if (error) { toast.error(error.message); return; }

    // Déduction automatique du stock
    for (const item of stockItems) {
      const { data: current } = await db.from("stock_products").select("quantite").eq("id", item.product_id).maybeSingle();
      if (current) {
        const next = Math.max(0, Number(current.quantite) - item.quantite);
        await db.from("stock_products").update({ quantite: next }).eq("id", item.product_id);
      }
    }
    if (stockItems.length > 0) {
      qc.invalidateQueries({ queryKey: ["stock_products"] });
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
