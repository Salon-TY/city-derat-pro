import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useClient, useInterventions, useContracts } from "@/lib/queries";
import { ClientForm } from "@/components/client-form";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trash2, Phone, Mail, MapPin, Hash, ClipboardList, FileSignature, AlertTriangle } from "lucide-react";
import { db } from "@/lib/db";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { formatDateFR, STATUTS_INTERVENTION, STATUTS_CONTRAT } from "@/lib/schemas";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { ClientForm as ClientFormType } from "@/lib/schemas";

export const Route = createFileRoute("/_app/clients/$id")({
  head: () => ({ meta: [{ title: "Fiche client — CITY DERAT" }] }),
  component: ClientDetail,
});

function statutLabel(list: readonly { value: string; label: string }[], v: string) {
  return list.find((s) => s.value === v)?.label ?? v;
}

function ClientDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: client, isLoading } = useClient(id);
  const { data: interventions = [] } = useInterventions({ client_id: id });
  const { data: contracts = [] } = useContracts();
  const clientContracts = contracts.filter((c) => c.client_id === id);

  async function handleUpdate(values: ClientFormType) {
    const { error } = await db.from("clients").update(values).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["clients"] });
    qc.invalidateQueries({ queryKey: ["client", id] });
    toast.success("Client mis à jour");
  }

  async function handleDelete() {
    const { error } = await db.from("clients").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["clients"] });
    toast.success("Client supprimé");
    navigate({ to: "/clients" });
  }

  if (isLoading) return <div className="text-sm text-muted-foreground">Chargement…</div>;
  if (!client) return <div className="text-sm text-muted-foreground">Client introuvable.</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link to="/clients" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" /> Retour
        </Link>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer ce client ?</AlertDialogTitle>
              <AlertDialogDescription>Toutes les interventions et contrats liés seront supprimés.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive">Supprimer</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h1 className="text-xl font-bold tracking-tight">{client.raison_sociale}</h1>
          {client.adresse_site && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(client.adresse_site)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2 text-sm text-primary hover:underline"
            >
              <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
              {client.adresse_site}
            </a>
          )}
          {client.telephone && <div className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 shrink-0 text-muted-foreground" /><a className="text-primary underline" href={`tel:${client.telephone}`}>{client.telephone}</a></div>}
          {client.email && <div className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 shrink-0 text-muted-foreground" /><a className="text-primary underline truncate" href={`mailto:${client.email}`}>{client.email}</a></div>}
          {client.siret && <div className="flex items-center gap-2 text-sm"><Hash className="h-4 w-4 shrink-0 text-muted-foreground" />SIRET: {client.siret}</div>}
          {client.type_nuisible && <div className="inline-flex items-center rounded-full bg-accent/15 px-2 py-1 text-xs text-accent font-medium">Nuisible: {client.type_nuisible}</div>}
          {!client.email && (
            <div className="flex items-center gap-2 rounded-lg border border-orange-300 bg-orange-50 dark:bg-orange-950/20 px-3 py-2 text-sm text-orange-700 dark:text-orange-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="flex-1">Email manquant — requis pour l'envoi des rapports</span>
              <a href="#modifier" className="text-xs font-medium underline">Corriger ↓</a>
            </div>
          )}
        </CardContent>
      </Card>

      {clientContracts.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2"><FileSignature className="h-4 w-4" />Contrat(s)</h2>
          <div className="space-y-2">
            {clientContracts.map((c) => (
              <Link key={c.id} to="/contrats/$id" params={{ id: c.id }}>
                <Card><CardContent className="p-3 text-sm flex items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{formatDateFR(c.date_debut)} → {formatDateFR(c.date_fin)}</div>
                    <div className="text-xs text-muted-foreground">{c.passages_realises}/{c.nb_passages_inclus} passages · {statutLabel(STATUTS_CONTRAT, c.statut)}</div>
                  </div>
                </CardContent></Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2"><ClipboardList className="h-4 w-4" />Historique interventions</h2>
        {interventions.length === 0 ? (
          <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">Aucune intervention.</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {interventions.map((i) => (
              <Link key={i.id} to="/interventions/$id" params={{ id: i.id }}>
                <Card><CardContent className="p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{formatDateFR(i.date)}</span>
                    <span className={`text-xs rounded-full px-2 py-0.5 ${i.statut === "realisee" ? "bg-success/15 text-success" : i.statut === "annulee" ? "bg-muted text-muted-foreground" : "bg-warning/20 text-warning-foreground"}`}>
                      {statutLabel(STATUTS_INTERVENTION, i.statut)}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{i.type_intervention}{i.type_nuisible ? ` · ${i.type_nuisible}` : ""}</div>
                </CardContent></Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section id="modifier">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Modifier</h2>
        <ClientForm defaultValues={client} onSubmit={handleUpdate} submitLabel="Enregistrer" />
      </section>
    </div>
  );
}
