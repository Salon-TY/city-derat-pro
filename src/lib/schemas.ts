import { z } from "zod";

export const TYPES_NUISIBLES = [
  "Rats",
  "Souris",
  "Cafards",
  "Blattes",
  "Pigeons",
  "Frelons",
  "Punaises de lit",
  "Autres",
] as const;

export const TYPES_INTERVENTION = [
  "Dératisation",
  "Désinsectisation",
  "Les deux",
] as const;

export const STATUTS_INTERVENTION = [
  { value: "planifiee", label: "Planifiée" },
  { value: "realisee", label: "Réalisée" },
  { value: "rapport_transmis", label: "Rapport transmis" },
  { value: "annulee", label: "Annulée" },
] as const;

export const STATUTS_CONTRAT = [
  { value: "actif", label: "Actif" },
  { value: "termine", label: "Terminé" },
  { value: "attente", label: "En attente" },
] as const;

export const STATUTS_FACTURE = [
  { value: "brouillon", label: "Brouillon" },
  { value: "envoyee", label: "Envoyée" },
  { value: "payee", label: "Payée" },
  { value: "retard", label: "En retard" },
] as const;

export const clientSchema = z.object({
  raison_sociale: z.string().trim().min(1, "Requis").max(200),
  adresse_site: z.string().max(500).default(""),
  telephone: z.string().max(50).default(""),
  email: z.string().email("Email invalide").min(1, "Email requis pour l'envoi des rapports"),
  siret: z.string().max(50).default(""),
  type_nuisible: z.string().max(100).default(""),
  notes: z.string().max(2000).default(""),
});
export type ClientForm = z.infer<typeof clientSchema>;

export const interventionSchema = z.object({
  client_id: z.string().uuid("Client requis"),
  date: z.string().min(1, "Date requise"),
  adresse_site: z.string().max(500).default(""),
  type_nuisible: z.string().max(100).default(""),
  type_intervention: z.enum(TYPES_INTERVENTION),
  produits: z.string().max(500).default(""),
  quantite: z.string().max(100).default(""),
  observations: z.string().max(2000).default(""),
  statut: z.string().default("planifiee"),
  date_prochain_passage: z.string().optional().nullable(),
});
export type InterventionForm = z.infer<typeof interventionSchema>;

export const contractSchema = z.object({
  client_id: z.string().uuid("Client requis"),
  date_debut: z.string().min(1, "Requis"),
  date_fin: z.string().min(1, "Requis"),
  nb_passages_inclus: z.coerce.number().int().min(1).max(52),
  passages_realises: z.coerce.number().int().min(0).max(100),
  statut: z.string().default("actif"),
  notes: z.string().max(2000).default(""),
});
export type ContractForm = z.infer<typeof contractSchema>;

export const invoiceLineSchema = z.object({
  description: z.string().trim().min(1, "Description requise").max(500),
  quantite: z.coerce.number().min(0).max(10000),
  prix_unitaire_ht: z.coerce.number().min(0).max(1000000),
});
export type InvoiceLineForm = z.infer<typeof invoiceLineSchema>;

export const invoiceSchema = z.object({
  client_id: z.string().uuid("Client requis"),
  date_facture: z.string().min(1, "Requis"),
  echeance: z.string().optional().nullable(),
  adresse_site: z.string().max(500).default(""),
  statut: z.string().default("brouillon"),
  tva_taux: z.coerce.number().min(0).max(100).default(20),
  notes: z.string().max(2000).default(""),
  lines: z.array(invoiceLineSchema).min(1, "Au moins une ligne"),
});
export type InvoiceForm = z.infer<typeof invoiceSchema>;

export const settingsSchema = z.object({
  nom: z.string().trim().min(1, "Requis").max(200),
  adresse: z.string().max(500).default(""),
  siret: z.string().max(50).default(""),
  tva_number: z.string().max(50).default(""),
  telephone: z.string().max(50).default(""),
  email: z.string().email("Email invalide").or(z.literal("")).default(""),
  iban: z.string().max(50).default(""),
  bic: z.string().max(50).default(""),
  objectif_ca_mensuel: z.coerce.number().min(0).max(10000000).default(3000),
});
export type SettingsForm = z.infer<typeof settingsSchema>;

export const STATUTS_DEVIS = [
  { value: "brouillon", label: "Brouillon" },
  { value: "envoye", label: "Envoyé" },
  { value: "accepte", label: "Accepté" },
  { value: "refuse", label: "Refusé" },
  { value: "converti", label: "Converti" },
] as const;

export const quoteLineSchema = z.object({
  description: z.string().trim().min(1, "Description requise").max(500),
  quantite: z.coerce.number().min(0).max(10000),
  prix_unitaire_ht: z.coerce.number().min(0).max(1000000),
});
export type QuoteLineForm = z.infer<typeof quoteLineSchema>;

export const quoteSchema = z.object({
  client_id: z.string().uuid("Client requis"),
  date_devis: z.string().min(1, "Requis"),
  date_validite: z.string().min(1, "Requis"),
  statut: z.string().default("brouillon"),
  tva_taux: z.coerce.number().min(0).max(100).default(20),
  notes: z.string().max(2000).default(""),
  lines: z.array(quoteLineSchema).min(1, "Au moins une ligne"),
});
export type QuoteForm = z.infer<typeof quoteSchema>;

export const UNITES_STOCK = ["kg", "L", "ml", "boîte", "unité", "sachet"] as const;
export const UNITES_VOLUME = ["L", "ml"] as const;
export const UNITES_UNITE = ["kg", "boîte", "unité", "sachet"] as const;

export const stockProductSchema = z.object({
  nom: z.string().trim().min(1, "Requis").max(200),
  type_gestion: z.enum(["unite", "volume"]).default("unite"),
  unite: z.enum(UNITES_STOCK).default("unité"),
  quantite: z.coerce.number().min(0).max(1000000).default(0),
  seuil_alerte: z.coerce.number().min(0).max(1000000).default(0),
  prix_achat_ht: z.coerce.number().min(0).max(1000000).default(0),
});
export type StockProductForm = z.infer<typeof stockProductSchema>;

export function formatEUR(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v);
}

export function formatDateFR(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("fr-FR");
}
