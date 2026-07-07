import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState, useRef } from "react";
import {
  interventionSchema,
  type InterventionForm as IFType,
  TYPES_NUISIBLES,
  TYPES_INTERVENTION,
  STATUTS_INTERVENTION,
} from "@/lib/schemas";
import { useClients, useStockProducts, useContracts, useAssignableMembers, useStockLevels, getGarageLevel, getVanLevel } from "@/lib/queries";
import { db } from "@/lib/db";

export type StockUsageItem = {
  product_id: string;
  nom: string;
  quantite: number;
  unite: string;
};

type UnifiedItem =
  | { kind: "stock"; product_id: string; nom: string; quantite: number; unite: string; stock_actuel: number }
  | { kind: "free"; id: string; nom: string; quantite_text: string };

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
import { Link } from "@tanstack/react-router";
import { TechnicianSelect } from "@/components/technician-select";

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
  const { data: contracts = [] } = useContracts();
  const { data: assignableMembers = [] } = useAssignableMembers();
  const { data: stockLevels = [] } = useStockLevels();
  const qc = useQueryClient();
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientTel, setNewClientTel] = useState("");
  const [newClientAdresse, setNewClientAdresse] = useState("");
  const [creatingClient, setCreatingClient] = useState(false);
  const [rapportChecks, setRapportChecks] = useState<string[]>([]);
  // ─── Unified product list (stock + free) ────────────────────────────────────
  const [items, setItems] = useState<UnifiedItem[]>([]);

  // Mode A — stock picker
  const [pickedProductId, setPickedProductId] = useState("");
  const [pickedQty, setPickedQty] = useState<number>(1);
  const pickedProduct = stockProducts.find((p) => p.id === pickedProductId);
  const isVolume = pickedProduct?.type_gestion === "volume";

  // Mode B — free product
  const [showFreeForm, setShowFreeForm] = useState(false);
  const [freeNom, setFreeNom] = useState("");
  const [freeQty, setFreeQty] = useState("");
  const [showAutoList, setShowAutoList] = useState(false);
  const freeInputRef = useRef<HTMLInputElement>(null);

  // Autocomplete — unique product names from previous interventions
  const [freeSuggestions, setFreeSuggestions] = useState<{ nom: string; count: number }[]>([]);
  useEffect(() => {
    import("@/lib/db").then(({ db }) => {
      db.from("interventions").select("produits").then(({ data }) => {
        const counts = new Map<string, number>();
        for (const row of data ?? []) {
          if (!row.produits) continue;
          const parts = (row.produits as string).split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
          for (const p of parts) {
            const nom = p.replace(/\s*[x×][\d.,]+.*$/i, "").trim();
            if (nom.length > 1) counts.set(nom, (counts.get(nom) ?? 0) + 1);
          }
        }
        setFreeSuggestions(
          [...counts.entries()]
            .map(([nom, count]) => ({ nom, count }))
            .sort((a, b) => b.count - a.count)
        );
      });
    });
  }, []);

  const freeAutoComplete = freeSuggestions.filter(
    (s) => freeNom.length >= 2 && s.nom.toLowerCase().includes(freeNom.toLowerCase()) && s.nom !== freeNom
  ).slice(0, 5);

  // Names of free items with ≥3 historical uses → suggest adding to stock
  const stockSuggestions = items
    .filter((i): i is Extract<UnifiedItem, { kind: "free" }> => i.kind === "free")
    .map((i) => freeSuggestions.find((s) => s.nom === i.nom))
    .filter((s): s is { nom: string; count: number } => !!s && s.count >= 3)
    .map((s) => s.nom);
  const [photos, setPhotos] = useState<PhotoFile[]>([]);

  const form = useForm<IFType>({
    resolver: zodResolver(interventionSchema) as any,
    defaultValues: {
      client_id: defaultValues?.client_id ?? "",
      contract_id: defaultValues?.contract_id ?? "",
      technicien_id: defaultValues?.technicien_id ?? undefined,
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
  const contractId = form.watch("contract_id");
  const technicienId = form.watch("technicien_id");
  const clientContracts = contracts.filter((c) => c.client_id === clientId && c.statut === "actif");

  // Quantité disponible pour le picker de stock : camion du technicien assigné,
  // sinon le garage (avec indication à l'utilisateur).
  function availableQty(productId: string): number {
    const level = technicienId
      ? getVanLevel(stockLevels, productId, technicienId)
      : getGarageLevel(stockLevels, productId);
    return level?.quantite ?? 0;
  }
  const pickedAvailableQty = pickedProductId ? availableQty(pickedProductId) : null;
  const stockAfter = pickedProduct
    ? Math.max(0, (pickedAvailableQty ?? 0) - pickedQty)
    : null;

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

  useEffect(() => {
    if (contractId && !clientContracts.some((c) => c.id === contractId)) {
      form.setValue("contract_id", "");
    }
  }, [clientId, clientContracts]);

  // Pré-sélectionne le technicien connecté s'il fait partie de l'équipe assignable,
  // uniquement à la création (pas de valeur déjà fournie/éditée).
  useEffect(() => {
    if (defaultValues?.technicien_id) return;
    if (form.getValues("technicien_id")) return;
    if (assignableMembers.length === 0) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && assignableMembers.some((m) => m.user_id === user.id)) {
        form.setValue("technicien_id", user.id);
      }
    })();
  }, [assignableMembers]);


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
    setItems((prev) => {
      const existing = prev.find((i) => i.kind === "stock" && i.product_id === pickedProductId);
      if (existing) {
        return prev.map((i) =>
          i.kind === "stock" && i.product_id === pickedProductId
            ? { ...i, quantite: i.quantite + qty }
            : i
        );
      }
      return [...prev, {
        kind: "stock",
        product_id: product.id,
        nom: product.nom,
        quantite: qty,
        unite: product.unite,
        stock_actuel: availableQty(product.id),
      }];
    });
    setPickedProductId("");
    setPickedQty(product.type_gestion === "volume" ? 0.5 : 1);
  }

  function addFreeItem() {
    if (!freeNom.trim()) { toast.error("Nom du produit requis"); return; }
    setItems((prev) => [
      ...prev,
      { kind: "free", id: `free-${Date.now()}`, nom: freeNom.trim(), quantite_text: freeQty.trim() },
    ]);
    setFreeNom("");
    setFreeQty("");
    setShowFreeForm(false);
    setShowAutoList(false);
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((i) =>
      i.kind === "stock" ? i.product_id !== key : i.id !== key
    ));
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
    const stockItems: StockUsageItem[] = items
      .filter((i): i is Extract<UnifiedItem, { kind: "stock" }> => i.kind === "stock")
      .map((i) => ({ product_id: i.product_id, nom: i.nom, quantite: i.quantite, unite: i.unite }));

    const produitsSerialized = items.length > 0
      ? items.map((i) =>
          i.kind === "stock"
            ? `${i.nom} ×${i.quantite} ${i.unite}`
            : `${i.nom}${i.quantite_text ? ` (${i.quantite_text})` : ""}`
        ).join(", ")
      : values.produits;

    return onSubmit({ ...values, produits: produitsSerialized, quantite: "" }, stockItems, photos);
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

      {clientContracts.length > 0 && (
        <Field label="Contrat rattaché (optionnel)">
          <Select
            value={form.watch("contract_id") || undefined}
            onValueChange={(v) => form.setValue("contract_id", v)}
          >
            <SelectTrigger><SelectValue placeholder="Aucun contrat…" /></SelectTrigger>
            <SelectContent>
              {clientContracts.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.numero ? `${c.numero} — ` : ""}{c.nom_etablissement || "Établissement"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}

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

      <Field label="Technicien assigné">
        <TechnicianSelect
          value={form.watch("technicien_id") ?? "none"}
          onValueChange={(v) => form.setValue("technicien_id", v === "none" ? undefined : v)}
        />
      </Field>

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

      {/* ─── Produits utilisés (hybride stock + libre) ─────────────────────── */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Produits utilisés</Label>
        <Card className="border-border">
          <CardContent className="p-3 space-y-3">

            {/* Liste unifiée des produits ajoutés */}
            {items.length > 0 && (
              <div className="space-y-1.5">
                {items.map((item) => (
                  <div
                    key={item.kind === "stock" ? item.product_id : item.id}
                    className="flex items-start gap-2 rounded-md bg-muted/40 px-2 py-1.5 text-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium">{item.nom}</span>
                        {item.kind === "stock" && (
                          <>
                            <span className="text-muted-foreground">× {item.quantite} {item.unite}</span>
                            <span className="rounded-full bg-primary/15 text-primary text-[9px] font-semibold px-1.5 py-0.5 shrink-0">Stock</span>
                          </>
                        )}
                        {item.kind === "free" && item.quantite_text && (
                          <span className="text-muted-foreground">— {item.quantite_text}</span>
                        )}
                      </div>
                      {item.kind === "stock" && (
                        <p className={`text-[10px] mt-0.5 ${item.quantite > item.stock_actuel ? "text-destructive" : "text-muted-foreground"}`}>
                          Stock après déduction : {Math.max(0, item.stock_actuel - item.quantite)} {item.unite}
                          {item.quantite > item.stock_actuel && " ⚠️"}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.kind === "stock" ? item.product_id : item.id)}
                      className="text-destructive/60 hover:text-destructive shrink-0 mt-0.5"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Suggestion "Ajouter au stock" pour produits libres fréquents */}
            {stockSuggestions.map((nom) => (
              <div key={nom} className="flex items-center justify-between gap-2 rounded-lg bg-accent/5 border border-accent/20 px-3 py-2 text-xs">
                <span className="text-muted-foreground">💡 « {nom} » est souvent utilisé.</span>
                <Link
                  to={"/stock" as any}
                  className="shrink-0 text-accent underline font-medium"
                >
                  Ajouter au stock
                </Link>
              </div>
            ))}

            {/* ── MODE A : Produit du stock ──────────────────────────────── */}
            {stockProducts.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Depuis le stock</div>
                {!technicienId && (
                  <p className="text-[10px] text-muted-foreground italic">
                    Assignez un technicien pour décompter son camion — à défaut, le garage sera décompté.
                  </p>
                )}
                <Select
                  value={pickedProductId}
                  onValueChange={(v) => {
                    setPickedProductId(v);
                    const p = stockProducts.find((x) => x.id === v);
                    setPickedQty(p?.type_gestion === "volume" ? 0.5 : 1);
                  }}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Choisir un produit du stock…" />
                  </SelectTrigger>
                  <SelectContent>
                    {stockProducts.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nom} — {availableQty(p.id)} {p.unite} dispo
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {pickedProductId && (
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground">
                      {isVolume
                        ? `Quantité consommée (${pickedProduct?.unite ?? "L/ml"}) — quantité exacte utilisée`
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
                    {stockAfter !== null && pickedProduct && pickedAvailableQty !== null && (
                      <p className={`text-[10px] ${pickedQty > pickedAvailableQty ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                        Stock actuel ({technicienId ? "camion" : "garage"}) : {pickedAvailableQty} {pickedProduct.unite}
                        {" → sera : "}
                        <span className="font-medium">{stockAfter} {pickedProduct.unite}</span>
                        {pickedQty > pickedAvailableQty && " ⚠️ insuffisant"}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── MODE B : Produit libre ─────────────────────────────────── */}
            {showFreeForm ? (
              <div className="space-y-2 rounded-lg border border-dashed border-muted-foreground/30 p-2.5">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Produit libre (sans suivi stock)</div>
                <div className="relative">
                  <Input
                    ref={freeInputRef}
                    placeholder="Nom du produit…"
                    value={freeNom}
                    onChange={(e) => { setFreeNom(e.target.value); setShowAutoList(true); }}
                    onFocus={() => setShowAutoList(true)}
                    onBlur={() => setTimeout(() => setShowAutoList(false), 150)}
                    className="h-8 text-sm"
                  />
                  {showAutoList && freeAutoComplete.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-10 mt-0.5 rounded-lg border bg-card shadow-lg overflow-hidden">
                      {freeAutoComplete.map((s) => (
                        <button
                          key={s.nom}
                          type="button"
                          className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted flex items-center justify-between"
                          onMouseDown={() => { setFreeNom(s.nom); setShowAutoList(false); }}
                        >
                          <span>{s.nom}</span>
                          <span className="text-[10px] text-muted-foreground">{s.count}×</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Input
                  placeholder="Quantité (optionnel, ex: 2 sachets, ~50 ml…)"
                  value={freeQty}
                  onChange={(e) => setFreeQty(e.target.value)}
                  className="h-8 text-sm"
                />
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" className="flex-1 h-7 text-xs" onClick={() => { setShowFreeForm(false); setFreeNom(""); setFreeQty(""); }}>
                    Annuler
                  </Button>
                  <Button type="button" size="sm" className="flex-1 h-7 text-xs" onClick={addFreeItem}>
                    Ajouter
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setShowFreeForm(true); setTimeout(() => freeInputRef.current?.focus(), 50); }}
                className="flex w-full items-center gap-1.5 rounded-lg border border-dashed border-muted-foreground/30 px-3 py-2 text-xs text-muted-foreground hover:border-muted-foreground/60 hover:text-foreground transition-colors"
              >
                <Plus className="h-3.5 w-3.5 shrink-0" /> Produit libre (sans suivi stock)
              </button>
            )}

            {items.length === 0 && !showFreeForm && !pickedProductId && (
              <p className="text-xs text-muted-foreground text-center">Aucun produit ajouté</p>
            )}
          </CardContent>
        </Card>
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
