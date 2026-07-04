import { useQuery } from "@tanstack/react-query";
import { db } from "./db";

function localDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type Client = {
  id: string;
  user_id: string;
  raison_sociale: string;
  adresse_site: string;
  telephone: string;
  email: string;
  siret: string;
  siren?: string | null;
  rcs?: string | null;
  forme_juridique?: string | null;
  type_nuisible: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type Intervention = {
  id: string;
  user_id: string;
  client_id: string;
  contract_id?: string | null;
  date: string;
  adresse_site: string;
  type_nuisible: string;
  type_intervention: string;
  produits: string;
  quantite: string;
  observations: string;
  statut: string;
  date_prochain_passage: string | null;
  photos: string[] | null;
  signature_url: string | null;
  created_at: string;
  updated_at: string;
  client?: Client | null;
};

export type Contract = {
  id: string;
  user_id: string;
  client_id: string;
  numero?: string | null;
  nom_etablissement?: string | null;
  adresse_etablissement?: string | null;
  type_prestation?: string | null;
  frequence?: string | null;
  type_passage?: string | null;
  duree_mois?: number;
  ville_signature?: string | null;
  signature_url?: string | null;
  signature_at?: string | null;
  date_debut: string;
  date_fin: string;
  nb_passages_inclus: number;
  passages_realises: number;
  statut: string;
  notes: string;
  client?: Client | null;
};

export type InvoiceLine = {
  id: string;
  invoice_id: string;
  user_id: string;
  description: string;
  quantite: number;
  prix_unitaire_ht: number;
  total_ht: number;
  ordre: number;
};

export type Invoice = {
  id: string;
  user_id: string;
  client_id: string;
  intervention_id: string | null;
  numero: number;
  date_facture: string;
  echeance: string | null;
  adresse_site: string;
  statut: string;
  total_ht: number;
  tva: number;
  total_ttc: number;
  tva_taux: number;
  notes: string;
  client?: Client | null;
  lines?: InvoiceLine[];
};

export type Settings = {
  user_id: string;
  nom: string;
  adresse: string;
  siret: string;
  tva_number: string;
  telephone: string;
  email: string;
  iban: string;
  bic: string;
  next_invoice_number: number;
  objectif_ca_mensuel: number;
  logo_url?: string | null;
  nom_technicien?: string | null;
  numero_certibiocide?: string | null;
  relance_delai_n1?: number | null;
  relance_delai_n2?: number | null;
  relance_delai_n3?: number | null;
  relance_signature?: string | null;
};

export type Relance = {
  id: string;
  user_id: string;
  facture_id: string;
  niveau: 1 | 2 | 3;
  date_envoi: string;
  notes: string;
  created_at: string;
};

export function useRelances() {
  return useQuery({
    queryKey: ["relances"],
    queryFn: async (): Promise<Relance[]> => {
      const { data, error } = await db.from("relances").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({ ...r, niveau: Number(r.niveau) as 1 | 2 | 3 }));
    },
  });
}

export function useRelancesForInvoice(factureId: string | undefined) {
  return useQuery({
    queryKey: ["relances", factureId],
    enabled: !!factureId,
    queryFn: async (): Promise<Relance[]> => {
      const { data, error } = await db.from("relances").select("*").eq("facture_id", factureId!).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({ ...r, niveau: Number(r.niveau) as 1 | 2 | 3 }));
    },
  });
}

export type ProduitBiocide = {
  id: string;
  user_id: string;
  nom: string;
  numero_homologation: string;
  type: string;
  dose_habituelle: string;
  ordre: number;
};

export function useProduitsBiocides() {
  return useQuery({
    queryKey: ["produits_biocides"],
    queryFn: async (): Promise<ProduitBiocide[]> => {
      const { data, error } = await db.from("produits_biocides").select("*").order("ordre");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type QuoteLine = {
  id: string;
  devis_id: string;
  user_id: string;
  description: string;
  quantite: number;
  prix_unitaire_ht: number;
  total_ht: number;
  ordre: number;
};

export type Quote = {
  id: string;
  user_id: string;
  client_id: string;
  numero: string;
  date_devis: string;
  date_validite: string;
  statut: string;
  total_ht: number;
  tva: number;
  tva_taux: number;
  total_ttc: number;
  notes: string;
  created_at: string;
  updated_at: string;
  client?: Client | null;
  lines?: QuoteLine[];
};

export type Preset = {
  id: string;
  user_id: string;
  label: string;
  description: string;
  prix_unitaire_ht: number;
  ordre: number;
};

export type StockProduct = {
  id: string;
  user_id: string;
  nom: string;
  type_gestion: "unite" | "volume";
  unite: string;
  quantite: number;
  seuil_alerte: number;
  prix_achat_ht: number;
  created_at: string;
  updated_at: string;
};

export function useStockProducts() {
  return useQuery({
    queryKey: ["stock_products"],
    queryFn: async (): Promise<StockProduct[]> => {
      const { data, error } = await db.from("stock_products").select("*").order("nom");
      if (error) throw error;
      return (data ?? []).map((p: any) => ({
        ...p,
        type_gestion: p.type_gestion ?? "unite",
        quantite: Number(p.quantite),
        seuil_alerte: Number(p.seuil_alerte),
        prix_achat_ht: Number(p.prix_achat_ht),
      }));
    },
  });
}

export type ProductStat = {
  id: string;
  nom: string;
  unite: string;
  prix_achat_ht: number;
  total_qty: number;
  cout_total: number;
};

export function useProductStats() {
  return useQuery({
    queryKey: ["product_stats"],
    queryFn: async (): Promise<ProductStat[]> => {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const [stockRes, intRes] = await Promise.all([
        db.from("stock_products").select("id, nom, unite, prix_achat_ht"),
        db.from("interventions").select("produits_utilises, date").gte("date", since),
      ]);
      const stockMap = new Map<string, { nom: string; unite: string; prix: number }>();
      for (const p of stockRes.data ?? []) {
        stockMap.set(p.id, { nom: p.nom, unite: p.unite, prix: Number(p.prix_achat_ht) });
      }
      const totals = new Map<string, number>();
      for (const inv of intRes.data ?? []) {
        const items: Array<{ product_id: string; quantite: number }> = inv.produits_utilises ?? [];
        for (const item of items) {
          totals.set(item.product_id, (totals.get(item.product_id) ?? 0) + Number(item.quantite));
        }
      }
      const results: ProductStat[] = [];
      for (const [id, qty] of totals.entries()) {
        const p = stockMap.get(id);
        if (!p) continue;
        results.push({ id, nom: p.nom, unite: p.unite, prix_achat_ht: p.prix, total_qty: qty, cout_total: qty * p.prix });
      }
      return results.sort((a, b) => b.cout_total - a.cout_total);
    },
  });
}

export function useClients() {
  return useQuery({
    queryKey: ["clients"],
    queryFn: async (): Promise<Client[]> => {
      const { data, error } = await db.from("clients").select("*").order("raison_sociale");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useClient(id: string | undefined) {
  return useQuery({
    queryKey: ["client", id],
    enabled: !!id,
    queryFn: async (): Promise<Client | null> => {
      const { data, error } = await db.from("clients").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useInterventions(filters?: { client_id?: string; statut?: string; contract_id?: string }) {
  return useQuery({
    queryKey: ["interventions", filters],
    queryFn: async (): Promise<Intervention[]> => {
      let q = db.from("interventions").select("*, client:clients(*)").order("date", { ascending: false });
      if (filters?.client_id) q = q.eq("client_id", filters.client_id);
      if (filters?.statut) q = q.eq("statut", filters.statut);
      if (filters?.contract_id) q = q.eq("contract_id", filters.contract_id);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useIntervention(id: string | undefined) {
  return useQuery({
    queryKey: ["intervention", id],
    enabled: !!id,
    queryFn: async (): Promise<Intervention | null> => {
      const { data, error } = await db.from("interventions").select("*, client:clients(*)").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useContracts() {
  return useQuery({
    queryKey: ["contracts"],
    queryFn: async (): Promise<Contract[]> => {
      const { data, error } = await db.from("contracts").select("*, client:clients(*)").order("date_fin", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useContract(id: string | undefined) {
  return useQuery({
    queryKey: ["contract", id],
    enabled: !!id,
    queryFn: async (): Promise<Contract | null> => {
      const { data, error } = await db.from("contracts").select("*, client:clients(*)").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useInvoices() {
  return useQuery({
    queryKey: ["invoices"],
    queryFn: async (): Promise<Invoice[]> => {
      const { data, error } = await db.from("invoices").select("*, client:clients(*)").order("numero", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: ["invoice", id],
    enabled: !!id,
    queryFn: async (): Promise<Invoice | null> => {
      const { data: invoice, error } = await db.from("invoices").select("*, client:clients(*)").eq("id", id!).maybeSingle();
      if (error) throw error;
      if (!invoice) return null;
      const { data: lines, error: e2 } = await db.from("invoice_lines").select("*").eq("invoice_id", id!).order("ordre");
      if (e2) throw e2;
      return { ...invoice, lines: lines ?? [] };
    },
  });
}

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async (): Promise<Settings | null> => {
      const { data, error } = await db.from("company_settings").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function usePresets() {
  return useQuery({
    queryKey: ["presets"],
    queryFn: async (): Promise<Preset[]> => {
      const { data, error } = await db.from("service_presets").select("*").order("ordre");
      if (error) throw error;
      return data ?? [];
    },
  });
}


export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const _now = new Date();
      const today = localDate(_now);
      const monthStart = today.slice(0, 7) + "-01";
      const prevMonthStart = localDate(new Date(_now.getFullYear(), _now.getMonth() - 1, 1));
      const prevMonthEnd = localDate(new Date(_now.getFullYear(), _now.getMonth(), 0));

      const [todayRes, todayInterventions, monthRes, prevMonthRes, unpaidRes, contractsRes, stockRes] = await Promise.all([
        db.from("interventions").select("*", { count: "exact", head: true }).eq("date", today),
        db.from("interventions").select("*, client:clients(raison_sociale, telephone)").eq("date", today).order("created_at"),
        db.from("invoices").select("total_ttc, date_facture, statut").gte("date_facture", monthStart),
        db.from("invoices").select("total_ttc, statut").gte("date_facture", prevMonthStart).lte("date_facture", prevMonthEnd),
        db.from("invoices").select("id, total_ttc, statut, echeance, client:clients(raison_sociale)").in("statut", ["envoyee", "retard"]),
        db.from("contracts").select("*, client:clients(raison_sociale)").eq("statut", "actif"),
        db.from("stock_products").select("*"),
      ]);

      const ca = (monthRes.data ?? [])
        .filter((i: any) => ["payee", "envoyee", "retard"].includes(i.statut))
        .reduce((sum: number, i: any) => sum + Number(i.total_ttc ?? 0), 0);

      const caPrevMonth = (prevMonthRes.data ?? [])
        .filter((i: any) => ["payee", "envoyee", "retard"].includes(i.statut))
        .reduce((sum: number, i: any) => sum + Number(i.total_ttc ?? 0), 0);

      const impayes = unpaidRes.data ?? [];
      const impayesTotal = impayes.reduce((sum: number, i: any) => sum + Number(i.total_ttc ?? 0), 0);

      const now = new Date();
      const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const overdueInvoices = impayes
        .filter((i: any) => i.statut === "retard" && i.echeance)
        .map((i: any) => {
          const daysLate = Math.floor((now.getTime() - new Date(i.echeance + "T00:00:00").getTime()) / (1000 * 60 * 60 * 24));
          return { ...i, daysLate };
        })
        .filter((i: any) => i.daysLate > 7)
        .sort((a: any, b: any) => b.daysLate - a.daysLate);
      const expiringContracts = (contractsRes.data ?? [])
        .filter((c: any) => c.date_fin <= in30Days && c.date_fin >= today)
        .map((c: any) => ({ ...c, urgent: c.date_fin <= in7Days }));

      const stockAlerts = (stockRes.data ?? []).filter((p: any) => Number(p.quantite) <= Number(p.seuil_alerte));

      return {
        interventionsToday: todayRes.count ?? 0,
        todayInterventions: todayInterventions.data ?? [],
        caMonth: ca,
        caPrevMonth,
        unpaidCount: impayes.length,
        unpaidTotal: impayesTotal,
        overdueInvoices,
        expiringContracts,
        stockAlerts,
        lowStockCount: stockAlerts.length,
      };
    },
  });
}

export function useQuotes() {
  return useQuery({
    queryKey: ["devis"],
    queryFn: async (): Promise<Quote[]> => {
      const { data, error } = await db.from("devis").select("*, client:clients(*)").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((q: any) => ({
        ...q,
        total_ht: Number(q.total_ht),
        tva: Number(q.tva),
        tva_taux: Number(q.tva_taux),
        total_ttc: Number(q.total_ttc),
      }));
    },
  });
}

export function useQuote(id: string | undefined) {
  return useQuery({
    queryKey: ["devis", id],
    enabled: !!id,
    queryFn: async (): Promise<Quote | null> => {
      const { data: quote, error } = await db.from("devis").select("*, client:clients(*)").eq("id", id!).maybeSingle();
      if (error) throw error;
      if (!quote) return null;
      const { data: lines, error: e2 } = await db.from("devis_lines").select("*").eq("devis_id", id!).order("ordre");
      if (e2) throw e2;
      return {
        ...quote,
        total_ht: Number(quote.total_ht),
        tva: Number(quote.tva),
        tva_taux: Number(quote.tva_taux),
        total_ttc: Number(quote.total_ttc),
        lines: (lines ?? []).map((l: any) => ({
          ...l,
          quantite: Number(l.quantite),
          prix_unitaire_ht: Number(l.prix_unitaire_ht),
          total_ht: Number(l.total_ht),
        })),
      };
    },
  });
}

export function useMonthlyStats() {
  return useQuery({
    queryKey: ["monthly_stats"],
    queryFn: async () => {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const monthStart = today.slice(0, 7) + "-01";
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
      const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
      const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString().slice(0, 10);

      const [invoicesMonth, invoicesPrev, invoices12m, interventionsMonth, interventionsPrev, clientsMonth] = await Promise.all([
        db.from("invoices").select("total_ttc, statut").gte("date_facture", monthStart),
        db.from("invoices").select("total_ttc, statut").gte("date_facture", prevMonthStart).lte("date_facture", prevMonthEnd),
        db.from("invoices").select("total_ttc, statut, client_id, date_facture, client:clients(raison_sociale)").gte("date_facture", twelveMonthsAgo),
        db.from("interventions").select("id, statut").gte("date", monthStart).lte("date", today).eq("statut", "realisee"),
        db.from("interventions").select("id, statut").gte("date", prevMonthStart).lte("date", prevMonthEnd).eq("statut", "realisee"),
        db.from("clients").select("id", { count: "exact", head: true }).gte("created_at", monthStart),
      ]);

      const PAID = ["payee", "envoyee", "retard"];
      const caMonth = (invoicesMonth.data ?? []).filter((i: any) => PAID.includes(i.statut)).reduce((s: number, i: any) => s + Number(i.total_ttc ?? 0), 0);
      const caPrev = (invoicesPrev.data ?? []).filter((i: any) => PAID.includes(i.statut)).reduce((s: number, i: any) => s + Number(i.total_ttc ?? 0), 0);
      const caEvolution = caPrev === 0 ? null : ((caMonth - caPrev) / caPrev) * 100;

      const intMonth = (interventionsMonth.data ?? []).length;
      const intPrev = (interventionsPrev.data ?? []).length;

      // Top 5 clients by CA last 12 months
      const clientMap = new Map<string, { nom: string; ca: number }>();
      for (const inv of (invoices12m.data ?? [])) {
        if (!PAID.includes(inv.statut)) continue;
        const id = inv.client_id;
        const nom = (inv.client as any)?.raison_sociale ?? "—";
        const prev = clientMap.get(id) ?? { nom, ca: 0 };
        clientMap.set(id, { nom, ca: prev.ca + Number(inv.total_ttc ?? 0) });
      }
      const top5 = [...clientMap.entries()]
        .sort((a, b) => b[1].ca - a[1].ca)
        .slice(0, 5)
        .map(([id, v]) => ({ id, nom: v.nom, ca: v.ca }));

      // CA des 6 derniers mois (barres)
      const months6: { label: string; ca: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = d.toISOString().slice(0, 7);
        const label = d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
        const ca = (invoices12m.data ?? [])
          .filter((inv: any) => PAID.includes(inv.statut) && inv.date_facture?.startsWith(key))
          .reduce((s: number, inv: any) => s + Number(inv.total_ttc ?? 0), 0);
        months6.push({ label, ca });
      }

      return {
        caMonth,
        caPrev,
        caEvolution,
        intMonth,
        intPrev,
        top5,
        newClients: clientsMonth.count ?? 0,
        months6,
      };
    },
  });
}
