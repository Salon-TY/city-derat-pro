// Écran central du technicien — liste blanche stricte : mission (lecture
// seule), retour du responsable, compte-rendu (démarrer/observations/
// produits/photos/signature/terminer), historique du site, durée sur site
// (lecture seule). Rien d'autre : pas de facturation, pas d'envoi email,
// pas de PDF, pas de certificat, pas de duplication, pas de paramètres.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  useIntervention, useContracts, useSiteHistory, useAssignableMembers,
  resolveTechnicianName, logStockMovement, syncContractPassageCount, type Intervention,
} from "@/lib/queries";
import { formatDateFR, STATUTS_INTERVENTION } from "@/lib/schemas";
import type { InterventionForm as IFType } from "@/lib/schemas";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, MapPin, Calendar, Bug, FlaskConical, ClipboardList, ClipboardEdit,
  Camera, X, ChevronLeft, ChevronRight, PenLine, CheckCircle, PlayCircle,
  MessageSquareWarning, Timer, History, Phone,
} from "lucide-react";
import { uploadInterventionPhotos, deleteInterventionPhoto, uploadSignature, deleteSignature } from "@/lib/photos";
import { InterventionForm, type PhotoFile, type StockUsageItem } from "@/components/intervention-form";
import { SignatureCanvas } from "@/components/signature-canvas";
import { db } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tech/chantiers/$id")({
  head: () => ({ meta: [{ title: "Chantier — CITY DERAT" }] }),
  component: TechChantierDetail,
});

function statutLabel(v: string) {
  return STATUTS_INTERVENTION.find((s) => s.value === v)?.label ?? v;
}

const STATUT_COLORS: Record<string, string> = {
  planifiee: "bg-accent/15 text-accent",
  en_cours: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  realisee: "bg-primary/15 text-primary",
  rapport_transmis: "bg-success/15 text-success",
  annulee: "bg-muted text-muted-foreground",
};

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

// Récupère le niveau de stock d'un produit sur le camion du technicien.
async function fetchVanLevel(productId: string, technicienId: string) {
  const { data } = await db.from("stock_levels").select("id, quantite")
    .eq("product_id", productId).eq("technicien_id", technicienId).maybeSingle();
  return data as { id: string; quantite: number } | null;
}

function TechChantierDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: intervention, isLoading } = useIntervention(id);
  const { data: contracts = [] } = useContracts();
  const { data: assignableMembers = [] } = useAssignableMembers();
  const { data: siteHistory = [] } = useSiteHistory(intervention?.client_id, intervention?.adresse_site, id);
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const isMine = !!intervention && !!userId && intervention.technicien_id === userId;

  // Garde : uniquement le chantier assigné à ce technicien.
  useEffect(() => {
    if (!intervention || !userId) return;
    if (intervention.technicien_id !== userId) {
      toast.error("Accès non autorisé.");
      navigate({ to: "/tech/chantiers", replace: true });
    }
  }, [intervention, userId, navigate]);

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [showSignatureCanvas, setShowSignatureCanvas] = useState(false);
  const [savingSignature, setSavingSignature] = useState(false);

  const photos: string[] = intervention?.photos ?? [];
  const hasCompteRendu = !!(intervention?.produits?.trim() || intervention?.observations?.trim());
  // Éditable tant que le chantier est en cours (y compris après un renvoi de
  // l'admin, qui repasse le statut à en_cours) ; verrouillé sinon.
  const canEditCompteRendu = intervention?.statut === "en_cours";

  // ── Photos ───────────────────────────────────────────────────────────────

  async function handleAddPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length || !intervention) return;
    const remaining = 5 - photos.length;
    const toAdd: PhotoFile[] = files.slice(0, remaining).map((file) => ({ file, preview: URL.createObjectURL(file) }));
    e.target.value = "";
    setUploadingPhotos(true);
    const newUrls = await uploadInterventionPhotos(toAdd, userId ?? "");
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

  // ── Signature ────────────────────────────────────────────────────────────

  async function handleSignatureSave(blob: Blob) {
    setSavingSignature(true);
    const url = await uploadSignature(blob, userId ?? "");
    if (url) {
      await db.from("interventions").update({ signature_url: url, signature_at: new Date().toISOString() }).eq("id", id);
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

  // ── Démarrer / Terminer ──────────────────────────────────────────────────

  async function handleStart() {
    const updates: Record<string, unknown> = { statut: "en_cours" };
    if (!intervention?.heure_debut) updates.heure_debut = new Date().toISOString();
    const { error } = await db.from("interventions").update(updates).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["intervention", id] });
    qc.invalidateQueries({ queryKey: ["my_todo_count"] });
  }

  async function handleFinish() {
    if (intervention?.contract_id) {
      await syncContractPassageCount(intervention.contract_id, intervention.statut, "realisee");
      qc.invalidateQueries({ queryKey: ["contracts"] });
      qc.invalidateQueries({ queryKey: ["contract", intervention.contract_id] });
      qc.invalidateQueries({ queryKey: ["passages_a_programmer"] });
    }
    const updates: Record<string, unknown> = { statut: "realisee", retour_admin: null };
    if (!intervention?.heure_fin) updates.heure_fin = new Date().toISOString();
    const { error } = await db.from("interventions").update(updates).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["intervention", id] });
    qc.invalidateQueries({ queryKey: ["interventions"] });
    qc.invalidateQueries({ queryKey: ["my_todo_count"] });
    toast.success("Intervention marquée terminée");
  }

  // ── Compte-rendu (produits/observations/prochain passage) ───────────────
  // Le stock n'est déduit qu'au tout premier envoi (comme côté admin) — les
  // envois suivants (ex. après un renvoi de l'admin) ne re-déduisent pas.

  async function handleSaveCompteRendu(values: IFType, stockItems: StockUsageItem[]) {
    if (!userId) return;
    const isFirstSubmission = !hasCompteRendu;

    if (isFirstSubmission && stockItems.length > 0) {
      const warnings: string[] = [];
      for (const item of stockItems) {
        const level = await fetchVanLevel(item.product_id, userId);
        const disponible = Number(level?.quantite ?? 0);
        if (disponible < item.quantite) {
          warnings.push(`Stock insuffisant pour ${item.nom} : il reste seulement ${disponible} ${item.unite} sur le camion`);
        }
      }
      if (warnings.length > 0) {
        const proceed = window.confirm(`⚠️ Attention :\n${warnings.join("\n")}\n\nContinuer quand même ?`);
        if (!proceed) return;
      }
    }

    const updates: Record<string, unknown> = {
      produits: values.produits,
      quantite: values.quantite,
      observations: values.observations,
      date_prochain_passage: values.date_prochain_passage || null,
    };
    if (isFirstSubmission) {
      updates.produits_utilises = stockItems.map((i) => ({ product_id: i.product_id, nom: i.nom, quantite: i.quantite, unite: i.unite }));
    }

    const { error } = await db.from("interventions").update(updates).eq("id", id);
    if (error) { toast.error(error.message); return; }

    if (isFirstSubmission) {
      for (const item of stockItems) {
        const level = await fetchVanLevel(item.product_id, userId);
        const current = Number(level?.quantite ?? 0);
        const next = Math.max(0, current - item.quantite);
        if (level) {
          await db.from("stock_levels").update({ quantite: next }).eq("id", level.id);
        } else {
          await db.from("stock_levels").insert({ product_id: item.product_id, technicien_id: userId, quantite: next, user_id: intervention?.user_id });
        }
        await logStockMovement({ product_id: item.product_id, type: "consommation", technicien_id: userId, intervention_id: id, quantite: item.quantite });
      }
      if (stockItems.length > 0) {
        qc.invalidateQueries({ queryKey: ["stock_levels"] });
        qc.invalidateQueries({ queryKey: ["my_van_stock"] });
        qc.invalidateQueries({ queryKey: ["product_stats"] });
      }
    }

    qc.invalidateQueries({ queryKey: ["intervention", id] });
    toast.success("Compte-rendu enregistré");
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading) return <div className="text-sm text-muted-foreground py-10 text-center">Chargement…</div>;
  if (!intervention) return <div className="text-sm text-muted-foreground py-10 text-center">Chantier introuvable.</div>;
  if (!isMine) return null;

  const assignedContract = contracts.find((c) => c.id === intervention.contract_id);
  const contractLabel = assignedContract
    ? `${assignedContract.numero ? `${assignedContract.numero} — ` : ""}${assignedContract.nom_etablissement || "Établissement"}`
    : "Aucun contrat";
  const hasSig = !!intervention.signature_url;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link to="/tech/chantiers" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" /> Retour
        </Link>
        <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold uppercase", STATUT_COLORS[intervention.statut] ?? "bg-muted")}>
          {statutLabel(intervention.statut)}
        </span>
      </div>

      {/* Retour du responsable */}
      {intervention.retour_admin && (
        <Card className="border-orange-400 bg-orange-50 dark:border-orange-900/60 dark:bg-orange-950/30">
          <CardContent className="p-4 flex items-start gap-2.5">
            <MessageSquareWarning className="h-4 w-4 text-orange-600 dark:text-orange-400 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-orange-700 dark:text-orange-400">Retour du responsable</p>
              <p className="text-orange-700/90 dark:text-orange-400/90 whitespace-pre-wrap mt-0.5">{intervention.retour_admin}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Workflow */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4 space-y-2.5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mon intervention</h2>
          {intervention.statut === "planifiee" && (
            <Button className="w-full" onClick={handleStart}>
              <PlayCircle className="mr-2 h-4 w-4" /> Démarrer l'intervention
            </Button>
          )}
          {intervention.statut === "en_cours" && (
            <p className="text-xs text-muted-foreground">
              Renseignez le compte-rendu ci-dessous, puis marquez l'intervention comme terminée.
            </p>
          )}
          {intervention.statut === "realisee" && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-primary shrink-0" />
              Terminée — en attente de vérification par le responsable.
            </p>
          )}
          {intervention.statut === "rapport_transmis" && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-success shrink-0" />
              Vérifiée par le responsable — rapport envoyé au client.
            </p>
          )}
        </CardContent>
      </Card>

      {/* La mission (lecture seule) */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 px-1">
          <ClipboardList className="h-4 w-4" /> La mission
        </h2>
        <Card>
          <CardContent className="p-4 space-y-3">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Client</div>
              <p className="text-sm font-semibold">{intervention.client?.raison_sociale ?? "Client supprimé"}</p>
              {intervention.adresse_site && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(intervention.adresse_site)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-start gap-1.5 text-xs text-primary hover:underline mt-1"
                >
                  <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                  <span className="whitespace-pre-wrap">{intervention.adresse_site}</span>
                </a>
              )}
              {intervention.client?.telephone && (
                <a href={`tel:${intervention.client.telephone}`} className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                  <Phone className="h-3 w-3 shrink-0" />{intervention.client.telephone}
                </a>
              )}
            </div>
            <InfoRow icon={<Calendar className="h-4 w-4" />} label="Date" value={formatDateFR(intervention.date)} />
            <InfoRow icon={<Bug className="h-4 w-4" />} label="Type de nuisible" value={intervention.type_nuisible || "—"} />
            <InfoRow icon={<FlaskConical className="h-4 w-4" />} label="Type d'intervention" value={intervention.type_intervention || "—"} />
            <InfoRow icon={<ClipboardList className="h-4 w-4" />} label="Contrat rattaché" value={contractLabel} />
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <ClipboardEdit className="h-3 w-3" /> Consignes
              </div>
              <p className="text-sm whitespace-pre-wrap mt-0.5">{intervention.consignes || "—"}</p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Historique du site (lecture seule) */}
      {siteHistory.length > 0 && <SiteHistoryList history={siteHistory} assignableMembers={assignableMembers} />}

      {/* Mon compte-rendu */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 px-1">
          <PenLine className="h-4 w-4" /> Mon compte-rendu
        </h2>

        {/* Durée sur site — lecture seule */}
        <Card>
          <CardContent className="p-4 space-y-1">
            <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <Timer className="h-3 w-3" /> Durée sur site
            </div>
            <p className="text-sm">
              {intervention.heure_debut && intervention.heure_fin
                ? formatDuration(intervention.heure_debut, intervention.heure_fin)
                : intervention.heure_debut
                ? `Démarrée le ${formatDateTime(intervention.heure_debut)}`
                : "—"}
            </p>
          </CardContent>
        </Card>

        {canEditCompteRendu ? (
          <Card>
            <CardContent className="p-4">
              <InterventionForm
                mode="compte-rendu"
                defaultValues={{
                  client_id: intervention.client_id,
                  date: intervention.date,
                  type_intervention: intervention.type_intervention as any,
                  technicien_id: intervention.technicien_id ?? undefined,
                  produits: intervention.produits ?? "",
                  quantite: intervention.quantite ?? "",
                  observations: intervention.observations ?? "",
                  date_prochain_passage: intervention.date_prochain_passage ?? "",
                }}
                onSubmit={handleSaveCompteRendu}
                submitLabel={hasCompteRendu ? "Enregistrer les modifications" : "Enregistrer le compte-rendu"}
              />
            </CardContent>
          </Card>
        ) : hasCompteRendu ? (
          <Card>
            <CardContent className="p-4 space-y-3">
              <InfoRow icon={<ClipboardList className="h-4 w-4" />} label="Produits utilisés" value={intervention.produits || "—"} />
              {intervention.date_prochain_passage && (
                <InfoRow icon={<Calendar className="h-4 w-4" />} label="Prochain passage" value={formatDateFR(intervention.date_prochain_passage)} />
              )}
              {intervention.observations && (
                <div className="pt-1 border-t">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mt-2 mb-1">Observations</div>
                  <p className="text-sm whitespace-pre-wrap">{intervention.observations}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground text-center">
              Démarrez l'intervention pour remplir le compte-rendu.
            </CardContent>
          </Card>
        )}

        {/* Photos */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <Camera className="h-4 w-4" /> Photos ({photos.length}/5)
              </h3>
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

        {/* Signature client */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <PenLine className="h-4 w-4" /> Signature client
            </h3>
            {hasSig ? (
              <div className="space-y-2">
                <div className="rounded-lg border bg-white dark:bg-zinc-900 p-3 text-center">
                  <img src={intervention.signature_url!} alt="Signature client" className="max-h-20 mx-auto" />
                  <p className="text-[10px] text-muted-foreground mt-1 flex items-center justify-center gap-1">
                    <CheckCircle className="h-3 w-3 text-primary" />
                    Signé — {formatDateTime((intervention as any).signature_at)}
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

        {intervention.statut === "en_cours" && (
          <Button className="w-full" onClick={handleFinish}>
            <CheckCircle className="mr-2 h-4 w-4" /> Marquer terminée
          </Button>
        )}
      </section>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={() => setLightboxIndex(null)}>
          <button type="button" className="absolute top-3 right-3 text-white/80 hover:text-white" onClick={() => setLightboxIndex(null)}>
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
              <X className="h-3 w-3" /> Supprimer
            </button>
          </div>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-xs">
            {lightboxIndex + 1} / {photos.length}
          </div>
        </div>
      )}
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

function SiteHistoryList({ history, assignableMembers }: { history: Intervention[]; assignableMembers: any[] }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <History className="h-4 w-4" /> Historique du site ({history.length})
        </h2>
        <div className="space-y-2">
          {history.map((h) => (
            <div key={h.id} className="rounded-md border p-2.5 text-xs space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{formatDateFR(h.date)}</span>
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase shrink-0", STATUT_COLORS[h.statut] ?? "bg-muted")}>
                  {statutLabel(h.statut)}
                </span>
              </div>
              <div className="text-muted-foreground">
                {resolveTechnicianName(assignableMembers, h.technicien_id) ?? "Non assigné"}
                {h.produits ? ` · ${h.produits}` : ""}
              </div>
              {h.observations && <p className="text-muted-foreground truncate">{h.observations}</p>}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
