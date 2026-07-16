import { Command } from "commander";
import { getClient } from "../context.js";
import { resolvePeriod } from "../quarter.js";
import { fmtAmount, fmtDate, printJson, printTable } from "../lib/format.js";
import { connectorIbans, fetchPeriodTransactions } from "../lib/fetch.js";
import { txLabel } from "../lib/reconcile.js";
import type { Transaction } from "../schemas.js";

export function register(program: Command): void {
  program
    .command("transactions")
    .alias("tx")
    .description("Liste les transactions d'une période")
    .option("-q, --quarter <q>", "trimestre, ex. 2026-Q3")
    .option("-p, --period <a/b>", "période YYYY-MM-DD/YYYY-MM-DD")
    .option("-a, --account <iban>", "limiter à un compte (défaut: tous)")
    .option("--unmatched", "seulement les dépenses sans document")
    .option("--json", "sortie JSON")
    .action(
      async (opts: {
        quarter?: string;
        period?: string;
        account?: string;
        unmatched?: boolean;
        json?: boolean;
      }) => {
        const { client, config } = getClient();
        const period = resolvePeriod(opts);
        const connectors = await client.getConnectors();
        let ibans = connectorIbans(connectors);
        if (opts.account) ibans = ibans.filter((i) => i === opts.account);

        let txs = await fetchPeriodTransactions(client, ibans, period, config.settings.fiscalAccounts);
        if (opts.unmatched) {
          txs = txs.filter((t) => t.amount < 0 && (t.matchedItems ?? []).length === 0);
        }
        txs.sort((a, b) => (b.valueDate ?? "").localeCompare(a.valueDate ?? ""));

        if (opts.json) return printJson(txs);
        printTable(
          ["Date", "Montant", "Contrepartie", "Doc", "Catégorie"],
          txs.map((t: Transaction) => [
            fmtDate(t.valueDate ?? t.executionDate ?? ""),
            fmtAmount(t.amount),
            txLabel(t).slice(0, 32),
            (t.matchedItems ?? []).length > 0 ? "✓" : "—",
            t.transactionCategory ?? "à classer",
          ]),
        );
        process.stdout.write(`\n${txs.length} transaction(s) — ${period.label}\n`);
      },
    );
}
