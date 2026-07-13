# CLAUDE.md — city-derat-pro (état du projet & conventions)

> Document de contexte pour Claude Code. À la racine du repo, il est lu automatiquement à chaque session. Tenir à jour au fil des évolutions.

## Le projet

App de gestion pour un dératiseur indépendant (CITY DERAT). Déjà en production.
- **Repo GitHub** : github.com/Salon-TY/city-derat-pro — push sur `main` → **Netlify redéploie automatiquement**.
- **Netlify** : derat-pro.netlify.app
- **Supabase** : projet `dawwepdqqzrdyyadhmtw`
- **Stack** : TanStack Start + React + shadcn/ui + Supabase + Netlify.

## Conventions NON négociables

- **RÈGLE STRUCTURELLE — séparation des interfaces.** Les techniciens (`poste === 'technicien'`, non-owner) utilisent **exclusivement** les routes `/tech/*` et le `TechShell` (`src/components/tech-shell.tsx`). Ils ne doivent **jamais** rendre un composant ou une route `_app.*` — `src/routes/_app.tsx` les redirige vers `/tech` avant même de monter `AppShell`, et `src/routes/tech.tsx` redirige symétriquement tout non-technicien vers `/`. Toute nouvelle fonctionnalité admin est donc invisible pour eux par construction : **ne jamais compter sur un masquage par `can(...)` ou un `if (isTechnician)` pour protéger un technicien** — il faut que la page/le composant n'existe tout simplement pas dans son arbre de rendu. Les employés **bureau** restent, eux, sur l'interface admin filtrée par les permissions cochables (règle suivante). L'owner garde l'interface admin complète (y compris le bloc compte-rendu) puisqu'il peut s'auto-assigner un chantier.
- **RÈGLE PERMANENTE — permissions par module** : tout nouveau module **admin** (bureau/owner) doit venir avec sa propre case à cocher dans les permissions (`src/lib/permissions.ts` → `PermissionKey` + `PERMISSION_LABELS`), filtré dans la nav via `useMyAccess().can(...)`, protégé par `PermissionGate`, et cochable individuellement depuis la page Équipe (uniquement affiché/actif pour les membres poste **bureau** — pour un technicien, la page Équipe affiche une note et désactive les cases). Ne jamais coder en dur "le bureau peut X" : c'est le propriétaire qui coche, employé par employé. (Ceci ne concerne pas les techniciens, cf. règle structurelle ci-dessus.)
- **bun** uniquement (jamais npm). Build : `bun run build`. Publish dir : `dist/client`.
- **`src/routeTree.gen.ts` est géré À LA MAIN** (le plugin TanStack Router ne le génère pas ici, mais **il valide quand même l'unicité des chemins par convention de nommage des fichiers** à chaque `bun run build`/`bun run dev` — indépendamment du contenu manuel de `routeTree.gen.ts`). Toute nouvelle route doit y être ajoutée manuellement, sinon build/route cassés. **Piège connu** : un fichier `_prefix.xxx.tsx` (préfixe underscore) est TOUJOURS traité comme pathless par le validateur, même si `routeTree.gen.ts` lui assigne manuellement un `path` réel — deux préfixes pathless différents (`_app`, `_tech`…) dont un enfant `.index.tsx` visent tous deux `/` provoquent un échec de build ("Conflicting configuration paths"). C'est pourquoi les routes technicien sont nommées `tech.*.tsx` (sans underscore) et pas `_tech.*.tsx` : `tech.tsx` + `tech.index.tsx` etc. sont un layout normal (segment réel "/tech"), pas un layout pathless.
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
   - **Permissions par page** (`src/lib/permissions.ts`) : `PermissionKey`, `PERMISSION_LABELS`, preset `PRESET_BUREAU`. Terrain toujours visible ; Équipe owner-only. Défaut : tout bloqué. Ne s'applique qu'au poste **bureau** (le technicien a sa propre interface, cf. règle structurelle).
   - Page **Équipe** (`_app.equipe.index.tsx`, owner-only) : créer/reset/activer-désactiver/supprimer + éditeur d'autorisations (désactivé avec une note explicative si `poste === 'technicien'`) + poste.
   - Garde de route : `src/components/permission-gate.tsx` (redirige vers `/interventions` si non autorisé) — pour le bureau ; pour un technicien qui taperait une URL admin à la main, c'est la garde de `_app.tsx` qui agit en amont (redirection vers `/tech`).
5. **Opérations technicien** :
   - `interventions.technicien_id` (assignation). Roster : `useAssignableMembers()` (owner + `poste='technicien'`). Composant partagé `src/components/signature-canvas.tsx` et `TechnicianSelect` (« Moi » épinglé, techniciens seulement).
   - **Stock à deux niveaux** : `stock_products` = catalogue ; `stock_levels (product_id, technicien_id NULL=garage, quantite)` = quantités par emplacement ; `stock_movements` = historique (`entree|transfert|consommation|ajustement`). Déduction sur le camion du technicien assigné. `_app.stock.index.tsx` = vue d'ensemble owner/bureau uniquement (garage + tous les camions, entrées, réappro) ; la vue camion d'un technicien vit exclusivement dans `/tech/camion`. Dashboard + export Excel recâblés sur `stock_levels`.
   - **Stats par technicien** (`useTechnicianStats`) : nb interventions, CA (via facture→intervention→technicien, bucket « Non attribué »), valeur consommée, répartition nuisibles.
6. **Navigation admin** : Stock dans la barre principale ; menu « Plus » affiché seulement s'il reste des onglets (disparaît quand vide). (Navigation technicien : voir Phase 6-C ci-dessous, entièrement séparée.)
7. **Workflow terrain (Phase 5.2-A)** : statuts `planifiee`=À faire, `en_cours`=En cours, `realisee`=Terminée, `rapport_transmis`=Vérifiée, `annulee`. Carte de workflow (Démarrer → Terminer) ; file **« À vérifier »** admin (`realisee`) + widget dashboard ; **« Valider et envoyer le rapport »** (→`rapport_transmis` + email client) ; **« Renvoyer au technicien »** (→`en_cours`, note stockée à part dans `retour_admin`, jamais dans `observations`/le PDF).
8. **Temps passé + historique du site (Phase 5.2-B)** : `interventions.heure_debut`/`heure_fin` posés automatiquement par le workflow (Démarrer/Terminer), corrigibles à la main par owner/bureau, durée affichée + dans le rapport PDF. Panneau « Historique du site » (`useSiteHistory`) listant les interventions précédentes à la même adresse.
9. **Cloisonnement des permissions (Phase 6-A)** : recherche globale, dashboard et FAB de création rapide filtrent désormais leurs résultats/sections via `useMyAccess().can(...)` (auparavant ces trois surfaces bypassaient le système de permissions et fuitaient des données). Devenu partiellement obsolète pour le technicien depuis la Phase 6-C (il ne rend plus jamais ces composants), reste pertinent pour le bureau.
10. **Flux admin ↔ technicien (Phase 6-B)** :
    - Formulaire d'intervention scindé : création (`_app.interventions.new.tsx`) = **planification uniquement** (client, adresse, date, type, technicien, contrat, consignes) ; le compte-rendu (observations, produits, photos, signature) est saisi **par la personne assignée**, une fois le chantier démarré.
    - `interventions.consignes` (notes de planification) et `interventions.retour_admin` (note de renvoi, bannière dédiée, jamais dans le PDF/email, effacée à la re-soumission).
    - **Demandes de réappro** (`stock_requests`, permission `reappro` pour le bureau) : un technicien à court de stock demande depuis « Mon camion » (toujours possible, sans permission requise — c'est son propre stock) ; la page `/reappro` (owner + bureau avec `can("reappro")`) sert/refuse la demande (transfert garage→camion réutilisé).
    - Pastille « à faire » (interventions `planifiee` assignées) — `useMyTodoCount()`.
11. **Interface technicien dédiée (Phase 6-C)** — refonte structurelle : les techniciens ne rendent plus jamais de page/composant `_app.*`.
    - `src/components/tech-shell.tsx` + `src/routes/tech.tsx` (layout, garde de poste) + 4 écrans : `tech.index.tsx` (Ma journée), `tech.chantiers.index.tsx` (Mes chantiers, filtre `technicien_id` en dur), `tech.chantiers.$id.tsx` (le chantier — mission lecture seule, retour du responsable, compte-rendu Démarrer/Terminer, historique du site, durée lecture seule ; AUCUN bouton facturation/email/PDF/certificat/duplication/paramètres), `tech.camion.tsx` (son stock + ses demandes de réappro + son historique).
    - `_app.tsx` redirige tout technicien vers `/tech` avant de monter `AppShell` ; `tech.tsx` redirige symétriquement tout non-technicien vers `/`. `auth.tsx` route vers la bonne interface après connexion.
    - Nettoyage côté admin : `isTechnician`/`useMyPoste` retirés de `_app.interventions.$id.tsx`, `_app.interventions.index.tsx` (devenus inutiles, ces pages ne sont plus jamais vues par un technicien) ; `TechnicianVanView` retirée de `_app.stock.index.tsx`.
    - Réutilise les hooks génériques (`queries.ts`) et composants de saisie (`signature-canvas.tsx`, `InterventionForm` en mode `compte-rendu`, `photos.ts`) sans jamais importer de page/composant admin.

## Hooks & fichiers clés

- `src/lib/queries.ts` : `useCurrentRole`, `useMyAccess`, `useMyPoste`, `useTeamMembers`, `useAssignableMembers`, `useTechnicianWorkload`, `useStockLevels`, `useMyVanStock`, `useStockMovements`/`useMyVanMovements`, `logStockMovement`, `useTechnicianStats`, `useDashboardStats` (dont `toVerifyCount`), `useSiteHistory`, `useStockRequests`/`useMyStockRequests`, `useMyTodoCount`, `useInterventions({ technicien_id })`, `getGarageLevel`/`getVanLevel`, `resolveTechnicianName`.
- `src/lib/` : `print.ts`, `team.ts`, `permissions.ts`, `schemas.ts` (dont `STATUTS_INTERVENTION`, `TYPES_PASSAGE`).
- `src/components/` : `app-shell.tsx` (nav admin owner/bureau), `tech-shell.tsx` (nav technicien — indépendant, ne pas fusionner), `permission-gate.tsx`, `signature-canvas.tsx`, `intervention-form.tsx` (mode `planification` | `compte-rendu`, contient `TechnicianSelect`).
- `src/routes/` : `_app.*` = admin (owner/bureau) ; `tech.*` = technicien (voir règle structurelle). Les deux layouts (`_app.tsx`, `tech.tsx`) se redirigent mutuellement selon le poste résolu.
- `src/lib/api/team.functions.ts` : fonctions serveur de gestion des comptes.

## Méthode de travail

Un assistant « planificateur » (côté chat) produit : (a) le SQL à exécuter dans Supabase, (b) des prompts précis pour Claude Code. Claude Code applique dans le repo, build avec bun, commit, push → Netlify déploie. Claude Code ne peut pas cliquer dans l'app en live : vérification via `bun run build`, puis test manuel par l'utilisateur.

## En cours / à venir

- **Plus tard (phase à part)** : génération automatique des interventions récurrentes depuis les contrats (« 1 passage hebdomadaire » → passages créés et prêts à assigner).
- **Idées parkées** (surdimensionnées pour l'instant) : mode hors-ligne, notifications push/email, portail client, géoloc/tournée, SMS, satisfaction client.
