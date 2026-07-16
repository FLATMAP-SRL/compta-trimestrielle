import { z } from "zod";

/** Réponses API tolérantes : on ne valide que les champs qu'on utilise, le reste passe (.passthrough()). */

export const MatchedItemSchema = z
  .object({
    documentId: z.string().optional(),
    _id: z.string().optional(),
    type: z.string().optional(),
    sufficientlyDocumented: z.boolean().optional(),
    isValidated: z.boolean().optional(),
    expenseDate: z.string().optional(),
    supplier: z.object({ name: z.string().optional() }).passthrough().optional(),
    files: z.array(z.unknown()).optional(),
  })
  .passthrough();

export const TransactionSchema = z
  .object({
    _id: z.string(),
    amount: z.number(),
    valueDate: z.string().optional(),
    executionDate: z.string().optional(),
    counterPartyName: z.string().nullish(),
    originalCounterPartyName: z.string().nullish(),
    communication: z.string().nullish(),
    transactionCategory: z.string().nullish(),
    accountNumber: z.string().nullish(),
    matchedItems: z.array(MatchedItemSchema).optional().default([]),
  })
  .passthrough();

export const ExpenseSchema = z
  .object({
    _id: z.string(),
    expenseDate: z.string().optional(),
    totalAmount: z.number().nullish(),
    amount: z.number().nullish(),
    isValidated: z.boolean().optional(),
    sufficientlyDocumented: z.boolean().optional(),
    supplier: z.object({ name: z.string().optional() }).passthrough().nullish(),
    files: z.array(z.unknown()).optional(),
  })
  .passthrough();

export const ConnectorSchema = z
  .object({
    _id: z.string().optional(),
    provider: z.string().optional(),
    balance: z.object({ amount: z.number().nullish() }).passthrough().nullish(),
    bankAccountReference: z
      .object({
        IBAN: z.string().optional(),
        name: z.string().optional(),
        accountHolderName: z.string().optional(),
        financialInstitutionSlug: z.string().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type MatchedItem = z.infer<typeof MatchedItemSchema>;
export type Transaction = z.infer<typeof TransactionSchema>;
export type Expense = z.infer<typeof ExpenseSchema>;
export type Connector = z.infer<typeof ConnectorSchema>;

/** Parse tolérant d'un tableau : ignore les éléments non conformes en émettant un avertissement. */
export function parseArray<S extends z.ZodTypeAny>(
  schema: S,
  data: unknown[],
  label: string,
): z.infer<S>[] {
  const out: z.infer<S>[] = [];
  let skipped = 0;
  for (const item of data) {
    const r = schema.safeParse(item);
    if (r.success) out.push(r.data);
    else skipped++;
  }
  if (skipped > 0) {
    process.stderr.write(`⚠️  ${skipped} ${label} ignoré(s) (schéma inattendu — l'API a peut-être changé)\n`);
  }
  return out;
}
