# compta-trimestrielle

Automatisation de la **collecte trimestrielle des justificatifs** pour une société belge,
pilotée par [Claude Code](https://claude.com/claude-code). À chaque trimestre : réconcilier
les dépenses bancaires (via [Accountable](https://web.accountable.eu)) avec leurs factures,
puis récupérer sur les portails fournisseurs celles qui manquent — avant la déclaration TVA.

Ce dépôt contient la **méthode** (skills Claude Code + workflow + gabarits), pas les données.
Vous le clonez, vous le configurez avec **vos** comptes, et vous l'utilisez pour votre propre
comptabilité.

> ⚠️ **Non officiel.** S'appuie sur l'API privée d'Accountable (non documentée, susceptible
> de changer) et sur des procédures de portails fournisseurs vérifiées à un instant T.
> Aucune affiliation avec Accountable ou les fournisseurs cités.

## Ce qu'il y a dans le dépôt

| Chemin | Rôle |
|---|---|
| `.claude/skills/` | Les 5 skills Claude Code : réconciliation, API Accountable, portails, téléchargements |
| `accountable-cli/` | Le CLI `accountable` (TypeScript) : réconciliation en terminal |
| `docs/workflow.md` | Le fil conducteur du cycle trimestriel |
| `docs/accountable-cli.md` | Installation & archi du CLI `accountable` |
| `.env.example` | Toutes les variables d'instance à remplir |
| `suppliers.example.csv` | Gabarit de liste fournisseurs |
| `template-trimestre/` | Arborescence vide à copier pour chaque nouveau trimestre |

## Prérequis

- **Claude Code** (les skills sont chargés depuis `.claude/skills/`).
- Le **MCP `chrome-devtools`** (pilotage du navigateur pour les portails). Voir
  [chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp).
- Le **CLI `accountable`** (réconciliation en terminal) — inclus dans `accountable-cli/`,
  voir `docs/accountable-cli.md`. Optionnel : tout peut aussi passer par l'API directement.
- Un **compte Accountable** actif.

## Mise en route

```bash
git clone <ce-dépôt> compta-trimestrielle
cd compta-trimestrielle

cp .env.example .env          # puis remplir VOS valeurs (TVA, IBAN, email, …)
cp suppliers.example.csv suppliers.csv   # puis lister VOS fournisseurs

# le CLI de réconciliation :
cd accountable-cli && npm install && npm run build && npm link && cd ..
```

`.env`, `suppliers.csv` et tout fichier comptable (`*.pdf`, `*.xlsx`,
`factures-manquantes-*.md`) sont **gitignorés** — voir `.gitignore`.

Pour démarrer un trimestre :

```bash
cp -R template-trimestre ~/Dev/t3-2026     # ajuste QUARTER_DIR_ROOT à ton goût
```

Puis, dans Claude Code, lancer le workflow (skill `collecte-factures-trimestre`), par
exemple : « dresse la liste des factures manquantes du trimestre en cours ».

## Comment ça marche

Résumé du cycle dans [`docs/workflow.md`](docs/workflow.md). En bref : `accountable missing`
liste les dépenses sans facture → un tracker Markdown → collecte portail par portail
(automatisable ou manuel selon l'anti-bot) → rangement + vérification → liaison des PDF aux
transactions dans le web app Accountable (l'upload reste manuel, le CLI est lecture seule).

## Sécurité & données

- **Ne committez jamais de donnée comptable.** Le `.gitignore` exclut les PDF, xlsx,
  trackers, `.env` et les dossiers de trimestre — mais vérifiez `git status` avant tout commit.
- Les valeurs d'instance (n° TVA, IBAN, IDs de facturation, réf. carte…) vivent uniquement
  dans votre `.env` local. Les skills n'y font référence que par nom de variable.
- L'authentification Accountable (token de session) est gérée par le CLI dans
  `~/.config/accountable/config.json`, hors du dépôt.

## Personnaliser

Les skills encodent quelques conventions (nommage `tX-YYYY`/`TX_YYYY`, `Factures
sortantes/` = dépenses, sites anti-bot faits manuellement). Ce sont des **conventions par
défaut** — adaptez-les à votre plan comptable et à vos préférences en éditant les fichiers
`SKILL.md` correspondants.
