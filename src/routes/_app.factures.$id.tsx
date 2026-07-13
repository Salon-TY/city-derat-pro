import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useInvoice, useSettings, useClients, usePresets, useRelancesForInvoice, type Relance } from "@/lib/queries";
import { formatEUR, formatDateFR, STATUTS_FACTURE, type InvoiceForm, invoiceSchema } from "@/lib/schemas";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Download, Trash2, Mail, MapPin, Pencil, Plus, X, Bell, Clock } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PermissionGate } from "@/components/permission-gate";

export const Route = createFileRoute("/_app/factures/$id")({
  head: () => ({ meta: [{ title: "Facture — CITY DERAT" }] }),
  component: () => (
    <PermissionGate perm="factures">
      <FactureDetail />
    </PermissionGate>
  ),
});

const STATUT_COLORS: Record<string, string> = {
  brouillon: "bg-muted text-muted-foreground",
  envoyee: "bg-accent/15 text-accent",
  payee: "bg-primary/15 text-primary",
  retard: "bg-destructive/15 text-destructive",
};

// PDF badge colours (inline, no Tailwind)
const PDF_BADGE: Record<string, { bg: string; color: string }> = {
  brouillon: { bg: "#e5e7eb", color: "#374151" },
  envoyee:   { bg: "#fff3e0", color: "#ea6c0a" },
  payee:     { bg: "#e6f4ef", color: "#1a3c2e" },
  retard:    { bg: "#fee2e2", color: "#b91c1c" },
};

function statutLabel(v: string) {
  return STATUTS_FACTURE.find((s) => s.value === v)?.label ?? v;
}

// ─── Edit form ─────────────────────────────────────────────────────────────

const PRESETS_DEFAULT = [
  { description: "Désinsectisation + Dératisation", prix_unitaire_ht: 208.33 },
  { description: "Désinsectisation + Souscription contrat annuel - Formule préventive contre les insectes et rongeurs (3 passages sur 12 mois)", prix_unitaire_ht: 90.00 },
  { description: "Désinsectisation + Souscription contrat annuel - Formule préventive contre les insectes et rongeurs (12 passages sur 12 mois)", prix_unitaire_ht: 300.00 },
];

function EditFactureForm({
  invoice,
  onCancel,
  onSaved,
}: {
  invoice: NonNullable<ReturnType<typeof useInvoice>["data"]>;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const { data: clients = [] } = useClients();
  const { data: presets = [] } = usePresets();

  const form = useForm<InvoiceForm>({
    resolver: zodResolver(invoiceSchema) as any,
    defaultValues: {
      client_id: invoice.client_id,
      date_facture: invoice.date_facture,
      echeance: invoice.echeance ?? "",
      adresse_site: invoice.adresse_site ?? "",
      statut: invoice.statut,
      tva_taux: invoice.tva_taux ?? 20,
      notes: invoice.notes ?? "",
      lines: (invoice.lines ?? []).map((l) => ({
        description: l.description,
        quantite: l.quantite,
        prix_unitaire_ht: l.prix_unitaire_ht,
      })),
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lines" });
  const lines = form.watch("lines");
  const tvaTaux = form.watch("tva_taux") ?? 20;
  const totalHT = lines.reduce((s, l) => s + (Number(l.quantite) || 0) * (Number(l.prix_unitaire_ht) || 0), 0);
  const tvaAmount = totalHT * (tvaTaux / 100);
  const totalTTC = totalHT + tvaAmount;

  const allPresets = presets.length > 0
    ? presets.map((p) => ({ description: p.description, prix_unitaire_ht: p.prix_unitaire_ht }))
    : PRESETS_DEFAULT;

  async function onSubmit(values: InvoiceForm) {
    const linesCalc = values.lines.map((l) => ({
      quantite: Number(l.quantite),
      prix_unitaire_ht: Number(l.prix_unitaire_ht),
      total_ht: Number(l.quantite) * Number(l.prix_unitaire_ht),
    }));
    const totalHTCalc = linesCalc.reduce((s, l) => s + l.total_ht, 0);
    const tva = totalHTCalc * (values.tva_taux / 100);
    const ttc = totalHTCalc + tva;

    const { error } = await db.from("invoices").update({
      client_id: values.client_id,
      date_facture: values.date_facture,
      echeance: values.echeance || null,
      adresse_site: values.adresse_site,
      statut: values.statut,
      tva_taux: values.tva_taux,
      total_ht: totalHTCalc,
      tva,
      total_ttc: ttc,
      notes: values.notes,
    }).eq("id", invoice.id);

    if (error) { toast.error(error.message); return; }

    // Recreate lines
    await db.from("invoice_lines").delete().eq("invoice_id", invoice.id);
    const linesInsert = values.lines.map((l, i) => ({
      invoice_id: invoice.id,
      user_id: invoice.user_id,
      description: l.description,
      quantite: Number(l.quantite),
      prix_unitaire_ht: Number(l.prix_unitaire_ht),
      total_ht: Number(l.quantite) * Number(l.prix_unitaire_ht),
      ordre: i,
    }));
    const { error: e2 } = await db.from("invoice_lines").insert(linesInsert);
    if (e2) { toast.error(e2.message); return; }

    qc.invalidateQueries({ queryKey: ["invoice", invoice.id] });
    qc.invalidateQueries({ queryKey: ["invoices"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    toast.success("Facture mise à jour");
    onSaved();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Modifier la facture N°{invoice.numero}</h2>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}><X className="h-4 w-4" /></Button>
      </div>

      <Card><CardContent className="p-4 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Client</h3>
        <EditField label="Client *" error={(form.formState.errors as any).client_id?.message}>
          <Select value={form.watch("client_id")} onValueChange={(v) => form.setValue("client_id", v, { shouldValidate: true })}>
            <SelectTrigger><SelectValue placeholder="Sélectionner un client…" /></SelectTrigger>
            <SelectContent>
              {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.raison_sociale}</SelectItem>)}
            </SelectContent>
          </Select>
        </EditField>
        <EditField label="Adresse du site">
          <Textarea rows={2} {...form.register("adresse_site")} />
        </EditField>
      </CardContent></Card>

      <Card><CardContent className="p-4 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dates & statut</h3>
        <div className="grid grid-cols-2 gap-3">
          <EditField label="Date facture *"><Input type="date" {...form.register("date_facture")} /></EditField>
          <EditField label="Échéance"><Input type="date" {...form.register("echeance")} /></EditField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <EditField label="Statut">
            <Select value={form.watch("statut")} onValueChange={(v) => form.setValue("statut", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUTS_FACTURE.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </EditField>
          <EditField label="TVA (%)"><Input type="number" {...form.register("tva_taux")} /></EditField>
        </div>
      </CardContent></Card>

      <Card><CardContent className="p-4 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prestations rapides</h3>
        <div className="flex flex-wrap gap-2">
          {allPresets.map((p, i) => (
            <button key={i} type="button"
              onClick={() => append({ description: p.description, quantite: 1, prix_unitaire_ht: p.prix_unitaire_ht })}
              className="text-left text-xs rounded-lg border px-3 py-2 hover:border-primary/50 hover:bg-primary/5 transition-colors max-w-xs">
              {p.description.length > 55 ? p.description.slice(0, 55) + "…" : p.description}
              <span className="ml-1 text-muted-foreground">({formatEUR(p.prix_unitaire_ht)} HT)</span>
            </button>
          ))}
        </div>
      </CardContent></Card>

      <Card><CardContent className="p-4 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lignes</h3>
        {fields.map((field, i) => (
          <div key={field.id} className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Ligne {i + 1}</span>
              {fields.length > 1 && (
                <button type="button" onClick={() => remove(i)} className="text-destructive"><Trash2 className="h-4 w-4" /></button>
              )}
            </div>
            <EditField label="Description *" error={(form.formState.errors as any).lines?.[i]?.description?.message}>
              <Textarea rows={2} {...form.register(`lines.${i}.description`)} />
            </EditField>
            <div className="grid grid-cols-2 gap-2">
              <EditField label="Quantité"><Input type="number" step="0.01" {...form.register(`lines.${i}.quantite`)} /></EditField>
              <EditField label="Prix HT (€)"><Input type="number" step="0.01" {...form.register(`lines.${i}.prix_unitaire_ht`)} /></EditField>
            </div>
            <div className="text-right text-sm font-medium text-muted-foreground">
              {formatEUR((Number(form.watch(`lines.${i}.quantite`)) || 0) * (Number(form.watch(`lines.${i}.prix_unitaire_ht`)) || 0))}
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => append({ description: "", quantite: 1, prix_unitaire_ht: 0 })}>
          <Plus className="mr-1 h-4 w-4" /> Ajouter une ligne
        </Button>
      </CardContent></Card>

      <Card><CardContent className="p-4 space-y-1">
        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total HT</span><span>{formatEUR(totalHT)}</span></div>
        <div className="flex justify-between text-sm"><span className="text-muted-foreground">TVA ({tvaTaux}%)</span><span>{formatEUR(tvaAmount)}</span></div>
        <div className="flex justify-between font-bold border-t pt-2 mt-1"><span>Total TTC</span><span className="text-primary">{formatEUR(totalTTC)}</span></div>
      </CardContent></Card>

      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>Annuler</Button>
        <Button type="submit" className="flex-1" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Enregistrement…" : "Sauvegarder les modifications"}
        </Button>
      </div>
    </form>
  );
}

function EditField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

const NIVEAU_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: "Rappel avant échéance", color: "text-amber-600" },
  2: { label: "Relance amiable", color: "text-orange-600" },
  3: { label: "Mise en demeure", color: "text-destructive" },
};

function niveauRelance(echeance: string | null, settings: any): 1 | 2 | 3 {
  const delaiN1 = settings?.relance_delai_n1 ?? 7;
  const delaiN3 = settings?.relance_delai_n3 ?? 31;
  if (!echeance) return 2;
  const now = new Date();
  const ech = new Date(echeance + "T00:00:00");
  const diff = Math.floor((now.getTime() - ech.getTime()) / 86400000);
  if (diff < 0 && Math.abs(diff) <= delaiN1) return 1;
  if (diff >= 0 && diff < delaiN3) return 2;
  if (diff >= delaiN3) return 3;
  return 2;
}

function FactureDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: invoice, isLoading } = useInvoice(id);
  const { data: settings } = useSettings();
  const { data: relances = [] } = useRelancesForInvoice(id);
  const [editing, setEditing] = useState(false);
  const [sendingRelance, setSendingRelance] = useState(false);

  async function updateStatut(statut: string) {
    const { error } = await db.from("invoices").update({ statut }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["invoice", id] });
    qc.invalidateQueries({ queryKey: ["invoices"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    toast.success("Statut mis à jour");
  }

  async function handleDelete() {
    await db.from("invoice_lines").delete().eq("invoice_id", id);
    const { error } = await db.from("invoices").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["invoices"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    toast.success("Facture supprimée");
    navigate({ to: "/factures" });
  }

  function exportPDF(printOpts?: { printButtonLabel?: string; hint?: string; onPrinted?: () => void }) {
    if (!invoice) return;
    const s = settings;
    const badge = PDF_BADGE[invoice.statut] ?? PDF_BADGE.brouillon;
    const rowsHtml = (invoice.lines ?? []).map((l, i) => `
      <tr style="background:${i % 2 === 0 ? "#fff" : "#f8faf8"}">
        <td style="padding:8px 10px">${l.description}</td>
        <td style="padding:8px 10px;text-align:center">${l.quantite}</td>
        <td style="padding:8px 10px;text-align:right">${formatEUR(l.prix_unitaire_ht)}</td>
        <td style="padding:8px 10px;text-align:right;font-weight:600">${formatEUR(l.total_ht)}</td>
      </tr>`).join("");

    const css = `
  body { font-family:Arial,sans-serif; font-size:11px; color:#1f2937; background:#fff; }

  /* ── En-tête bandeau vert ── */
  .header {
    background:#1a3c2e;
    padding:22px 32px;
    display:flex;
    justify-content:space-between;
    align-items:center;
  }
  .logo-block { display:flex; align-items:center; gap:14px; }
  .logo-icon {
    width:46px; height:46px;
    background:#f97316;
    border-radius:10px;
    display:flex; align-items:center; justify-content:center;
    font-size:22px;
    flex-shrink:0;
  }
  .logo-text { color:#fff; }
  .logo-text .name { font-size:20px; font-weight:bold; letter-spacing:1px; }
  .logo-text .sub  { font-size:10px; opacity:.75; margin-top:2px; }
  .header-coords { text-align:right; color:#d1fae5; font-size:10px; line-height:1.8; }

  /* ── Corps ── */
  .body { padding:28px 32px; }

  /* ── Client / Facture ── */
  .meta-row { display:flex; justify-content:space-between; gap:20px; margin-bottom:20px; }
  .meta-left .lbl  { font-size:9px; text-transform:uppercase; letter-spacing:.8px; color:#6b7280; margin-bottom:4px; }
  .meta-left .name { font-size:14px; font-weight:bold; color:#1a3c2e; margin-bottom:3px; }
  .meta-left .addr { font-size:10px; color:#6b7280; line-height:1.6; }
  .meta-right      { text-align:right; }
  .meta-right .num { font-size:28px; font-weight:bold; color:#1a3c2e; line-height:1; }
  .badge {
    display:inline-block; margin-top:5px; padding:3px 10px;
    border-radius:20px; font-size:10px; font-weight:bold;
    background:${badge.bg}; color:${badge.color};
  }
  .meta-right .dates { font-size:10px; color:#6b7280; margin-top:6px; line-height:1.7; }

  /* ── Objet ── */
  .objet {
    background:#f3f4f6; border-radius:6px;
    padding:9px 14px; font-size:10px; color:#374151;
    margin-bottom:18px;
  }

  /* ── Tableau ── */
  table { width:100%; border-collapse:collapse; margin-bottom:18px; }
  thead tr th {
    background:#1a3c2e; color:#fff;
    padding:9px 10px; font-size:10px; font-weight:600;
    text-transform:uppercase; letter-spacing:.5px;
  }
  tbody td { font-size:11px; border-bottom:1px solid #e5e7eb; }

  /* ── Totaux ── */
  .totaux { margin-left:auto; width:240px; }
  .t-row  { display:flex; justify-content:space-between; padding:4px 0; font-size:11px; color:#374151; }
  .t-row.ttc {
    font-weight:bold; font-size:14px; color:#1a3c2e;
    border-top:2px solid #1a3c2e; padding-top:8px; margin-top:4px;
  }

  /* ── RIB ── */
  .rib {
    margin-top:24px; background:#f9fafb; border-radius:6px;
    padding:12px 14px; font-size:10px; color:#374151; line-height:1.8;
  }
  .rib strong { display:block; color:#1a3c2e; font-size:11px; margin-bottom:3px; }

  /* ── Pied de page ── */
  .footer {
    margin-top:24px; padding-top:10px;
    border-top:3px solid #f97316;
    font-size:9px; color:#6b7280; line-height:1.7;
  }
`;

    const bodyHtml = `
  <div class="header">
    <div class="logo-block">
      ${s?.logo_url ? `<img src="${s.logo_url}" style="max-height:48px;max-width:120px;object-fit:contain;display:block" alt="Logo">` : `<div class="logo-icon">🐀</div>`}
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

  <div class="body">

    <div class="meta-row">
      <div class="meta-left">
        <div class="lbl">Facturé à</div>
        <div class="name">${invoice.client?.raison_sociale ?? "—"}</div>
        <div class="addr">
          ${invoice.adresse_site ? invoice.adresse_site.replace(/\n/g, "<br>") : ""}
          ${invoice.client?.email ? `<br>${invoice.client.email}` : ""}
          ${invoice.client?.siret ? `<br>SIRET : ${invoice.client.siret}` : ""}
        </div>
      </div>
      <div class="meta-right">
        <div class="num">Facture N°${invoice.numero}</div>
        <div class="badge">${statutLabel(invoice.statut)}</div>
        <div class="dates">
          Date : ${formatDateFR(invoice.date_facture)}<br>
          ${invoice.echeance ? `Échéance : ${formatDateFR(invoice.echeance)}` : ""}
        </div>
      </div>
    </div>

    <div class="objet">
      <strong>Objet :</strong> Intervention contre les insectes et les rongeurs
      ${invoice.adresse_site ? ` — ${invoice.adresse_site.replace(/\n/g, ", ")}` : ""}
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:52%;text-align:left">Description</th>
          <th style="width:12%;text-align:center">Qté</th>
          <th style="width:18%;text-align:right">Prix unitaire HT</th>
          <th style="width:18%;text-align:right">Total HT</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>

    <div class="totaux">
      <div class="t-row"><span>Total HT</span><span>${formatEUR(invoice.total_ht)}</span></div>
      <div class="t-row"><span>TVA (${invoice.tva_taux ?? 20} %)</span><span>${formatEUR(invoice.tva)}</span></div>
      <div class="t-row ttc"><span>Total TTC</span><span>${formatEUR(invoice.total_ttc)}</span></div>
    </div>

    <div class="rib">
      <strong>Coordonnées bancaires</strong>
      IBAN : ${s?.iban ?? "FR76 1695 8000 0121 4222 2612 637"}<br>
      BIC : ${s?.bic ?? "QNTOFRP1XXX"}
    </div>

    <div class="footer">
      En cas de retard de paiement, une pénalité au taux annuel de 5 % sera appliquée,
      à laquelle s'ajoutera une indemnité forfaitaire pour frais de recouvrement de 40 €
      (Art. L441-10 du Code de commerce).<br>
      Document émis par ${s?.nom ?? "CITY DERAT"} — Généré le ${new Date().toLocaleDateString("fr-FR")}
    </div>

  </div>
`;

    const ok = printDocument({ title: `Facture N°${invoice.numero}`, bodyHtml, css, ...printOpts });
    if (!ok) { toast.error("Autorisez les popups pour générer le PDF"); return; }
  }

  async function sendRelance() {
    if (!invoice) return;
    const email = invoice.client?.email ?? "";
    if (!email) { toast.error("Aucun email renseigné pour ce client"); return; }

    const s = settings;
    const nomSociete = s?.nom ?? "CITY DERAT";
    const signature = s?.relance_signature ? `\n\n${s.relance_signature}` : `\n\nCordialement,\n${nomSociete}${s?.telephone ? `\nTél : ${s.telephone}` : ""}`;
    const niveau = niveauRelance(invoice.echeance ?? null, settings);
    const montant = formatEUR(invoice.total_ttc);
    const numFac = `N°${invoice.numero}`;
    const echeanceStr = invoice.echeance ? formatDateFR(invoice.echeance) : "—";
    const iban = s?.iban ? `\n\nCoordonnées bancaires pour virement :\nIBAN : ${s.iban}${s.bic ? `\nBIC : ${s.bic}` : ""}` : "";

    const now = new Date();
    const daysLate = invoice.echeance
      ? Math.floor((now.getTime() - new Date(invoice.echeance + "T00:00:00").getTime()) / 86400000)
      : 0;

    let objet = "";
    let corps = "";

    if (niveau === 1) {
      objet = `Rappel : votre facture ${numFac} arrive à échéance le ${echeanceStr} — ${nomSociete}`;
      corps = `Bonjour,\n\nNous vous contactons pour vous rappeler que la facture ${numFac} d'un montant de ${montant} arrive à échéance le ${echeanceStr}.\n\nNous vous remercions par avance d'effectuer le règlement avant cette date.${iban}${signature}`;
    } else if (niveau === 2) {
      objet = `Relance : facture ${numFac} en attente de règlement depuis ${daysLate} jour${daysLate > 1 ? "s" : ""} — ${nomSociete}`;
      corps = `Bonjour,\n\nSauf erreur de notre part, la facture ${numFac} d'un montant de ${montant}, dont l'échéance était fixée au ${echeanceStr}, reste à ce jour impayée.\n\nNous vous demandons de bien vouloir procéder au règlement dans les meilleurs délais.${iban}${signature}`;
    } else {
      objet = `MISE EN DEMEURE : facture ${numFac} — règlement immédiat requis — ${nomSociete}`;
      corps = `Bonjour,\n\nMalgré nos relances, la facture ${numFac} d'un montant de ${montant}, échue depuis ${daysLate} jours (date d'échéance : ${echeanceStr}), demeure impayée.\n\nNous vous mettons en demeure de procéder au règlement immédiat de cette somme.\n\nÀ défaut de paiement sous 8 jours, nous nous verrons contraints d'engager une procédure de recouvrement, entraînant des frais supplémentaires à votre charge (pénalités de retard, indemnité forfaitaire de 40 € conformément à l'Art. L441-10 du Code de commerce).${iban}${signature}`;
    }

    setSendingRelance(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      await db.from("relances").insert({
        user_id: user.id,
        facture_id: id,
        niveau,
        date_envoi: dateStr,
        notes: `Niveau ${niveau} — ${NIVEAU_LABELS[niveau].label}`,
      });
      qc.invalidateQueries({ queryKey: ["relances"] });
      qc.invalidateQueries({ queryKey: ["relances", id] });
      toast.success(`Relance niveau ${niveau} enregistrée`);
    } finally {
      setSendingRelance(false);
    }

    const mailto = `mailto:${email}?subject=${encodeURIComponent(objet)}&body=${encodeURIComponent(corps)}`;
    setTimeout(() => { window.location.href = mailto; }, 300);
  }

  function sendEmail() {
    if (!invoice) return;
    const email = invoice.client?.email ?? "";
    if (!email) { toast.warning("Aucun email renseigné pour ce client"); return; }
    const s = settings;
    const nomSociete = s?.nom ?? "CITY DERAT";
    const objet = `Facture N°${invoice.numero} - ${nomSociete}`;
    const corps = [
      "Bonjour,",
      "",
      `Veuillez trouver ci-joint la facture N°${invoice.numero} d'un montant de ${formatEUR(invoice.total_ttc)}.`,
      "",
      "Cordialement,",
      nomSociete,
    ].join("\n");

    // L'aperçu éditable s'ouvre d'abord ; la messagerie n'ouvre qu'après que
    // l'utilisateur a cliqué sur "Générer le PDF" (évènement afterprint).
    exportPDF({
      printButtonLabel: "Générer le PDF puis ouvrir l'email",
      hint: "Corrigez le document si besoin, puis générez le PDF. Votre messagerie s'ouvrira ensuite : joignez-y le PDF que vous venez d'enregistrer.",
      onPrinted: () => {
        window.location.href = `mailto:${email}?subject=${encodeURIComponent(objet)}&body=${encodeURIComponent(corps)}`;
        toast.success("Votre messagerie est ouverte. Joignez le PDF que vous venez d'enregistrer, puis envoyez.");
      },
    });
  }

  if (isLoading) return <div className="text-sm text-muted-foreground py-10 text-center">Chargement…</div>;
  if (!invoice) return <div className="text-sm text-muted-foreground py-10 text-center">Facture introuvable.</div>;

  const canEdit = invoice.statut !== "payee";

  if (editing) {
    return (
      <div className="space-y-4">
        <Link to="/factures" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" /> Retour
        </Link>
        <EditFactureForm invoice={invoice} onCancel={() => setEditing(false)} onSaved={() => setEditing(false)} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link to="/factures" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" /> Retour
        </Link>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Modifier
            </Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer cette facture ?</AlertDialogTitle>
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

      <Card><CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold">Facture N°{invoice.numero}</h1>
            <div className="text-sm text-muted-foreground">{invoice.client?.raison_sociale ?? "—"}</div>
            <div className="text-xs text-muted-foreground">{formatDateFR(invoice.date_facture)}{invoice.echeance ? ` · Éch. ${formatDateFR(invoice.echeance)}` : ""}</div>
            {invoice.adresse_site && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(invoice.adresse_site)}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-primary hover:underline mt-1"
              >
                <MapPin className="h-3 w-3 shrink-0" />{invoice.adresse_site}
              </a>
            )}
          </div>
          <span className={cn("text-xs font-medium uppercase rounded-full px-2 py-1 shrink-0", STATUT_COLORS[invoice.statut] ?? "bg-muted")}>
            {statutLabel(invoice.statut)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Statut :</span>
          <Select value={invoice.statut} onValueChange={updateStatut}>
            <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUTS_FACTURE.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {!canEdit && (
          <p className="text-xs text-muted-foreground italic">La facture est payée — modification désactivée.</p>
        )}
      </CardContent></Card>

      <Card><CardContent className="p-4 space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Prestations</h2>
        {(invoice.lines ?? []).map((l, i) => (
          <div key={i} className="flex items-start justify-between gap-2 py-2 border-b last:border-0">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{l.description}</div>
              <div className="text-xs text-muted-foreground">Qté : {l.quantite} × {formatEUR(l.prix_unitaire_ht)}</div>
            </div>
            <div className="text-sm font-semibold shrink-0">{formatEUR(l.total_ht)}</div>
          </div>
        ))}
        <div className="pt-2 space-y-1">
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total HT</span><span>{formatEUR(invoice.total_ht)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">TVA ({invoice.tva_taux ?? 20}%)</span><span>{formatEUR(invoice.tva)}</span></div>
          <div className="flex justify-between text-base font-bold border-t pt-2"><span>Total TTC</span><span className="text-primary">{formatEUR(invoice.total_ttc)}</span></div>
        </div>
      </CardContent></Card>

      {/* Relances */}
      {invoice.statut !== "payee" && invoice.statut !== "brouillon" && (
        <Card><CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-accent shrink-0" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Relances</h2>
          </div>

          {/* Historique */}
          {relances.length > 0 && (
            <div className="space-y-1.5">
              {relances.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/30 px-3 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className={cn("font-bold", NIVEAU_LABELS[r.niveau]?.color)}>
                      Niv. {r.niveau}
                    </span>
                    <span className="text-muted-foreground">{NIVEAU_LABELS[r.niveau]?.label}</span>
                  </div>
                  <span className="flex items-center gap-1 text-muted-foreground shrink-0">
                    <Clock className="h-3 w-3" />{formatDateFR(r.date_envoi)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Bouton relance */}
          {invoice.client?.email ? (() => {
            const niv = niveauRelance(invoice.echeance ?? null, settings);
            const info = NIVEAU_LABELS[niv];
            return (
              <div className="space-y-1">
                <Button
                  onClick={sendRelance}
                  disabled={sendingRelance}
                  className={cn(
                    "w-full gap-2",
                    niv === 3 ? "bg-destructive hover:bg-destructive/90 text-white" :
                    niv === 2 ? "bg-orange-600 hover:bg-orange-700 text-white" :
                    "bg-amber-500 hover:bg-amber-600 text-white"
                  )}
                >
                  <Mail className="h-4 w-4" />
                  {sendingRelance ? "Envoi…" : `Envoyer — Niveau ${niv} (${info.label})`}
                </Button>
                <p className="text-[10px] text-muted-foreground text-center">
                  {niv === 1 && "Rappel doux avant échéance"}
                  {niv === 2 && "Relance ferme mais courtoise"}
                  {niv === 3 && "Mise en demeure — ton urgent"}
                  {relances.length > 0 && ` · ${relances.length} relance${relances.length > 1 ? "s" : ""} déjà envoyée${relances.length > 1 ? "s" : ""}`}
                </p>
              </div>
            );
          })() : (
            <p className="text-xs text-muted-foreground italic">
              Aucun email client — <Link to="/clients/$id" params={{ id: invoice.client_id }} className="underline">Ajouter l'email du client</Link>
            </p>
          )}
        </CardContent></Card>
      )}

      <Button onClick={() => exportPDF()} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
        <Download className="mr-2 h-4 w-4" /> Télécharger / Imprimer PDF
      </Button>

      <div className="space-y-1.5">
        <Button onClick={sendEmail} variant="outline" className="w-full">
          <Mail className="mr-2 h-4 w-4" /> Envoyer par email
        </Button>
        <p className="text-[11px] text-muted-foreground text-center leading-tight px-2">
          Le PDF s'ouvre dans un nouvel onglet — téléchargez-le puis joignez-le manuellement à votre email.
        </p>
      </div>
    </div>
  );
}
