// Passages de contrat à programmer — l'app ne devine jamais de date, elle
// se contente de surfacer ce qu'il reste à programmer (voir
// usePassagesAProgrammer dans queries.ts) et de préremplir la création
// d'intervention pour que seule la date (et éventuellement le technicien)
// reste à saisir.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarClock, MapPin, ClipboardList, CalendarPlus } from "lucide-react";
import { usePassagesAProgrammer, type PassageAProgrammer } from "@/lib/queries";
import { TechnicianSelect } from "@/components/technician-select";
import { TYPES_NUISIBLES, TYPES_INTERVENTION } from "@/lib/schemas";
import { PermissionGate } from "@/components/permission-gate";

export const Route = createFileRoute("/_app/programmation/")({
  head: () => ({ meta: [{ title: "Passages à programmer — CITY DERAT" }] }),
  component: () => (
    <PermissionGate perm="programmation">
      <ProgrammationPage />
    </PermissionGate>
  ),
});

// Best-effort : le type de nuisible n'est pas structuré sur le contrat
// (type_prestation est du texte libre) — on tente une correspondance simple,
// sinon on laisse l'utilisateur choisir.
function deriveTypeNuisible(typePrestation: string | null | undefined): string {
  const t = (typePrestation ?? "").toLowerCase();
  if (t.includes("rat")) return "Rats";
  if (t.includes("souris") || t.includes("rong")) return "Souris";
  if (t.includes("cafard") || t.includes("blatte")) return "Cafards";
  if (t.includes("punaise")) return "Punaises de lit";
  if (t.includes("pigeon")) return "Pigeons";
  if (t.includes("frelon")) return "Frelons";
  return "";
}

function deriveTypeIntervention(typePrestation: string | null | undefined): (typeof TYPES_INTERVENTION)[number] {
  const t = (typePrestation ?? "").toLowerCase();
  const dérat = t.includes("dérat") || t.includes("derat");
  const désin = t.includes("désin") || t.includes("desin") || t.includes("insect");
  if (dérat && désin) return "Les deux";
  if (désin && !dérat) return "Désinsectisation";
  return "Dératisation";
}

function ProgrammationPage() {
  const { data: contracts = [], isLoading } = usePassagesAProgrammer();
  const [dialogContract, setDialogContract] = useState<PassageAProgrammer | null>(null);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Passages à programmer</h1>
        <p className="text-sm text-muted-foreground">
          Contrats actifs auxquels il reste des passages à créer. La date reste toujours à votre choix.
        </p>
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Chargement…</div>
      ) : contracts.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          <CalendarClock className="mx-auto mb-2 h-8 w-8 opacity-50" />
          Aucun passage à programmer pour le moment.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {contracts.map((c) => {
            const progress = Math.min(100, (c.passages_realises / c.nb_passages_inclus) * 100);
            const adresse = c.adresse_etablissement || c.client?.adresse_site || "";
            return (
              <Card key={c.id}>
                <CardContent className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {c.numero && <div className="text-[10px] font-mono text-muted-foreground">{c.numero}</div>}
                      <Link to="/contrats/$id" params={{ id: c.id }} className="font-semibold truncate hover:underline block">
                        {c.client?.raison_sociale ?? "—"}
                      </Link>
                      {c.nom_etablissement && <div className="text-xs text-muted-foreground truncate">{c.nom_etablissement}</div>}
                    </div>
                    <span className="shrink-0 rounded-full bg-destructive/10 text-destructive px-2.5 py-1 text-[11px] font-semibold uppercase">
                      {c.restant} à programmer
                    </span>
                  </div>

                  {adresse && (
                    <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                      <span className="truncate">{adresse}</span>
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {c.frequence && <div><span className="text-muted-foreground/70">Fréquence : </span>{c.frequence}</div>}
                    {c.type_prestation && <div><span className="text-muted-foreground/70">Prestation : </span>{c.type_prestation}</div>}
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                      <div className="h-2 bg-primary rounded-full" style={{ width: `${progress}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {c.passages_realises}/{c.nb_passages_inclus} réalisés
                    </span>
                  </div>
                  {c.planifiees > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      {c.planifiees} déjà planifié{c.planifiees > 1 ? "s" : ""} (non compté{c.planifiees > 1 ? "s" : ""} dans le reste à programmer)
                    </p>
                  )}

                  <Button size="sm" className="w-full" onClick={() => setDialogContract(c)}>
                    <CalendarPlus className="mr-1.5 h-4 w-4" /> Programmer un passage
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ProgrammerDialog contract={dialogContract} onClose={() => setDialogContract(null)} />
    </div>
  );
}

function ProgrammerDialog({ contract, onClose }: { contract: PassageAProgrammer | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [typeNuisible, setTypeNuisible] = useState("");
  const [technicienId, setTechnicienId] = useState("none");
  const [consignes, setConsignes] = useState("");
  const [saving, setSaving] = useState(false);

  // Réinitialise le formulaire à chaque ouverture sur un nouveau contrat.
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  if (contract && contract.id !== openedFor) {
    setOpenedFor(contract.id);
    setDate(new Date().toISOString().slice(0, 10));
    setTypeNuisible(deriveTypeNuisible(contract.type_prestation));
    setTechnicienId("none");
    setConsignes(contract.notes || "");
  }

  async function handleConfirm() {
    if (!contract) return;
    if (!date) { toast.error("Choisissez une date"); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Non connecté"); return; }
      const adresse = contract.adresse_etablissement || contract.client?.adresse_site || "";
      const { error } = await db.from("interventions").insert({
        user_id: user.id,
        client_id: contract.client_id,
        contract_id: contract.id,
        technicien_id: technicienId === "none" ? null : technicienId,
        date,
        adresse_site: adresse,
        type_nuisible: typeNuisible,
        type_intervention: deriveTypeIntervention(contract.type_prestation),
        consignes: consignes || null,
        statut: "planifiee",
      });
      if (error) { toast.error(error.message); return; }
      qc.invalidateQueries({ queryKey: ["passages_a_programmer"] });
      qc.invalidateQueries({ queryKey: ["interventions"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["my_todo_count"] });
      toast.success("Passage programmé");
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!contract} onOpenChange={(v) => { if (!v) { onClose(); setOpenedFor(null); } }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Programmer un passage</DialogTitle></DialogHeader>
        {contract && (
          <div className="space-y-3">
            <div className="rounded-lg bg-muted/40 p-3 text-sm space-y-0.5">
              <div className="font-semibold">{contract.client?.raison_sociale ?? "—"}</div>
              {(contract.adresse_etablissement || contract.client?.adresse_site) && (
                <div className="text-xs text-muted-foreground flex items-start gap-1">
                  <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                  {contract.adresse_etablissement || contract.client?.adresse_site}
                </div>
              )}
              {contract.numero && <div className="text-xs text-muted-foreground flex items-center gap-1"><ClipboardList className="h-3 w-3" />{contract.numero}</div>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Date *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} autoFocus />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Technicien (optionnel)</Label>
              <TechnicianSelect value={technicienId} onValueChange={setTechnicienId} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Type de nuisible</Label>
              <Select value={typeNuisible} onValueChange={setTypeNuisible}>
                <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                <SelectContent>
                  {TYPES_NUISIBLES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Consignes pour le technicien (optionnel)</Label>
              <Textarea rows={2} value={consignes} onChange={(e) => setConsignes(e.target.value)} placeholder="Ex. clés chez le gardien…" />
            </div>

            <Button className="w-full" disabled={saving} onClick={handleConfirm}>
              {saving ? "Enregistrement…" : "Créer l'intervention"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
