# HR Assistant – Spécifications Fonctionnelles

## Vue d'ensemble

Application web permettant à un utilisateur de poser des questions RH en langage naturel sur une **convention collective** fournie au format PDF. L'assistant répond en s'appuyant exclusivement sur le contenu du document et cite systématiquement les **pages sources** utilisées pour construire sa réponse.

## Objectifs

- Réduire le temps de recherche d'informations dans des conventions collectives souvent longues et denses.
- Garantir la **traçabilité** des réponses (pas de réponse sans source vérifiable).
- Offrir une expérience conversationnelle simple, sans configuration technique côté utilisateur.

---

## Fonctionnalités principales

### 1. Import du document PDF

- Upload d'un fichier PDF via l'UI (drag & drop + bouton).
- Validation du fichier (format PDF, taille maximale, nombre de pages).
- Affichage d'un indicateur de progression pendant l'ingestion.
- Remplacement possible du PDF courant par un nouveau document.
- Persistance du document pour la durée de la session (a minima).

### 2. Ingestion et indexation

- Extraction du texte page par page, en **conservant le numéro de page** de chaque extrait.
- Découpage du texte en *chunks* sémantiques (avec recouvrement) en gardant la métadonnée de page.
- Génération d'*embeddings* pour chaque chunk.
- Stockage dans une base vectorielle (locale ou embarquée) indexée par document.

### 3. Chat conversationnel (RAG)

- Interface de chat : historique des questions/réponses de la session.
- Pour chaque question :
  1. Recherche des chunks les plus pertinents par similarité vectorielle.
  2. Construction d'un prompt contextualisé envoyé au LLM.
  3. Génération d'une réponse en français, concise et structurée.
- Gestion du contexte conversationnel (questions de suivi, pronoms).
- Message explicite si la réponse ne figure pas dans le document (pas d'hallucination).

### 4. Citation des sources

- Chaque réponse affiche la liste des **pages sources** utilisées (ex. `p. 12, 34, 58`).
- Clic sur une page source → ouverture d'un **visualiseur PDF** intégré positionné sur la page.
- Surlignage (*highlight*) optionnel de l'extrait exact ayant servi à la réponse.
- Possibilité de voir l'extrait textuel brut (citation) avant d'ouvrir le PDF.

### 5. Visualiseur PDF intégré

- Affichage côte-à-côte : chat à gauche, PDF à droite (layout responsive).
- Navigation : pagination, zoom, recherche plein texte dans le PDF.
- Synchronisation avec les citations : cliquer une source saute à la bonne page.

### 6. Gestion de la session

- Historique de conversation conservé tant que le document est chargé.
- Bouton "Nouvelle conversation" (réinitialise l'historique, garde le PDF).
- Bouton "Nouveau document" (réinitialise tout).

---

## Fonctionnalités secondaires (nice-to-have)

- Export de la conversation (Markdown / PDF).
- Historique multi-documents (bibliothèque de conventions déjà ingérées).
- Suggestions de questions types ("Quelle est la durée du préavis ?", "Combien de jours de congés ?").
- Mode comparaison entre deux conventions.
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
- Les documents peuvent contenir des informations sensibles : traitement local privilégié ou, à défaut, aucun stockage côté fournisseur LLM au-delà de la requête.
- Pas de partage des documents entre utilisateurs.

---

## Architecture envisagée (à confirmer)

- **Frontend** : application web (framework à définir : Next.js / React / SvelteKit).
- **Backend** : API (Python FastAPI ou Node) gérant ingestion, RAG, appels LLM.
- **Parsing PDF** : `pypdf` / `pdfplumber` / `PyMuPDF` (ce dernier facilite l'extraction avec positions).
- **Embeddings & LLM** : API Anthropic (Claude) pour la génération, modèle d'embeddings à choisir.
- **Vector store** : Chroma, Qdrant, ou LanceDB (embarqué).
- **Visualiseur PDF** : `pdf.js` côté frontend.

---

## Questions ouvertes

1. Déploiement visé : local uniquement, ou hébergé ?
2. Mono-utilisateur ou multi-utilisateurs ?
3. Besoin d'un historique persistant entre sessions ?
4. Langue unique (français) ou multilingue ?
5. Budget/contraintes sur le choix du LLM (Claude, local open-source, etc.) ?
