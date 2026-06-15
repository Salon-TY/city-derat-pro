import { createFileRoute, useNavigate, Link, useSearch } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { InterventionForm } from "@/components/intervention-form";
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

  async function handleSubmit(values: IFType) {
    const { data: userRes } = await supabase.auth.getUser();
    const payload = {
      ...values,
      date_prochain_passage: values.date_prochain_passage || null,
      user_id: userRes.user?.id,
    };
    const { error } = await db.from("interventions").insert(payload);
    if (error) { toast.error(error.message); return; }
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
