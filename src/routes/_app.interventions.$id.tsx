import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useIntervention, useSettings } from "@/lib/queries";
import { formatDateFR, STATUTS_INTERVENTION } from "@/lib/schemas";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Receipt, Copy, FileText, MapPin, Calendar, Bug, FlaskConical,
  Package, ClipboardList, CalendarClock, Trash2, Camera, X, ChevronLeft,
  ChevronRight, Mail, PenLine, CheckCircle, AlertTriangle, Phone,
} from "lucide-react";
import { useState, useCallback, useRef, useEffect } from "react";
import { uploadInterventionPhotos, deleteInterventionPhoto, uploadSignature, deleteSignature } from "@/lib/photos";
import type { PhotoFile } from "@/components/intervention-form";
import { db } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_app/interventions/$id")({
  head: () => ({ meta: [{ title: "Rapport d'intervention — CITY DERAT" }] }),
  component: InterventionDetail,
});

const STATUT_COLORS: Record<string, string> = {
  planifiee: "bg-accent/15 text-accent",
  realisee: "bg-primary/15 text-primary",
  rapport_transmis: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  annulee: "bg-muted text-muted-foreground",
};

function statutLabel(v: string) {
  return STATUTS_INTERVENTION.find((s) => s.value === v)?.label ?? v;
}

function reportNumber(id: string) {
  const year = new Date().getFullYear();
  return `RI-${year}-${id.slice(0, 6).toUpperCase()}`;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ─── Signature canvas ────────────────────────────────────────────────────────

function SignatureCanvas({ onSave }: { onSave: (blob: Blob) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [hasStrokes, setHasStrokes] = useState(false);

  function getPos(e: React.TouchEvent | React.MouseEvent): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function startDraw(e: React.TouchEvent | React.MouseEvent) {
    e.preventDefault();
    drawing.current = true;
    last.current = getPos(e);
  }

  function draw(e: React.TouchEvent | React.MouseEvent) {
    e.preventDefault();
    if (!drawing.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d")!;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.strokeStyle = "#1a3c2e";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.moveTo(last.current!.x, last.current!.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    last.current = pos;
    setHasStrokes(true);
  }

  function endDraw(e: React.TouchEvent | React.MouseEvent) {
    e.preventDefault();
    drawing.current = false;
    last.current = null;
  }

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStrokes(false);
  }

  function save() {
    const canvas = canvasRef.current;
    if (!canvas || !hasStrokes) { toast.error("Veuillez signer avant de valider"); return; }
    canvas.toBlob((blob) => { if (blob) onSave(blob); }, "image/png");
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Signez avec le doigt dans la zone ci-dessous :</p>
      <div className="rounded-lg border-2 border-dashed border-muted-foreground/30 bg-white dark:bg-zinc-900 touch-none select-none overflow-hidden">
        <canvas
          ref={canvasRef}
          width={600}
          height={160}
          className="w-full"
          style={{ touchAction: "none" }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" className="flex-1" onClick={clear}>
          Effacer
        </Button>
        <Button type="button" size="sm" className="flex-1 bg-primary" onClick={save} disabled={!hasStrokes}>
          <CheckCircle className="mr-1.5 h-3.5 w-3.5" /> Valider la signature
        </Button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

function InterventionDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: intervention, isLoading } = useIntervention(id);
  const { data: settings } = useSettings();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [showSignatureCanvas, setShowSignatureCanvas] = useState(false);
  const [savingSignature, setSavingSignature] = useState(false);

  const photos: string[] = intervention?.photos ?? [];
  const rapportNum = intervention ? reportNumber(intervention.id) : "";

  // ── Photo handlers ──────────────────────────────────────────────────────────

  async function handleAddPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length || !intervention) return;
    const remaining = 5 - photos.length;
    const toAdd: PhotoFile[] = files.slice(0, remaining).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    e.target.value = "";
    setUploadingPhotos(true);
    const { data: { user } } = await supabase.auth.getUser();
    const newUrls = await uploadInterventionPhotos(toAdd, user?.id ?? "");
    toAdd.forEach((p) => URL.revokeObjectURL(p.preview));
    if (newUrls.length > 0) {
      const merged = [...photos, ...newUrls];
      await db.from("interventions").update({ photos: merged }).eq("id", id);
      qc.invalidateQueries({ queryKey: ["intervention", id] });
    }
    setUploadingPhotos(false);
  }

  async function handleDeletePhoto(url: string) {
    await deleteInterventionPhoto(url);
    const merged = photos.filter((u) => u !== url);
    await db.from("interventions").update({ photos: merged.length > 0 ? merged : null }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["intervention", id] });
    setLightboxIndex(null);
  }

  const closeLightbox = useCallback(() => setLightboxIndex(null), []);

  // ── Signature handler ───────────────────────────────────────────────────────

  async function handleSignatureSave(blob: Blob) {
    setSavingSignature(true);
    const { data: { user } } = await supabase.auth.getUser();
    const url = await uploadSignature(blob, user?.id ?? "");
    if (url) {
      const signedAt = new Date().toISOString();
      await db.from("interventions").update({ signature_url: url, signature_at: signedAt, statut: "realisee" }).eq("id", id);
      qc.invalidateQueries({ queryKey: ["intervention", id] });
      toast.success("Signature enregistrée");
      setShowSignatureCanvas(false);
    }
    setSavingSignature(false);
  }

  async function handleDeleteSignature() {
    if (!intervention?.signature_url) return;
    await deleteSignature(intervention.signature_url);
    await db.from("interventions").update({ signature_url: null, signature_at: null }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["intervention", id] });
    toast.success("Signature supprimée");
  }

  // ── Statut ──────────────────────────────────────────────────────────────────

  async function updateStatut(statut: string) {
    await db.from("interventions").update({ statut }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["intervention", id] });
    qc.invalidateQueries({ queryKey: ["interventions"] });
  }

  // ── Delete / Duplicate ─────────────────────────────────────────────────────

  async function handleDelete() {
    const { error } = await db.from("interventions").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["interventions"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    toast.success("Intervention supprimée");
    navigate({ to: "/interventions" });
  }

  async function handleDuplicate() {
    if (!intervention) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Non connecté"); return; }
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await db.from("interventions").insert({
      user_id: user.id,
      client_id: intervention.client_id,
      date: today,
      adresse_site: intervention.adresse_site,
      type_nuisible: intervention.type_nuisible,
      type_intervention: intervention.type_intervention,
      produits: intervention.produits,
      quantite: intervention.quantite,
      observations: intervention.observations,
      statut: "planifiee",
      date_prochain_passage: null,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["interventions"] });
    toast.success("Intervention dupliquée");
    navigate({ to: "/interventions/$id", params: { id: data.id } });
  }

  // ── PDF ─────────────────────────────────────────────────────────────────────

  function generatePDF() {
    if (!intervention) return;
    const s = settings;
    const num = rapportNum;
    const dateHeure = formatDateTime(intervention.created_at);
    const photosHtml = (intervention.photos ?? []).slice(0, 3).length > 0
      ? `<div class="photos-grid">${(intervention.photos ?? []).slice(0, 3).map((url) =>
          `<img src="${url}" alt="Photo" style="width:100%;height:100px;object-fit:cover;border-radius:4px;border:1px solid #eee;">`
        ).join("")}</div>`
      : "";
    const sigHtml = intervention.signature_url
      ? `<div class="sig-img-block">
           <img src="${intervention.signature_url}" alt="Signature" style="max-height:60px;border-bottom:1px solid #ccc;padding-bottom:4px;">
           <div style="font-size:9px;color:#555;margin-top:3px;">Signé par le client — ${formatDateTime((intervention as any).signature_at)}</div>
         </div>`
      : `<div class="sig-line">Signature du client (bon pour accord)</div>`;

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
  .rapport-num { font-size:9px; color:#888; margin-bottom:2px; }
  .titre { text-align:center; margin:16px 0 4px; font-size:18px; font-weight:bold; color:#1a3c2e; }
  .sous-titre { text-align:center; font-size:10px; color:#555; margin-bottom:16px; }
  .badge { display:inline-block; background:#e6f4ef; color:#1a3c2e; padding:2px 8px; border-radius:12px; font-size:10px; font-weight:bold; }
  .section { margin-bottom:14px; }
  .section-title { font-size:10px; font-weight:bold; text-transform:uppercase; color:#1a3c2e; border-bottom:1px solid #c8ddd5; padding-bottom:2px; margin-bottom:6px; letter-spacing:.5px; }
  .row { display:flex; gap:8px; margin-bottom:3px; }
  .lbl { color:#666; min-width:155px; }
  .val { font-weight:500; }
  .obs { white-space:pre-wrap; background:#f9faf8; border:1px solid #e0ebe6; padding:8px; border-radius:4px; line-height:1.7; }
  .photos-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; margin-top:6px; }
  .signature-zone { display:flex; justify-content:space-between; margin-top:32px; gap:20px; }
  .sig-box { flex:1; text-align:center; }
  .sig-line { border-top:1px solid #ccc; margin-top:50px; padding-top:5px; font-size:9px; color:#777; }
  .sig-img-block { padding-top:6px; }
  .mention { margin-top:24px; padding:8px; background:#f5f5f5; border-radius:4px; font-size:9px; color:#666; line-height:1.6; }
  .footer { margin-top:16px; font-size:8px; color:#aaa; text-align:center; border-top:1px solid #eee; padding-top:8px; }
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
      <div class="rapport-num">${num}</div>
      <strong>${intervention.client?.raison_sociale ?? ""}</strong>
      ${intervention.adresse_site ? intervention.adresse_site.replace(/\n/g, "<br>") : ""}
      ${intervention.client?.telephone ? `<br>Tél : ${intervention.client.telephone}` : ""}
      ${intervention.client?.email ? `<br>${intervention.client.email}` : ""}
    </div>
  </div>

  <div class="titre">Rapport d'intervention</div>
  <div class="sous-titre">
    N° ${num} &nbsp;·&nbsp; ${dateHeure}
    &nbsp;·&nbsp; <span class="badge">${statutLabel(intervention.statut)}</span>
  </div>

  <div class="section">
    <div class="section-title">Intervention</div>
    <div class="row"><span class="lbl">Type de nuisible :</span><span class="val">${intervention.type_nuisible || "—"}</span></div>
    <div class="row"><span class="lbl">Type d'intervention :</span><span class="val">${intervention.type_intervention || "—"}</span></div>
    <div class="row"><span class="lbl">Produits utilisés :</span><span class="val">${intervention.produits || "—"}</span></div>
    <div class="row"><span class="lbl">Quantités :</span><span class="val">${intervention.quantite || "—"}</span></div>
    ${intervention.date_prochain_passage ? `<div class="row"><span class="lbl">Prochain passage :</span><span class="val">${formatDateFR(intervention.date_prochain_passage)}</span></div>` : ""}
  </div>

  ${intervention.observations ? `
  <div class="section">
    <div class="section-title">Compte-rendu / Observations</div>
    <div class="obs">${intervention.observations.replace(/\n/g, "<br>")}</div>
  </div>` : ""}

  ${photosHtml ? `<div class="section"><div class="section-title">Photos</div>${photosHtml}</div>` : ""}

  <div class="signature-zone">
    <div class="sig-box">
      <div class="sig-line">Signature du technicien</div>
    </div>
    <div class="sig-box">${sigHtml}</div>
  </div>

  <div class="mention">
    ⚠️ Ce rapport constitue une preuve de réalisation de la prestation. Conservez ce document.
    En cas de litige, ce document fait foi de l'intervention réalisée par ${s?.nom ?? "CITY DERAT"}.
  </div>

  <div class="footer">
    ${num} &nbsp;·&nbsp; Généré le ${new Date().toLocaleString("fr-FR")} &nbsp;·&nbsp; ${s?.nom ?? "CITY DERAT"}
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

  // ── Email ───────────────────────────────────────────────────────────────────

  async function handleSendEmail() {
    if (!intervention) return;
    const clientEmail = intervention.client?.email ?? "";

    if (!clientEmail) {
      toast.warning("Aucun email renseigné pour ce client");
      return;
    }

    const num = rapportNum;
    const s = settings;
    const nomSociete = s?.nom ?? "CITY DERAT";
    const prochainPassage = intervention.date_prochain_passage
      ? `\nProchain passage prévu le : ${formatDateFR(intervention.date_prochain_passage)}`
      : "";

    const objet = `Rapport d'intervention N° ${num} — ${nomSociete}`;
    const corps = [
      "Bonjour,",
      "",
      `Veuillez trouver ci-joint le rapport d'intervention N° ${num} réalisée le ${formatDateFR(intervention.date)}.`,
      "",
      `Résumé de l'intervention :`,
      `- Type : ${intervention.type_intervention || "—"}`,
      `- Nuisible traité : ${intervention.type_nuisible || "—"}`,
      `- Produits utilisés : ${intervention.produits || "—"}`,
      prochainPassage,
      "",
      "Le rapport complet est joint à cet email en PDF.",
      "",
      "Cordialement,",
      nomSociete,
      s?.telephone ? `Tél : ${s.telephone}` : "",
    ].filter((l) => l !== undefined).join("\n");

    // Open PDF first
    generatePDF();

    // Then open mail client
    setTimeout(() => {
      window.location.href = `mailto:${clientEmail}?subject=${encodeURIComponent(objet)}&body=${encodeURIComponent(corps)}`;
    }, 700);

    // Propose changing statut
    setTimeout(async () => {
      await updateStatut("rapport_transmis");
      toast.success("Statut mis à jour : Rapport transmis");
    }, 1500);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (isLoading) return <div className="text-sm text-muted-foreground py-10 text-center">Chargement…</div>;
  if (!intervention) return <div className="text-sm text-muted-foreground py-10 text-center">Intervention introuvable.</div>;

  const clientEmail = intervention.client?.email ?? "";
  const hasSig = !!intervention.signature_url;

  return (
    <div className="space-y-4">
      {/* Barre haut */}
      <div className="flex items-center justify-between gap-3">
        <Link to="/interventions" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" /> Retour
        </Link>
        <div className="flex items-center gap-2">
          <Select value={intervention.statut} onValueChange={updateStatut}>
            <SelectTrigger className="h-8 text-xs w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUTS_INTERVENTION.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer cette intervention ?</AlertDialogTitle>
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

      {/* 1. En-tête rapport */}
      <Card className="border-primary/20 bg-primary/3">
        <CardContent className="p-4 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-mono text-muted-foreground tracking-wider">{rapportNum}</p>
              <h1 className="text-lg font-bold mt-0.5">Rapport d'intervention</h1>
            </div>
            <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase shrink-0", STATUT_COLORS[intervention.statut] ?? "bg-muted")}>
              {statutLabel(intervention.statut)}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap mt-1">
            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDateFR(intervention.date)}</span>
            <span className="text-muted-foreground/60">Créé le {formatDateTime(intervention.created_at)}</span>
          </div>
        </CardContent>
      </Card>

      {/* 2. Client */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Client</h2>
          <p className="font-semibold">{intervention.client?.raison_sociale ?? "Client supprimé"}</p>
          {intervention.adresse_site && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(intervention.adresse_site)}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-start gap-1.5 text-xs text-primary hover:underline"
            >
              <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
              <span className="whitespace-pre-wrap">{intervention.adresse_site}</span>
            </a>
          )}
          {intervention.client?.telephone && (
            <a href={`tel:${intervention.client.telephone}`} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Phone className="h-3 w-3 shrink-0" />{intervention.client.telephone}
            </a>
          )}
          {clientEmail ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Mail className="h-3 w-3 shrink-0" />{clientEmail}
            </p>
          ) : (
            <Link to="/clients/$id" params={{ id: intervention.client_id }}>
              <div className="flex items-center gap-1.5 rounded border border-orange-300 bg-orange-50 dark:bg-orange-950/20 px-2.5 py-1.5 text-xs text-orange-700 dark:text-orange-400">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Aucun email — Cliquez pour ajouter (requis pour envoi)
              </div>
            </Link>
          )}
        </CardContent>
      </Card>

      {/* 3. Intervention */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Intervention</h2>
          <InfoRow icon={<Bug className="h-4 w-4" />} label="Type de nuisible" value={intervention.type_nuisible || "—"} />
          <InfoRow icon={<FlaskConical className="h-4 w-4" />} label="Type d'intervention" value={intervention.type_intervention || "—"} />
          <InfoRow icon={<Package className="h-4 w-4" />} label="Produits utilisés" value={intervention.produits || "—"} />
          <InfoRow icon={<ClipboardList className="h-4 w-4" />} label="Quantité" value={intervention.quantite || "—"} />
          {intervention.date_prochain_passage && (
            <InfoRow icon={<CalendarClock className="h-4 w-4" />} label="Prochain passage" value={formatDateFR(intervention.date_prochain_passage)} />
          )}
        </CardContent>
      </Card>

      {/* 4. Compte-rendu */}
      {intervention.observations && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Compte-rendu / Observations</h2>
            <p className="text-sm whitespace-pre-wrap">{intervention.observations}</p>
          </CardContent>
        </Card>
      )}

      {/* 5. Photos */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <Camera className="h-4 w-4" /> Photos ({photos.length}/5)
            </h2>
            {photos.length < 5 && (
              <label className={cn("flex items-center gap-1 text-xs text-primary cursor-pointer", uploadingPhotos && "opacity-50 pointer-events-none")}>
                <Camera className="h-3.5 w-3.5" />
                {uploadingPhotos ? "Upload…" : "Ajouter"}
                <input type="file" accept="image/*" capture="environment" multiple className="sr-only" onChange={handleAddPhotos} disabled={uploadingPhotos} />
              </label>
            )}
          </div>
          {photos.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aucune photo.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((url, i) => (
                <button key={url} type="button" onClick={() => setLightboxIndex(i)}
                  className="relative aspect-square rounded-md overflow-hidden border hover:opacity-90 transition-opacity">
                  <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={closeLightbox}>
          <button type="button" className="absolute top-3 right-3 text-white/80 hover:text-white" onClick={closeLightbox}>
            <X className="h-6 w-6" />
          </button>
          {lightboxIndex > 0 && (
            <button type="button" className="absolute left-3 top-1/2 -translate-y-1/2 text-white/80 hover:text-white"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex((n) => Math.max(0, (n ?? 1) - 1)); }}>
              <ChevronLeft className="h-8 w-8" />
            </button>
          )}
          {lightboxIndex < photos.length - 1 && (
            <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-white/80 hover:text-white"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex((n) => Math.min(photos.length - 1, (n ?? 0) + 1)); }}>
              <ChevronRight className="h-8 w-8" />
            </button>
          )}
          <div className="relative max-w-[90vw] max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
            <img src={photos[lightboxIndex]} alt="" className="max-w-full max-h-[80vh] object-contain rounded" />
            <button type="button" onClick={() => handleDeletePhoto(photos[lightboxIndex])}
              className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-destructive px-2 py-1 text-xs text-white">
              <Trash2 className="h-3 w-3" /> Supprimer
            </button>
          </div>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-xs">
            {lightboxIndex + 1} / {photos.length}
          </div>
        </div>
      )}

      {/* 6. Signature client */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <PenLine className="h-4 w-4" /> Signature client
          </h2>
          {hasSig ? (
            <div className="space-y-2">
              <div className="rounded-lg border bg-white dark:bg-zinc-900 p-3 text-center">
                <img src={intervention.signature_url!} alt="Signature client" className="max-h-20 mx-auto" />
                <p className="text-[10px] text-muted-foreground mt-1 flex items-center justify-center gap-1">
                  <CheckCircle className="h-3 w-3 text-primary" />
                  Signé par le client — {formatDateTime((intervention as any).signature_at)}
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

      {/* 7. Actions */}
      <div className="space-y-2">
        <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" onClick={generatePDF}>
          <FileText className="mr-2 h-4 w-4" /> Générer PDF rapport officiel
        </Button>

        {clientEmail ? (
          <Button className="w-full" variant="outline" onClick={handleSendEmail}>
            <Mail className="mr-2 h-4 w-4" /> Envoyer rapport par email
          </Button>
        ) : (
          <div className="space-y-1">
            <Button className="w-full" variant="outline" disabled>
              <Mail className="mr-2 h-4 w-4" /> Envoyer par email
            </Button>
            <p className="text-[11px] text-orange-600 dark:text-orange-400 text-center flex items-center justify-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Aucun email renseigné pour ce client —{" "}
              <Link to="/clients/$id" params={{ id: intervention.client_id }} className="underline">
                Ajouter
              </Link>
            </p>
          </div>
        )}

        <Link to="/factures/new" search={{ client_id: intervention.client_id, adresse_site: intervention.adresse_site ?? "" }}>
          <Button className="w-full" variant="default">
            <Receipt className="mr-2 h-4 w-4" /> Facturer cette intervention
          </Button>
        </Link>

        <Button className="w-full" variant="outline" onClick={handleDuplicate}>
          <Copy className="mr-2 h-4 w-4" /> Dupliquer
        </Button>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-sm">{value}</div>
      </div>
    </div>
  );
}
