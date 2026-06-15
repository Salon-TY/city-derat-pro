import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { settingsSchema, type SettingsForm } from "@/lib/schemas";
import { useSettings } from "@/lib/queries";
import { db } from "@/lib/db";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_app/parametres")({
  head: () => ({ meta: [{ title: "Paramètres — CITY DERAT" }] }),
  component: ParametresPage,
});

function ParametresPage() {
  const { data: settings } = useSettings();
  const qc = useQueryClient();
  const form = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema) as any,
    defaultValues: { nom: "CITY DERAT", adresse: "", siret: "", tva_number: "", telephone: "", email: "", iban: "", bic: "" },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        nom: settings.nom ?? "CITY DERAT",
        adresse: settings.adresse ?? "",
        siret: settings.siret ?? "",
        tva_number: settings.tva_number ?? "",
        telephone: settings.telephone ?? "",
        email: settings.email ?? "",
        iban: settings.iban ?? "",
        bic: settings.bic ?? "",
      });
    }
  }, [settings, form]);

  async function onSubmit(values: SettingsForm) {
    const { error } = await db.from("company_settings").update(values).eq("user_id", settings?.user_id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["settings"] });
    toast.success("Paramètres enregistrés");
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Paramètres</h1>
      <Card><CardContent className="p-4">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Société</h2>
          <Field label="Nom *" error={form.formState.errors.nom?.message}><Input {...form.register("nom")} /></Field>
          <Field label="Adresse"><Textarea rows={2} {...form.register("adresse")} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="SIRET"><Input {...form.register("siret")} /></Field>
            <Field label="N° TVA"><Input {...form.register("tva_number")} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Téléphone"><Input {...form.register("telephone")} /></Field>
            <Field label="Email" error={form.formState.errors.email?.message}><Input type="email" {...form.register("email")} /></Field>
          </div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground pt-2">Coordonnées bancaires</h2>
          <Field label="IBAN"><Input {...form.register("iban")} /></Field>
          <Field label="BIC"><Input {...form.register("bic")} /></Field>
          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>Enregistrer</Button>
        </form>
      </CardContent></Card>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
