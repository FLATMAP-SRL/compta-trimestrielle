import { Command } from "commander";
import { getClient } from "../context.js";
import { resolvePeriod, inPeriod } from "../quarter.js";
import { fmtAmount, fmtDate, printJson, printTable } from "../lib/format.js";

export function register(program: Command): void {
  program
    .command("expenses")
    .description("Liste les documents de dépense (factures) présents dans Accountable")
    .option("-q, --quarter <q>", "trimestre, ex. 2026-Q3")
    .option("-p, --period <a/b>", "période YYYY-MM-DD/YYYY-MM-DD")
    .option("--all", "toutes les dépenses (sinon: filtrées sur la période)")
    .option("--json", "sortie JSON")
    .action(
      async (opts: { quarter?: string; period?: string; all?: boolean; json?: boolean }) => {
        const { client } = getClient();
        let expenses = await client.getExpenses();
        const period = opts.all ? null : resolvePeriod(opts);
        if (period) expenses = expenses.filter((e) => inPeriod(e.expenseDate, period));
        expenses.sort((a, b) => (b.expenseDate ?? "").localeCompare(a.expenseDate ?? ""));

        if (opts.json) return printJson(expenses);
        printTable(
          ["Date", "Montant", "Fournisseur", "Validée", "Fichiers"],
          expenses.map((e) => [
            fmtDate(e.expenseDate ?? ""),
            e.totalAmount != null || e.amount != null ? fmtAmount((e.totalAmount ?? e.amount)!) : "—",
            (e.supplier?.name ?? "").slice(0, 32),
            e.isValidated ? "✓" : "—",
            String((e.files ?? []).length),
          ]),
        );
        process.stdout.write(`\n${expenses.length} dépense(s)${period ? ` — ${period.label}` : ""}\n`);
      },
    );
}
