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
import { useClients, useStockProducts } from "@/lib/queries";
import { db } from "@/lib/db";

export type StockUsageItem = {
  product_id: string;
  nom: string;
  quantite: number;
  unite: string;
};
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
import { Camera, Plus, UserPlus, X } from "lucide-react";

// Cases à cocher rapport rapide — label court + phrase complète dans les observations
const RAPPORT_ITEMS = [
  { id: "acces_difficile",       label: "Accès difficile",              phrase: "L'accès aux zones de traitement a été difficile lors de cette intervention." },
  { id: "traces_fraiches",       label: "Traces fraîches détectées",    phrase: "Des traces d'activité récente ont été détectées sur le site." },
  { id: "appats_poses",          label: "Appâts posés",                 phrase: "Des appâts rodenticides ont été posés aux points stratégiques identifiés." },
  { id: "appats_consommes",      label: "Appâts consommés",             phrase: "Les appâts posés lors du passage précédent ont été consommés, confirmant une activité persistante." },
  { id: "pieges_poses",          label: "Pièges posés",                 phrase: "Des pièges mécaniques ont été installés aux emplacements à risque." },
  { id: "pieges_declenches",     label: "Pièges déclenchés",            phrase: "Les pièges installés ont été déclenchés, attestant d'une présence active." },
  { id: "retour_necessaire",     label: "Retour nécessaire",            phrase: "Un second passage sera nécessaire pour s'assurer de l'efficacité du traitement." },
  { id: "client_absent",         label: "Client absent",                phrase: "Le client était absent lors de l'intervention. Un compte-rendu lui sera transmis." },
  { id: "traitement_complet",    label: "Traitement complet effectué",  phrase: "Le traitement complet a été réalisé conformément au protocole prévu." },
  { id: "recommandations_hygiene", label: "Recommandations hygiène",    phrase: "Des recommandations relatives aux mesures d'hygiène préventives ont été communiquées au client." },
];

export type PhotoFile = { file: File; preview: string };

export function InterventionForm({
  defaultValues,
  onSubmit,
  submitLabel = "Enregistrer l'intervention",
}: {
  defaultValues?: Partial<IFType>;
  onSubmit: (v: IFType, stockItems: StockUsageItem[], photos: PhotoFile[]) => Promise<void> | void;
  submitLabel?: string;
}) {
  const { data: clients = [], refetch: refetchClients } = useClients();
  const { data: stockProducts = [] } = useStockProducts();
  const qc = useQueryClient();
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientTel, setNewClientTel] = useState("");
  const [newClientAdresse, setNewClientAdresse] = useState("");
  const [creatingClient, setCreatingClient] = useState(false);
  const [rapportChecks, setRapportChecks] = useState<string[]>([]);
  const [stockUsage, setStockUsage] = useState<StockUsageItem[]>([]);
  const [pickedProductId, setPickedProductId] = useState("");
  const [pickedQty, setPickedQty] = useState<number>(1);

  const pickedProduct = stockProducts.find((p) => p.id === pickedProductId);
  const isVolume = pickedProduct?.type_gestion === "volume";
  const stockAfter = pickedProduct ? Math.max(0, pickedProduct.quantite - pickedQty) : null;
  const [photos, setPhotos] = useState<PhotoFile[]>([]);

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
    const item = RAPPORT_ITEMS.find((r) => r.id === id)!;
    const isChecked = rapportChecks.includes(id);
    setRapportChecks((prev) => isChecked ? prev.filter((x) => x !== id) : [...prev, id]);
    const current = form.getValues("observations") ?? "";
    if (!isChecked) {
      form.setValue("observations", current ? `${current}\n${item.phrase}` : item.phrase);
    } else {
      const updated = current.replace(item.phrase, "").replace(/\n{2,}/g, "\n").trim();
      form.setValue("observations", updated);
    }
  }

  function addStockItem() {
    if (!pickedProductId) return;
    const product = stockProducts.find((p) => p.id === pickedProductId);
    if (!product) return;
    const qty = Number(pickedQty);
    if (!qty || qty <= 0) { toast.error("Quantité invalide"); return; }
    setStockUsage((prev) => {
      const existing = prev.find((i) => i.product_id === pickedProductId);
      if (existing) {
        return prev.map((i) => i.product_id === pickedProductId ? { ...i, quantite: i.quantite + qty } : i);
      }
      return [...prev, { product_id: product.id, nom: product.nom, quantite: qty, unite: product.unite }];
    });
    setPickedProductId("");
    setPickedQty(product.type_gestion === "volume" ? 0.5 : 1);
  }

  function removeStockItem(product_id: string) {
    setStockUsage((prev) => prev.filter((i) => i.product_id !== product_id));
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const remaining = 5 - photos.length;
    const toAdd = files.slice(0, remaining);
    const newPhotos: PhotoFile[] = toAdd.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setPhotos((prev) => [...prev, ...newPhotos]);
    e.target.value = "";
  }

  function removePhoto(index: number) {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  function handleSubmitWithStock(values: IFType) {
    const produitsSerialized = stockUsage.length > 0
      ? stockUsage.map((i) => `${i.nom} x${i.quantite} ${i.unite}`).join(", ")
      : values.produits;
    return onSubmit({ ...values, produits: produitsSerialized, quantite: "" }, stockUsage, photos);
  }

  return (
    <form onSubmit={form.handleSubmit(handleSubmitWithStock)} className="space-y-3">

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

      <div className="space-y-1.5">
        <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Produits utilisés</Label>
        {stockProducts.length === 0 ? (
          <Input {...form.register("produits")} placeholder="Ex. Brodifacoum…" />
        ) : (
          <Card className="border-border">
            <CardContent className="p-3 space-y-2">
              {/* Sélecteur */}
              <div className="space-y-1.5">
                <Select value={pickedProductId} onValueChange={(v) => {
                  setPickedProductId(v);
                  const p = stockProducts.find((x) => x.id === v);
                  setPickedQty(p?.type_gestion === "volume" ? 0.5 : 1);
                }}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Choisir un produit…" />
                  </SelectTrigger>
                  <SelectContent>
                    {stockProducts.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nom} ({p.quantite} {p.unite} dispo)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {pickedProductId && (
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {isVolume
                        ? `Quantité consommée (${pickedProduct?.unite ?? "L ou ml"}) — saisir la quantité exacte utilisée`
                        : `Quantité (boîtes / unités)`}
                    </label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min={isVolume ? "0.001" : "1"}
                        step={isVolume ? "0.001" : "1"}
                        value={pickedQty}
                        onChange={(e) => setPickedQty(Number(e.target.value))}
                        className="h-8 flex-1 text-sm"
                      />
                      <Button type="button" size="sm" className="h-8 px-3 shrink-0" onClick={addStockItem}>
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {stockAfter !== null && pickedProduct && (
                      <p className={`text-[10px] ${pickedQty > pickedProduct.quantite ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                        Stock actuel : {pickedProduct.quantite} {pickedProduct.unite}
                        {" → sera : "}
                        <span className="font-medium">{stockAfter} {pickedProduct.unite}</span>
                        {pickedQty > pickedProduct.quantite && " ⚠️ stock insuffisant"}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Liste sélectionnée */}
              {stockUsage.length > 0 && (
                <div className="space-y-1">
                  {stockUsage.map((item) => (
                    <div key={item.product_id} className="flex items-center justify-between rounded-md bg-muted/40 px-2 py-1 text-sm">
                      <span>{item.nom} <span className="text-muted-foreground font-medium">× {item.quantite} {item.unite}</span></span>
                      <button type="button" onClick={() => removeStockItem(item.product_id)} className="text-destructive hover:text-destructive/80 ml-2">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {stockUsage.length === 0 && (
                <p className="text-xs text-muted-foreground">Aucun produit sélectionné</p>
              )}
            </CardContent>
          </Card>
        )}
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

      {/* Section photos */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Photos ({photos.length}/5)
        </Label>
        <Card>
          <CardContent className="p-3 space-y-3">
            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {photos.map((p, i) => (
                  <div key={i} className="relative aspect-square">
                    <img
                      src={p.preview}
                      alt={`Photo ${i + 1}`}
                      className="w-full h-full object-cover rounded-md border"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5 shadow"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {photos.length < 5 && (
              <label className="flex items-center justify-center gap-2 w-full h-10 rounded-md border border-dashed border-muted-foreground/40 text-sm text-muted-foreground cursor-pointer hover:bg-muted/30 transition-colors">
                <Camera className="h-4 w-4" />
                Prendre / choisir une photo
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  className="sr-only"
                  onChange={handlePhotoChange}
                />
              </label>
            )}
          </CardContent>
        </Card>
      </div>

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
