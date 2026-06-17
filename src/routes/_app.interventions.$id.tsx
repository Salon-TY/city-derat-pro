import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useIntervention, useSettings } from "@/lib/queries";
import { formatDateFR, STATUTS_INTERVENTION } from "@/lib/schemas";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Receipt, Copy, FileText, MapPin, Calendar, Bug, FlaskConical, Package, ClipboardList, CalendarClock } from "lucide-react";
import { db } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/interventions/$id")({
  head: () => ({ meta: [{ title: "Intervention — CITY DERAT" }] }),
  component: InterventionDetail,
});

const STATUT_COLORS: Record<string, string> = {
  planifiee: "bg-accent/15 text-accent",
  realisee: "bg-primary/15 text-primary",
  annulee: "bg-muted text-muted-foreground",
};

function statutLabel(v: string) {
  return STATUTS_INTERVENTION.find((s) => s.value === v)?.label ?? v;
}

function InterventionDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: intervention, isLoading } = useIntervention(id);
  const { data: settings } = useSettings();

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

  function generateBon() {
    if (!intervention) return;
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
  .titre { text-align: center; margin: 20px 0 4px; font-size: 20px; font-weight: bold; color: #1a3c2e; }
  .sous-titre { text-align: center; font-size: 11px; color: #555; margin-bottom: 20px; }
  .section { margin-bottom: 16px; }
  .section-title { font-size: 11px; font-weight: bold; text-transform: uppercase; color: #1a3c2e; border-bottom: 1px solid #1a3c2e; padding-bottom: 3px; margin-bottom: 8px; }
  .row { display: flex; gap: 8px; margin-bottom: 4px; }
  .label { color: #555; min-width: 160px; }
  .value { font-weight: 500; }
  .obs { white-space: pre-wrap; background: #f9f9f9; border: 1px solid #eee; padding: 10px; border-radius: 4px; line-height: 1.6; }
  .signature { display: flex; justify-content: space-between; margin-top: 40px; }
  .sig-box { text-align: center; width: 45%; }
  .sig-line { border-top: 1px solid #ccc; margin-top: 50px; padding-top: 6px; font-size: 10px; color: #666; }
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
      <strong>${intervention.client?.raison_sociale ?? ""}</strong>
      ${intervention.adresse_site ? intervention.adresse_site.replace(/\n/g, "<br>") : ""}
      ${intervention.client?.telephone ? `<br>Tél : ${intervention.client.telephone}` : ""}
    </div>
  </div>

  <div class="titre">Bon d'intervention</div>
  <div class="sous-titre">Date : ${formatDateFR(intervention.date)} &nbsp;·&nbsp; Statut : ${statutLabel(intervention.statut)}</div>

  <div class="section">
    <div class="section-title">Détails de l'intervention</div>
    <div class="row"><span class="label">Type de nuisible :</span><span class="value">${intervention.type_nuisible || "—"}</span></div>
    <div class="row"><span class="label">Type d'intervention :</span><span class="value">${intervention.type_intervention || "—"}</span></div>
    <div class="row"><span class="label">Produits utilisés :</span><span class="value">${intervention.produits || "—"}</span></div>
    <div class="row"><span class="label">Quantité :</span><span class="value">${intervention.quantite || "—"}</span></div>
    ${intervention.date_prochain_passage ? `<div class="row"><span class="label">Prochain passage :</span><span class="value">${formatDateFR(intervention.date_prochain_passage)}</span></div>` : ""}
  </div>

  ${intervention.observations ? `
  <div class="section">
    <div class="section-title">Observations / Rapport</div>
    <div class="obs">${intervention.observations.replace(/\n/g, "<br>")}</div>
  </div>` : ""}

  <div class="signature">
    <div class="sig-box">
      <div class="sig-line">Signature du technicien</div>
    </div>
    <div class="sig-box">
      <div class="sig-line">Signature du client (bon pour accord)</div>
    </div>
  </div>

  <div class="mention">
    Document généré le ${new Date().toLocaleDateString("fr-FR")} — ${s?.nom ?? "CITY DERAT"}
  </div>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (!win) { toast.error("Autorisez les popups pour générer le PDF"); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 500);
  }

  if (isLoading) return <div className="text-sm text-muted-foreground py-10 text-center">Chargement…</div>;
  if (!intervention) return <div className="text-sm text-muted-foreground py-10 text-center">Intervention introuvable.</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/interventions" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" /> Retour
        </Link>
      </div>

      {/* En-tête */}
      <Card><CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold">{intervention.client?.raison_sociale ?? "Client supprimé"}</h1>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
              <Calendar className="h-3 w-3" />
              {formatDateFR(intervention.date)}
            </div>
          </div>
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium uppercase", STATUT_COLORS[intervention.statut] ?? "bg-muted")}>
            {statutLabel(intervention.statut)}
          </span>
        </div>

        {intervention.adresse_site && (
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
            <span className="whitespace-pre-wrap">{intervention.adresse_site}</span>
          </div>
        )}
      </CardContent></Card>

      {/* Détails */}
      <Card><CardContent className="p-4 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Détails</h2>

        <InfoRow icon={<Bug className="h-4 w-4" />} label="Type de nuisible" value={intervention.type_nuisible || "—"} />
        <InfoRow icon={<FlaskConical className="h-4 w-4" />} label="Type d'intervention" value={intervention.type_intervention || "—"} />
        <InfoRow icon={<Package className="h-4 w-4" />} label="Produits utilisés" value={intervention.produits || "—"} />
        <InfoRow icon={<ClipboardList className="h-4 w-4" />} label="Quantité" value={intervention.quantite || "—"} />
        {intervention.date_prochain_passage && (
          <InfoRow icon={<CalendarClock className="h-4 w-4" />} label="Prochain passage" value={formatDateFR(intervention.date_prochain_passage)} />
        )}
      </CardContent></Card>

      {/* Observations */}
      {intervention.observations && (
        <Card><CardContent className="p-4 space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Observations</h2>
          <p className="text-sm whitespace-pre-wrap">{intervention.observations}</p>
        </CardContent></Card>
      )}

      {/* Actions */}
      <div className="space-y-2">
        <Link
          to="/factures/new"
          search={{ client_id: intervention.client_id, adresse_site: intervention.adresse_site ?? "" }}
        >
          <Button className="w-full" variant="default">
            <Receipt className="mr-2 h-4 w-4" /> Facturer cette intervention
          </Button>
        </Link>

        <Button className="w-full" variant="outline" onClick={handleDuplicate}>
          <Copy className="mr-2 h-4 w-4" /> Dupliquer
        </Button>

        <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" onClick={generateBon}>
          <FileText className="mr-2 h-4 w-4" /> Générer le bon d'intervention
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
