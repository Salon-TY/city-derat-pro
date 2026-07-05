import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { ClientForm } from "@/components/client-form";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ClientForm as ClientFormType } from "@/lib/schemas";
import { PermissionGate } from "@/components/permission-gate";

export const Route = createFileRoute("/_app/clients/new")({
  head: () => ({ meta: [{ title: "Nouveau client — CITY DERAT" }] }),
  component: () => (
    <PermissionGate perm="clients">
      <NewClient />
    </PermissionGate>
  ),
});

function NewClient() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function handleSubmit(values: ClientFormType) {
    const { data: userRes } = await supabase.auth.getUser();
    const { data, error } = await db.from("clients").insert({ ...values, user_id: userRes.user?.id }).select().single();
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["clients"] });
    toast.success("Client créé");
    navigate({ to: "/clients/$id", params: { id: data.id } });
  }

  return (
    <div className="space-y-4">
      <Link to="/clients" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" /> Retour
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">Nouveau client</h1>
      <ClientForm onSubmit={handleSubmit} />
    </div>
  );
}
