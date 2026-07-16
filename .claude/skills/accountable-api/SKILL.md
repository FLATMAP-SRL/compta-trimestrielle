---
name: accountable-api
description: Use when reading transactions or expense documents from Accountable (web.accountable.eu / app.accountable.eu) — lister les transactions bancaires d'un trimestre TVA, trouver les dépenses sans document attaché, ou vérifier si une facture existe déjà dans Accountable.
---

# API Accountable (app.accountable.eu)

> API **non officielle**, reconstituée par observation du web app. Les endpoints peuvent changer sans préavis.
> Les valeurs propres à votre société (IBAN, email) se lisent dans votre `.env` — voir `.env.example`.

## Auth
Se connecter sur web.accountable.eu dans Chrome MCP (bouton « Sign in with Google », session `<ACCOUNTABLE_EMAIL>` généralement mémorisée). Le JWT (validité ~1 h) se récupère depuis la page :
```js
let auth; for (let i = 0; i < localStorage.length; i++) {
  const v = localStorage.getItem(localStorage.key(i));
  const m = v && v.match(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  if (m) { auth = m[0]; break; }
}
```
Headers : `authorization: Bearer <jwt>`, `accept: application/json`, `x-client: accountable-web`. Appeler via `evaluate_script` (fetch depuis la page, CORS ok vers app.accountable.eu).

### Refresh (pour un client headless / CLI)
`localStorage.auth` est un JSON : `{ access_token (JWT ~1 h), refresh_token (opaque), refresh_token_expires_at (ISO, ~12 h de vie fixe depuis le login), client_id, session_id, cloudFrontCookies }`.
Rafraîchir l'access token (repris du bundle `forceUpdateAuthData`) :
```
POST https://app.accountable.eu/api/v2/users/refresh-access-token
Content-Type: application/json          (PAS de header authorization)
body: { "refresh_token": "<refresh_token>" }
→ 200 { access_token, token_type:"Bearer", finalPayload:{...exp}, cloudFrontCookies:{...} }
```
- Le `refresh_token` **ne tourne PAS** (pas de nouveau refresh_token en réponse) et son `refresh_token_expires_at` est **fixe** (~12 h). Quand il expire → re-login (recoller `localStorage.auth`).
- `cloudFrontCookies` = cookies signés pour `files.accountable.eu` (téléchargement des PDF de documents), rafraîchis à chaque refresh. Pas nécessaires pour l'API JSON.
- 401 : le web app retente après refresh sur `jwt-expired`/`no-auth-token`/`invalid-token` ; logout sur `not-valid-expected`.
- Un CLI robuste : stocker tout l'objet `auth`, rafraîchir l'access_token avant chaque requête s'il est expiré (et si refresh_token encore valide), sinon message de re-login.

## Endpoints vérifiés
| Usage | Endpoint |
|---|---|
| Transactions d'un trimestre | `GET https://app.accountable.eu/api/v1/transactions?accountNumbers=<BANK_MAIN_IBAN>&currency=EUR&expand=matchedItems&expense_version=3&lang=fr&page=N&perPage=100&periods=2026-04-01%2F2026-07-01&sort=valueDate_desc` |
| Documents de dépense | `GET https://app.accountable.eu/api/v2/expenses?page=N&perPage=100` — le paramètre `search` est ignoré, filtrer côté client |

- Comptes : `<BANK_MAIN_IBAN>` (compte pro principal) ; `<BANK_MASTERCARD_ACCOUNT_REF>` (pseudo-compte carte, optionnel — alimenté par **imports manuels de relevés**, souvent en retard : re-vérifier après chaque import ; ses transactions n'ont pas de période TVA → interroger SANS `periods` et filtrer par `valueDate` côté client). La liste des comptes s'obtient via `GET /api/v1/connectors` (`bankAccountReference.IBAN`).
- `periods=<début>/<premier jour du trimestre suivant>` = période TVA telle qu'Accountable l'assigne (peut inclure des `valueDate` de début de trimestre suivant rattachées au trimestre courant).
- Paginer tant que `data.length === 100`.

## Upload d'une facture + liaison à une transaction (UI, pas d'API directe fiable)
Naviguer `https://web.accountable.eu/banks?id=<txId>` ouvre le dialogue de classement de la transaction.
- **Nouvelle dépense** : bouton « Créer une nouvelle dépense » → dialogue « Créer une dépense » qui pré-lie déjà la transaction. Uploader le PDF via le `<input type=file>` (« Choose file » DANS le form « Créer une dépense »), puis « Sauvegarder ». ⚠️ Attendre ~3-4 s que l'upload asynchrone se termine AVANT de sauvegarder, sinon le save est rejeté silencieusement.
- **Contrepartie non reconnue** (fournisseur cloud à libellé cryptique, éditeur de logiciel) : le save est bloqué par « Le fournisseur/La catégorie ne peut pas être vide ». Remplir le combobox Fournisseur (taper + cliquer la suggestion, ou texte libre pour un nouveau) et Catégorie (ex. « Service technologique ou logiciel ») avant de sauvegarder. Fermer le dropdown avant de cliquer Sauvegarder (sinon le clic est absorbé).
- **Document déjà présent** (facture Peppol, facture reçue par email) : « Dépense professionnelle » → « Lier à une dépense existante » → cocher la dépense (même montant/date) → « Sauvegarder ».
- **Une dépense = UN seul document** (boutons « Remplacer »/« Effacer », pas d'ajout multiple). Facture multi-PDF (ex. commande livrée en 2 envois) : fusionner en un seul PDF (`pypdf PdfWriter().append`) puis uploader/remplacer via la vue dépense `web.accountable.eu/expenses?id=<expenseId>` (expenseId = `matchedItems[].documentId`).
- **Ne PAS créer de dépense** pour les règlements de carte de crédit (transferts internes du compte courant vers la carte) : en faire des dépenses double-compte les lignes de carte individuelles.
- Vérifier le succès via l'API : `matchedItems[].files.length >= 1` sur la transaction.

## Schéma utile
- **Transaction** : `amount` (négatif = dépense), `valueDate`, `counterPartyName`, `communication`, `transactionCategory` (`professionalExpense`, `VATPayment`, `creditNoteOnPurchase`, absent = « À classer »), `matchedItems[]`.
- **matchedItems[]** : `sufficientlyDocumented`, `isValidated`, `files[]`, `supplier.name`, `expenseDate`. **Facture manquante = dépense avec `matchedItems` vide.** `sufficientlyDocumented:true` avec `files:0` existe (certains frais bancaires, charges de copropriété) → considéré documenté, ne pas chercher.
- **Expense (v2)** : `expenseDate`, `supplier.name`, `totalAmount`, `isValidated`, `sufficientlyDocumented`, `files[]`. Les factures Peppol et reçues par email y arrivent seules, parfois non matchées → croiser par montant (±0,02 €) avant de déclarer une facture manquante.
