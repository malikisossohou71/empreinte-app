# Empreinte — MVP Phase 1 + 2 + 3 + 4

MVP fonctionnel complet de la plateforme décrite dans le cahier des charges :
import d'un modèle (**image, PSD ou DOCX**), mapping des champs (texte, image,
**QR code de vérification**), comptes multi-utilisateurs, publication d'un lien
public personnalisable, remplissage par l'utilisateur final, export PNG/JPEG/PDF,
**envoi par e-mail**, statistiques avancées, et **API publique + webhooks** pour
les intégrations tierces.

## Prérequis système

Node.js seul suffit pour les modèles **image**, l'authentification, les QR codes,
l'e-mail et l'API. L'import **PSD** et **DOCX** (Phase 2) s'appuie en plus sur des
outils courants, à installer s'ils manquent :

| Outil | Rôle | Installation (Debian/Ubuntu) |
|---|---|---|
| **ImageMagick** (`convert`, `identify`) | Lecture des calques PSD | `apt install imagemagick` |
| **Python 3** + `python-docx` | Détection/remplissage des champs `{{...}}` DOCX | `apt install python3-pip && pip install python-docx` |
| **LibreOffice** (`soffice`) | Conversion DOCX → PDF | `apt install libreoffice` |
| **Poppler** (`pdftoppm`) | Conversion PDF → image (aperçu DOCX) | `apt install poppler-utils` |
| **reportlab** (Python) | Génération des QR codes | `pip install reportlab` (souvent déjà présent) |

## Déploiement en production

Pour héberger cette application en ligne (accessible à de vrais utilisateurs, pas
seulement en local), voir **[DEPLOY.md](./DEPLOY.md)** : guide pas-à-pas pour
déployer sur Railway avec le `Dockerfile` fourni (inclut ImageMagick, LibreOffice,
Python — tout ce qu'il faut pour les Phases 1 à 4).

## Installation

```bash
npm install
npm start
```

Le serveur démarre sur **http://localhost:3000**. Crée un compte sur
http://localhost:3000/admin puis importe ton premier modèle.

### Configurer l'envoi d'e-mail (facultatif)

Sans configuration, l'envoi par e-mail est simplement désactivé (le reste de
l'application fonctionne normalement). Pour l'activer, définis ces variables
d'environnement avant `npm start` (exemple avec Gmail SMTP) :

```bash
export SMTP_HOST=smtp.gmail.com
export SMTP_PORT=587
export SMTP_USER=toncompte@gmail.com
export SMTP_PASS=un_mot_de_passe_application
export SMTP_FROM=toncompte@gmail.com
npm start
```

Le client SMTP est implémenté nativement (`lib/mailer.js`, sans `nodemailer`) et
gère STARTTLS (port 587) et TLS direct (port 465, avec `SMTP_SECURE=true`).

## Ce que couvre ce MVP

### Phase 1 — modèles image
Import PNG/JPG, mapping visuel par glisser-déposer, formulaire automatique, lien
public, rendu serveur (`sharp`), export PNG/JPEG/PDF.

### Phase 2 — import PSD et DOCX
**PSD** : calques nommés détectés automatiquement (ImageMagick) → champs
pré-positionnés (position/taille/couleur déduites des pixels). **DOCX** : balises
`{{champ}}` détectées et remplies en préservant la mise en forme, conversion PDF
fidèle via LibreOffice.

### Phase 3 — comptes, personnalisation et pilotage
Comptes multi-utilisateurs (mot de passe haché scrypt, session par cookie),
isolation stricte des modèles par propriétaire, personnalisation de la page
publique (couleur, logo, messages), statistiques avancées (vues, taux de
complétion, export CSV).

### Phase 4 — extensions
- **QR codes dynamiques** : un champ de type "QR code de vérification" encode
  automatiquement un lien unique par soumission (`/verify/{id}`), utile pour un
  contrôle d'accès à l'entrée d'un événement (scan du badge). Généré via le
  moteur QR pur Python déjà embarqué dans `reportlab` (`lib/qr_helper.py`,
  `lib/qr.js`) — vérifié scannable par décodage OpenCV pendant les tests.
- **Envoi automatique par e-mail** : client SMTP natif (`lib/mailer.js`, EHLO,
  STARTTLS, AUTH LOGIN, pièce jointe MIME), déclenché si l'utilisateur final
  renseigne son adresse dans le formulaire public (champ affiché uniquement si
  le SMTP est configuré côté serveur).
- **Page de vérification publique** (`/verify/{submissionId}`) : confirme
  l'authenticité d'un document généré, avec les valeurs du champ (hors QR).
- **API publique v1** (`/api/v1/...`) authentifiée par clé API personnelle
  (visible dans la barre latérale, régénérable) :
  - `GET /api/v1/templates` — liste tes modèles
  - `POST /api/v1/templates/{id}/generate` — génère un document par NOM de champ,
    sans passer par le formulaire public (utile pour un script d'import en masse
    à partir d'un CSV, par exemple) :
    ```bash
    curl -X POST https://ton-serveur/api/v1/templates/TEMPLATE_ID/generate \
      -H "Authorization: Bearer emp_TA_CLE_API" \
      -H "Content-Type: application/json" \
      -d '{"values": {"Nom": "Awa Koffi"}}'
    ```
- **Webhooks** (onglet "Intégrations" par modèle) : notifie une URL tierce en
  POST JSON après chaque génération (événement `submission.created`), pour
  connecter Empreinte à un CRM, une billetterie, ou un outil type Zapier.

## Corrections et améliorations récentes

- **Gestion des modèles** : un bouton "Supprimer" (liste latérale et en-tête du
  modèle) efface définitivement du serveur le fichier importé, les champs, liens,
  réponses et documents générés associés.
- **Modèles Word** : possibilité d'ajouter manuellement un champ (comme pour les
  modèles image) — insère ensuite la balise `{{NomDuChamp}}` correspondante dans
  le document. L'extraction et le remplissage des champs couvrent maintenant
  aussi les **en-têtes, pieds de page, tableaux et zones de texte/formes**, pas
  seulement le corps du document, pour mieux préserver la mise en forme d'origine.
- **Aperçu en temps réel pour les modèles Word** (case à cocher dans l'onglet
  "Champs") : génère un aperçu à jour (image) pendant que l'administrateur
  modifie les valeurs d'exemple, et pendant que l'utilisateur final remplit le
  formulaire public. Désactivé par défaut (chaque aperçu déclenche une vraie
  conversion LibreOffice, plus lente qu'un aperçu image classique).
- **Import PSD** : correction d'un bug où un calque débordant du canevas (ombre
  portée, fond à fond perdu, décalage négatif — très courant dans un vrai fichier
  Photoshop) provoquait l'erreur "Image to composite must have same dimensions or
  smaller". Chaque calque est désormais recadré à la portion réellement visible
  du canevas avant assemblage, quelle que soit sa taille ou sa position d'origine.

- **Modèles Word — champs positionnés** : en plus des balises `{{champ}}`
  classiques, il est maintenant possible d'ajouter des champs texte, image ou
  QR code **positionnés librement par glisser-déposer**, exactement comme pour
  les modèles image (position, taille, couleur, alignement). Ils sont dessinés
  par-dessus le PDF généré par LibreOffice via `lib/docx_overlay.js` (pdf-lib),
  sans toucher au texte de substitution ni à la mise en page d'origine. Les deux
  mécanismes cohabitent sur un même modèle.

- **Photo : recadrage et formes** : quand un utilisateur final ajoute une photo
  pour un champ image, il peut maintenant la **déplacer et zoomer** (souris ou
  doigt sur mobile) dans une petite fenêtre de recadrage avant de valider. Un
  champ image peut aussi être défini avec une **forme circulaire** (en plus du
  rectangle classique) dans l'inspecteur de l'administrateur — la photo est
  alors découpée en cercle à la fois dans l'aperçu et dans le document final,
  quelle que soit la forme de la case d'origine (`lib/image_shape.js`, réutilisé
  par le rendu image/PSD et par la superposition sur les modèles Word).

- **Numéro de référence auto-incrémenté** : une case à cocher ("Afficher un
  numéro de référence sur le document final") ajoute un champ spécial de type
  "référence", positionnable par glisser-déposer comme n'importe quel autre champ.
  Deux modes : génération 100% automatique (`REF-0001`, `REF-0002`...) ou préfixe
  personnalisé + numéro de série (`DOC-RH-0014`). Le compteur est propre à chaque
  modèle et n'avance qu'à la génération réelle d'un document, jamais lors d'un
  aperçu. Testé avec incrémentation vérifiée sur plusieurs générations
  successives, sur les deux types de modèles (image et Word).
- **Typographie des champs texte** : chaque champ texte (et le champ référence)
  peut désormais choisir sa police parmi une liste "web-safe" (Arial, Helvetica,
  Verdana, Tahoma, Times New Roman, Georgia, Courier New, Trebuchet MS), avec
  gras/italique/souligné combinables. Ces polices sont approximées côté serveur
  par des équivalents libres métriquement compatibles (`fonts-liberation`) pour
  les modèles image/PSD, et par les 14 polices standard PDF pour les modèles
  Word — aucun fichier à fournir, ça fonctionne immédiatement.
  Un bouton "Utiliser une police installée sur cet appareil" s'appuie sur l'API
  Local Font Access du navigateur (Chrome/Edge, ordinateur) pour importer une
  police personnelle : le fichier est copié sur le serveur (`data/fonts/`, donc
  persistant) et réellement intégré au document final généré, pas seulement à
  l'aperçu. **Cette dernière partie (police locale + intégration dans le PDF
  Word via `@pdf-lib/fontkit`) n'a pas pu être testée dans l'environnement de
  développement (pas de navigateur, pas d'accès réseau pour installer le
  paquet) : à valider en priorité après déploiement.** Le reste (polices
  web-safe, gras/italique/souligné, intégration dans les images/PSD) est
  entièrement testé et vérifié.

- **Taille et bordure des champs image/QR code** : un curseur dans l'inspecteur
  ajuste directement la taille du QR code ou de la photo sur le document (le
  cadre reste carré en pixels réels même si le canevas ne l'est pas). Pour les
  champs "Image/Photo" uniquement : case à cocher pour activer une bordure,
  sélecteur de couleur, et curseur d'épaisseur — la bordure suit la forme du
  cadre (rectangle ou cercle) à la fois dans l'aperçu et sur le document final,
  sur les modèles image/PSD (`lib/render.js`, via un contour SVG) comme sur les
  champs positionnés d'un modèle Word (`lib/docx_overlay.js`, via les primitives
  natives `drawRectangle`/`drawEllipse` de pdf-lib). Testé et vérifié
  visuellement sur les deux moteurs de rendu.

## Choix techniques simplifiés par rapport au cahier des charges cible

| Sujet | Choix dans ce MVP | Cible en production |
|---|---|---|
| Base de données | fichier JSON (`data/db.json`) | PostgreSQL |
| Stockage fichiers | disque local | S3 ou équivalent objet |
| Upload de fichiers | JSON + base64 | multipart/form-data |
| Framework HTTP | Node.js natif (`http`) | Express / NestJS |
| Traitement asynchrone | rendu synchrone dans la requête | file d'attente (Redis + BullMQ) |
| Authentification | session cookie, hachage scrypt | JWT + refresh token, Redis |
| Envoi d'e-mail | client SMTP maison | service dédié (SES, Postmark...) avec files de retry |
| Webhooks | requête HTTP best-effort, sans retry | file d'attente avec retries et signature HMAC |
| Parsing PSD | géométrie des calques (ImageMagick + pixels) | vraie librairie PSD (texte/police éditables) |

Ces simplifications n'affectent pas la logique métier, qui suit fidèlement les
spécifications fonctionnelles du cahier des charges — seule l'infrastructure
autour est allégée pour un MVP local, entièrement testé de bout en bout à chaque
étape (voir historique du projet).

## Structure du projet

```
empreinte-mvp/
├── server.js                # Serveur HTTP + routes API (auth, webhooks, API v1)
├── lib/
│   ├── db.js                  # Stockage JSON (à remplacer par PostgreSQL)
│   ├── auth.js                  # Comptes, sessions, clés API, hachage des mots de passe
│   ├── mailer.js                  # Client SMTP natif (sans nodemailer)
│   ├── qr.js / qr_helper.py         # Génération de QR codes (via reportlab)
│   ├── render.js                      # Moteur de rendu image (sharp + pdf-lib + QR)
│   ├── image_shape.js                   # Découpe des photos par forme (cercle...)
│   ├── fonts.js                           # Polices personnalisées (upload + fontconfig)
│   ├── psd.js                               # Analyse PSD (ImageMagick + sharp)
│   ├── docx_helper.py                         # Détection/remplissage des champs DOCX
│   ├── docx_render.js                           # Orchestration DOCX -> PDF -> PNG
│   └── docx_overlay.js                            # Champs positionnés + référence sur PDF Word
├── public/
│   ├── admin.html            # Back-office complet (auth, import, mapping, branding, intégrations, stats)
│   └── form.html               # Formulaire public (branding, e-mail facultatif, recadrage photo)
└── data/
    ├── db.json                # Généré automatiquement
    ├── uploads/ renders/ work/ fonts/  # Fichiers gérés automatiquement
```

## Prochaines étapes suggérées (au-delà du cahier des charges initial)

1. Migration du stockage JSON vers PostgreSQL et du stockage fichiers vers S3.
2. File d'attente asynchrone (Redis + BullMQ) pour absorber les pics de génération.
3. Signature HMAC des webhooks + retries automatiques en cas d'échec.
4. Import en masse par CSV (génération de tous les documents d'une liste de
   participants en une fois, en s'appuyant sur l'API v1 déjà en place).
