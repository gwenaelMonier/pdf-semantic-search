# PDF Semantic Search – Fonctionnalités

## 1. Import du document PDF

- Upload d'un fichier PDF via drag & drop ou bouton (30 Mo / 500 pages max).
- Validation du fichier (format, taille, nombre de pages).
- Indicateur de progression pendant l'ingestion.
- Remplacement du PDF courant par un nouveau document ("Nouveau document").
- Sélection d'un document pré-chargé depuis une liste de presets.

## 2. Ingestion et indexation

- Extraction du texte page par page côté serveur (`unpdf`), en conservant le numéro de page.
- Indexation BM25 in-memory pour la sélection rapide des pages pertinentes.

## 3. Chat conversationnel

- Interface de chat avec historique en mémoire (perdu au refresh).
- Réponses en streaming.
- Pour chaque question :
  1. Mode économie de tokens (activable via toggle) : sélection BM25 des pages les plus pertinentes.
  2. Mode complet : toutes les pages envoyées au modèle.
  3. Construction du prompt et envoi au LLM avec le contexte conversationnel.
- Gestion du contexte conversationnel (questions de suivi).
- Message explicite si la réponse ne figure pas dans le document (zéro hallucination).

## 4. Résilience et gestion des erreurs

- Rotation automatique des clés API et des modèles Gemini sur quota épuisé ou erreur 503.
- Fermeture silencieuse du stream en cas d'erreur mid-stream.
- Indicateur ⚠ "Réponse interrompue" + bouton "Réessayer" si le stream est interrompu sans sentinel.

## 5. Métadonnées de réponse

- Footer affiché sous chaque réponse complète : durée, modèle utilisé, tokens consommés, pages envoyées/total (si mode économie actif).

## 6. Citation des sources

- Format `[p. X: "extrait verbatim"]` et multi-paires `[p. 8: "q1", p. 9: "q2"]`.
- Clic sur une citation → visualiseur PDF positionné sur la page, extrait surligné.

## 7. Visualiseur PDF intégré

- Affichage côte-à-côte : chat à gauche, PDF à droite.
- Surlignage n-gram fuzzy de l'extrait cité, auto-scroll vers le passage.

## Architecture

- **Frontend** : Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- **Backend** : Route handlers Next.js (Node.js runtime)
- **Parsing PDF** : `unpdf` (server-side), `react-pdf` / `pdf.js` (client-side)
- **LLM** : Google Gemini 2.5 Flash via `@google/genai`, avec rotation clés/modèles
- **Recherche** : BM25 in-memory (`lib/bm25.ts`)
- **Déploiement** : Vercel
