import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { settingsSchema, type SettingsForm } from "@/lib/schemas";
import { useSettings } from "@/lib/queries";
import { db } from "@/lib/db";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart2, ChevronRight, Download } from "lucide-react";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/_app/parametres")({
  head: () => ({ meta: [{ title: "Paramètres — CITY DERAT" }] }),
  component: ParametresPage,
});

function ParametresPage() {
  const { data: settings } = useSettings();
  const qc = useQueryClient();
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const [clients, interventions, invoices, invoiceLines, contracts, stock] = await Promise.all([
        db.from("clients").select("*").order("raison_sociale"),
        db.from("interventions").select("*, client:clients(raison_sociale)").order("date", { ascending: false }),
        db.from("invoices").select("*, client:clients(raison_sociale)").order("numero", { ascending: false }),
        db.from("invoice_lines").select("*").order("ordre"),
        db.from("contracts").select("*, client:clients(raison_sociale)").order("date_fin"),
        db.from("stock_products").select("*").order("nom"),
      ]);

      const wb = XLSX.utils.book_new();

      const sheetClients = XLSX.utils.json_to_sheet(
        (clients.data ?? []).map((c: any) => ({
          "Raison sociale": c.raison_sociale,
          "Adresse": c.adresse_site ?? "",
          "Téléphone": c.telephone ?? "",
          "Email": c.email ?? "",
          "SIRET": c.siret ?? "",
          "Type nuisible": c.type_nuisible ?? "",
          "Notes": c.notes ?? "",
          "Créé le": c.created_at?.slice(0, 10) ?? "",
        }))
      );
      XLSX.utils.book_append_sheet(wb, sheetClients, "Clients");

      const sheetInterventions = XLSX.utils.json_to_sheet(
        (interventions.data ?? []).map((i: any) => ({
          "Date": i.date,
          "Client": (i.client as any)?.raison_sociale ?? "",
          "Adresse": i.adresse_site ?? "",
          "Type nuisible": i.type_nuisible ?? "",
          "Type intervention": i.type_intervention ?? "",
          "Produits": i.produits ?? "",
          "Quantité": i.quantite ?? "",
          "Statut": i.statut,
          "Observations": i.observations ?? "",
          "Prochain passage": i.date_prochain_passage ?? "",
        }))
      );
      XLSX.utils.book_append_sheet(wb, sheetInterventions, "Interventions");

      const sheetFactures = XLSX.utils.json_to_sheet(
        (invoices.data ?? []).map((f: any) => ({
          "N°": f.numero,
          "Date": f.date_facture,
          "Échéance": f.echeance ?? "",
          "Client": (f.client as any)?.raison_sociale ?? "",
          "Statut": f.statut,
          "Total HT": f.total_ht,
          "TVA": f.tva,
          "Total TTC": f.total_ttc,
          "Notes": f.notes ?? "",
        }))
      );
      XLSX.utils.book_append_sheet(wb, sheetFactures, "Factures");

      const sheetLines = XLSX.utils.json_to_sheet(
        (invoiceLines.data ?? []).map((l: any) => ({
          "Facture ID": l.invoice_id,
          "Description": l.description,
          "Quantité": l.quantite,
          "Prix unitaire HT": l.prix_unitaire_ht,
          "Total HT": l.total_ht,
          "Ordre": l.ordre,
        }))
      );
      XLSX.utils.book_append_sheet(wb, sheetLines, "Lignes factures");

      const sheetContrats = XLSX.utils.json_to_sheet(
        (contracts.data ?? []).map((c: any) => ({
          "Client": (c.client as any)?.raison_sociale ?? "",
          "Date début": c.date_debut,
          "Date fin": c.date_fin,
          "Passages inclus": c.nb_passages_inclus,
          "Passages réalisés": c.passages_realises,
          "Statut": c.statut,
          "Notes": c.notes ?? "",
        }))
      );
      XLSX.utils.book_append_sheet(wb, sheetContrats, "Contrats");

      const sheetStock = XLSX.utils.json_to_sheet(
        (stock.data ?? []).map((p: any) => ({
          "Produit": p.nom,
          "Unité": p.unite,
          "Quantité": p.quantite,
          "Seuil alerte": p.seuil_alerte,
          "Prix achat HT": p.prix_achat_ht,
        }))
      );
      XLSX.utils.book_append_sheet(wb, sheetStock, "Stock");

      const date = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `city-derat-sauvegarde-${date}.xlsx`);
      toast.success("Export téléchargé");
    } catch (e: any) {
      toast.error(e.message ?? "Erreur lors de l'export");
    } finally {
      setExporting(false);
    }
  }

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

      <Link to="/stats">
        <Card className="hover:border-primary/40 transition-colors cursor-pointer">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
                <BarChart2 className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold text-sm">Statistiques mensuelles</div>
                <div className="text-xs text-muted-foreground">CA, interventions, top clients</div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </CardContent>
        </Card>
      </Link>

      <Card>
        <CardContent className="p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Download className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold text-sm">Sauvegarde des données</div>
              <div className="text-xs text-muted-foreground">Clients, interventions, factures, contrats, stock</div>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={handleExport} disabled={exporting}>
            {exporting ? "Export…" : "Exporter Excel"}
          </Button>
        </CardContent>
      </Card>

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
