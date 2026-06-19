import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Minus, AlertTriangle, Package, Trash2, Search, Filter, X } from "lucide-react";
import { useStockProducts, type StockProduct } from "@/lib/queries";
import { stockProductSchema, type StockProductForm, UNITES_STOCK, UNITES_VOLUME, UNITES_UNITE, formatEUR } from "@/lib/schemas";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/stock/")({
  head: () => ({ meta: [{ title: "Stock — CITY DERAT" }] }),
  component: StockPage,
});

type StockFilter = "all" | "low" | "empty";
type StockSort = "alpha" | "qty_asc" | "qty_desc";

function StockPage() {
  const { data: products = [], isLoading } = useStockProducts();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [sort, setSort] = useState<StockSort>("alpha");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const qc = useQueryClient();

  const activeFiltersCount = [q.trim() ? 1 : 0, stockFilter !== "all" ? 1 : 0, sort !== "alpha" ? 1 : 0].reduce((a, b) => a + b, 0);

  const filtered = useMemo(() => {
    let list = [...products];
    const s = q.trim().toLowerCase();
    if (s) list = list.filter((p) => p.nom.toLowerCase().includes(s));
    if (stockFilter === "low") list = list.filter((p) => p.quantite > 0 && p.quantite <= p.seuil_alerte);
    if (stockFilter === "empty") list = list.filter((p) => p.quantite === 0);
    list.sort((a, b) => {
      if (sort === "alpha") return a.nom.localeCompare(b.nom);
      if (sort === "qty_asc") return a.quantite - b.quantite;
      return b.quantite - a.quantite;
    });
    return list;
  }, [products, q, stockFilter, sort]);

  const createMut = useMutation({
    mutationFn: async (values: StockProductForm) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Non authentifié");
      const { error } = await db.from("stock_products").insert({ ...values, user_id: u.user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Produit ajouté");
      qc.invalidateQueries({ queryKey: ["stock_products"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Stock</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-1 h-4 w-4" />Ajouter un produit</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nouveau produit</DialogTitle></DialogHeader>
            <ProductForm onSubmit={(v) => createMut.mutateAsync(v)} submitting={createMut.isPending} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Search + filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un produit…" className="pl-9" />
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
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Filtre stock</div>
              <div className="flex flex-wrap gap-1">
                {[
                  { v: "all", l: "Tous" },
                  { v: "low", l: "Stock bas" },
                  { v: "empty", l: "Épuisé" },
                ].map(({ v, l }) => (
                  <button key={v} onClick={() => setStockFilter(v as StockFilter)}
                    className={cn("rounded-full px-2.5 py-1 text-xs font-medium border",
                      stockFilter === v ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border")}
                  >{l}</button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Tri</div>
              <div className="flex flex-wrap gap-1">
                {[
                  { v: "alpha", l: "A→Z" },
                  { v: "qty_asc", l: "Qté ↑" },
                  { v: "qty_desc", l: "Qté ↓" },
                ].map(({ v, l }) => (
                  <button key={v} onClick={() => setSort(v as StockSort)}
                    className={cn("rounded-full px-2.5 py-1 text-xs font-medium border",
                      sort === v ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border")}
                  >{l}</button>
                ))}
              </div>
            </div>
            {activeFiltersCount > 0 && (
              <button onClick={() => { setQ(""); setStockFilter("all"); setSort("alpha"); }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" /> Réinitialiser
              </button>
            )}
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Chargement…</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          <Package className="mx-auto mb-2 h-8 w-8 opacity-50" />
          {products.length === 0 ? "Aucun produit en stock. Ajoutez votre premier produit." : "Aucun résultat."}
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">{filtered.length} produit{filtered.length > 1 ? "s" : ""}</div>
          {filtered.map((p) => <ProductRow key={p.id} product={p} />)}
        </div>
      )}
    </div>
  );
}

function ProductRow({ product }: { product: StockProduct }) {
  const qc = useQueryClient();
  const low = product.quantite <= product.seuil_alerte;

  const adjustMut = useMutation({
    mutationFn: async (delta: number) => {
      const next = Math.max(0, Number(product.quantite) + delta);
      const { error } = await db.from("stock_products").update({ quantite: next }).eq("id", product.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock_products"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  function prompt(action: "in" | "out") {
    const label = action === "in" ? "Quantité à ajouter (réapprovisionnement)" : "Quantité à retirer (utilisation)";
    const raw = window.prompt(label, "1");
    if (raw == null) return;
    const n = Number(raw.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) { toast.error("Quantité invalide"); return; }
    adjustMut.mutate(action === "in" ? n : -n);
  }

  return (
    <Card className={low ? "border-destructive/40" : ""}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold truncate">{product.nom}</h3>
              {product.quantite === 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive-foreground">
                  Épuisé
                </span>
              )}
              {product.quantite > 0 && low && (
                <span className="inline-flex items-center gap-1 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive-foreground">
                  <AlertTriangle className="h-3 w-3" /> Stock bas
                </span>
              )}
            </div>
            <div className="mt-1 text-sm text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="font-medium text-foreground tabular-nums">{product.quantite}</span>
              <span>{product.unite}</span>
              <span className="opacity-50">·</span>
              <span>Seuil : <span className="tabular-nums">{product.seuil_alerte}</span></span>
              <span className="opacity-50">·</span>
              <span>{formatEUR(product.prix_achat_ht)} HT/{product.unite}</span>
              <span className={cn(
                "rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
                product.type_gestion === "volume"
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  : "bg-muted text-muted-foreground"
              )}>
                {product.type_gestion === "volume" ? "Volume" : "Unité"}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <Button size="icon" variant="outline" className="h-9 w-9" onClick={() => prompt("out")} aria-label="Retirer" disabled={adjustMut.isPending}>
              <Minus className="h-4 w-4" />
            </Button>
            <Button size="icon" className="h-9 w-9 bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => prompt("in")} aria-label="Ajouter" disabled={adjustMut.isPending}>
              <Plus className="h-4 w-4" />
            </Button>
            <DeleteProductButton id={product.id} nom={product.nom} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DeleteProductButton({ id, nom }: { id: string; nom: string }) {
  const qc = useQueryClient();
  const deleteMut = useMutation({
    mutationFn: async () => {
      const { error } = await db.from("stock_products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Produit supprimé");
      qc.invalidateQueries({ queryKey: ["stock_products"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="icon" variant="outline" className="h-9 w-9 text-destructive hover:text-destructive border-destructive/30">
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer ce produit ?</AlertDialogTitle>
          <AlertDialogDescription>"{nom}" sera définitivement supprimé du stock.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={() => deleteMut.mutate()} className="bg-destructive" disabled={deleteMut.isPending}>Supprimer</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ProductForm({ onSubmit, submitting }: { onSubmit: (v: StockProductForm) => Promise<void> | void; submitting?: boolean }) {
  const form = useForm<StockProductForm>({
    resolver: zodResolver(stockProductSchema) as any,
    defaultValues: { nom: "", type_gestion: "unite", unite: "unité", quantite: 0, seuil_alerte: 0, prix_achat_ht: 0 },
  });
  const typeGestion = form.watch("type_gestion");
  const uniteOptions = typeGestion === "volume" ? UNITES_VOLUME : UNITES_UNITE;

  // Reset unité quand on change le type
  function handleTypeChange(v: "unite" | "volume") {
    form.setValue("type_gestion", v);
    form.setValue("unite", v === "volume" ? "L" : "unité");
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
      <Field label="Nom du produit *" error={form.formState.errors.nom?.message}>
        <Input placeholder="Ex. Brodifacoum" {...form.register("nom")} />
      </Field>
      <Field label="Type de gestion">
        <div className="flex rounded-lg border border-border overflow-hidden">
          {(["unite", "volume"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => handleTypeChange(t)}
              className={cn(
                "flex-1 py-2 text-xs font-medium transition-colors",
                typeGestion === t
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              {t === "unite" ? "À l'unité" : "Liquide (volume)"}
            </button>
          ))}
        </div>
        {typeGestion === "volume" && (
          <p className="text-[10px] text-muted-foreground mt-1">Produits liquides/dilués — quantité en L ou ml</p>
        )}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Unité">
          <Select value={form.watch("unite")} onValueChange={(v) => form.setValue("unite", v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{uniteOptions.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Quantité actuelle">
          <Input type="number" step={typeGestion === "volume" ? "0.001" : "1"} min="0" {...form.register("quantite")} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Seuil d'alerte">
          <Input type="number" step={typeGestion === "volume" ? "0.001" : "1"} min="0" {...form.register("seuil_alerte")} />
        </Field>
        <Field label="Prix d'achat HT">
          <Input type="number" step="0.01" min="0" {...form.register("prix_achat_ht")} />
        </Field>
      </div>
      <DialogFooter><Button type="submit" className="w-full" disabled={submitting}>Ajouter</Button></DialogFooter>
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
