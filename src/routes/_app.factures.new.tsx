import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { invoiceSchema, type InvoiceForm, formatEUR, STATUTS_FACTURE } from "@/lib/schemas";
import { useClients, useSettings, usePresets } from "@/lib/queries";
import { db } from "@/lib/db";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ArrowLeft, UserPlus, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/factures/new")({
  head: () => ({ meta: [{ title: "Nouvelle facture — CITY DERAT" }] }),
  component: NouvelleFacture,
});

const PRESETS_DEFAULT = [
  { description: "Désinsectisation + Dératisation", prix_unitaire_ht: 208.33 },
  { description: "Désinsectisation + Souscription contrat annuel - Formule préventive contre les insectes et rongeurs (3 passages sur 12 mois)", prix_unitaire_ht: 90.00 },
  { description: "Désinsectisation + Souscription contrat annuel - Formule préventive contre les insectes et rongeurs (12 passages sur 12 mois)", prix_unitaire_ht: 300.00 },
  { description: "Devis offert", prix_unitaire_ht: 0 },
  { description: "Frais de déplacement offerts", prix_unitaire_ht: 0 },
];

function NouvelleFacture() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: clients = [], refetch: refetchClients } = useClients();
  const { data: settings } = useSettings();
  const { data: presets = [] } = usePresets();

  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientTel, setNewClientTel] = useState("");
  const [newClientAdresse, setNewClientAdresse] = useState("");
  const [creatingClient, setCreatingClient] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const form = useForm<InvoiceForm>({
    resolver: zodResolver(invoiceSchema) as any,
    defaultValues: {
      client_id: "",
      date_facture: today,
      echeance: "",
      adresse_site: "",
      statut: "brouillon",
      tva_taux: 20,
      notes: "",
      lines: [{ description: "", quantite: 1, prix_unitaire_ht: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lines" });

  const clientId = form.watch("client_id");
  const dateFacture = form.watch("date_facture");
  const lines = form.watch("lines");
  const tvaTaux = form.watch("tva_taux") ?? 20;

  const totalHT = lines.reduce((s, l) => s + (Number(l.quantite) || 0) * (Number(l.prix_unitaire_ht) || 0), 0);
  const tvaAmount = totalHT * (tvaTaux / 100);
  const totalTTC = totalHT + tvaAmount;

  useEffect(() => {
    if (!clientId) return;
    const c = clients.find((x) => x.id === clientId);
    if (c?.adresse_site && !form.getValues("adresse_site")) {
      form.setValue("adresse_site", c.adresse_site);
    }
  }, [clientId, clients]);

  useEffect(() => {
    if (!dateFacture) return;
    const d = new Date(dateFacture);
    if (isNaN(d.getTime())) return;
    d.setDate(d.getDate() + 30);
    form.setValue("echeance", d.toISOString().slice(0, 10));
  }, [dateFacture]);

  async function createClient() {
    if (!newClientName.trim()) { toast.error("Le nom est requis"); return; }
    setCreatingClient(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await db.from("clients").insert({
      user_id: user?.id,
      raison_sociale: newClientName.trim(),
      telephone: newClientTel.trim(),
      adresse_site: newClientAdresse.trim(),
    }).select().single();
    setCreatingClient(false);
    if (error) { toast.error(error.message); return; }
    await refetchClients();
    qc.invalidateQueries({ queryKey: ["clients"] });
    form.setValue("client_id", data.id, { shouldValidate: true });
    if (newClientAdresse) form.setValue("adresse_site", newClientAdresse);
    setShowNewClient(false);
    setNewClientName("");
    setNewClientTel("");
    setNewClientAdresse("");
    toast.success(`Client "${data.raison_sociale}" créé`);
  }

  async function onSubmit(values: InvoiceForm) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Non connecté"); return; }

    // Récupérer le prochain numéro
    const { data: settingsData } = await db.from("company_settings").select("next_invoice_number, user_id").maybeSingle();
    const numero = settingsData?.next_invoice_number ?? 1;

    const linesCalc = values.lines.map((l) => ({
      quantite: Number(l.quantite),
      prix_unitaire_ht: Number(l.prix_unitaire_ht),
      total_ht: Number(l.quantite) * Number(l.prix_unitaire_ht),
    }));
    const totalHTCalc = linesCalc.reduce((s, l) => s + l.total_ht, 0);
    const tva = totalHTCalc * (values.tva_taux / 100);
    const ttc = totalHTCalc + tva;

    const { data: inv, error } = await db.from("invoices").insert({
      user_id: user.id,
      client_id: values.client_id,
      numero,
      date_facture: values.date_facture,
      echeance: values.echeance || null,
      adresse_site: values.adresse_site,
      statut: values.statut,
      tva_taux: values.tva_taux,
      total_ht: totalHTCalc,
      tva,
      total_ttc: ttc,
      notes: values.notes,
    }).select().single();

    if (error) { toast.error(error.message); return; }

    const linesInsert = values.lines.map((l, i) => ({
      invoice_id: inv.id,
      user_id: user.id,
      description: l.description,
      quantite: Number(l.quantite),
      prix_unitaire_ht: Number(l.prix_unitaire_ht),
      total_ht: Number(l.quantite) * Number(l.prix_unitaire_ht),
      ordre: i,
    }));

    const { error: e2 } = await db.from("invoice_lines").insert(linesInsert);
    if (e2) { toast.error(e2.message); return; }

    // Incrémenter le numéro suivant
    if (settingsData) {
      await db.from("company_settings").update({ next_invoice_number: numero + 1 }).eq("user_id", settingsData.user_id);
    }

    qc.invalidateQueries({ queryKey: ["invoices"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    toast.success(`Facture N°${numero} créée`);
    navigate({ to: "/factures/$id", params: { id: inv.id } });
  }

  const allPresets = presets.length > 0
    ? presets.map((p) => ({ description: p.description, prix_unitaire_ht: p.prix_unitaire_ht }))
    : PRESETS_DEFAULT;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/factures" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" /> Retour
        </Link>
      </div>
      <h1 className="text-2xl font-bold tracking-tight">Nouvelle facture</h1>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <Card><CardContent className="p-4 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Client</h2>
          <Field label="Client *" error={(form.formState.errors as any).client_id?.message}>
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Select
                    value={form.watch("client_id")}
                    onValueChange={(v) => { form.setValue("client_id", v, { shouldValidate: true }); setShowNewClient(false); }}
                  >
                    <SelectTrigger><SelectValue placeholder="Sélectionner un client…" /></SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.raison_sociale}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 px-3"
                  onClick={() => setShowNewClient((v) => !v)}
                >
                  {showNewClient ? <X className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                </Button>
              </div>
              {showNewClient && (
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="p-3 space-y-2">
                    <p className="text-xs font-semibold text-primary uppercase tracking-wide flex items-center gap-1">
                      <Plus className="h-3 w-3" /> Nouveau client
                    </p>
                    <Input
                      placeholder="Nom / Raison sociale *"
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      className="h-8 text-sm"
                    />
                    <Input
                      placeholder="Téléphone"
                      type="tel"
                      value={newClientTel}
                      onChange={(e) => setNewClientTel(e.target.value)}
                      className="h-8 text-sm"
                    />
                    <Textarea
                      placeholder="Adresse du site"
                      rows={2}
                      value={newClientAdresse}
                      onChange={(e) => setNewClientAdresse(e.target.value)}
                      className="text-sm"
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="w-full h-8"
                      onClick={createClient}
                      disabled={creatingClient}
                    >
                      {creatingClient ? "Création…" : "Créer et sélectionner"}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </Field>
          <Field label="Adresse du site">
            <Textarea rows={2} {...form.register("adresse_site")} />
          </Field>
        </CardContent></Card>

        <Card><CardContent className="p-4 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Dates & statut</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date de facture *" error={(form.formState.errors as any).date_facture?.message}>
              <Input type="date" {...form.register("date_facture")} />
            </Field>
            <Field label="Échéance">
              <Input type="date" {...form.register("echeance")} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Statut">
              <Select value={form.watch("statut")} onValueChange={(v) => form.setValue("statut", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUTS_FACTURE.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="TVA (%)">
              <Input type="number" {...form.register("tva_taux")} />
            </Field>
          </div>
        </CardContent></Card>

        <Card><CardContent className="p-4 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Prestations rapides</h2>
          <div className="flex flex-wrap gap-2">
            {allPresets.map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() => append({ description: p.description, quantite: 1, prix_unitaire_ht: p.prix_unitaire_ht })}
                className="text-left text-xs rounded-lg border border-border bg-card px-3 py-2 hover:border-primary/50 hover:bg-primary/5 transition-colors max-w-xs"
              >
                {p.description.length > 60 ? p.description.slice(0, 60) + "…" : p.description}
                <span className="ml-1 text-muted-foreground">({formatEUR(p.prix_unitaire_ht)} HT)</span>
              </button>
            ))}
          </div>
        </CardContent></Card>

        <Card><CardContent className="p-4 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Lignes de facturation</h2>
          {(form.formState.errors as any).lines?.root && (
            <p className="text-xs text-destructive">{(form.formState.errors as any).lines.root.message}</p>
          )}
          {fields.map((field, i) => (
            <div key={field.id} className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Ligne {i + 1}</span>
                {fields.length > 1 && (
                  <button type="button" onClick={() => remove(i)} className="text-destructive hover:text-destructive/80">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Field label="Description *" error={(form.formState.errors as any).lines?.[i]?.description?.message}>
                <Textarea rows={2} {...form.register(`lines.${i}.description`)} placeholder="Ex. Désinsectisation + Dératisation" />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Quantité" error={(form.formState.errors as any).lines?.[i]?.quantite?.message}>
                  <Input type="number" step="0.01" {...form.register(`lines.${i}.quantite`)} />
                </Field>
                <Field label="Prix unitaire HT (€)" error={(form.formState.errors as any).lines?.[i]?.prix_unitaire_ht?.message}>
                  <Input type="number" step="0.01" {...form.register(`lines.${i}.prix_unitaire_ht`)} />
                </Field>
              </div>
              <div className="text-right text-sm font-medium text-muted-foreground">
                Total : {formatEUR((Number(form.watch(`lines.${i}.quantite`)) || 0) * (Number(form.watch(`lines.${i}.prix_unitaire_ht`)) || 0))}
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => append({ description: "", quantite: 1, prix_unitaire_ht: 0 })}>
            <Plus className="mr-1 h-4 w-4" /> Ajouter une ligne
          </Button>
        </CardContent></Card>

        <Card><CardContent className="p-4 space-y-2">
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total HT</span><span className="font-medium">{formatEUR(totalHT)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">TVA ({tvaTaux}%)</span><span className="font-medium">{formatEUR(tvaAmount)}</span></div>
          <div className="flex justify-between text-base font-bold border-t pt-2 mt-2"><span>Total TTC</span><span className="text-primary">{formatEUR(totalTTC)}</span></div>
        </CardContent></Card>

        <Field label="Notes (optionnel)">
          <Textarea rows={2} {...form.register("notes")} placeholder="Notes internes…" />
        </Field>

        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Enregistrement…" : "Créer la facture"}
        </Button>
      </form>
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
