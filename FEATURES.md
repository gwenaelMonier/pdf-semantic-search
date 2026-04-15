# PDF Semantic Search – Spécifications Fonctionnelles

## Vue d'ensemble

Application web permettant à un utilisateur de poser des questions en langage naturel sur un **document PDF**. L'assistant répond en s'appuyant exclusivement sur le contenu du document et cite systématiquement les **pages sources** utilisées pour construire sa réponse.

## Objectifs

- Réduire le temps de recherche d'informations dans des documents longs et denses.
- Garantir la **traçabilité** des réponses (pas de réponse sans source vérifiable).
- Offrir une expérience conversationnelle simple, sans configuration technique côté utilisateur.

---

## Fonctionnalités principales

### 1. Import du document PDF

- Upload d'un fichier PDF via l'UI (drag & drop + bouton).
- Validation du fichier (format PDF, taille maximale, nombre de pages).
- Affichage d'un indicateur de progression pendant l'ingestion.
- Remplacement possible du PDF courant par un nouveau document.
- Persistance du document pour la durée de la session.
- Sélection d'un document pré-chargé depuis une liste de presets.

### 2. Ingestion et indexation

- Extraction du texte page par page, en **conservant le numéro de page** de chaque extrait.
- Indexation BM25 pour la sélection rapide des pages pertinentes (mode économie de tokens).

### 3. Chat conversationnel

- Interface de chat : historique des questions/réponses de la session.
- Pour chaque question :
  1. Sélection optionnelle des pages les plus pertinentes par score BM25.
  2. Construction d'un prompt contextualisé envoyé au LLM.
  3. Génération d'une réponse en français, concise et structurée.
- Gestion du contexte conversationnel (questions de suivi, pronoms).
- Message explicite si la réponse ne figure pas dans le document (pas d'hallucination).

### 4. Citation des sources

- Chaque réponse affiche les **pages sources** utilisées au format `[p. X: "extrait verbatim"]`.
- Clic sur une citation → ouverture du **visualiseur PDF** positionné sur la page.
- Surlignage de l'extrait exact ayant servi à la réponse.

### 5. Visualiseur PDF intégré

- Affichage côte-à-côte : chat à gauche, PDF à droite.
- Synchronisation avec les citations : cliquer une source saute à la bonne page.
- Surlignage n-gram fuzzy de l'extrait cité.

### 6. Gestion de la session

- Historique de conversation conservé tant que le document est chargé.
- Bouton "Nouveau document" (réinitialise tout).

---

## Fonctionnalités secondaires (nice-to-have)

- Export de la conversation (Markdown / PDF).
- Bibliothèque de documents déjà ingérés.
- Suggestions de questions types selon le contenu du document.
- Mode comparaison entre deux documents.
- Authentification utilisateur et espace personnel.

---

## Contraintes & exigences

### Qualité des réponses
- **Zéro hallucination** : si l'information n'est pas dans le PDF, le dire explicitement.
- Toute affirmation factuelle doit être rattachée à au moins une page source.
- Réponses en **français**, ton professionnel et neutre.

### Performance
- Ingestion d'un PDF de ~200 pages en moins d'1 minute (cible).
- Réponse à une question en moins de 10 secondes (cible).

### Confidentialité
- Les documents peuvent contenir des informations sensibles : aucun stockage côté fournisseur LLM au-delà de la requête.
- Pas de partage des documents entre utilisateurs.

---

## Architecture

- **Frontend** : Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- **Backend** : API Next.js (App Router route handlers)
- **Parsing PDF** : `unpdf` (server-side), `react-pdf` / `pdf.js` (client-side)
- **LLM** : Google Gemini 2.5 Flash via `@google/generative-ai`
- **Recherche** : BM25 (in-memory, `lib/bm25.ts`)
- **Sessions** : in-memory store avec TTL 2h

---

## Questions ouvertes

1. Déploiement visé : local uniquement, ou hébergé ?
2. Mono-utilisateur ou multi-utilisateurs ?
3. Besoin d'un historique persistant entre sessions ?
4. Support multilingue (réponses dans la langue du document) ?
