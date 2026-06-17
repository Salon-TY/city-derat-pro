import { createFileRoute, useNavigate, Link, useSearch } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { InterventionForm, type StockUsageItem } from "@/components/intervention-form";
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

  async function handleSubmit(values: IFType, stockItems: StockUsageItem[]) {
    const { data: userRes } = await supabase.auth.getUser();
    const payload = {
      ...values,
      date_prochain_passage: values.date_prochain_passage || null,
      user_id: userRes.user?.id,
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
