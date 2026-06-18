import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useInvoice, useSettings } from "@/lib/queries";
import { formatEUR, formatDateFR, STATUTS_FACTURE } from "@/lib/schemas";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Trash2, Mail, MapPin } from "lucide-react";
import { db } from "@/lib/db";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_app/factures/$id")({
  head: () => ({ meta: [{ title: "Facture — CITY DERAT" }] }),
  component: FactureDetail,
});

const STATUT_COLORS: Record<string, string> = {
  brouillon: "bg-muted text-muted-foreground",
  envoyee: "bg-accent/15 text-accent",
  payee: "bg-primary/15 text-primary",
  retard: "bg-destructive/15 text-destructive",
};

function statutLabel(v: string) {
  return STATUTS_FACTURE.find((s) => s.value === v)?.label ?? v;
}

function FactureDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: invoice, isLoading } = useInvoice(id);
  const { data: settings } = useSettings();

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

  function sendEmail() {
    if (!invoice) return;
    const s = settings;
    const nomSociete = s?.nom ?? "CITY DERAT";
    const email = invoice.client?.email ?? "";
    const objet = `Facture N°${invoice.numero} - ${nomSociete}`;
    const corps = [
      "Bonjour,",
      "",
      `Veuillez trouver ci-joint la facture N°${invoice.numero} d'un montant de ${formatEUR(invoice.total_ttc)}.`,
      "",
      `Cordialement,`,
      nomSociete,
    ].join("\n");

    // Ouvre d'abord le PDF dans un nouvel onglet
    exportPDF();

    // Puis ouvre le client mail
    const mailto = `mailto:${email}?subject=${encodeURIComponent(objet)}&body=${encodeURIComponent(corps)}`;
    setTimeout(() => { window.location.href = mailto; }, 600);
  }

  function exportPDF() {
    if (!invoice) return;
    const s = settings;
    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #222; padding: 40px; }
  .header { display: flex; justify-content: space-between; margin-bottom: 30px; }
  .prestataire { font-size: 11px; line-height: 1.6; }
  .prestataire strong { font-size: 14px; display: block; margin-bottom: 4px; color: #1a3c2e; }
  .client-block { text-align: right; font-size: 11px; line-height: 1.6; }
  .titre { text-align: center; margin: 20px 0 8px; font-size: 20px; font-weight: bold; color: #1a3c2e; }
  .meta { text-align: center; font-size: 11px; color: #555; margin-bottom: 6px; }
  .objet { text-align: center; font-size: 11px; margin: 16px 0 20px; color: #333; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th { background: #1a3c2e; color: white; padding: 8px; text-align: left; font-size: 11px; }
  td { padding: 8px; border-bottom: 1px solid #eee; font-size: 11px; }
  .totaux { margin-left: auto; width: 260px; }
  .totaux-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; }
  .totaux-row.total { font-weight: bold; font-size: 14px; border-top: 2px solid #1a3c2e; padding-top: 8px; margin-top: 4px; color: #1a3c2e; }
  .rib { margin-top: 30px; font-size: 11px; color: #333; }
  .rib strong { display: block; margin-bottom: 4px; }
  .mention { margin-top: 30px; font-size: 9px; color: #888; border-top: 1px solid #eee; padding-top: 10px; }
</style>
</head>
<body>
  <div class="header">
    <div class="prestataire">
      <strong>${s?.nom ?? "CITY DERAT"}</strong>
      ${s?.adresse ? s.adresse.replace(/\n/g, "<br>") : "17 RUE DU DOCTEUR LAURENT<br>75013 PARIS 13"}
      <br>Siret : ${s?.siret ?? "88268913600019"}
      <br>N° TVA : ${s?.tva_number ?? "FR12882689136"}
      <br>Tél : ${s?.telephone ?? "06 47 83 25 71"}
    </div>
    <div class="client-block">
      <strong>${invoice.client?.raison_sociale ?? ""}</strong>
      ${invoice.adresse_site ? invoice.adresse_site.replace(/\n/g, "<br>") : ""}
      ${invoice.client?.siret ? `<br>Siret : ${invoice.client.siret}` : ""}
    </div>
  </div>

  <div class="titre">Facture N°${invoice.numero}</div>
  <div class="meta">Date de facture : ${formatDateFR(invoice.date_facture)}${invoice.echeance ? `   &nbsp;&nbsp;&nbsp;   Échéance : ${formatDateFR(invoice.echeance)}` : ""}</div>
  <div class="objet">
    <strong>Intervention contre les insectes et les rongeurs</strong><br>
    ${invoice.adresse_site ?? ""}
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:55%">Description</th>
        <th style="width:15%;text-align:center">Quantité</th>
        <th style="width:15%;text-align:right">Prix unitaire HT</th>
        <th style="width:15%;text-align:right">Prix total HT</th>
      </tr>
    </thead>
    <tbody>
      ${(invoice.lines ?? []).map((l) => `
      <tr>
        <td>${l.description}</td>
        <td style="text-align:center">${l.quantite}</td>
        <td style="text-align:right">${formatEUR(l.prix_unitaire_ht)}</td>
        <td style="text-align:right">${formatEUR(l.total_ht)}</td>
      </tr>`).join("")}
    </tbody>
  </table>

  <div class="totaux">
    <div class="totaux-row"><span>Total HT</span><span>${formatEUR(invoice.total_ht)}</span></div>
    <div class="totaux-row"><span>TVA (${invoice.tva_taux ?? 20}%)</span><span>${formatEUR(invoice.tva)}</span></div>
    <div class="totaux-row total"><span>Total TTC</span><span>${formatEUR(invoice.total_ttc)}</span></div>
  </div>

  <div class="rib">
    <strong>Coordonnées bancaires</strong>
    RIB/IBAN : ${s?.iban ?? "FR76 1695 8000 0121 4222 2612 637"}<br>
    BIC : ${s?.bic ?? "QNTOFRP1XXX"}
  </div>

  <div class="mention">
    En cas de retard, une pénalité au taux annuel de 5 % sera appliquée, à laquelle s'ajoutera une indemnité forfaitaire pour frais de recouvrement de 40 €.
  </div>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (!win) { toast.error("Autorisez les popups pour télécharger le PDF"); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 500);
  }

  if (isLoading) return <div className="text-sm text-muted-foreground py-10 text-center">Chargement…</div>;
  if (!invoice) return <div className="text-sm text-muted-foreground py-10 text-center">Facture introuvable.</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link to="/factures" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" /> Retour
        </Link>
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

      <Card><CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold">Facture N°{invoice.numero}</h1>
            <div className="text-sm text-muted-foreground">{invoice.client?.raison_sociale ?? "—"}</div>
            <div className="text-xs text-muted-foreground">{formatDateFR(invoice.date_facture)}</div>
            {invoice.adresse_site && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(invoice.adresse_site)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-primary hover:underline mt-1"
              >
                <MapPin className="h-3 w-3 shrink-0" />
                {invoice.adresse_site}
              </a>
            )}
          </div>
          <span className={cn("text-xs font-medium uppercase rounded-full px-2 py-1", STATUT_COLORS[invoice.statut] ?? "bg-muted")}>
            {statutLabel(invoice.statut)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Changer statut :</span>
          <Select value={invoice.statut} onValueChange={updateStatut}>
            <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUTS_FACTURE.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
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

      <Button onClick={exportPDF} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
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
