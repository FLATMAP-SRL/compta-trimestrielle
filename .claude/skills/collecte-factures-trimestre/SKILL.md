---
name: collecte-factures-trimestre
description: Use when collecting a quarter's missing invoices for your company — nouveau dossier tX-YYYY, réconciliation des dépenses Accountable, préparation compta/TVA trimestrielle, "dresse la liste des factures manquantes".
---

# Collecte trimestrielle des factures

## Vue d'ensemble
Réconcilier les dépenses bancaires (source de vérité : Accountable) avec les justificatifs, puis récupérer les factures manquantes sur les portails fournisseurs.

**REQUIRED SUB-SKILLS :** accountable-api (extraction des transactions), portails-fournisseurs (procédures par fournisseur), telechargements-chrome-mcp (téléchargement fiable des PDF).

Les valeurs propres à votre société (TVA, IBAN, chemins…) se lisent dans votre `.env` — voir `.env.example`.

## Étapes
1. **Structure** : copier le gabarit `template-trimestre/` vers `<QUARTER_DIR_ROOT>/tX-YYYY/` (minuscule-tiret), ce qui crée `Factures entrantes/`, `Factures sortantes/`, `Note de crédit/`, `Justificatif/`, `Relevés Mastercard/`, `écriture comptable/`. Y déposer votre `suppliers.csv` (voir `suppliers.example.csv`). ⚠️ **Convention de nommage contre-intuitive** (à adapter à votre plan comptable) : `Factures sortantes/` = factures FOURNISSEURS (dépenses — l'argent sort) → c'est là que vont toutes les factures collectées ; `Factures entrantes/` = factures de vente que votre société émet (revenus).
2. **Extraction** : le plus simple = le CLI `accountable missing -q tX-YYYY` (voir [[accountable-cli]]) qui applique déjà toute la règle et regroupe par fournisseur ; `--md <fichier>` génère directement le tracker. À défaut (ou pour un cas non couvert), via [[accountable-api]] : lister les transactions du trimestre (période TVA) et les documents déjà présents (`/api/v2/expenses`). **Manquant = dépense (montant < 0) avec `matchedItems` vide ET aucun document non-matché au même montant (±0,02 € — certaines factures Peppol ont 1 centime d'écart d'arrondi).**
3. **Tracker** : `factures-manquantes-tX-YYYY.md` (via `accountable missing --md` puis compléter), groupé par fournisseur, statuts ⬜ à récupérer / ✅ récupérée / 📧 email / ❌ pas encore émise / ➖ pas de facture attendue. Le présenter à l'utilisateur avant la collecte (il identifie les fournisseurs ambigus).
4. **Hors périmètre** : paiements TVA/impôts (`VATPayment`, pas de facture), salaires (fiches déjà matchées), revenus (encaissements clients, payouts de plateformes de paiement).
5. **Collecte** fournisseur par fournisseur (voir portails-fournisseurs). Consigne par défaut : sites à captcha/Cloudflare/anti-bot/itsme → **skip, l'utilisateur les fait manuellement** ; lui lister ce qui reste. (Comportement configurable selon vos préférences.)
6. **Rangement** : `Factures sortantes/N facture <fournisseur> <mois ou montant> TX_YYYY.pdf` (N séquentiel dans l'ordre de collecte) ; relevés carte → `Relevés Mastercard/N relevés mastercard <mois> TX_YYYY.pdf`. Nommage : le dossier trimestre est `tX-YYYY` (minuscule-tiret) mais le suffixe des fichiers est `TX_YYYY` (majuscule-underscore, ex. `T3_2026`) — les deux coexistent volontairement.
7. **Vérification** : lire chaque PDF (Read) et confirmer fournisseur/montant/mention de votre société ou n° TVA (`<COMPANY_VAT>`) avant de cocher ✅. Mettre à jour `suppliers.csv` au fil de l'eau (URL exacte, méthode d'accès, quirks).
8. **Récap final** : récupérées / manuelles restantes / à matcher dans Accountable / anomalies (paiement sans facture possible, commande fournisseur sans transaction bancaire correspondante).

## Pièges courants
| Piège | Parade |
|---|---|
| Facture « manquante » déjà dans Accountable (Peppol, reçue par email), juste non matchée | Toujours croiser avec `/api/v2/expenses` AVANT d'aller sur les portails |
| Paiements par carte de crédit invisibles côté compte courant | Seul le débit mensuel de règlement de carte apparaît → le justificatif est le relevé de carte (souvent à télécharger manuellement) |
| Facture du dernier mois pas encore émise à la mi-trimestre suivant | Marquer ❌ « pas encore disponible », ne pas insister |
| Achat introuvable sur le portail attendu | Voir portails-fournisseurs (ex. marketplace réparti entre plusieurs domaines, profil pro vs perso) |
