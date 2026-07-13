export type PermissionKey =
  | "accueil" | "clients" | "devis" | "contrats" | "factures"
  | "stock" | "reappro" | "tresorerie" | "stats" | "parametres" | "export";

// Ordre d'affichage + libellés dans l'éditeur d'autorisations
export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  accueil:    "Accueil / Tableau de bord",
  clients:    "Clients",
  devis:      "Devis",
  contrats:   "Contrats",
  factures:   "Factures",
  stock:      "Stock",
  reappro:    "Demandes de réappro",
  tresorerie: "Trésorerie",
  stats:      "Statistiques",
  parametres: "Paramètres",
  export:     "Export Excel",
};

export const ALL_PERMISSION_KEYS = Object.keys(PERMISSION_LABELS) as PermissionKey[];

// Modèle rapide (point de départ ; le patron ajuste ensuite les cases).
// Les techniciens n'ont pas de preset : ils utilisent l'interface dédiée
// /tech/* et ces autorisations ne s'appliquent qu'au poste bureau.
export const PRESET_BUREAU: PermissionKey[] = ["accueil", "clients", "devis", "contrats", "factures", "reappro"];

export function presetToPermissions(keys: PermissionKey[]): Record<string, boolean> {
  return Object.fromEntries(ALL_PERMISSION_KEYS.map((k) => [k, keys.includes(k)]));
}
