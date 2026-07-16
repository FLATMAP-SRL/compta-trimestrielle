import Table from "cli-table3";
import pc from "picocolors";
import type { Period } from "../quarter.js";
import { groupBySupplier, type MissingItem, type ReconcileResult } from "./reconcile.js";

export function fmtAmount(n: number): string {
  return (
    new Intl.NumberFormat("fr-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) +
    " €"
  );
}

export function fmtDate(iso: string): string {
  const d = iso.slice(0, 10);
  const [y, m, day] = d.split("-");
  return day && m && y ? `${day}/${m}/${y}` : d;
}

export function printTable(headers: string[], rows: (string | number)[][]): void {
  const t = new Table({ head: headers.map((h) => pc.bold(h)), style: { head: [], border: [] } });
  for (const r of rows) t.push(r.map((c) => String(c)));
  process.stdout.write(t.toString() + "\n");
}

export function printJson(obj: unknown): void {
  process.stdout.write(JSON.stringify(obj, null, 2) + "\n");
}

/** Rendu console d'un résultat de réconciliation (groupé par fournisseur). */
export function printMissing(result: ReconcileResult, period: Period): void {
  const line = (items: MissingItem[]) =>
    items.reduce((s, it) => s + it.amount, 0);

  process.stdout.write(pc.bold(`\nFactures manquantes — ${period.label}\n`));

  if (result.missing.length === 0) {
    process.stdout.write(pc.green("  ✓ Aucune facture manquante\n"));
  } else {
    for (const [supplier, items] of groupBySupplier(result.missing)) {
      process.stdout.write(
        `\n${pc.yellow("⬜")} ${pc.bold(supplier)}  ${items.length} facture(s)  ${pc.dim(fmtAmount(line(items)))}\n`,
      );
      for (const it of items) {
        process.stdout.write(`   ${fmtDate(it.date)}  ${fmtAmount(it.amount).padStart(12)}  ${pc.dim(it.txId)}\n`);
      }
    }
  }

  if (result.toLink.length > 0) {
    process.stdout.write(
      pc.cyan(`\n↔️  Déjà dans Accountable, à lier (${result.toLink.length}) :\n`),
    );
    for (const it of result.toLink) {
      process.stdout.write(
        `   ${fmtDate(it.date)}  ${fmtAmount(it.amount).padStart(12)}  ${it.label}  → dépense ${pc.dim(it.alreadyInAccountable?.expenseId ?? "")}\n`,
      );
    }
  }

  process.stdout.write(
    pc.dim(
      `\nRésumé : ${result.missing.length} manquante(s) · ${result.toLink.length} à lier · ${result.documented} documentée(s) · ${result.outOfScope.length} hors périmètre · ${result.totalExpenseTx} dépenses au total\n`,
    ),
  );
}

/** Markdown type tracker `factures-manquantes-*.md`. */
export function missingToMarkdown(result: ReconcileResult, period: Period): string {
  const lines: string[] = [];
  lines.push(`# Factures manquantes — ${period.label} (${period.start} → ${period.end})`, "");
  lines.push(
    "Statuts : ⬜ à récupérer · ↔️ déjà dans Accountable (à lier) · ➖ hors périmètre",
    "",
  );

  lines.push("## À récupérer");
  if (result.missing.length === 0) lines.push("_Aucune._", "");
  for (const [supplier, items] of groupBySupplier(result.missing)) {
    lines.push(`### ${supplier} — ${items.length} facture(s)`);
    lines.push("| Statut | Date | Montant | Communication |", "|---|---|---|---|");
    for (const it of items) {
      lines.push(
        `| ⬜ | ${fmtDate(it.date)} | ${fmtAmount(it.amount)} | ${(it.communication ?? "").replace(/\|/g, "/")} |`,
      );
    }
    lines.push("");
  }

  if (result.toLink.length > 0) {
    lines.push("## Déjà dans Accountable — à lier");
    lines.push("| Date | Montant | Fournisseur | Dépense |", "|---|---|---|---|");
    for (const it of result.toLink) {
      lines.push(
        `| ${fmtDate(it.date)} | ${fmtAmount(it.amount)} | ${it.label} | ${it.alreadyInAccountable?.expenseId ?? ""} |`,
      );
    }
    lines.push("");
  }

  if (result.outOfScope.length > 0) {
    lines.push("## Hors périmètre");
    lines.push("| Date | Montant | Libellé | Raison |", "|---|---|---|---|");
    for (const it of result.outOfScope) {
      lines.push(`| ${fmtDate(it.date)} | ${fmtAmount(it.amount)} | ${it.label} | ${it.reason} |`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
