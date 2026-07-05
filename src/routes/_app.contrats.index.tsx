import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { contractSchema, type ContractForm as ContractFormType, formatDateFR, STATUTS_CONTRAT, TYPES_PASSAGE } from "@/lib/schemas";
import { useContracts, useClients } from "@/lib/queries";
import type { Contract } from "@/lib/queries";
import { db } from "@/lib/db";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, AlertTriangle, CheckCircle2, Clock, Trash2, Search, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PermissionGate } from "@/components/permission-gate";

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export async function nextContractNumero(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `CT-${year}-`;
  const { data } = await db.from("contracts").select("numero").ilike("numero", `${prefix}%`);
  let max = 0;
  for (const row of data ?? []) {
    const n = Number((row.numero as string | null)?.slice(prefix.length));
    if (!isNaN(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

export const Route = createFileRoute("/_app/contrats/")({
  head: () => ({ meta: [{ title: "Contrats — CITY DERAT" }] }),
  component: () => (
    <PermissionGate perm="contrats">
      <ContratsPage />
    </PermissionGate>
  ),
});

const STATUT_ICONS: Record<string, React.ReactNode> = {
  actif: <CheckCircle2 className="h-4 w-4 text-primary" />,
  termine: <Clock className="h-4 w-4 text-muted-foreground" />,
  attente: <Clock className="h-4 w-4 text-accent" />,
};

function daysUntil(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function statutLabel(v: string) {
  return STATUTS_CONTRAT.find((s) => s.value === v)?.label ?? v;
}

function ContratsPage() {
  const { data: contracts = [], isLoading } = useContracts();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [statutFilter, setStatutFilter] = useState("all");
  const [expFilter, setExpFilter] = useState("all");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const activeFiltersCount = [
    q.trim() ? 1 : 0,
    statutFilter !== "all" ? 1 : 0,
    expFilter !== "all" ? 1 : 0,
    sortDir !== "asc" ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const filtered = useMemo(() => {
    let list = [...contracts];
    const s = q.trim().toLowerCase();
    if (s) list = list.filter((c) => (c.client?.raison_sociale ?? "").toLowerCase().includes(s));
    if (statutFilter !== "all") list = list.filter((c) => c.statut === statutFilter);
    if (expFilter === "month") {
      const now = new Date();
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
      list = list.filter((c) => c.date_fin <= end);
    } else if (expFilter === "3months") {
      const now = new Date();
      const end = new Date(now.getFullYear(), now.getMonth() + 3, now.getDate()).toISOString().slice(0, 10);
      list = list.filter((c) => c.date_fin <= end);
    } else if (expFilter === "expired") {
      const today = new Date().toISOString().slice(0, 10);
      list = list.filter((c) => c.date_fin < today);
    }
    list.sort((a, b) => {
      const cmp = a.date_fin.localeCompare(b.date_fin);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [contracts, q, statutFilter, expFilter, sortDir]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Contrats</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="shrink-0"><Plus className="mr-1 h-4 w-4" /> Nouveau</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nouveau contrat</DialogTitle></DialogHeader>
            <ContratForm onSuccess={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Search + filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un client…" className="pl-9" />
        </div>
        <button
          onClick={() => setFiltersOpen((v) => !v)}
          className={cn(
            "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors",
            filtersOpen || activeFiltersCount > 0
              ? "bg-accent/10 border-accent text-accent"
              : "bg-card border-border text-muted-foreground"
          )}
        >
          <Filter className="h-4 w-4" />
          {activeFiltersCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-white">
              {activeFiltersCount}
            </span>
          )}
        </button>
      </div>

      {filtersOpen && (
        <Card>
          <CardContent className="p-3 space-y-3">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Statut</div>
              <div className="flex flex-wrap gap-1">
                {[{ v: "all", l: "Tous" }, ...STATUTS_CONTRAT.map((s) => ({ v: s.value, l: s.label }))].map(({ v, l }) => (
                  <button key={v} onClick={() => setStatutFilter(v)}
                    className={cn("rounded-full px-2.5 py-1 text-xs font-medium border",
                      statutFilter === v ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border")}
                  >{l}</button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Expiration</div>
              <div className="flex flex-wrap gap-1">
                {[
                  { v: "all", l: "Tous" }, { v: "month", l: "Ce mois" },
                  { v: "3months", l: "Dans 3 mois" }, { v: "expired", l: "Déjà expiré" },
                ].map(({ v, l }) => (
                  <button key={v} onClick={() => setExpFilter(v)}
                    className={cn("rounded-full px-2.5 py-1 text-xs font-medium border",
                      expFilter === v ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border")}
                  >{l}</button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Tri date fin</div>
              <div className="flex gap-1">
                {[{ v: "asc", l: "↑ Plus urgents" }, { v: "desc", l: "↓ Plus tardifs" }].map(({ v, l }) => (
                  <button key={v} onClick={() => setSortDir(v as any)}
                    className={cn("rounded-full px-2.5 py-1 text-xs font-medium border",
                      sortDir === v ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border")}
                  >{l}</button>
                ))}
              </div>
            </div>
            {activeFiltersCount > 0 && (
              <button onClick={() => { setQ(""); setStatutFilter("all"); setExpFilter("all"); setSortDir("asc"); }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" /> Réinitialiser
              </button>
            )}
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="text-center text-sm text-muted-foreground py-10">Chargement…</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          {contracts.length === 0 ? "Aucun contrat. Créez-en un." : "Aucun résultat."}
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">{filtered.length} contrat{filtered.length > 1 ? "s" : ""}</div>
          {filtered.map((c) => {
            const days = daysUntil(c.date_fin);
            const expiring = c.statut === "actif" && days <= 30 && days >= 0;
            const expired = days < 0;
            return (
              <Card key={c.id} className={cn("overflow-hidden",
                expiring && days <= 7 && "border-destructive/40",
                expiring && days > 7 && "border-orange-300")}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <Link to="/contrats/$id" params={{ id: c.id }} className="min-w-0 flex-1">
                      {c.numero && <div className="text-[10px] font-mono text-muted-foreground">{c.numero}</div>}
                      <div className="font-semibold truncate">{c.client?.raison_sociale ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{formatDateFR(c.date_debut)} → {formatDateFR(c.date_fin)}</div>
                    </Link>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1">
                        {STATUT_ICONS[c.statut]}
                        <span className="text-xs font-medium">{statutLabel(c.statut)}</span>
                      </div>
                      <DeleteContratButton id={c.id} nom={c.client?.raison_sociale ?? "ce contrat"} />
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                      <div className="h-2 bg-primary rounded-full"
                        style={{ width: `${Math.min(100, (c.passages_realises / c.nb_passages_inclus) * 100)}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {c.passages_realises}/{c.nb_passages_inclus} passages
                    </span>
                  </div>
                  {expiring && (
                    <div className={cn("text-xs font-medium flex items-center gap-1",
                      days <= 7 ? "text-destructive" : "text-orange-500")}>
                      <AlertTriangle className="h-3 w-3" />
                      {expired ? `Expiré depuis ${Math.abs(days)} jour${Math.abs(days) > 1 ? "s" : ""}` : `Expire dans ${days} jour${days > 1 ? "s" : ""}`}
                    </div>
                  )}
                  <UpdatePassages contrat={c} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DeleteContratButton({ id, nom }: { id: string; nom: string }) {
  const qc = useQueryClient();
  async function handleDelete() {
    const { error } = await db.from("contracts").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["contracts"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    toast.success("Contrat supprimé");
  }
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer ce contrat ?</AlertDialogTitle>
          <AlertDialogDescription>Contrat de {nom}. Cette action est irréversible.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} className="bg-destructive">Supprimer</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function UpdatePassages({ contrat }: { contrat: any }) {
  const qc = useQueryClient();
  async function increment() {
    if (contrat.passages_realises >= contrat.nb_passages_inclus) return;
    const { error } = await db.from("contracts").update({ passages_realises: contrat.passages_realises + 1 }).eq("id", contrat.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["contracts"] });
    toast.success("Passage enregistré");
  }
  return (
    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={increment}
      disabled={contrat.passages_realises >= contrat.nb_passages_inclus}>
      + Enregistrer un passage
    </Button>
  );
}

export function ContratForm({ contract, onSuccess }: { contract?: Contract; onSuccess: () => void }) {
  const qc = useQueryClient();
  const { data: clients = [] } = useClients();
  const today = new Date().toISOString().slice(0, 10);
  const isEdit = !!contract;

  const form = useForm<ContractFormType>({
    resolver: zodResolver(contractSchema) as any,
    defaultValues: {
      client_id: contract?.client_id ?? "",
      numero: contract?.numero ?? undefined,
      nom_etablissement: contract?.nom_etablissement ?? "",
      adresse_etablissement: contract?.adresse_etablissement ?? "",
      type_prestation: contract?.type_prestation ?? "désinsectisation et dératisation",
      frequence: contract?.frequence ?? "",
      type_passage: contract?.type_passage ?? "préventif",
      date_debut: contract?.date_debut ?? today,
      duree_mois: contract?.duree_mois ?? 12,
      ville_signature: contract?.ville_signature ?? "",
      nb_passages_inclus: contract?.nb_passages_inclus ?? 3,
      passages_realises: contract?.passages_realises ?? 0,
      statut: contract?.statut ?? "actif",
      notes: contract?.notes ?? "",
    },
  });

  const clientId = form.watch("client_id");
  useEffect(() => {
    if (!clientId || isEdit) return;
    const c = clients.find((x) => x.id === clientId);
    if (c?.adresse_site && !form.getValues("adresse_etablissement")) {
      form.setValue("adresse_etablissement", c.adresse_site);
    }
  }, [clientId, clients]);

  async function onSubmit(values: ContractFormType) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Non connecté"); return; }
    const date_fin = addMonths(values.date_debut, values.duree_mois);

    if (isEdit) {
      const { error } = await db.from("contracts").update({ ...values, date_fin }).eq("id", contract!.id);
      if (error) { toast.error(error.message); return; }
      qc.invalidateQueries({ queryKey: ["contracts"] });
      qc.invalidateQueries({ queryKey: ["contract", contract!.id] });
      toast.success("Contrat mis à jour");
    } else {
      const numero = await nextContractNumero();
      const { error } = await db.from("contracts").insert({ ...values, numero, date_fin, user_id: user.id });
      if (error) { toast.error(error.message); return; }
      qc.invalidateQueries({ queryKey: ["contracts"] });
      toast.success(`Contrat ${numero} créé`);
    }
    onSuccess();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Client & établissement</h3>
        <Field label="Client *" error={(form.formState.errors as any).client_id?.message}>
          <Select value={form.watch("client_id")} onValueChange={(v) => form.setValue("client_id", v, { shouldValidate: true })}>
            <SelectTrigger><SelectValue placeholder="Sélectionner un client…" /></SelectTrigger>
            <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.raison_sociale}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Nom de l'établissement"><Input {...form.register("nom_etablissement")} /></Field>
        <Field label="Adresse de l'établissement"><Textarea rows={2} {...form.register("adresse_etablissement")} /></Field>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prestation</h3>
        <Field label="Type de prestation"><Input {...form.register("type_prestation")} /></Field>
        <Field label="Fréquence"><Input {...form.register("frequence")} placeholder="1 passage hebdomadaire" /></Field>
        <Field label="Type de passage">
          <Select value={form.watch("type_passage")} onValueChange={(v) => form.setValue("type_passage", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TYPES_PASSAGE.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Durée</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date début *" error={(form.formState.errors as any).date_debut?.message}>
            <Input type="date" {...form.register("date_debut")} />
          </Field>
          <Field label="Durée (mois)" error={(form.formState.errors as any).duree_mois?.message}>
            <Input type="number" min={1} max={60} {...form.register("duree_mois")} />
          </Field>
        </div>
        <Field label="Ville de signature"><Input {...form.register("ville_signature")} placeholder="Paris" /></Field>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Suivi</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Passages inclus" error={(form.formState.errors as any).nb_passages_inclus?.message}>
            <Input type="number" {...form.register("nb_passages_inclus")} />
          </Field>
          <Field label="Passages réalisés" error={(form.formState.errors as any).passages_realises?.message}>
            <Input type="number" {...form.register("passages_realises")} />
          </Field>
        </div>
        <Field label="Statut">
          <Select value={form.watch("statut")} onValueChange={(v) => form.setValue("statut", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{STATUTS_CONTRAT.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Notes"><Textarea rows={2} {...form.register("notes")} /></Field>
      </div>

      <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Enregistrement…" : isEdit ? "Enregistrer" : "Créer le contrat"}
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
