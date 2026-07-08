import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useIntervention, useSettings, useProduitsBiocides, useContracts, useAssignableMembers, resolveTechnicianName, useCurrentRole, useMyPoste, useSiteHistory, type AssignableMember, type Intervention } from "@/lib/queries";
import { formatDateFR, STATUTS_INTERVENTION } from "@/lib/schemas";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Receipt, Copy, FileText, MapPin, Calendar, Bug, FlaskConical,
  Package, ClipboardList, CalendarClock, Trash2, Camera, X, ChevronLeft,
  ChevronRight, Mail, PenLine, CheckCircle, AlertTriangle, Phone, ShieldCheck,
  PlayCircle, Undo2, History, ChevronDown, Timer,
} from "lucide-react";
import { useState, useCallback, useEffect } from "react";
import { uploadInterventionPhotos, deleteInterventionPhoto, uploadSignature, deleteSignature } from "@/lib/photos";
import type { PhotoFile } from "@/components/intervention-form";
import { SignatureCanvas } from "@/components/signature-canvas";
import { TechnicianSelect } from "@/components/technician-select";
import { printDocument } from "@/lib/print";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export const Route = createFileRoute("/_app/interventions/$id")({
  head: () => ({ meta: [{ title: "Rapport d'intervention — CITY DERAT" }] }),
  component: InterventionDetail,
});

const STATUT_COLORS: Record<string, string> = {
  planifiee: "bg-accent/15 text-accent",
  en_cours: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  realisee: "bg-primary/15 text-primary",
  rapport_transmis: "bg-success/15 text-success",
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

function formatDuration(startIso: string | null | undefined, endIso: string | null | undefined): string | null {
  if (!startIso || !endIso) return null;
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (isNaN(start) || isNaN(end)) return null;
  const totalMin = Math.max(0, Math.round((end - start) / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── Main component ───────────────────────────────────────────────────────────

function InterventionDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: intervention, isLoading } = useIntervention(id);
  const { data: settings } = useSettings();
  const { data: produitsBiocides = [] } = useProduitsBiocides();
  const { data: contracts = [] } = useContracts();
  const { data: assignableMembers = [] } = useAssignableMembers();
  const technicienName = resolveTechnicianName(assignableMembers, intervention?.technicien_id) ?? settings?.nom_technicien ?? null;
  const { data: role } = useCurrentRole();
  const { data: myPoste } = useMyPoste();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);
  const isTechnician = role !== undefined && role !== "owner" && myPoste === "technicien";
  const isMine = !!intervention && !!currentUserId && intervention.technicien_id === currentUserId;
  const { data: siteHistory = [] } = useSiteHistory(intervention?.client_id, intervention?.adresse_site, id);

  const [heureDebutInput, setHeureDebutInput] = useState("");
  const [heureFinInput, setHeureFinInput] = useState("");
  useEffect(() => {
    setHeureDebutInput(toDatetimeLocal(intervention?.heure_debut));
    setHeureFinInput(toDatetimeLocal(intervention?.heure_fin));
  }, [intervention?.heure_debut, intervention?.heure_fin]);

  // Un technicien ne peut consulter que ses propres interventions assignées —
  // sinon retour au Terrain.
  useEffect(() => {
    if (!intervention || !currentUserId || role === undefined || myPoste === undefined) return;
    if (role === "owner" || myPoste !== "technicien") return;
    if (intervention.technicien_id !== currentUserId) {
      toast.error("Accès non autorisé.");
      navigate({ to: "/interventions", replace: true });
    }
  }, [intervention, currentUserId, role, myPoste, navigate]);

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

  // ── Contrat rattaché ─────────────────────────────────────────────────────────

  async function handleContractChange(contractId: string) {
    await db.from("interventions").update({ contract_id: contractId || null }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["intervention", id] });
    toast.success("Contrat rattaché mis à jour");
  }

  // ── Technicien assigné ──────────────────────────────────────────────────────

  async function handleTechnicienChange(technicienId: string) {
    await db.from("interventions").update({ technicien_id: technicienId === "none" ? null : technicienId }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["intervention", id] });
    toast.success("Technicien assigné mis à jour");
  }

  // ── Compteur de passages contrat ─────────────────────────────────────────────

  async function maybeIncrementContractPassages(newStatut: string) {
    if (!intervention?.contract_id || intervention.statut === "realisee" || newStatut !== "realisee") return;
    const { data: contract } = await db.from("contracts").select("passages_realises, nb_passages_inclus").eq("id", intervention.contract_id).maybeSingle();
    if (!contract) return;
    const next = Math.min(contract.nb_passages_inclus, contract.passages_realises + 1);
    await db.from("contracts").update({ passages_realises: next }).eq("id", intervention.contract_id);
    qc.invalidateQueries({ queryKey: ["contracts"] });
    qc.invalidateQueries({ queryKey: ["contract", intervention.contract_id] });
  }

  // ── Signature handler ───────────────────────────────────────────────────────

  async function handleSignatureSave(blob: Blob) {
    setSavingSignature(true);
    const { data: { user } } = await supabase.auth.getUser();
    const url = await uploadSignature(blob, user?.id ?? "");
    if (url) {
      const signedAt = new Date().toISOString();
      await maybeIncrementContractPassages("realisee");
      const updates: Record<string, unknown> = { signature_url: url, signature_at: signedAt, statut: "realisee" };
      if (!intervention?.heure_fin) updates.heure_fin = signedAt;
      await db.from("interventions").update(updates).eq("id", id);
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
    await maybeIncrementContractPassages(statut);
    const updates: Record<string, unknown> = { statut };
    const now = new Date().toISOString();
    if (statut === "en_cours" && !intervention?.heure_debut) updates.heure_debut = now;
    if (statut === "realisee" && !intervention?.heure_fin) updates.heure_fin = now;
    await db.from("interventions").update(updates).eq("id", id);
    qc.invalidateQueries({ queryKey: ["intervention", id] });
    qc.invalidateQueries({ queryKey: ["interventions"] });
  }

  // ── Temps passé (correction manuelle, owner/bureau) ─────────────────────────

  async function handleSaveTimes() {
    const updates: Record<string, unknown> = {
      heure_debut: heureDebutInput ? new Date(heureDebutInput).toISOString() : null,
      heure_fin: heureFinInput ? new Date(heureFinInput).toISOString() : null,
    };
    const { error } = await db.from("interventions").update(updates).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["intervention", id] });
    toast.success("Horaires mis à jour");
  }

  // Admin : renvoie un rapport "Terminée" au technicien pour correction.
  async function handleReturnToTechnician() {
    const note = window.prompt("Note pour le technicien (optionnel) :", "");
    if (note === null) return;
    const updates: Record<string, unknown> = { statut: "en_cours" };
    if (note.trim()) {
      const current = intervention?.observations ?? "";
      updates.observations = current ? `${current}\n[Retour admin] ${note.trim()}` : `[Retour admin] ${note.trim()}`;
    }
    const { error } = await db.from("interventions").update(updates).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["intervention", id] });
    qc.invalidateQueries({ queryKey: ["interventions"] });
    toast.success("Renvoyé au technicien");
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

    const css = `
  body { font-family:Arial,sans-serif; font-size:11px; color:#222; }
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
`;

    const bodyHtml = `
  <div class="header">
    <div class="prestataire">
      ${s?.logo_url ? `<img src="${s.logo_url}" style="max-height:40px;max-width:100px;object-fit:contain;display:block;margin-bottom:4px" alt="Logo">` : ""}
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
    ${technicienName ? `<div class="row"><span class="lbl">Réalisé par :</span><span class="val">${technicienName}</span></div>` : ""}
    ${intervention.heure_debut && intervention.heure_fin ? `<div class="row"><span class="lbl">Durée :</span><span class="val">${formatDuration(intervention.heure_debut, intervention.heure_fin)}</span></div>` : ""}
  </div>

  ${intervention.observations ? `
  <div class="section">
    <div class="section-title">Compte-rendu / Observations</div>
    <div class="obs">${intervention.observations.replace(/\n/g, "<br>")}</div>
  </div>` : ""}

  ${photosHtml ? `<div class="section"><div class="section-title">Photos</div>${photosHtml}</div>` : ""}

  <div class="signature-zone">
    <div class="sig-box">
      <div class="sig-line">Signature du technicien${technicienName ? ` — ${technicienName}` : ""}</div>
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
`;

    const ok = printDocument({ title: `Rapport ${num}`, bodyHtml, css });
    if (!ok) { toast.error("Autorisez les popups pour générer le PDF"); return; }
  }

  // ── Certificat biocide ──────────────────────────────────────────────────────

  function generateCertificat() {
    if (!intervention) return;
    const s = settings;
    const year = new Date(intervention.date).getFullYear();
    const certNum = `CB-${year}-${intervention.id.slice(0, 6).toUpperCase()}`;
    const now = new Date();
    const dateGeneration = now.toLocaleDateString("fr-FR") + " " + now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

    // Match produits utilisés avec la base biocide
    const produitsTexte = intervention.produits ?? "";
    const produitsLignes: string[] = [];
    if (produitsTexte) {
      // Try to match each biocide product against the text
      const matchedIds = new Set<string>();
      for (const pb of produitsBiocides) {
        if (produitsTexte.toLowerCase().includes(pb.nom.toLowerCase())) {
          matchedIds.add(pb.id);
          produitsLignes.push(
            `<tr>
              <td style="padding:5px 8px;border-bottom:1px solid #f1f5f9">${pb.nom}</td>
              <td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;color:#6b7280">${pb.numero_homologation || "—"}</td>
              <td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;color:#6b7280">${pb.type}</td>
              <td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;color:#6b7280">${pb.dose_habituelle || "—"}</td>
            </tr>`
          );
        }
      }
      if (produitsLignes.length === 0) {
        // Fallback: just list the raw text
        produitsLignes.push(
          `<tr><td colspan="4" style="padding:5px 8px;border-bottom:1px solid #f1f5f9">${produitsTexte}</td></tr>`
        );
      }
    } else {
      produitsLignes.push(
        `<tr><td colspan="4" style="padding:5px 8px;color:#9ca3af;font-style:italic">Aucun produit renseigné</td></tr>`
      );
    }

    const sigHtml = intervention.signature_url
      ? `<div style="text-align:center">
           <img src="${intervention.signature_url}" alt="Signature" style="max-height:50px;border-bottom:1px solid #ccc;padding-bottom:4px;">
           <div style="font-size:9px;color:#6b7280;margin-top:3px;">Signature du client</div>
         </div>`
      : `<div style="border-top:1px solid #ccc;margin-top:40px;padding-top:4px;font-size:9px;color:#9ca3af;text-align:center">Signature du client (bon pour accord)</div>`;

    const css = `
  body { font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;font-size:11px;color:#1e293b; }
  .header { display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:14px;border-bottom:3px solid #1a3c2e; }
  .logo-block { display:flex;align-items:center;gap:10px; }
  .logo-text .name { font-size:16px;font-weight:800;color:#1a3c2e; }
  .logo-text .sub { font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-top:2px; }
  .header-coords { font-size:10px;color:#64748b;text-align:right;line-height:1.6; }
  .cert-title { font-size:18px;font-weight:800;color:#1a3c2e;text-align:center;margin:16px 0 4px; text-transform:uppercase;letter-spacing:1px; }
  .cert-num { text-align:center;font-size:10px;color:#94a3b8;margin-bottom:16px; }
  .section { margin-bottom:14px; }
  .section-title { font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#1a3c2e;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin-bottom:8px; }
  .grid2 { display:grid;grid-template-columns:1fr 1fr;gap:12px; }
  .info-box { background:#f8fafc;border-radius:6px;padding:8px 10px; }
  .info-box .lbl { font-size:9px;text-transform:uppercase;letter-spacing:0.6px;color:#94a3b8;margin-bottom:2px; }
  .info-box .val { font-size:11px;font-weight:600;color:#1e293b; }
  table { width:100%;border-collapse:collapse; }
  thead th { background:#1a3c2e;color:#fff;font-size:9px;font-weight:700;text-transform:uppercase;padding:6px 8px;text-align:left; }
  .reco-box { background:#f0fdf4;border-left:3px solid #16a34a;border-radius:0 6px 6px 0;padding:8px 12px;font-size:10px;color:#166534;line-height:1.6; }
  .mention { font-size:9px;color:#94a3b8;text-align:center;margin-top:12px;font-style:italic; }
  .footer { margin-top:16px;padding-top:8px;border-top:2px solid #f1f5f9;font-size:8px;color:#cbd5e1;text-align:center; }
  .sig-row { display:flex;justify-content:space-between;gap:20px;margin-top:16px; }
  .sig-col { flex:1;text-align:center; }
  .sig-label { font-size:9px;color:#94a3b8;text-transform:uppercase;margin-bottom:8px; }
`;

    const bodyHtml = `
<div class="header">
  <div class="logo-block">
    ${s?.logo_url ? `<img src="${s.logo_url}" style="max-height:44px;max-width:110px;object-fit:contain;display:block" alt="Logo">` : ""}
    <div class="logo-text">
      <div class="name">${s?.nom ?? "CITY DERAT"}</div>
      <div class="sub">Dératisation · Désinsectisation</div>
    </div>
  </div>
  <div class="header-coords">
    ${s?.adresse ? s.adresse.replace(/\n/g, "<br>") : ""}<br>
    ${s?.siret ? `Siret : ${s.siret}<br>` : ""}
    ${s?.telephone ? `Tél : ${s.telephone}<br>` : ""}
    ${s?.numero_certibiocide ? `<strong>Certibiocide N° ${s.numero_certibiocide}</strong>` : ""}
  </div>
</div>

<div class="cert-title">Certificat de traitement biocide</div>
<div class="cert-num">N° ${certNum}</div>

<div class="section">
  <div class="section-title">Informations de l'intervention</div>
  <div class="grid2">
    <div class="info-box">
      <div class="lbl">Date du traitement</div>
      <div class="val">${formatDateFR(intervention.date)}</div>
    </div>
    <div class="info-box">
      <div class="lbl">Type d'intervention</div>
      <div class="val">${intervention.type_intervention || "—"}</div>
    </div>
    <div class="info-box">
      <div class="lbl">Nuisible traité</div>
      <div class="val">${intervention.type_nuisible || "—"}</div>
    </div>
    <div class="info-box">
      <div class="lbl">Technicien</div>
      <div class="val">${technicienName || s?.nom || "CITY DERAT"}</div>
    </div>
  </div>
</div>

<div class="section">
  <div class="section-title">Coordonnées client</div>
  <div class="grid2">
    <div class="info-box">
      <div class="lbl">Client</div>
      <div class="val">${intervention.client?.raison_sociale ?? "—"}</div>
      ${intervention.client?.telephone ? `<div style="font-size:10px;color:#64748b;margin-top:2px">Tél : ${intervention.client.telephone}</div>` : ""}
    </div>
    <div class="info-box">
      <div class="lbl">Site traité</div>
      <div class="val">${intervention.adresse_site || "—"}</div>
    </div>
  </div>
</div>

<div class="section">
  <div class="section-title">Produits biocides utilisés</div>
  <table>
    <thead>
      <tr>
        <th>Produit</th>
        <th>N° homologation</th>
        <th>Type</th>
        <th>Dose appliquée</th>
      </tr>
    </thead>
    <tbody>
      ${produitsLignes.join("")}
    </tbody>
  </table>
  ${intervention.quantite ? `<div style="margin-top:6px;font-size:10px;color:#64748b">Quantités : ${intervention.quantite}</div>` : ""}
</div>

${intervention.observations ? `
<div class="section">
  <div class="section-title">Zones traitées / Observations</div>
  <div style="font-size:10px;color:#374151;line-height:1.6;white-space:pre-wrap">${intervention.observations}</div>
</div>` : ""}

<div class="section">
  <div class="section-title">Recommandations post-traitement</div>
  <div class="reco-box">
    Respecter un délai de réoccupation de 2 heures après traitement.<br>
    Tenir les denrées alimentaires à l'écart des zones traitées.<br>
    En cas d'ingestion accidentelle, contacter le 15 ou le Centre Antipoison.
  </div>
</div>

<div class="sig-row">
  <div class="sig-col">
    <div class="sig-label">Signature du technicien</div>
    <div style="border-top:1px solid #ccc;margin-top:40px;padding-top:4px;font-size:9px;color:#9ca3af">${technicienName || ""}</div>
  </div>
  <div class="sig-col">
    <div class="sig-label">Signature du client</div>
    ${sigHtml}
  </div>
</div>

<p class="mention">Traitement réalisé conformément à la réglementation en vigueur relative aux produits biocides (Règlement UE 528/2012)</p>

<div class="footer">
  Certificat N° ${certNum} · Généré le ${dateGeneration} · ${s?.nom ?? "CITY DERAT"} · SIRET ${s?.siret ?? ""}
</div>
`;

    const ok = printDocument({ title: `Certificat ${certNum}`, bodyHtml, css });
    if (!ok) { toast.error("Autorisez les popups pour générer le PDF"); return; }
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
      toast.success("Statut mis à jour : Vérifiée");
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
          {isTechnician ? (
            <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold uppercase", STATUT_COLORS[intervention.statut] ?? "bg-muted")}>
              {statutLabel(intervention.statut)}
            </span>
          ) : (
            <Select value={intervention.statut} onValueChange={updateStatut}>
              <SelectTrigger className="h-8 text-xs w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUTS_INTERVENTION.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
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

      {/* 1bis. Workflow technicien — uniquement sur sa propre intervention */}
      {isTechnician && isMine && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 space-y-2.5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mon intervention</h2>
            {intervention.statut === "planifiee" && (
              <Button className="w-full" onClick={() => updateStatut("en_cours")}>
                <PlayCircle className="mr-2 h-4 w-4" /> Démarrer l'intervention
              </Button>
            )}
            {intervention.statut === "en_cours" && (
              <>
                <p className="text-xs text-muted-foreground">
                  Renseignez le compte-rendu, les produits utilisés, les photos et la signature client ci-dessous, puis marquez l'intervention comme terminée.
                </p>
                <Button className="w-full" onClick={() => updateStatut("realisee")}>
                  <CheckCircle className="mr-2 h-4 w-4" /> Marquer terminée
                </Button>
              </>
            )}
            {intervention.statut === "realisee" && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5 text-primary shrink-0" />
                Terminée — en attente de vérification par le responsable.
              </p>
            )}
            {intervention.statut === "rapport_transmis" && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-success shrink-0" />
                Vérifiée par le responsable — rapport envoyé au client.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* 1ter. Vérification admin — rapport terminé en attente de validation */}
      {!isTechnician && intervention.statut === "realisee" && (
        <Card className="border-orange-300 bg-orange-50 dark:border-orange-900/50 dark:bg-orange-950/20">
          <CardContent className="p-4 space-y-2.5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-orange-700 dark:text-orange-400">
              À vérifier
            </h2>
            <p className="text-xs text-orange-700/80 dark:text-orange-400/80">
              Le technicien a terminé ce rapport. Vérifiez son contenu puis validez-le pour l'envoyer au client.
            </p>
            <Button variant="outline" className="w-full" onClick={handleReturnToTechnician}>
              <Undo2 className="mr-2 h-4 w-4" /> Renvoyer au technicien
            </Button>
          </CardContent>
        </Card>
      )}

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

      {/* 2bis. Historique du site */}
      {siteHistory.length > 0 && (
        <SiteHistoryPanel history={siteHistory} assignableMembers={assignableMembers} />
      )}

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
          <div className="space-y-1.5">
            <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <Timer className="h-3 w-3" /> Durée sur site
            </div>
            {isTechnician ? (
              <p className="text-sm">
                {intervention.heure_debut && intervention.heure_fin
                  ? `Durée sur site : ${formatDuration(intervention.heure_debut, intervention.heure_fin)}`
                  : intervention.heure_debut
                  ? `Démarrée le ${formatDateTime(intervention.heure_debut)}`
                  : "—"}
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-muted-foreground">Début</label>
                  <input
                    type="datetime-local"
                    className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                    value={heureDebutInput}
                    onChange={(e) => setHeureDebutInput(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-muted-foreground">Fin</label>
                  <input
                    type="datetime-local"
                    className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                    value={heureFinInput}
                    onChange={(e) => setHeureFinInput(e.target.value)}
                  />
                </div>
                <Button size="sm" variant="outline" className="h-8" onClick={handleSaveTimes}>Enregistrer</Button>
                {intervention.heure_debut && intervention.heure_fin && (
                  <span className="text-xs text-muted-foreground">
                    Durée : {formatDuration(intervention.heure_debut, intervention.heure_fin)}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Contrat rattaché</div>
            <Select value={intervention.contract_id ?? ""} onValueChange={handleContractChange}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Aucun contrat" /></SelectTrigger>
              <SelectContent>
                {contracts.filter((c) => c.client_id === intervention.client_id).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.numero ? `${c.numero} — ` : ""}{c.nom_etablissement || "Établissement"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Technicien assigné</div>
            <TechnicianSelect
              value={intervention.technicien_id ?? "none"}
              onValueChange={handleTechnicienChange}
              triggerClassName="h-8 text-sm"
            />
          </div>
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

        {settings?.numero_certibiocide ? (
          <Button className="w-full bg-green-700 hover:bg-green-800 text-white" onClick={generateCertificat}>
            <ShieldCheck className="mr-2 h-4 w-4" /> Certificat de traitement biocide
          </Button>
        ) : (
          <div title="Renseignez votre numéro Certibiocide dans les paramètres">
            <Button className="w-full" variant="outline" disabled>
              <ShieldCheck className="mr-2 h-4 w-4" /> Certificat biocide
            </Button>
            <p className="text-[11px] text-muted-foreground text-center mt-1">
              <Link to="/parametres" className="underline hover:text-foreground">Renseignez votre numéro Certibiocide</Link> dans les paramètres
            </p>
          </div>
        )}

        {clientEmail ? (
          <Button
            className={cn("w-full", !isTechnician && intervention.statut === "realisee" && "bg-primary hover:bg-primary/90")}
            variant={!isTechnician && intervention.statut === "realisee" ? "default" : "outline"}
            onClick={handleSendEmail}
          >
            <Mail className="mr-2 h-4 w-4" />
            {!isTechnician && intervention.statut === "realisee" ? "Valider et envoyer le rapport" : "Envoyer rapport par email"}
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

// Passages précédents sur le même site — donne au technicien le contexte
// sans qu'il ait besoin d'appeler le bureau.
function SiteHistoryPanel({ history, assignableMembers }: { history: Intervention[]; assignableMembers: AssignableMember[] }) {
  const [open, setOpen] = useState(true);
  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardContent className="p-4 space-y-2">
          <CollapsibleTrigger className="flex w-full items-center justify-between text-left">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <History className="h-4 w-4" /> Historique du site ({history.length})
            </h2>
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 pt-1">
            {history.map((h) => (
              <Link key={h.id} to="/interventions/$id" params={{ id: h.id }}>
                <div className="rounded-md border p-2.5 text-xs space-y-1 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{formatDateFR(h.date)}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase shrink-0", STATUT_COLORS[h.statut] ?? "bg-muted")}>
                      {statutLabel(h.statut)}
                    </span>
                  </div>
                  <div className="text-muted-foreground">
                    {resolveTechnicianName(assignableMembers, h.technicien_id) ?? "Non assigné"}
                    {h.produits ? ` · ${h.produits}` : ""}
                    {h.photos?.length ? ` · ${h.photos.length} photo${h.photos.length > 1 ? "s" : ""}` : ""}
                  </div>
                  {h.observations && <p className="text-muted-foreground truncate">{h.observations}</p>}
                </div>
              </Link>
            ))}
          </CollapsibleContent>
        </CardContent>
      </Collapsible>
    </Card>
  );
}
