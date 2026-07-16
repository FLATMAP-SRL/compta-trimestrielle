#!/usr/bin/env node
import { Command } from "commander";
import pc from "picocolors";
import { AuthError } from "./auth.js";
import { register as registerLogin } from "./commands/login.js";
import { register as registerAccounts } from "./commands/accounts.js";
import { register as registerTransactions } from "./commands/transactions.js";
import { register as registerExpenses } from "./commands/expenses.js";
import { register as registerMissing } from "./commands/missing.js";
import { register as registerReport } from "./commands/report.js";

const program = new Command();

program
  .name("accountable")
  .description("CLI non-officiel pour Accountable (compta belge)")
  .version("0.1.0");

registerLogin(program);
registerAccounts(program);
registerTransactions(program);
registerExpenses(program);
registerMissing(program);
registerReport(program);

async function main() {
  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    if (err instanceof AuthError) {
      process.stderr.write(pc.red(`\n${err.message}\n`));
      process.exitCode = 1;
      return;
    }
    process.stderr.write(pc.red(`\nErreur : ${(err as Error).message}\n`));
    process.exitCode = 1;
  }
}

main();
