---
name: accountable-cli
description: Use when you want to consult Accountable or find a quarter's missing invoices from the terminal — via the `accountable` CLI (instead of the browser/chrome-devtools). Triggers: « accountable missing », « liste les factures manquantes en ligne de commande », réconciliation trimestrielle scriptable, `acc tx`.
---

# CLI `accountable` (réconciliation Accountable en terminal)

Outil TypeScript **non officiel** distribué à part (voir `docs/accountable-cli.md` pour l'installation), binaire global **`accountable`** (alias **`acc`**). **Lecture seule** : il consulte et réconcilie ; l'upload/liaison de factures reste manuel (web app — voir [[accountable-api]]). Pour la logique brute de l'API ou ce que le CLI ne fait pas, voir [[accountable-api]] ; pour le workflow complet de collecte, [[collecte-factures-trimestre]].

## Connexion (à refaire ~toutes les 12 h)
Pas d'API key : on réutilise la session du navigateur.
1. Sur **web.accountable.eu** (connecté) → console (F12) : `copy(localStorage.getItem('auth'))`
2. `accountable login` puis coller (ou `pbpaste | accountable login`).

Le CLI **rafraîchit l'access token tout seul** (JWT ~1 h, refresh token ~12 h). Quand une commande affiche « Session expirée / recolle localStorage.auth », refaire l'étape ci-dessus. Session dans `~/.config/accountable/config.json` (chmod 600). Env alternatives : `ACCOUNTABLE_TOKEN`, `ACCOUNTABLE_REFRESH_TOKEN`.

## Commandes
| Commande | Rôle |
|---|---|
| `accountable whoami` | utilisateur + validité de session |
| `accountable accounts` | comptes connectés (IBAN, solde) |
| `accountable tx -q 2026-Q3 [--unmatched] [-a <iban>]` | transactions (alias de `transactions`) |
| `accountable expenses -q 2026-Q3 [--all]` | documents de dépense présents dans Accountable |
| `accountable missing -q 2026-Q3` | **⭐ factures manquantes** (réconciliation, groupé par fournisseur) |
| `accountable report -q 2026-Q3` | rapport complet |
| `accountable login` / `logout` | session |

- **Période** : `-q 2026-Q3` (ou `2026Q3`) **ou** `-p 2026-07-01/2026-10-01`. Défaut = trimestre courant (`accountable missing` sans argument).
- **Sorties** : tableau par défaut ; `--json` sur toutes les commandes (scripting/pipe) ; `missing` a aussi `--md [fichier]` (format tracker `factures-manquantes-*.md`) et `--xlsx <fichier>`.

## Ce que classe `missing`
- **⬜ à récupérer** : dépense (`amount<0`) sans document lié et sans document au même montant (±0,02 €) déjà dans Accountable → il faut aller chercher la facture sur le portail.
- **↔️ à lier** : un document existe déjà dans Accountable (Peppol/email) mais n'est pas rattaché → juste à lier dans l'app.
- **documentée** / **hors périmètre** (TVA/impôt, règlement carte de crédit, salaire) : ignorées.

Comptes fiscaux interrogés par période TVA ; comptes carte filtrés par `valueDate`.

## Exemples
```bash
accountable missing -q 2026-Q3                      # à l'écran, groupé par fournisseur
accountable missing -q 2026-Q3 --md ~/Dev/t3-2026/factures-manquantes-t3-2026.md
accountable missing -q 2026-Q3 --xlsx /tmp/t3.xlsx
accountable tx -q 2026-Q3 --unmatched --json | jq '.[].amount'
```

## Pièges
- Après `npm link` le binaire est global ; sinon `npm run dev -- missing -q 2026-Q3` (tsx) depuis le dossier du CLI.
- API non officielle : si une commande renvoie des avertissements « schéma inattendu » ou des erreurs 4xx après un changement d'Accountable, re-vérifier les endpoints dans [[accountable-api]].
- Le CLI ne fait PAS l'upload : une fois la liste `missing` obtenue, la collecte des PDF et leur liaison suivent [[collecte-factures-trimestre]] / [[portails-fournisseurs]].
