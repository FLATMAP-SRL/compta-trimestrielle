import { Command } from "commander";
import pc from "picocolors";
import { getClient } from "../context.js";
import { resolvePeriod } from "../quarter.js";
import { connectorIbans, fetchPeriodTransactions } from "../lib/fetch.js";
import { reconcile } from "../lib/reconcile.js";
import { printJson, printMissing } from "../lib/format.js";
import { writeMissingXlsx } from "../lib/xlsx.js";

export function register(program: Command): void {
  program
    .command("report")
    .description("Rapport complet de réconciliation d'un trimestre")
    .option("-q, --quarter <q>", "trimestre, ex. 2026-Q3")
    .option("-p, --period <a/b>", "période YYYY-MM-DD/YYYY-MM-DD")
    .option("--xlsx <file>", "export Excel")
    .option("--json", "sortie JSON")
    .action(async (opts: { quarter?: string; period?: string; xlsx?: string; json?: boolean }) => {
      const { client, config } = getClient();
      const period = resolvePeriod(opts);
      const connectors = await client.getConnectors();
      const ibans = connectorIbans(connectors);
      const [txs, expenses] = await Promise.all([
        fetchPeriodTransactions(client, ibans, period, config.settings.fiscalAccounts),
        client.getExpenses(),
      ]);
      const result = reconcile(txs, expenses);

      if (opts.json) return printJson({ period, ...result });
      printMissing(result, period);
      if (opts.xlsx) {
        await writeMissingXlsx(result, period, opts.xlsx);
        process.stdout.write(pc.green(`\n✓ Excel écrit : ${opts.xlsx}\n`));
      }
    });
}
