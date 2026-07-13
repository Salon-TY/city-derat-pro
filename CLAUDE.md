# CLAUDE.md — city-derat-pro (état du projet & conventions)

> Document de contexte pour Claude Code. À la racine du repo, il est lu automatiquement à chaque session. Tenir à jour au fil des évolutions.

## Le projet

App de gestion pour un dératiseur indépendant (CITY DERAT). Déjà en production.
- **Repo GitHub** : github.com/Salon-TY/city-derat-pro — push sur `main` → **Netlify redéploie automatiquement**.
- **Netlify** : derat-pro.netlify.app
- **Supabase** : projet `dawwepdqqzrdyyadhmtw`
- **Stack** : TanStack Start + React + shadcn/ui + Supabase + Netlify.

## Conventions NON négociables

- **RÈGLE PERMANENTE — permissions par module** : tout nouveau module doit venir avec sa propre case à cocher dans les permissions (`src/lib/permissions.ts` → `PermissionKey` + `PERMISSION_LABELS`), filtré dans la nav via `useMyAccess().can(...)`, protégé par `PermissionGate`, et cochable individuellement depuis la page Équipe. Ne jamais coder en dur "le bureau peut X, le technicien peut Y" : c'est le propriétaire qui coche, employé par employé.
- **bun** uniquement (jamais npm). Build : `bun run build`. Publish dir : `dist/client`.
- **`src/routeTree.gen.ts` est géré À LA MAIN** (le plugin TanStack Router ne le génère pas ici). Toute nouvelle route doit y être ajoutée manuellement, sinon build/route cassés.
- **`src/integrations/supabase/types.ts` est géré À LA MAIN** — mettre à jour à chaque changement de schéma DB.
- Buckets Supabase Storage **publics et déjà existants** : `company-logos`, `intervention-photos`, `intervention-signatures`. Ne jamais rajouter de vérification d'existence de bucket (cf. `photos.ts` : pas de `ensureBucket`/`listBuckets`).
- **Fonctions serveur** (créer/gérer des comptes) : utiliser le pattern existant `requireSupabaseAuth` (middleware, donne `context.userId` + `context.supabase`) + `attachSupabaseAuth` (attache le token, global dans `src/start.ts`). Le client **service-role** doit rester **côté serveur** : l'importer dynamiquement depuis `src/integrations/supabase/client.server.ts` DANS le handler (jamais au niveau module d'un `.functions.ts`, sinon la clé/surface admin fuit dans le bundle navigateur).
- **Variables Netlify (serveur)** : `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`. La service-role ne doit jamais être exposée au client ni préfixée `VITE_`.
- Vert de marque : `#1a3c2e`. Accent devis : orange `#f97316`.
- Les migrations SQL sont exécutées manuellement dans **Supabase > SQL Editor** (pas de `supabase db push` câblé).

## Architecture base de données — multi-comptes (partage patron ↔ employés)

Le modèle : chaque donnée appartient à un **compte** (le patron), pas à un utilisateur isolé. Patron et employés d'un même compte voient/gèrent les mêmes données.

- **Fonctions SQL** :
  - `account_owner()` → l'id du compte patron de l'utilisateur courant (patron → son id ; employé actif → id du patron ; sinon son id).
  - `current_user_role()` → `'owner'` | `'employe'` | `'disabled'`.
  - `set_account_owner()` → trigger BEFORE INSERT sur toutes les tables de données : force `user_id = account_owner()` **seulement si non-null** (sinon laisse la valeur — indispensable pour ne pas casser `handle_new_user`).
- **RLS** des tables de données (`clients, contracts, interventions, invoices, invoice_lines, service_presets, stock_products, stock_levels, stock_movements, stock_requests`) : `USING/WITH CHECK (user_id = account_owner())`. `company_settings` : lecture pour tout le compte, écriture **owner uniquement**.
- **`team_members`** : `id, owner_id, user_id, email, role ('owner'|'employe'), active, username, display_name, poste ('bureau'|'technicien'), permissions (jsonb), created_at`. RLS : le patron gère son équipe (`owner_id = auth.uid()`), le membre lit sa propre ligne (`user_id = auth.uid()`).
- **`handle_new_user()`** (trigger sur `auth.users`) : à chaque création d'utilisateur, insère une ligne `company_settings` + des `service_presets` par défaut. (Les employés créés récupèrent des lignes orphelines invisibles — sans conséquence.)

## Fonctionnalités déjà construites (chronologie)

1. **Fix upload** (`src/lib/photos.ts`) : upload direct sans `ensureBucket`, vraie erreur Supabase affichée.
2. **PDF format A4 homogène** : helper partagé `src/lib/print.ts` (`printDocument({title, bodyHtml, css})`, aperçu **éditable** avant génération (`contenteditable`, barre d'outils masquée à l'impression, bouton "Générer le PDF" → `window.print()`), `@page { size:A4; margin:14mm 15mm }`, `print-color-adjust:exact`. Utilisé par les 5 générateurs (devis, rapport intervention, certificat biocide, facture, contrat).
3. **Module Contrats** : `contracts.numero` = `CT-YYYY-NNN` généré à la création, **éditable en format libre** (unicité garantie par index `(user_id, numero)`, message clair sur violation `23505`) ; champs légaux client (`siren, rcs, forme_juridique`) ; PDF fidèle au modèle ; signature tactile ; email ; lien interventions (`interventions.contract_id`).
4. **Multi-utilisateurs** :
   - Création de comptes employés via la fonction serveur `createEmployee` (+ `resetEmployeePassword`, `setEmployeeActive`, `deleteEmployee`) dans `src/lib/api/team.functions.ts`.
   - **Connexion par identifiant** : email interne synthétique `username@team.cityderat.local` (`src/lib/team.ts` : `usernameToEmail`, `USERNAME_RE`). Page `auth.tsx` : champ « identifiant ou email » (si `@` → email sinon suffixe), **inscription publique retirée**.
   - **Permissions par page** (`src/lib/permissions.ts`) : `PermissionKey`, `PERMISSION_LABELS`, presets `PRESET_BUREAU`/`PRESET_TECHNICIEN`. Terrain toujours visible ; Équipe owner-only. Défaut : tout bloqué.
   - Page **Équipe** (`_app.equipe.index.tsx`, owner-only) : créer/reset/activer-désactiver/supprimer + éditeur d'autorisations + poste.
   - Garde de route : `src/components/permission-gate.tsx` (redirige vers `/interventions` si non autorisé).
5. **Opérations technicien** :
   - `interventions.technicien_id` (assignation). Roster : `useAssignableMembers()` (owner + `poste='technicien'`). Composant partagé `src/components/signature-canvas.tsx` et `TechnicianSelect` (« Moi » épinglé, techniciens seulement).
   - **Stock à deux niveaux** : `stock_products` = catalogue ; `stock_levels (product_id, technicien_id NULL=garage, quantite)` = quantités par emplacement ; `stock_movements` = historique (`entree|transfert|consommation|ajustement`). Déduction sur le camion du technicien assigné. Page Stock role/poste-aware (patron **ou bureau** = vue d'ensemble + réappro ; technicien = « Mon camion » + demandes de réappro). Dashboard + export Excel recâblés sur `stock_levels`.
   - **Stats par technicien** (`useTechnicianStats`) : nb interventions, CA (via facture→intervention→technicien, bucket « Non attribué »), valeur consommée, répartition nuisibles.
6. **Navigation** : Stock dans la barre principale ; menu « Plus » affiché seulement s'il reste des onglets (disparaît quand vide).
7. **Workflow terrain (Phase 5.2-A)** : statuts `planifiee`=À faire, `en_cours`=En cours, `realisee`=Terminée, `rapport_transmis`=Vérifiée, `annulee`. Le technicien ne voit/édite QUE ses interventions (verrou UI via `useMyPoste()`) ; carte de workflow (Démarrer → Terminer) ; file **« À vérifier »** admin (`realisee`) + widget dashboard ; **« Valider et envoyer le rapport »** (→`rapport_transmis` + email client) ; **« Renvoyer au technicien »** (→`en_cours`, note stockée à part dans `retour_admin`, jamais dans `observations`/le PDF).
8. **Temps passé + historique du site (Phase 5.2-B)** : `interventions.heure_debut`/`heure_fin` posés automatiquement par le workflow (Démarrer/Terminer), corrigibles à la main par owner/bureau, durée affichée + dans le rapport PDF. Panneau « Historique du site » (`useSiteHistory`) listant les interventions précédentes à la même adresse.
9. **Cloisonnement des permissions (Phase 6-A)** : recherche globale, dashboard et FAB de création rapide filtrent désormais leurs résultats/sections via `useMyAccess().can(...)` (auparavant ces trois surfaces bypassaient le système de permissions et fuitaient des données).
10. **Flux admin ↔ technicien (Phase 6-B)** :
    - Formulaire d'intervention scindé : création (`_app.interventions.new.tsx`) = **planification uniquement** (client, adresse, date, type, technicien, contrat, consignes) ; le compte-rendu (observations, produits, photos, signature) est saisi **par la personne assignée** depuis la page détail, une fois le chantier démarré.
    - `interventions.consignes` (notes de planification, éditable owner/bureau, lecture seule technicien) et `interventions.retour_admin` (note de renvoi, bannière dédiée, jamais dans le PDF/email, effacée à la re-soumission).
    - **Demandes de réappro** (`stock_requests`, permission `reappro`) : un technicien à court de stock demande depuis « Mon camion » ; la page `/reappro` (owner + `can("reappro")`) sert/refuse la demande (transfert garage→camion réutilisé).
    - Pastille « à faire » pour le technicien (interventions `planifiee` qui lui sont assignées), sur l'onglet Terrain et sur l'Accueil.

## Hooks & fichiers clés

- `src/lib/queries.ts` : `useCurrentRole`, `useMyAccess`, `useMyPoste`, `useTeamMembers`, `useAssignableMembers`, `useTechnicianWorkload`, `useStockLevels`, `useMyVanStock`, `useStockMovements`/`useMyVanMovements`, `logStockMovement`, `useTechnicianStats`, `useDashboardStats` (dont `toVerifyCount`), `useSiteHistory`, `useStockRequests`/`useMyStockRequests`, `getGarageLevel`/`getVanLevel`, `resolveTechnicianName`.
- `src/lib/` : `print.ts`, `team.ts`, `permissions.ts`, `schemas.ts` (dont `STATUTS_INTERVENTION`, `TYPES_PASSAGE`).
- `src/components/` : `app-shell.tsx` (nav), `permission-gate.tsx`, `signature-canvas.tsx`, `intervention-form.tsx` (mode `planification` | `compte-rendu`, contient `TechnicianSelect`).
- `src/lib/api/team.functions.ts` : fonctions serveur de gestion des comptes.

## Méthode de travail

Un assistant « planificateur » (côté chat) produit : (a) le SQL à exécuter dans Supabase, (b) des prompts précis pour Claude Code. Claude Code applique dans le repo, build avec bun, commit, push → Netlify déploie. Claude Code ne peut pas cliquer dans l'app en live : vérification via `bun run build`, puis test manuel par l'utilisateur.

## En cours / à venir

- **Plus tard (phase à part)** : génération automatique des interventions récurrentes depuis les contrats (« 1 passage hebdomadaire » → passages créés et prêts à assigner).
- **Idées parkées** (surdimensionnées pour l'instant) : mode hors-ligne, notifications push/email, portail client, géoloc/tournée, SMS, satisfaction client.
