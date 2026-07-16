import type { AccountableClient } from "../client.js";
import type { Connector, Transaction } from "../schemas.js";
import { inPeriod, type Period } from "../quarter.js";

export function connectorIbans(connectors: Connector[]): string[] {
  return connectors
    .map((c) => c.bankAccountReference?.IBAN)
    .filter((x): x is string => !!x);
}

/**
 * Transactions d'une période sur tous les comptes.
 * Comptes fiscaux → requête avec `periods=` (période TVA d'Accountable).
 * Autres comptes → requête sans `periods` puis filtre par `valueDate` dans [start,end).
 */
export async function fetchPeriodTransactions(
  client: AccountableClient,
  ibans: string[],
  period: Period,
  fiscalAccounts: string[],
): Promise<Transaction[]> {
  const all: Transaction[] = [];
  for (const iban of ibans) {
    if (fiscalAccounts.includes(iban)) {
      const txs = await client.getTransactions({
        accountNumbers: iban,
        periods: `${period.start}/${period.end}`,
      });
      all.push(...txs);
    } else {
      const txs = await client.getTransactions({ accountNumbers: iban });
      all.push(...txs.filter((t) => inPeriod(t.valueDate ?? t.executionDate, period)));
    }
  }
  return all;
}
