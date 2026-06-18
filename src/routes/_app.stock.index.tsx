import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
import { Plus, Minus, AlertTriangle, Package, Trash2 } from "lucide-react";
import { useStockProducts, type StockProduct } from "@/lib/queries";
import { stockProductSchema, type StockProductForm, UNITES_STOCK, formatEUR } from "@/lib/schemas";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";

export const Route = createFileRoute("/_app/stock/")({
  head: () => ({ meta: [{ title: "Stock — CITY DERAT" }] }),
  component: StockPage,
});

function StockPage() {
  const { data: products = [], isLoading } = useStockProducts();
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

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

      {isLoading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Chargement…</div>
      ) : products.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          <Package className="mx-auto mb-2 h-8 w-8 opacity-50" />
          Aucun produit en stock. Ajoutez votre premier produit.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {products.map((p) => <ProductRow key={p.id} product={p} />)}
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
              {low && (
                <span className="inline-flex items-center gap-1 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive-foreground">
                  <AlertTriangle className="h-3 w-3" /> Stock bas
                </span>
              )}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              <span className="font-medium text-foreground tabular-nums">{product.quantite}</span> {product.unite}
              <span className="mx-1.5 opacity-50">·</span>
              Seuil&nbsp;: <span className="tabular-nums">{product.seuil_alerte}</span>
              <span className="mx-1.5 opacity-50">·</span>
              {formatEUR(product.prix_achat_ht)} HT / {product.unite}
            </div>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <Button size="icon" variant="outline" className="h-9 w-9" onClick={() => prompt("out")} aria-label="Retirer du stock" disabled={adjustMut.isPending}>
              <Minus className="h-4 w-4" />
            </Button>
            <Button size="icon" className="h-9 w-9 bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => prompt("in")} aria-label="Ajouter au stock" disabled={adjustMut.isPending}>
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
        <Button size="icon" variant="outline" className="h-9 w-9 text-destructive hover:text-destructive border-destructive/30" aria-label="Supprimer le produit">
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer ce produit ?</AlertDialogTitle>
          <AlertDialogDescription>
            "{nom}" sera définitivement supprimé du stock. Cette action est irréversible.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={() => deleteMut.mutate()} className="bg-destructive" disabled={deleteMut.isPending}>
            Supprimer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ProductForm({ onSubmit, submitting }: { onSubmit: (v: StockProductForm) => Promise<void> | void; submitting?: boolean }) {
  const form = useForm<StockProductForm>({
    resolver: zodResolver(stockProductSchema) as any,
    defaultValues: { nom: "", unite: "unité", quantite: 0, seuil_alerte: 0, prix_achat_ht: 0 },
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
      <Field label="Nom du produit *" error={form.formState.errors.nom?.message}>
        <Input placeholder="Ex. Brodifacoum" {...form.register("nom")} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Unité">
          <Select value={form.watch("unite")} onValueChange={(v) => form.setValue("unite", v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {UNITES_STOCK.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Quantité actuelle">
          <Input type="number" step="0.01" min="0" {...form.register("quantite")} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Seuil d'alerte">
          <Input type="number" step="0.01" min="0" {...form.register("seuil_alerte")} />
        </Field>
        <Field label="Prix d'achat HT">
          <Input type="number" step="0.01" min="0" {...form.register("prix_achat_ht")} />
        </Field>
      </div>
      <DialogFooter>
        <Button type="submit" className="w-full" disabled={submitting}>Ajouter</Button>
      </DialogFooter>
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
