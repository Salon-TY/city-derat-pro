import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { quoteSchema, type QuoteForm, formatEUR } from "@/lib/schemas";
import { useClients, usePresets } from "@/lib/queries";
import { db } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { PermissionGate } from "@/components/permission-gate";

export const Route = createFileRoute("/_app/devis/new")({
  head: () => ({ meta: [{ title: "Nouveau devis — CITY DERAT" }] }),
  component: () => (
    <PermissionGate perm="devis">
      <NewDevisPage />
    </PermissionGate>
  ),
});

function localDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function NewDevisPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: clients = [] } = useClients();
  const { data: presets = [] } = usePresets();

  const today = localDateStr(new Date());
  const validite = localDateStr(addDays(new Date(), 30));

  const form = useForm<QuoteForm>({
    resolver: zodResolver(quoteSchema) as any,
    defaultValues: {
      client_id: "",
      date_devis: today,
      date_validite: validite,
      statut: "brouillon",
      tva_taux: 20,
      notes: "",
      lines: [{ description: "", quantite: 1, prix_unitaire_ht: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lines" });

  const lines = form.watch("lines");
  const tvaTaux = form.watch("tva_taux");
  const totalHT = lines.reduce((s, l) => s + (Number(l.quantite) || 0) * (Number(l.prix_unitaire_ht) || 0), 0);
  const tva = totalHT * (Number(tvaTaux) / 100);
  const totalTTC = totalHT + tva;

  async function onSubmit(values: QuoteForm) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Generate numero DEV-YYYY-NNN
    const year = new Date().getFullYear();
    const { count } = await db.from("devis").select("*", { count: "exact", head: true }).eq("user_id", user.id);
    const n = (count ?? 0) + 1;
    const numero = `DEV-${year}-${String(n).padStart(3, "0")}`;

    const linesData = values.lines.map((l, i) => ({
      description: l.description,
      quantite: Number(l.quantite),
      prix_unitaire_ht: Number(l.prix_unitaire_ht),
      total_ht: Number(l.quantite) * Number(l.prix_unitaire_ht),
      ordre: i,
    }));

    const th = linesData.reduce((s, l) => s + l.total_ht, 0);
    const tv = th * (Number(values.tva_taux) / 100);

    const { data: devis, error } = await db.from("devis").insert({
      user_id: user.id,
      client_id: values.client_id,
      numero,
      date_devis: values.date_devis,
      date_validite: values.date_validite,
      statut: values.statut,
      tva_taux: Number(values.tva_taux),
      total_ht: th,
      tva: tv,
      total_ttc: th + tv,
      notes: values.notes,
    }).select().single();

    if (error) { toast.error(error.message); return; }

    const lineInserts = linesData.map((l) => ({ ...l, devis_id: devis.id, user_id: user.id }));
    const { error: e2 } = await db.from("devis_lines").insert(lineInserts);
    if (e2) { toast.error(e2.message); return; }

    qc.invalidateQueries({ queryKey: ["devis"] });
    toast.success(`Devis ${numero} créé`);
    navigate({ to: "/devis/$id", params: { id: devis.id } });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate({ to: "/devis" })} className="grid h-9 w-9 place-items-center rounded-xl border border-border hover:bg-muted transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-xl font-bold">Nouveau devis</h1>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <Card><CardContent className="p-4 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Informations</h2>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Client *</Label>
            <select {...form.register("client_id")} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent">
              <option value="">Sélectionner un client…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.raison_sociale}</option>)}
            </select>
            {form.formState.errors.client_id && <p className="text-xs text-destructive">{form.formState.errors.client_id.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Date devis</Label>
              <Input type="date" {...form.register("date_devis")} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Date validité</Label>
              <Input type="date" {...form.register("date_validite")} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">TVA (%)</Label>
              <Input type="number" min={0} max={100} step={0.1} {...form.register("tva_taux")} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Statut</Label>
              <select {...form.register("statut")} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none">
                <option value="brouillon">Brouillon</option>
                <option value="envoye">Envoyé</option>
              </select>
            </div>
          </div>
        </CardContent></Card>

        <Card><CardContent className="p-4 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Prestations</h2>

          {presets.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => append({ description: p.description, quantite: 1, prix_unitaire_ht: p.prix_unitaire_ht })}
                  className="rounded-full border border-accent/40 px-2.5 py-1 text-xs text-accent hover:bg-accent/10 transition-colors"
                >
                  + {p.label}
                </button>
              ))}
            </div>
          )}

          {fields.map((field, i) => (
            <div key={field.id} className="rounded-xl border border-border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Ligne {i + 1}</span>
                {fields.length > 1 && (
                  <button type="button" onClick={() => remove(i)} className="text-destructive hover:text-destructive/80">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Textarea rows={2} placeholder="Description de la prestation…" {...form.register(`lines.${i}.description`)} />
              {(form.formState.errors.lines as any)?.[i]?.description && (
                <p className="text-xs text-destructive">{(form.formState.errors.lines as any)[i].description.message}</p>
              )}
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-muted-foreground">Qté</Label>
                  <Input type="number" min={0} step={0.01} {...form.register(`lines.${i}.quantite`)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-muted-foreground">PU HT (€)</Label>
                  <Input type="number" min={0} step={0.01} {...form.register(`lines.${i}.prix_unitaire_ht`)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-muted-foreground">Total HT</Label>
                  <div className="flex h-10 items-center rounded-lg border border-border bg-muted/30 px-3 text-sm font-medium">
                    {formatEUR((Number(lines[i]?.quantite) || 0) * (Number(lines[i]?.prix_unitaire_ht) || 0))}
                  </div>
                </div>
              </div>
            </div>
          ))}

          <Button type="button" variant="outline" size="sm" onClick={() => append({ description: "", quantite: 1, prix_unitaire_ht: 0 })}>
            <Plus className="mr-1 h-4 w-4" /> Ajouter une ligne
          </Button>

          <div className="rounded-xl bg-muted/30 p-3 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Total HT</span><span className="font-medium">{formatEUR(totalHT)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">TVA ({tvaTaux}%)</span><span className="font-medium">{formatEUR(tva)}</span></div>
            <div className="flex justify-between font-bold text-base border-t pt-1 mt-1"><span>Total TTC</span><span>{formatEUR(totalTTC)}</span></div>
          </div>
        </CardContent></Card>

        <Card><CardContent className="p-4 space-y-1.5">
          <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notes</Label>
          <Textarea rows={3} placeholder="Notes internes ou conditions particulières…" {...form.register("notes")} />
        </CardContent></Card>

        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Création…" : "Créer le devis"}
        </Button>
      </form>
    </div>
  );
}
