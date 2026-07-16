# Workflow de collecte trimestrielle

Vue d'ensemble du processus que ce dépôt outille. Les détails opératoires sont dans les
skills (`.claude/skills/`) ; ce document donne le fil conducteur.

## Pourquoi

La comptabilité belge exige **un justificatif par dépense**. [Accountable](https://web.accountable.eu)
(compta + TVA pour indépendants/sociétés) est la source de vérité des transactions bancaires.
Chaque trimestre, il faut réconcilier les dépenses avec leurs factures et récupérer celles
qui manquent sur les portails fournisseurs, avant la déclaration TVA.

## Le cycle, trimestre par trimestre

1. **Nouveau dossier** : copier `template-trimestre/` vers `<QUARTER_DIR_ROOT>/tX-YYYY/`
   (ex. `t3-2026`). Y déposer votre `suppliers.csv`.
2. **Réconciliation** : `accountable missing -q 2026-Q3` (voir le skill
   `accountable-cli`) applique la règle et regroupe les manquants par fournisseur.
   `--md` génère directement le tracker `factures-manquantes-tX-YYYY.md`.
   - Manquant = une dépense (`amount < 0`) sans document lié **et** sans document déjà
     présent dans Accountable au même montant (±0,02 €). Des factures Peppol ou reçues
     par email sont parfois déjà là, juste non matchées — toujours croiser avec
     `/api/v2/expenses` avant d'aller sur un portail.
3. **Tracker** : compléter le `.md` (statuts ⬜/✅/📧/❌/➖), le présenter avant la collecte
   pour lever les fournisseurs ambigus.
4. **Collecte** portail par portail (skill `portails-fournisseurs`) : téléchargement des
   PDF (skill `telechargements-chrome-mcp`), rangement dans `Factures sortantes/`,
   vérification du contenu (fournisseur / montant / n° TVA de la société) avant de cocher ✅.
   Les sites à anti-bot / itsme sont faits manuellement par l'utilisateur.
5. **Liaison dans Accountable** : upload + rattachement des factures aux transactions
   (manuel dans le web app — voir le skill `accountable-api`). Le CLI est **lecture seule**.
6. **Récap** : récupérées / manuelles restantes / à matcher / anomalies.

## Hors périmètre (pas de facture attendue)

Paiements de TVA / impôts (`VATPayment`), salaires (fiches déjà matchées),
règlements de carte de crédit (transferts internes), encaissements de revenus.

## Comptes bancaires

Le compte pro principal (`BANK_MAIN_IBAN`) porte l'essentiel des transactions et est
interrogé par période TVA. Les dépenses par carte de crédit n'apparaissent sur le compte
courant que via un débit mensuel de règlement ; le justificatif est alors le **relevé de
carte** (souvent à télécharger manuellement derrière itsme). Accountable peut modéliser la
carte comme un pseudo-compte séparé (`BANK_MASTERCARD_ACCOUNT_REF`), alimenté par imports
manuels de relevés — souvent en retard, à re-vérifier après chaque import.

## Convention de nommage (à adapter)

- Dossier de trimestre : `tX-YYYY` minuscule-tiret (ex. `t3-2026`).
- Suffixe des fichiers : `TX_YYYY` majuscule-underscore (ex. `T3_2026`).
- ⚠️ `Factures sortantes/` contient les factures **fournisseurs** (dépenses) ;
  `Factures entrantes/` les factures de **vente** émises par la société (revenus).
  Convention contre-intuitive — ajustez-la à votre plan comptable.
