import { writeFileSync } from "node:fs";
import { Command } from "commander";
import pc from "picocolors";
import { getClient } from "../context.js";
import { resolvePeriod } from "../quarter.js";
import { connectorIbans, fetchPeriodTransactions } from "../lib/fetch.js";
import { reconcile } from "../lib/reconcile.js";
import { missingToMarkdown, printJson, printMissing } from "../lib/format.js";
import { writeMissingXlsx } from "../lib/xlsx.js";

export function register(program: Command): void {
  program
    .command("missing")
    .description("Dépenses sans facture (réconciliation) — la commande phare")
    .option("-q, --quarter <q>", "trimestre, ex. 2026-Q3 (défaut: trimestre courant)")
    .option("-p, --period <a/b>", "période YYYY-MM-DD/YYYY-MM-DD")
    .option("--json", "sortie JSON")
    .option("--md [file]", "sortie Markdown (stdout ou fichier)")
    .option("--xlsx <file>", "export Excel")
    .action(
      async (opts: {
        quarter?: string;
        period?: string;
        json?: boolean;
        md?: string | boolean;
        xlsx?: string;
      }) => {
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

        if (opts.xlsx) {
          await writeMissingXlsx(result, period, opts.xlsx);
          process.stdout.write(pc.green(`✓ Excel écrit : ${opts.xlsx}\n`));
        }
        if (opts.md !== undefined) {
          const md = missingToMarkdown(result, period);
          if (typeof opts.md === "string") {
            writeFileSync(opts.md, md, "utf8");
            process.stdout.write(pc.green(`✓ Markdown écrit : ${opts.md}\n`));
          } else {
            process.stdout.write(md + "\n");
          }
          return;
        }
        if (!opts.xlsx) printMissing(result, period);
      },
    );
}
