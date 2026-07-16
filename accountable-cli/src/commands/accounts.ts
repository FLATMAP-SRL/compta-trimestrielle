import { Command } from "commander";
import { getClient } from "../context.js";
import { fmtAmount, printJson, printTable } from "../lib/format.js";

export function register(program: Command): void {
  program
    .command("accounts")
    .description("Liste les comptes bancaires connectés")
    .option("--json", "sortie JSON")
    .action(async (opts: { json?: boolean }) => {
      const { client } = getClient();
      const connectors = await client.getConnectors();
      if (opts.json) return printJson(connectors);
      printTable(
        ["IBAN", "Nom", "Banque", "Provider", "Solde"],
        connectors.map((c) => [
          c.bankAccountReference?.IBAN ?? "?",
          c.bankAccountReference?.name ?? c.bankAccountReference?.accountHolderName ?? "",
          c.bankAccountReference?.financialInstitutionSlug ?? "",
          c.provider ?? "",
          c.balance?.amount != null ? fmtAmount(c.balance.amount) : "—",
        ]),
      );
    });
}
