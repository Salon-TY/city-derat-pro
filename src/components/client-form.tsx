import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { clientSchema, type ClientForm as ClientFormType, TYPES_NUISIBLES } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ClientForm({
  defaultValues,
  onSubmit,
  submitLabel = "Créer le client",
}: {
  defaultValues?: Partial<ClientFormType>;
  onSubmit: (v: ClientFormType) => Promise<void> | void;
  submitLabel?: string;
}) {
  const form = useForm<ClientFormType>({
    resolver: zodResolver(clientSchema) as any,
    defaultValues: {
      raison_sociale: defaultValues?.raison_sociale ?? "",
      adresse_site: defaultValues?.adresse_site ?? "",
      telephone: defaultValues?.telephone ?? "",
      email: defaultValues?.email ?? "",
      siret: defaultValues?.siret ?? "",
      type_nuisible: defaultValues?.type_nuisible ?? "",
      notes: defaultValues?.notes ?? "",
    },
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
      <Field label="Raison sociale / Nom *" error={form.formState.errors.raison_sociale?.message}>
        <Input {...form.register("raison_sociale")} />
      </Field>
      <Field label="Adresse du site">
        <Textarea rows={2} {...form.register("adresse_site")} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Téléphone"><Input type="tel" {...form.register("telephone")} /></Field>
        <Field label="Email" error={form.formState.errors.email?.message}><Input type="email" {...form.register("email")} /></Field>
      </div>
      <Field label="SIRET (optionnel)"><Input {...form.register("siret")} /></Field>
      <Field label="Type de nuisible">
        <Select value={form.watch("type_nuisible") ?? ""} onValueChange={(v) => form.setValue("type_nuisible", v)}>
          <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
          <SelectContent>
            {TYPES_NUISIBLES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Notes">
        <Textarea rows={3} {...form.register("notes")} />
      </Field>
      <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>{submitLabel}</Button>
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
