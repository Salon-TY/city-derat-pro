import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useContract, useInterventions, useSettings } from "@/lib/queries";
import { formatDateFR, STATUTS_CONTRAT, STATUTS_INTERVENTION } from "@/lib/schemas";
import { ContratForm } from "@/routes/_app.contrats.index";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SignatureCanvas } from "@/components/signature-canvas";
import { uploadSignature, deleteSignature } from "@/lib/photos";
import { db } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Trash2, MapPin, Building2, FileText, Mail, PenLine,
  CheckCircle, Pencil, ClipboardList, CalendarClock,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_app/contrats/$id")({
  head: () => ({ meta: [{ title: "Contrat — CITY DERAT" }] }),
  component: ContractDetail,
});

function statutLabel(v: string) {
  return STATUTS_CONTRAT.find((s) => s.value === v)?.label ?? v;
}

function interventionStatutLabel(v: string) {
  return STATUTS_INTERVENTION.find((s) => s.value === v)?.label ?? v;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function companySirenFormatted(siret: string | null | undefined): string {
  if (!siret) return "";
  const digits = siret.replace(/\D/g, "").slice(0, 9);
  if (digits.length !== 9) return siret;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;
}

function clientLegalIdLine(client: { rcs?: string | null; siren?: string | null; siret?: string | null }): string {
  if (client.rcs) return `RCS : ${client.rcs}`;
  if (client.siren) return `SIREN : ${client.siren}`;
  if (client.siret) return `SIRET : ${client.siret}`;
  return "";
}

function clientLegalIdPhrase(client: { rcs?: string | null; siren?: string | null; siret?: string | null }): string {
  if (client.rcs) return `RCS ${client.rcs}`;
  if (client.siren) return `SIREN ${client.siren}`;
  if (client.siret) return `SIRET ${client.siret}`;
  return "immatriculation non renseignée";
}

function ContractDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: contract, isLoading } = useContract(id);
  const { data: settings } = useSettings();
  const { data: interventions = [] } = useInterventions({ contract_id: id });
  const [showSignatureCanvas, setShowSignatureCanvas] = useState(false);
  const [savingSignature, setSavingSignature] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  async function handleDelete() {
    const { error } = await db.from("contracts").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["contracts"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    toast.success("Contrat supprimé");
    navigate({ to: "/contrats" });
  }

  async function handleSignatureSave(blob: Blob) {
    setSavingSignature(true);
    const { data: { user } } = await supabase.auth.getUser();
    const url = await uploadSignature(blob, user?.id ?? "");
    if (url) {
      await db.from("contracts").update({ signature_url: url, signature_at: new Date().toISOString() }).eq("id", id);
      qc.invalidateQueries({ queryKey: ["contract", id] });
      qc.invalidateQueries({ queryKey: ["contracts"] });
      toast.success("Signature enregistrée");
      setShowSignatureCanvas(false);
    }
    setSavingSignature(false);
  }

  async function handleDeleteSignature() {
    if (!contract?.signature_url) return;
    await deleteSignature(contract.signature_url);
    await db.from("contracts").update({ signature_url: null, signature_at: null }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["contract", id] });
    qc.invalidateQueries({ queryKey: ["contracts"] });
    toast.success("Signature supprimée");
  }

  function generatePDF() {
    if (!contract) return;
    const s = settings;
    const client = contract.client;
    const nomSociete = s?.nom ?? "CITY DERAT";
    const clientNom = client?.raison_sociale ?? "";
    const formeJuridique = (client as any)?.forme_juridique as string | null | undefined;
    const clientNomAvecForme = formeJuridique ? `${clientNom}, ${formeJuridique}` : clientNom;
    const companySiren = companySirenFormatted(s?.siret);
    const adresseEtablissement = contract.adresse_etablissement || client?.adresse_site || "";
    const ville = contract.ville_signature || "Paris";

    const sigCompanyHtml = `<div class="sig-line">${nomSociete}</div>`;
    const sigClientHtml = contract.signature_url
      ? `<div class="sig-img-block">
           <img src="${contract.signature_url}" alt="Signature" style="max-height:60px;border-bottom:1px solid #ccc;padding-bottom:4px;">
           <div style="font-size:9px;color:#555;margin-top:3px;">Signé le ${formatDateTime(contract.signature_at)}</div>
         </div>`
      : `<div class="sig-line">${clientNom}</div>`;

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:Arial,sans-serif; font-size:11px; color:#222; padding:32px; }
  .header { display:flex; justify-content:space-between; margin-bottom:24px; border-bottom:2px solid #1a3c2e; padding-bottom:16px; }
  .prestataire strong { font-size:15px; display:block; margin-bottom:4px; color:#1a3c2e; }
  .prestataire { line-height:1.7; }
  .client-block { text-align:right; line-height:1.7; }
  .titre { text-align:center; margin:16px 0 4px; font-size:18px; font-weight:bold; color:#1a3c2e; }
  .sous-titre { text-align:center; font-size:10px; font-style:italic; color:#555; margin-bottom:20px; }
  .para { text-align:justify; line-height:1.8; margin-bottom:14px; }
  .date-line { margin:24px 0 8px; }
  .signature-zone { display:flex; justify-content:space-between; margin-top:32px; gap:20px; }
  .sig-box { flex:1; text-align:center; }
  .sig-box .sig-label { font-size:10px; color:#555; margin-bottom:45px; font-weight:bold; }
  .sig-line { border-top:1px solid #ccc; margin-top:50px; padding-top:5px; font-size:9px; color:#777; }
  .sig-img-block { padding-top:6px; }
  .footer { margin-top:24px; font-size:8px; color:#aaa; text-align:center; border-top:1px solid #eee; padding-top:8px; }
</style>
</head>
<body>
  <div class="header">
    <div class="prestataire">
      ${s?.logo_url ? `<img src="${s.logo_url}" style="max-height:40px;max-width:100px;object-fit:contain;display:block;margin-bottom:4px" alt="Logo">` : ""}
      <strong>${nomSociete}</strong>
      ${s?.adresse ? s.adresse.replace(/\n/g, "<br>") : ""}
      <br>Siret : ${s?.siret ?? ""}
      <br>N° TVA : ${s?.tva_number ?? ""}
      <br>Tél : ${s?.telephone ?? ""}
    </div>
    <div class="client-block">
      <strong>${clientNom}</strong>
      ${adresseEtablissement ? adresseEtablissement.replace(/\n/g, "<br>") : ""}
      ${clientLegalIdLine(client ?? {}) ? `<br>${clientLegalIdLine(client ?? {})}` : ""}
    </div>
  </div>

  <div class="titre">CONTRAT D'ENGAGEMENT ANTI-NUISIBLES</div>
  <div class="sous-titre">${adresseEtablissement}</div>

  <p class="para">
    La société ${nomSociete} immatriculée sous le SIREN ${companySiren} et la société ${clientNomAvecForme}, immatriculée sous le ${clientLegalIdPhrase(client ?? {})},
    s'engagent pour un contrat de ${contract.type_prestation} dans l'établissement nommé ${contract.nom_etablissement} situé au ${adresseEtablissement}.
  </p>

  <p class="para">
    La société ${nomSociete} s'engage à réaliser ${contract.frequence}, de type ${contract.type_passage}, et à intervenir en cas de sollicitation de la part de la société ${clientNom} sur les sites précédemment mentionnés.
    <br>Le présent contrat prend effet à compter du ${formatDateFR(contract.date_debut)} et ce pour une durée de ${contract.duree_mois} mois.
  </p>

  <p class="date-line">Fait à ${ville}, le ${formatDateFR(contract.date_debut)}</p>

  <div class="signature-zone">
    <div class="sig-box">
      <div class="sig-label">${nomSociete}</div>
      ${sigCompanyHtml}
    </div>
    <div class="sig-box">
      <div class="sig-label">${clientNom}</div>
      ${sigClientHtml}
    </div>
  </div>

  <div class="footer">
    ${contract.numero ?? ""} &nbsp;·&nbsp; Généré le ${new Date().toLocaleString("fr-FR")} &nbsp;·&nbsp; ${nomSociete}
  </div>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (!win) { toast.error("Autorisez les popups pour générer le PDF"); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 600);
  }

  async function handleSendEmail() {
    if (!contract) return;
    const clientEmail = contract.client?.email ?? "";
    if (!clientEmail) { toast.warning("Aucun email renseigné pour ce client"); return; }

    const s = settings;
    const nomSociete = s?.nom ?? "CITY DERAT";
    const num = contract.numero ?? "";

    const objet = `Contrat ${num} — ${nomSociete}`;
    const corps = [
      "Bonjour,",
      "",
      `Veuillez trouver ci-joint le contrat N° ${num} concernant l'établissement ${contract.nom_etablissement ?? ""}.`,
      "",
      `Prestation : ${contract.type_prestation}`,
      `Fréquence : ${contract.frequence || "—"}`,
      `Durée : ${contract.duree_mois} mois à compter du ${formatDateFR(contract.date_debut)}`,
      "",
      "Le contrat complet est joint à cet email en PDF.",
      "",
      "Cordialement,",
      nomSociete,
      s?.telephone ? `Tél : ${s.telephone}` : "",
    ].filter((l) => l !== undefined).join("\n");

    generatePDF();
    setTimeout(() => {
      window.location.href = `mailto:${clientEmail}?subject=${encodeURIComponent(objet)}&body=${encodeURIComponent(corps)}`;
    }, 700);
  }

  if (isLoading) return <div className="text-sm text-muted-foreground py-10 text-center">Chargement…</div>;
  if (!contract) return <div className="text-sm text-muted-foreground py-10 text-center">Contrat introuvable.</div>;

  const clientEmail = contract.client?.email ?? "";
  const hasSig = !!contract.signature_url;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link to="/contrats" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" /> Retour
        </Link>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer ce contrat ?</AlertDialogTitle>
              <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive">Supprimer</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Card className="border-primary/20 bg-primary/3">
        <CardContent className="p-4 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-mono text-muted-foreground tracking-wider">{contract.numero}</p>
              <h1 className="text-lg font-bold mt-0.5">{contract.client?.raison_sociale ?? "Client supprimé"}</h1>
            </div>
            <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase shrink-0 bg-primary/15 text-primary">
              {statutLabel(contract.statut)}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <Building2 className="h-4 w-4" /> Établissement
          </h2>
          <p className="font-semibold text-sm">{contract.nom_etablissement || "—"}</p>
          {contract.adresse_etablissement && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contract.adresse_etablissement)}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-start gap-1.5 text-xs text-primary hover:underline"
            >
              <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
              <span className="whitespace-pre-wrap">{contract.adresse_etablissement}</span>
            </a>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prestation</h2>
          <div className="text-sm"><span className="text-muted-foreground">Type : </span>{contract.type_prestation}</div>
          <div className="text-sm"><span className="text-muted-foreground">Fréquence : </span>{contract.frequence || "—"}</div>
          <div className="text-sm"><span className="text-muted-foreground">Type de passage : </span>{contract.type_passage}</div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Durée & suivi</h2>
          <div className="text-sm">{formatDateFR(contract.date_debut)} → {formatDateFR(contract.date_fin)} ({contract.duree_mois} mois)</div>
          <div className="flex items-center gap-4">
            <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
              <div className="h-2 bg-primary rounded-full"
                style={{ width: `${Math.min(100, (contract.passages_realises / contract.nb_passages_inclus) * 100)}%` }} />
            </div>
            <span className="text-xs text-muted-foreground shrink-0">
              {contract.passages_realises}/{contract.nb_passages_inclus} passages
            </span>
          </div>
        </CardContent>
      </Card>

      {interventions.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
            <ClipboardList className="h-4 w-4" /> Interventions liées
          </h2>
          <div className="space-y-2">
            {interventions.map((i) => (
              <Link key={i.id} to="/interventions/$id" params={{ id: i.id }}>
                <Card><CardContent className="p-3 text-sm flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="font-medium">{formatDateFR(i.date)}</span>
                    <span className="text-xs text-muted-foreground">{i.type_intervention}</span>
                  </div>
                  <span className="text-xs rounded-full px-2 py-0.5 bg-muted text-muted-foreground">
                    {interventionStatutLabel(i.statut)}
                  </span>
                </CardContent></Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <PenLine className="h-4 w-4" /> Signature client
          </h2>
          {hasSig ? (
            <div className="space-y-2">
              <div className="rounded-lg border bg-white dark:bg-zinc-900 p-3 text-center">
                <img src={contract.signature_url!} alt="Signature client" className="max-h-20 mx-auto" />
                <p className="text-[10px] text-muted-foreground mt-1 flex items-center justify-center gap-1">
                  <CheckCircle className="h-3 w-3 text-primary" />
                  Signé par le client — {formatDateTime(contract.signature_at)}
                </p>
              </div>
              <button type="button" onClick={handleDeleteSignature}
                className="text-xs text-destructive/70 hover:text-destructive underline">
                Supprimer la signature
              </button>
            </div>
          ) : showSignatureCanvas ? (
            <div>
              {savingSignature ? (
                <p className="text-sm text-muted-foreground text-center py-4">Enregistrement…</p>
              ) : (
                <SignatureCanvas onSave={handleSignatureSave} />
              )}
            </div>
          ) : (
            <Button type="button" variant="outline" className="w-full" onClick={() => setShowSignatureCanvas(true)}>
              <PenLine className="mr-2 h-4 w-4" /> Faire signer le client
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="space-y-2">
        <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" onClick={generatePDF}>
          <FileText className="mr-2 h-4 w-4" /> Générer le PDF
        </Button>

        {clientEmail ? (
          <Button className="w-full" variant="outline" onClick={handleSendEmail}>
            <Mail className="mr-2 h-4 w-4" /> Envoyer par email
          </Button>
        ) : (
          <Button className="w-full" variant="outline" disabled>
            <Mail className="mr-2 h-4 w-4" /> Envoyer par email (aucun email client)
          </Button>
        )}

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <Button className="w-full" variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" /> Modifier le contrat
          </Button>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Modifier le contrat</DialogTitle></DialogHeader>
            <ContratForm contract={contract} onSuccess={() => setEditOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
