---
name: portails-fournisseurs
description: Use when fetching an invoice PDF from a supplier portal — Google Workspace/Cloud, Amazon Business, Ubiquiti, 4411, portails Peppol/email, Hetzner, Anthropic/claude.ai, Doccle, banque en ligne — ou pour décider si un portail est automatisable ou à faire manuellement.
---

# Portails fournisseurs — recettes de téléchargement

Votre `suppliers.csv` (voir `suppliers.example.csv`) est la référence vivante — le mettre à jour à chaque découverte (URL exacte, méthode d'accès, quirks). Les identifiants de compte se lisent dans votre `.env`.

## Répartition (à adapter à vos fournisseurs)
- **Automatisable après login de l'utilisateur dans la fenêtre Chrome MCP** : la plupart des portails SaaS (ex. Google Workspace + Cloud, Amazon Business, Ubiquiti, 4411). Demander à l'utilisateur de se loguer via AskUserQuestion, puis reprendre la main.
- **Manuel par l'utilisateur (consigne par défaut : skipper sans insister)** : tout portail derrière un anti-bot ou une auth forte. Exemples rencontrés : Anthropic/claude.ai (Cloudflare), Hetzner `accounts.hetzner.com` (« Heray » = solution anti-bot maison, page « Request on Hold »), portails à **itsme** (ex. Doccle, banques belges type Home'Bank). L'utilisateur dépose ses téléchargements dans `<DOWNLOADS_DIR>` (parfois `CFNetworkDownload_*.pdf` via Safari) — les identifier en lisant la 1re page avant de les ranger.
- **Rien à récupérer** : fournisseurs qui envoient leur facture par **Peppol** ou par **email** directement dans Accountable. Vérifier leur présence via l'API expenses (voir [[accountable-api]]) plutôt que d'aller sur un portail.
- **Récurrents auto-documentés** : télécom, énergie, assurances, secrétariat social, syndic/copropriété, frais bancaires, logiciel de compta — généralement déjà matchés dans Accountable, normalement rien à collecter. S'ils apparaissent manquants un trimestre, vérifier d'abord l'API expenses.

## Procédures vérifiées (exemples réutilisables)
| Fournisseur | Chemin exact |
|---|---|
| Google Workspace | admin.google.com (revalidation mot de passe) > Facturation > Abonnements > « Afficher les factures » > section du mois > bouton « Facture PDF » > Téléchargement. Mois plus anciens : le 3e sélecteur en haut de l'iframe → « Cette année ». Fichier : `<n° facture>.pdf`. |
| Google Cloud | Passkey/Touch ID souvent exigé (l'utilisateur valide sur sa machine). Un ou plusieurs **comptes de facturation** (`<GCLOUD_BILLING_n_ID>` / `<GCLOUD_BILLING_n_LABEL>` dans `.env`). Chaque compte : `console.cloud.google.com/billing/<id>/invoices` > clic ligne > Actions > Download > décocher CSV. Fichier : `<n° facture>.pdf`, délai parfois > 30 s. |
| Amazon Business | Même login sur tous les marketplaces mais session par domaine. Les achats peuvent être répartis entre plusieurs domaines (ex. **amazon.fr ET amazon.de**), un paiement peut pointer vers l'un ou l'autre. Liens PDF : `fetch('/gp/shared-cs/ajax/invoice/invoice.html?orderId=<id>')` → parser les liens `/documents/download/<uuid>/invoice.pdf`. Une commande peut avoir plusieurs factures (multi-vendeurs marketplace). |
| Ubiquiti | eu.store.ui.com — ⚠️ `/eu/en/account/orders` = **404** ; utiliser `/eu/en/account` > Order History > ouvrir la commande > « View Invoice » = PDF direct `ecomm.svc.ui.com/invoice/<uuid>?locale=en` (fetch même session ok). |
| 4411 | my.4411.be > basculer sur le profil **PRO** (`<SUPPLIER_4411_CLIENT_ID>` ; le profil perso/EASY est distinct, souvent vide) > Invoices > liens S3 pré-signés (téléchargeables hors navigateur, `python urllib`, pas de cookies requis). Facture mensuelle émise le 1er. |
| JetBrains | account.jetbrains.com > Licenses > « Transactions / Invoices » > lien INVCZxxxxx = PDF direct (fetch même session). Abonnement annuel typique. |
| Relevés de carte (banque en ligne) | Carte se terminant par `<MASTERCARD_LAST4>`, réf. client `<MASTERCARD_CLIENT_REF>`. Relevé édité en début de mois, débité en milieu de mois. Souvent derrière itsme → **manuel** → ranger dans `Relevés Mastercard/`. |
