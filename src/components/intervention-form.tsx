import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import {
  interventionSchema,
  type InterventionForm as IFType,
  TYPES_NUISIBLES,
  TYPES_INTERVENTION,
  STATUTS_INTERVENTION,
} from "@/lib/schemas";
import { useClients } from "@/lib/queries";
import { db } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, UserPlus, X } from "lucide-react";

// Cases à cocher rapport rapide
const RAPPORT_ITEMS = [
  { id: "acces_difficile", label: "Accès difficile" },
  { id: "traces_fraiches", label: "Traces fraîches détectées" },
  { id: "appats_poses", label: "Appâts posés" },
  { id: "appats_consommes", label: "Appâts consommés" },
  { id: "pieges_poses", label: "Pièges posés" },
  { id: "pieges_declenches", label: "Pièges déclenchés" },
  { id: "retour_necessaire", label: "Retour nécessaire" },
  { id: "client_absent", label: "Client absent" },
  { id: "traitement_complet", label: "Traitement complet effectué" },
  { id: "recommandations_hygiene", label: "Recommandations hygiène faites" },
];

export function InterventionForm({
  defaultValues,
  onSubmit,
  submitLabel = "Enregistrer l'intervention",
}: {
  defaultValues?: Partial<IFType>;
  onSubmit: (v: IFType) => Promise<void> | void;
  submitLabel?: string;
}) {
  const { data: clients = [], refetch: refetchClients } = useClients();
  const qc = useQueryClient();
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientTel, setNewClientTel] = useState("");
  const [newClientAdresse, setNewClientAdresse] = useState("");
  const [creatingClient, setCreatingClient] = useState(false);
  const [rapportChecks, setRapportChecks] = useState<string[]>([]);

  const form = useForm<IFType>({
    resolver: zodResolver(interventionSchema) as any,
    defaultValues: {
      client_id: defaultValues?.client_id ?? "",
      date: defaultValues?.date ?? new Date().toISOString().slice(0, 10),
      adresse_site: defaultValues?.adresse_site ?? "",
      type_nuisible: defaultValues?.type_nuisible ?? "",
      type_intervention: defaultValues?.type_intervention ?? "Dératisation",
      produits: defaultValues?.produits ?? "",
      quantite: defaultValues?.quantite ?? "",
      observations: defaultValues?.observations ?? "",
      statut: defaultValues?.statut ?? "planifiee",
      date_prochain_passage: defaultValues?.date_prochain_passage ?? "",
    },
  });

  const clientId = form.watch("client_id");

  useEffect(() => {
    if (!clientId) return;
    const c = clients.find((x) => x.id === clientId);
    if (!c) return;
    if (!form.getValues("adresse_site") && c.adresse_site) {
      form.setValue("adresse_site", c.adresse_site);
    }
    if (!form.getValues("type_nuisible") && c.type_nuisible) {
      form.setValue("type_nuisible", c.type_nuisible);
    }
  }, [clientId, clients]);

  // Quand les cases changent, on met à jour les observations
  useEffect(() => {
    if (rapportChecks.length === 0) return;
    const labels = rapportChecks.map((id) => RAPPORT_ITEMS.find((r) => r.id === id)?.label ?? id);
    const current = form.getValues("observations") ?? "";
    const tag = `[Rapport: ${labels.join(", ")}]`;
    // Remplace l'ancien tag ou ajoute en début
    if (current.includes("[Rapport:")) {
      form.setValue("observations", current.replace(/\[Rapport:[^\]]*\]/, tag));
    } else {
      form.setValue("observations", tag + (current ? "\n" + current : ""));
    }
  }, [rapportChecks]);

  async function createClient() {
    if (!newClientName.trim()) { toast.error("Le nom est requis"); return; }
    setCreatingClient(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await db.from("clients").insert({
      user_id: user?.id,
      raison_sociale: newClientName.trim(),
      telephone: newClientTel.trim(),
      adresse_site: newClientAdresse.trim(),
    }).select().single();
    setCreatingClient(false);
    if (error) { toast.error(error.message); return; }
    await refetchClients();
    qc.invalidateQueries({ queryKey: ["clients"] });
    form.setValue("client_id", data.id, { shouldValidate: true });
    if (newClientAdresse) form.setValue("adresse_site", newClientAdresse);
    setShowNewClient(false);
    setNewClientName("");
    setNewClientTel("");
    setNewClientAdresse("");
    toast.success(`Client "${data.raison_sociale}" créé`);
  }

  function toggleCheck(id: string) {
    setRapportChecks((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">

      {/* Sélection client + création rapide */}
      <Field label="Client *" error={form.formState.errors.client_id?.message}>
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="flex-1">
              <Select
                value={form.watch("client_id")}
                onValueChange={(v) => {
                  form.setValue("client_id", v, { shouldValidate: true });
                  setShowNewClient(false);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un client…" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.raison_sociale}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 px-3"
              onClick={() => setShowNewClient((v) => !v)}
            >
              {showNewClient ? <X className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            </Button>
          </div>

          {/* Formulaire nouveau client inline */}
          {showNewClient && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-3 space-y-2">
                <p className="text-xs font-semibold text-primary uppercase tracking-wide flex items-center gap-1">
                  <Plus className="h-3 w-3" /> Nouveau client
                </p>
                <Input
                  placeholder="Nom / Raison sociale *"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  className="h-8 text-sm"
                />
                <Input
                  placeholder="Téléphone"
                  type="tel"
                  value={newClientTel}
                  onChange={(e) => setNewClientTel(e.target.value)}
                  className="h-8 text-sm"
                />
                <Textarea
                  placeholder="Adresse du site"
                  rows={2}
                  value={newClientAdresse}
                  onChange={(e) => setNewClientAdresse(e.target.value)}
                  className="text-sm"
                />
                <Button
                  type="button"
                  size="sm"
                  className="w-full h-8"
                  onClick={createClient}
                  disabled={creatingClient}
                >
                  {creatingClient ? "Création…" : "Créer et sélectionner"}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Date *" error={form.formState.errors.date?.message}>
          <Input type="date" {...form.register("date")} />
        </Field>
        <Field label="Statut">
          <Select
            value={form.watch("statut")}
            onValueChange={(v) => form.setValue("statut", v)}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUTS_INTERVENTION.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label="Adresse du site (auto)">
        <Textarea rows={2} {...form.register("adresse_site")} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Type de nuisible">
          <Select
            value={form.watch("type_nuisible") ?? ""}
            onValueChange={(v) => form.setValue("type_nuisible", v)}
          >
            <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
            <SelectContent>
              {TYPES_NUISIBLES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Type d'intervention">
          <Select
            value={form.watch("type_intervention")}
            onValueChange={(v) => form.setValue("type_intervention", v as any)}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TYPES_INTERVENTION.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Produits utilisés">
          <Input {...form.register("produits")} placeholder="Ex. Brodifacoum…" />
        </Field>
        <Field label="Quantité">
          <Input {...form.register("quantite")} placeholder="Ex. 4 boîtes" />
        </Field>
      </div>

      {/* Cases à cocher rapport rapide */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Rapport rapide
        </Label>
        <Card>
          <CardContent className="p-3 grid grid-cols-2 gap-2">
            {RAPPORT_ITEMS.map((item) => (
              <div key={item.id} className="flex items-center gap-2">
                <Checkbox
                  id={item.id}
                  checked={rapportChecks.includes(item.id)}
                  onCheckedChange={() => toggleCheck(item.id)}
                />
                <label
                  htmlFor={item.id}
                  className="text-xs cursor-pointer leading-tight"
                >
                  {item.label}
                </label>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Field label="Observations">
        <Textarea
          rows={3}
          {...form.register("observations")}
          placeholder="Constats, recommandations…"
        />
      </Field>

      <Field label="Date du prochain passage">
        <Input type="date" {...form.register("date_prochain_passage")} />
      </Field>

      <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
        {submitLabel}
      </Button>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
