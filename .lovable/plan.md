## CITY DERAT — Plan de construction

App PWA mobile-first en français pour technicien dératiseur indépendant. Thème vert foncé (#1a3c2e) + blanc, accent orange (#f97316).

### Stack
- TanStack Start (déjà en place)
- Lovable Cloud (Supabase) pour DB + auth email/mot de passe (utilisateur unique)
- PWA installable (manifest + service worker via vite-plugin-pwa)
- shadcn/ui + Tailwind v4
- jsPDF (ou pdf-lib) pour export PDF factures

### Base de données (Supabase)
Tables (toutes liées à `user_id = auth.uid()` avec RLS) :
- `company_settings` — infos société (nom, adresse, SIRET, TVA, tél, IBAN, BIC)
- `clients` — raison_sociale, adresse_site, tel, email, siret, type_nuisible, notes
- `contracts` — client_id, date_debut, date_fin, nb_passages_inclus, passages_realises, statut
- `interventions` — client_id, date, adresse_site, type_nuisible, type_intervention, produits, quantite, observations, statut, date_prochain_passage
- `invoices` — numero (auto), client_id, date, echeance, adresse_site, statut, totaux
- `invoice_lines` — invoice_id, description, quantite, prix_unitaire_ht
- `service_presets` — prestations fréquentes pré-enregistrées (seed)

Numérotation auto factures via séquence Postgres par utilisateur.

### Modules / écrans
1. **Auth** — `/auth` connexion email/mdp
2. **Tableau de bord** `/` — KPI du jour/mois, factures impayées, boutons d'action
3. **Clients** `/clients`, `/clients/new`, `/clients/$id` — liste avec recherche, fiche détaillée + historique interventions + contrat actif
4. **Interventions** `/interventions` — liste filtrable par statut + vue calendrier mensuelle, `/interventions/new`, `/interventions/$id`
5. **Contrats** `/contrats` — liste + alerte expiration < 30j, `/contrats/$id`
6. **Factures** `/factures` — liste, création, édition, export PDF avec mise en page CITY DERAT (logo/coordonnées, tableau, totaux HT/TVA 20%/TTC, RIB, mention légale)
7. **Paramètres** `/parametres` — société + coordonnées bancaires

### Navigation
- Bottom nav (5 icônes) : Tableau de bord, Clients, Interventions, Factures, Contrats
- Lien Paramètres dans l'en-tête / menu

### PWA
- `manifest.webmanifest` (nom, icônes, theme color vert)
- Service worker via `vite-plugin-pwa` (NetworkFirst pour les pages, désactivé en preview Lovable)
- Installable sur Android

### Détails techniques (section technique)
- Server functions (`createServerFn` + `requireSupabaseAuth`) pour mutations sensibles, lecture directe via client Supabase pour le reste
- Génération PDF côté client avec jsPDF
- Validation Zod sur tous les formulaires
- Tous les `GRANT` sur tables publiques + RLS scopée à `auth.uid()`
- Numéro de facture : séquence Postgres + fonction RPC `next_invoice_number()`

### Ordre de livraison
1. Activer Lovable Cloud + migrations DB (tables, RLS, grants, seed presets)
2. Auth + layout (bottom nav, header, thème)
3. Paramètres société (nécessaire pour factures)
4. Clients (CRUD + recherche)
5. Interventions (CRUD + calendrier)
6. Contrats (CRUD + alertes)
7. Factures (CRUD + PDF)
8. Tableau de bord (agrégations)
9. PWA (manifest + SW)

Confirmez et je commence par l'activation Lovable Cloud + le schéma.