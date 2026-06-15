import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import {
  interventionSchema,
  type InterventionForm as IFType,
  TYPES_NUISIBLES,
  TYPES_INTERVENTION,
  STATUTS_INTERVENTION,
} from "@/lib/schemas";
import { useClients } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function InterventionForm({
  defaultValues,
  onSubmit,
  submitLabel = "Enregistrer l'intervention",
}: {
  defaultValues?: Partial<IFType>;
  onSubmit: (v: IFType) => Promise<void> | void;
  submitLabel?: string;
}) {
  const { data: clients = [] } = useClients();

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

  // Auto-remplir adresse + type nuisible depuis le client sélectionné
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

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
      <Field label="Client *" error={form.formState.errors.client_id?.message}>
        <Select
          value={form.watch("client_id")}
          onValueChange={(v) => form.setValue("client_id", v, { shouldValidate: true })}
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
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUTS_INTERVENTION.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
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
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner…" />
            </SelectTrigger>
            <SelectContent>
              {TYPES_NUISIBLES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Type d'intervention">
          <Select
            value={form.watch("type_intervention")}
            onValueChange={(v) => form.setValue("type_intervention", v as any)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPES_INTERVENTION.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Produits utilisés">
          <Input
            {...form.register("produits")}
            placeholder="Ex. Brodifacoum, Fipronil…"
          />
        </Field>
        <Field label="Quantité">
          <Input {...form.register("quantite")} placeholder="Ex. 4 boîtes" />
        </Field>
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

      <Button
        type="submit"
        className="w-full"
        disabled={form.formState.isSubmitting}
      >
        {submitLabel}
      </Button>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
