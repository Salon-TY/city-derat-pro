import { useQuery } from "@tanstack/react-query";
import { db } from "./db";

export type Client = {
  id: string;
  user_id: string;
  raison_sociale: string;
  adresse_site: string;
  telephone: string;
  email: string;
  siret: string;
  type_nuisible: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type Intervention = {
  id: string;
  user_id: string;
  client_id: string;
  date: string;
  adresse_site: string;
  type_nuisible: string;
  type_intervention: string;
  produits: string;
  quantite: string;
  observations: string;
  statut: string;
  date_prochain_passage: string | null;
  created_at: string;
  updated_at: string;
  client?: Client | null;
};

export type Contract = {
  id: string;
  user_id: string;
  client_id: string;
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
};

export type Preset = {
  id: string;
  user_id: string;
  label: string;
  description: string;
  prix_unitaire_ht: number;
  ordre: number;
};

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

export function useInterventions(filters?: { client_id?: string; statut?: string }) {
  return useQuery({
    queryKey: ["interventions", filters],
    queryFn: async (): Promise<Intervention[]> => {
      let q = db.from("interventions").select("*, client:clients(*)").order("date", { ascending: false });
      if (filters?.client_id) q = q.eq("client_id", filters.client_id);
      if (filters?.statut) q = q.eq("statut", filters.statut);
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
      const today = new Date().toISOString().slice(0, 10);
      const monthStart = today.slice(0, 7) + "-01";

      const [todayRes, monthRes, unpaidRes] = await Promise.all([
        db.from("interventions").select("*", { count: "exact", head: true }).eq("date", today),
        db.from("invoices").select("total_ttc, date_facture, statut").gte("date_facture", monthStart),
        db.from("invoices").select("id, total_ttc, statut").in("statut", ["envoyee", "retard"]),
      ]);

      const ca = (monthRes.data ?? [])
        .filter((i: any) => ["payee", "envoyee", "retard"].includes(i.statut))
        .reduce((sum: number, i: any) => sum + Number(i.total_ttc ?? 0), 0);

      const impayes = unpaidRes.data ?? [];
      const impayesTotal = impayes.reduce((sum: number, i: any) => sum + Number(i.total_ttc ?? 0), 0);

      return {
        interventionsToday: todayRes.count ?? 0,
        caMonth: ca,
        unpaidCount: impayes.length,
        unpaidTotal: impayesTotal,
      };
    },
  });
}
