# CLI `accountable`

La réconciliation (étape « dresser la liste des factures manquantes ») est portée par un
petit CLI TypeScript **non officiel**, distribué séparément de ce dépôt. Le skill
`accountable-cli` documente son usage au quotidien ; ce document couvre l'installation et
l'architecture.

## Installation

Le CLI n'est pas inclus ici (c'est son propre projet). Une fois cloné :

```bash
cd accountable-cli
npm install
npm run build
npm link          # expose le binaire global `accountable` (alias `acc`)
# à défaut de link : npm run dev -- missing -q 2026-Q3   (via tsx)
```

Node 22, ESM. Dépendances typiques : `commander`, `zod`, `cli-table3`, `exceljs`.

## Authentification

Pas d'API key — on réutilise la session du navigateur :

1. Sur **web.accountable.eu** (connecté), console : `copy(localStorage.getItem('auth'))`.
2. `accountable login` puis coller (ou `pbpaste | accountable login`).

Le bundle `localStorage.auth` = `{ access_token (JWT ~1 h), refresh_token (opaque, ~12 h
fixe), refresh_token_expires_at, client_id, session_id, cloudFrontCookies }`. Le CLI
rafraîchit l'access token tout seul via `POST /api/v2/users/refresh-access-token`
(`{refresh_token}`) ; le refresh_token **ne tourne pas** → recoller le token toutes les
~12 h. Session stockée dans `~/.config/accountable/config.json` (chmod 600). Alternatives
d'environnement : `ACCOUNTABLE_TOKEN`, `ACCOUNTABLE_REFRESH_TOKEN`.

Le client HTTP doit envoyer `Origin`/`Referer: https://web.accountable.eu` +
`x-client: accountable-web`.

## Logique de réconciliation

Cœur pur et testable (ex. `src/lib/reconcile.ts`) :

- **manquant** = `amount < 0` + `matchedItems` vide + aucun document non-lié au même
  montant (±0,02 €) ;
- **hors périmètre** = paiement TVA, règlement de carte de crédit, salaire ;
- alias fournisseurs pour le regroupement.

## Portée

**MVP = lecture seule.** Le CLI consulte et réconcilie ; l'upload et la liaison des
factures aux transactions restent manuels dans le web app (voir le skill `accountable-api`).
Détails bruts de l'API (endpoints, schémas) : skill `accountable-api`.
