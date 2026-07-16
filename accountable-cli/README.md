# accountable-cli

CLI **non-officiel** pour [Accountable](https://www.accountable.eu) (compta belge), pour la réconciliation trimestrielle : lister les transactions/dépenses et trouver les factures manquantes, en ligne de commande et scriptable.

> ⚠️ API non documentée par Accountable, reverse-engineered depuis le web app. Usage personnel. Peut casser si Accountable change son API.

## Installation

```bash
cd accountable-cli    # depuis la racine du dépôt compta-trimestrielle
npm install
npm run build
npm link          # rend `accountable` (et l'alias `acc`) disponible globalement
```

Dev sans build : `npm run dev -- <commande>` (via tsx).

## Connexion

Accountable n'a pas d'API key. On réutilise la session du navigateur (JWT + refresh token) :

1. Ouvre **web.accountable.eu** (connecté) → console (F12) :
   ```js
   copy(localStorage.getItem('auth'))
   ```
2. Colle dans le CLI :
   ```bash
   accountable login       # puis colle la valeur, Entrée
   # ou :  pbpaste | accountable login
   ```

Le CLI **rafraîchit l'access token automatiquement** (l'access token vit ~1 h, le refresh token ~12 h). Quand le refresh token expire (~12 h), recolle `localStorage.auth`. La session est stockée dans `~/.config/accountable/config.json` (chmod 600).

Variables d'env :
- `ACCOUNTABLE_TOKEN`, `ACCOUNTABLE_REFRESH_TOKEN` — session (alternative au `login`).
- `ACCOUNTABLE_FISCAL_ACCOUNTS` — IBAN(s) interrogé(s) par période TVA, séparés par des
  virgules (ex. votre compte pro principal). À défaut, se règle dans
  `~/.config/accountable/config.json` (`settings.fiscalAccounts`).
- `ACCOUNTABLE_CARD_SETTLEMENT_REF` (optionnel) — référence de règlement de carte à exclure
  de la réconciliation (transfert interne), en plus du motif générique « mastercard NNN ».

## Commandes

```bash
accountable whoami                          # utilisateur + validité de la session
accountable accounts                        # comptes bancaires connectés
accountable transactions -q 2026-Q3         # (alias: tx) transactions du trimestre
accountable tx -q 2026-Q3 --unmatched       # dépenses sans document
accountable expenses -q 2026-Q3             # factures présentes dans Accountable
accountable missing -q 2026-Q3              # ⭐ factures manquantes (réconciliation)
accountable missing -q 2026-Q3 --md tracker.md   # export Markdown (type tracker)
accountable missing -q 2026-Q3 --xlsx q3.xlsx     # export Excel
accountable report -q 2026-Q3               # rapport complet
```

Options communes : `-q, --quarter 2026-Q3` · `-p, --period 2026-07-01/2026-10-01` (défaut : trimestre courant) · `--json` (toutes les commandes) pour le scripting.

## La commande phare : `missing`

Classe chaque dépense du trimestre :
- **⬜ à récupérer** : `amount < 0`, sans document lié, et aucun document au même montant (±0,02 €) déjà dans Accountable.
- **↔️ à lier** : un document existe déjà dans Accountable (Peppol/email) mais n'est pas rattaché → juste à lier.
- **documentée** : déjà rattachée à un justificatif.
- **hors périmètre** : paiement TVA/impôt, règlement carte Mastercard (transfert interne), salaire.

Comptes fiscaux (ING) interrogés par période TVA (`periods=`) ; comptes carte (Mastercard) filtrés par `valueDate`.

## Développement

```bash
npm test          # vitest (quarter.ts + reconcile.ts)
npm run build     # tsc → dist/
```

Architecture : `client.ts` (fetch + refresh + pagination), `schemas.ts` (zod tolérant), `lib/reconcile.ts` (logique pure, testée), `commands/*` (commander). Voir aussi le skill `accountable-api` dans `../.claude/skills/`.

## Non couvert (phase 2)

Écriture (upload d'une facture + liaison à une transaction) : se fait encore via le web app. Nécessiterait de répliquer les appels de création/liaison de dépense.
