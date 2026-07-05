import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuote, useSettings, useClients, usePresets } from "@/lib/queries";
import { formatEUR, formatDateFR, STATUTS_DEVIS, quoteSchema, type QuoteForm } from "@/lib/schemas";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Download, Trash2, Pencil, Plus, FileText, ClipboardList } from "lucide-react";
import { db } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { printDocument } from "@/lib/print";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PermissionGate } from "@/components/permission-gate";

export const Route = createFileRoute("/_app/devis/$id")({
  head: () => ({ meta: [{ title: "Devis — CITY DERAT" }] }),
  component: () => (
    <PermissionGate perm="devis">
      <DevisDetail />
    </PermissionGate>
  ),
});

const STATUT_COLORS: Record<string, string> = {
  brouillon: "bg-muted text-muted-foreground",
  envoye: "bg-accent/15 text-accent",
  accepte: "bg-green-100 text-green-700",
  refuse: "bg-destructive/15 text-destructive",
  converti: "bg-purple-100 text-purple-700",
};

function statutLabel(v: string) {
  return STATUTS_DEVIS.find((s) => s.value === v)?.label ?? v;
}

function localDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─── Edit form ───────────────────────────────────────────────────────────────

function EditDevisForm({
  quote,
  onCancel,
  onSaved,
}: {
  quote: NonNullable<ReturnType<typeof useQuote>["data"]>;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const { data: clients = [] } = useClients();
  const { data: presets = [] } = usePresets();

  const form = useForm<QuoteForm>({
    resolver: zodResolver(quoteSchema) as any,
    defaultValues: {
      client_id: quote.client_id,
      date_devis: quote.date_devis,
      date_validite: quote.date_validite,
      statut: quote.statut,
      tva_taux: quote.tva_taux ?? 20,
      notes: quote.notes ?? "",
      lines: (quote.lines ?? []).map((l) => ({
        description: l.description,
        quantite: l.quantite,
        prix_unitaire_ht: l.prix_unitaire_ht,
      })),
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lines" });
  const lines = form.watch("lines");
  const tvaTaux = form.watch("tva_taux");
  const totalHT = lines.reduce((s, l) => s + (Number(l.quantite) || 0) * (Number(l.prix_unitaire_ht) || 0), 0);
  const tva = totalHT * (Number(tvaTaux) / 100);
  const totalTTC = totalHT + tva;

  async function onSubmit(values: QuoteForm) {
    const linesData = values.lines.map((l, i) => ({
      description: l.description,
      quantite: Number(l.quantite),
      prix_unitaire_ht: Number(l.prix_unitaire_ht),
      total_ht: Number(l.quantite) * Number(l.prix_unitaire_ht),
      ordre: i,
    }));

    const th = linesData.reduce((s, l) => s + l.total_ht, 0);
    const tv = th * (Number(values.tva_taux) / 100);

    const { error } = await db.from("devis").update({
      client_id: values.client_id,
      date_devis: values.date_devis,
      date_validite: values.date_validite,
      statut: values.statut,
      tva_taux: Number(values.tva_taux),
      total_ht: th,
      tva: tv,
      total_ttc: th + tv,
      notes: values.notes,
    }).eq("id", quote.id);

    if (error) { toast.error(error.message); return; }

    await db.from("devis_lines").delete().eq("devis_id", quote.id);
    const { data: { user } } = await supabase.auth.getUser();
    const lineInserts = linesData.map((l) => ({ ...l, devis_id: quote.id, user_id: user!.id }));
    await db.from("devis_lines").insert(lineInserts);

    qc.invalidateQueries({ queryKey: ["devis"] });
    toast.success("Devis mis à jour");
    onSaved();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <Card><CardContent className="p-4 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Informations</h2>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Client *</Label>
          <select {...form.register("client_id")} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent">
            <option value="">Sélectionner…</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.raison_sociale}</option>)}
          </select>
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
              {STATUTS_DEVIS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
      </CardContent></Card>

      <Card><CardContent className="p-4 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Prestations</h2>
        {presets.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {presets.map((p) => (
              <button key={p.id} type="button"
                onClick={() => append({ description: p.description, quantite: 1, prix_unitaire_ht: p.prix_unitaire_ht })}
                className="rounded-full border border-accent/40 px-2.5 py-1 text-xs text-accent hover:bg-accent/10 transition-colors">
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
                <button type="button" onClick={() => remove(i)} className="text-destructive"><Trash2 className="h-4 w-4" /></button>
              )}
            </div>
            <Textarea rows={2} placeholder="Description…" {...form.register(`lines.${i}.description`)} />
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
        <Textarea rows={3} {...form.register("notes")} />
      </CardContent></Card>

      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>Annuler</Button>
        <Button type="submit" className="flex-1" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}

// ─── Main detail ─────────────────────────────────────────────────────────────

function DevisDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: quote, isLoading } = useQuote(id);
  const { data: settings } = useSettings();
  const [editing, setEditing] = useState(false);

  if (isLoading) return <div className="py-10 text-center text-sm text-muted-foreground">Chargement…</div>;
  if (!quote) return <div className="py-10 text-center text-sm text-destructive">Devis introuvable.</div>;

  async function handleDelete() {
    await db.from("devis_lines").delete().eq("devis_id", id);
    await db.from("devis").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["devis"] });
    toast.success("Devis supprimé");
    navigate({ to: "/devis" });
  }

  async function handleStatut(statut: string) {
    const { error } = await db.from("devis").update({ statut }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["devis"] });
    qc.invalidateQueries({ queryKey: ["devis", id] });
    toast.success(`Devis marqué : ${statutLabel(statut)}`);
  }

  async function convertToFacture() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get next invoice number
    const { data: lastInv } = await db.from("invoices").select("numero").order("numero", { ascending: false }).limit(1).maybeSingle();
    const nextNum = (lastInv?.numero ?? 0) + 1;

    const today = localDateStr(new Date());
    const echeance = localDateStr(new Date(new Date().getTime() + 30 * 86400000));

    const { data: inv, error } = await db.from("invoices").insert({
      user_id: user.id,
      client_id: quote.client_id,
      numero: nextNum,
      date_facture: today,
      echeance,
      adresse_site: quote.client?.adresse_site ?? "",
      statut: "brouillon",
      tva_taux: quote.tva_taux,
      total_ht: quote.total_ht,
      tva: quote.tva,
      total_ttc: quote.total_ttc,
      notes: quote.notes,
    }).select().single();

    if (error) { toast.error(error.message); return; }

    const lineInserts = (quote.lines ?? []).map((l, i) => ({
      user_id: user.id,
      invoice_id: inv.id,
      description: l.description,
      quantite: l.quantite,
      prix_unitaire_ht: l.prix_unitaire_ht,
      total_ht: l.total_ht,
      ordre: i,
    }));
    await db.from("invoice_lines").insert(lineInserts);
    await db.from("devis").update({ statut: "converti" }).eq("id", id);

    qc.invalidateQueries({ queryKey: ["devis"] });
    qc.invalidateQueries({ queryKey: ["invoices"] });
    toast.success("Converti en facture");
    navigate({ to: "/factures/$id", params: { id: inv.id } });
  }

  async function convertToIntervention() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const today = localDateStr(new Date());
    const { data: inv, error } = await db.from("interventions").insert({
      user_id: user.id,
      client_id: quote.client_id,
      date: today,
      type_intervention: "Les deux",
      statut: "planifiee",
      adresse_site: quote.client?.adresse_site ?? "",
      type_nuisible: "",
      produits: "",
      quantite: "",
      observations: quote.notes ?? "",
    }).select().single();

    if (error) { toast.error(error.message); return; }
    await db.from("devis").update({ statut: "converti" }).eq("id", id);

    qc.invalidateQueries({ queryKey: ["devis"] });
    qc.invalidateQueries({ queryKey: ["interventions"] });
    toast.success("Converti en intervention");
    navigate({ to: "/interventions/$id", params: { id: inv.id } });
  }

  function exportPDF() {
    const s = settings;
    const now = new Date();
    const dateHeure = now.toLocaleDateString("fr-FR") + " " + now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

    const linesHTML = (quote.lines ?? []).map((l) => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9">${l.description}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;text-align:center">${l.quantite}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;text-align:right">${formatEUR(l.prix_unitaire_ht)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600">${formatEUR(l.total_ht)}</td>
      </tr>
    `).join("");

    const css = `
  body { font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;font-size:11px;color:#1e293b;background:#fff; }
  .header { display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid #f97316; }
  .logo-block { display:flex;align-items:center;gap:12px; }
  .logo-icon { font-size:28px; }
  .logo-text .name { font-size:18px;font-weight:800;color:#1e293b;letter-spacing:-0.3px; }
  .logo-text .sub { font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-top:2px; }
  .header-coords { font-size:10px;color:#64748b;text-align:right;line-height:1.6; }
  .devis-title { font-size:22px;font-weight:800;color:#f97316;margin-bottom:4px; }
  .devis-num { font-size:13px;color:#64748b;margin-bottom:18px; }
  .meta { display:flex;justify-content:space-between;gap:24px;margin-bottom:18px; }
  .meta-box { background:#f8fafc;border-radius:8px;padding:10px 14px;flex:1; }
  .meta-box .lbl { font-size:9px;text-transform:uppercase;letter-spacing:0.8px;color:#94a3b8;margin-bottom:4px; }
  .meta-box .val { font-size:12px;font-weight:600;color:#1e293b; }
  table { width:100%;border-collapse:collapse;margin-top:16px; }
  thead th { background:#f97316;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;padding:8px;text-align:left; }
  thead th:last-child, thead th:nth-child(2), thead th:nth-child(3) { text-align:right; }
  .totals { margin-top:16px;display:flex;justify-content:flex-end; }
  .totals-box { width:220px; }
  .total-row { display:flex;justify-content:space-between;font-size:11px;padding:3px 0; }
  .total-row.big { font-size:14px;font-weight:800;border-top:2px solid #f97316;margin-top:6px;padding-top:6px;color:#f97316; }
  .validity { margin-top:16px;padding:8px 12px;background:#fff7ed;border-left:3px solid #f97316;font-size:10px;color:#c2410c; }
  .notes { margin-top:16px;padding:10px;background:#f8fafc;border-radius:6px;font-size:10px;color:#64748b;line-height:1.6; }
  .footer { margin-top:24px;padding-top:10px;border-top:2px solid #f1f5f9;font-size:9px;color:#94a3b8;text-align:center; }
`;

    const bodyHtml = `
  <div class="header">
    <div class="logo-block">
      ${s?.logo_url ? `<img src="${s.logo_url}" style="max-height:48px;max-width:120px;object-fit:contain" alt="Logo">` : `<div class="logo-icon">🐀</div>`}
      <div class="logo-text">
        <div class="name">${s?.nom ?? "CITY DERAT"}</div>
        <div class="sub">Dératisation · Désinsectisation</div>
      </div>
    </div>
    <div class="header-coords">
      ${s?.adresse ? s.adresse.replace(/\n/g, "<br>") : "17 RUE DU DOCTEUR LAURENT<br>75013 PARIS 13"}<br>
      Siret : ${s?.siret ?? "88268913600019"}<br>
      Tél : ${s?.telephone ?? "06 47 83 25 71"}
    </div>
  </div>

  <div class="devis-title">DEVIS N° ${quote.numero}</div>
  <div class="devis-num">Établi le ${formatDateFR(quote.date_devis)} — Valable jusqu'au ${formatDateFR(quote.date_validite)}</div>

  <div class="meta">
    <div class="meta-box">
      <div class="lbl">Proposé à</div>
      <div class="val">${quote.client?.raison_sociale ?? "—"}</div>
      ${quote.client?.adresse_site ? `<div style="font-size:10px;color:#64748b;margin-top:2px">${quote.client.adresse_site}</div>` : ""}
      ${quote.client?.telephone ? `<div style="font-size:10px;color:#64748b">Tél : ${quote.client.telephone}</div>` : ""}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Désignation</th>
        <th style="text-align:center">Qté</th>
        <th style="text-align:right">PU HT</th>
        <th style="text-align:right">Total HT</th>
      </tr>
    </thead>
    <tbody>
      ${linesHTML}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-box">
      <div class="total-row"><span>Total HT</span><span>${formatEUR(quote.total_ht)}</span></div>
      <div class="total-row"><span>TVA (${quote.tva_taux}%)</span><span>${formatEUR(quote.tva)}</span></div>
      <div class="total-row big"><span>TOTAL TTC</span><span>${formatEUR(quote.total_ttc)}</span></div>
    </div>
  </div>

  <div class="validity">Ce devis est valable jusqu'au ${formatDateFR(quote.date_validite)}. Passé ce délai, les prix peuvent être révisés.</div>

  ${quote.notes ? `<div class="notes"><strong>Notes :</strong> ${quote.notes}</div>` : ""}

  <div class="footer">
    Document généré le ${dateHeure} — ${s?.nom ?? "CITY DERAT"} · SIRET ${s?.siret ?? "88268913600019"} · ${s?.tva_number ?? ""}
  </div>
`;

    const ok = printDocument({ title: `Devis ${quote.numero}`, bodyHtml, css });
    if (!ok) { toast.error("Autorisez les popups pour générer le PDF"); return; }
  }

  if (editing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setEditing(false)} className="grid h-9 w-9 place-items-center rounded-xl border border-border hover:bg-muted transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-xl font-bold">Modifier le devis</h1>
        </div>
        <EditDevisForm quote={quote} onCancel={() => setEditing(false)} onSaved={() => setEditing(false)} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate({ to: "/devis" })} className="grid h-9 w-9 place-items-center rounded-xl border border-border hover:bg-muted transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">{quote.numero}</h1>
          <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUT_COLORS[quote.statut] ?? "bg-muted text-muted-foreground")}>
            {statutLabel(quote.statut)}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={exportPDF} className="grid h-9 w-9 place-items-center rounded-xl border hover:bg-muted transition-colors" title="Imprimer / PDF">
            <Download className="h-4 w-4" />
          </button>
          <button onClick={() => setEditing(true)} className="grid h-9 w-9 place-items-center rounded-xl border hover:bg-muted transition-colors">
            <Pencil className="h-4 w-4" />
          </button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="grid h-9 w-9 place-items-center rounded-xl border border-destructive/50 text-destructive hover:bg-destructive/5 transition-colors">
                <Trash2 className="h-4 w-4" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer le devis ?</AlertDialogTitle>
                <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive">Supprimer</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Actions statut */}
      {quote.statut !== "converti" && (
        <Card><CardContent className="p-3 flex flex-wrap gap-2">
          {quote.statut !== "accepte" && (
            <Button size="sm" variant="outline" className="text-green-700 border-green-300 hover:bg-green-50"
              onClick={() => handleStatut("accepte")}>Accepté</Button>
          )}
          {quote.statut !== "refuse" && (
            <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/5"
              onClick={() => handleStatut("refuse")}>Refusé</Button>
          )}
          {quote.statut !== "envoye" && quote.statut !== "accepte" && (
            <Button size="sm" variant="outline" onClick={() => handleStatut("envoye")}>Marquer envoyé</Button>
          )}
          <Button size="sm" className="bg-accent text-white hover:bg-accent/90 gap-1.5" onClick={convertToFacture}>
            <FileText className="h-4 w-4" /> Convertir en facture
          </Button>
          <Button size="sm" variant="secondary" className="gap-1.5" onClick={convertToIntervention}>
            <ClipboardList className="h-4 w-4" /> Convertir en intervention
          </Button>
        </CardContent></Card>
      )}

      {/* Infos */}
      <Card><CardContent className="p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Client</span>
          <span className="font-medium">{quote.client?.raison_sociale ?? "—"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Date</span>
          <span className="font-medium">{formatDateFR(quote.date_devis)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Validité</span>
          <span className="font-medium">{formatDateFR(quote.date_validite)}</span>
        </div>
      </CardContent></Card>

      {/* Lignes */}
      <Card><CardContent className="p-4 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Prestations</h2>
        {(quote.lines ?? []).map((l) => (
          <div key={l.id} className="flex items-start justify-between gap-3 rounded-lg bg-muted/30 p-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{l.description}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{l.quantite} × {formatEUR(l.prix_unitaire_ht)}</div>
            </div>
            <div className="shrink-0 font-semibold text-sm">{formatEUR(l.total_ht)}</div>
          </div>
        ))}
        <div className="rounded-xl bg-muted/30 p-3 space-y-1 text-sm border-t">
          <div className="flex justify-between"><span className="text-muted-foreground">Total HT</span><span>{formatEUR(quote.total_ht)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">TVA ({quote.tva_taux}%)</span><span>{formatEUR(quote.tva)}</span></div>
          <div className="flex justify-between font-bold text-base pt-1 border-t"><span>Total TTC</span><span>{formatEUR(quote.total_ttc)}</span></div>
        </div>
      </CardContent></Card>

      {quote.notes && (
        <Card><CardContent className="p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Notes</div>
          <p className="text-sm whitespace-pre-wrap">{quote.notes}</p>
        </CardContent></Card>
      )}
    </div>
  );
}
