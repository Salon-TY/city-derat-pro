import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Client = Database["public"]["Tables"]["clients"]["Row"];
type Intervention = Database["public"]["Tables"]["interventions"]["Row"];
type Invoice = Database["public"]["Tables"]["invoices"]["Row"];
type Contract = Database["public"]["Tables"]["contracts"]["Row"];
type Settings = Database["public"]["Tables"]["company_settings"]["Row"];
type Preset = Database["public"]["Tables"]["service_presets"]["Row"];
type InvoiceLine = Database["public"]["Tables"]["invoice_lines"]["Row"];

export function useClients() {
  return useQuery({
    queryKey: ["clients"],
    queryFn: async (): Promise<Client[]> => {
      const { data, error } = await supabase.from("clients").select("*").order("raison_sociale");
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
      const { data, error } = await supabase.from("clients").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useInterventions(filters?: { client_id?: string; statut?: string }) {
  return useQuery({
    queryKey: ["interventions", filters],
    queryFn: async (): Promise<(Intervention & { client?: Client | null })[]> => {
      let q = supabase.from("interventions").select("*, client:clients(*)").order("date", { ascending: false });
      if (filters?.client_id) q = q.eq("client_id", filters.client_id);
      if (filters?.statut) q = q.eq("statut", filters.statut);
      const { data, error } = await q;
      if (error) throw error;
      return (data as any) ?? [];
    },
  });
}

export function useIntervention(id: string | undefined) {
  return useQuery({
    queryKey: ["intervention", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("interventions").select("*, client:clients(*)").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useContracts() {
  return useQuery({
    queryKey: ["contracts"],
    queryFn: async (): Promise<(Contract & { client?: Client | null })[]> => {
      const { data, error } = await supabase
        .from("contracts").select("*, client:clients(*)").order("date_fin", { ascending: true });
      if (error) throw error;
      return (data as any) ?? [];
    },
  });
}

export function useContract(id: string | undefined) {
  return useQuery({
    queryKey: ["contract", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts").select("*, client:clients(*)").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useInvoices() {
  return useQuery({
    queryKey: ["invoices"],
    queryFn: async (): Promise<(Invoice & { client?: Client | null })[]> => {
      const { data, error } = await supabase
        .from("invoices").select("*, client:clients(*)").order("numero", { ascending: false });
      if (error) throw error;
      return (data as any) ?? [];
    },
  });
}

export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: ["invoice", id],
    enabled: !!id,
    queryFn: async () => {
      const { data: invoice, error } = await supabase
        .from("invoices").select("*, client:clients(*)").eq("id", id!).maybeSingle();
      if (error) throw error;
      if (!invoice) return null;
      const { data: lines, error: e2 } = await supabase
        .from("invoice_lines").select("*").eq("invoice_id", id!).order("ordre");
      if (e2) throw e2;
      return { ...invoice, lines: (lines as InvoiceLine[]) ?? [] };
    },
  });
}

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async (): Promise<Settings | null> => {
      const { data, error } = await supabase.from("company_settings").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function usePresets() {
  return useQuery({
    queryKey: ["presets"],
    queryFn: async (): Promise<Preset[]> => {
      const { data, error } = await supabase.from("service_presets").select("*").order("ordre");
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

      const [{ count: todayCount }, { data: monthInvoices }, { data: unpaidInvoices }] = await Promise.all([
        supabase.from("interventions").select("*", { count: "exact", head: true }).eq("date", today),
        supabase.from("invoices").select("total_ttc, date_facture, statut").gte("date_facture", monthStart),
        supabase.from("invoices").select("id, total_ttc, statut").in("statut", ["envoyee", "retard"]),
      ]);

      const ca = (monthInvoices ?? [])
        .filter((i: any) => i.statut === "payee" || i.statut === "envoyee" || i.statut === "retard")
        .reduce((sum: number, i: any) => sum + Number(i.total_ttc ?? 0), 0);

      const impayes = (unpaidInvoices ?? []);
      const impayesTotal = impayes.reduce((sum: number, i: any) => sum + Number(i.total_ttc ?? 0), 0);

      return {
        interventionsToday: todayCount ?? 0,
        caMonth: ca,
        unpaidCount: impayes.length,
        unpaidTotal: impayesTotal,
      };
    },
  });
}
