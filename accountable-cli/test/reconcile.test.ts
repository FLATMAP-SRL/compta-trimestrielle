import { describe, expect, it } from "vitest";
import { reconcile } from "../src/lib/reconcile.js";
import type { Expense, Transaction } from "../src/schemas.js";

function tx(p: Partial<Transaction> & { _id: string; amount: number }): Transaction {
  return { valueDate: "2026-05-10", matchedItems: [], ...p } as Transaction;
}
function exp(p: Partial<Expense> & { _id: string }): Expense {
  return { expenseDate: "2026-05-10", ...p } as Expense;
}

describe("reconcile", () => {
  it("classe manquant / à lier / documenté / hors périmètre / revenu", () => {
    const transactions: Transaction[] = [
      // 1. dépense sans doc et sans expense correspondante → MANQUANTE
      tx({ _id: "t1", amount: -90, counterPartyName: "Anthropic" }),
      // 2. dépense sans doc mais expense non-liée au même montant → À LIER
      tx({ _id: "t2", amount: -112.24, counterPartyName: "Pluxee" }),
      // 3. dépense déjà liée (matchedItems non vide) → DOCUMENTÉE
      tx({
        _id: "t3",
        amount: -20.4,
        counterPartyName: "Google",
        matchedItems: [{ documentId: "e-google", files: [{}] }],
      }),
      // 4. paiement TVA → HORS PÉRIMÈTRE
      tx({ _id: "t4", amount: -3000, counterPartyName: "Tva", transactionCategory: "VATPayment" }),
      // 5. règlement carte MC → HORS PÉRIMÈTRE
      tx({ _id: "t5", amount: -2500, communication: "Ing : mastercard 123" }),
      // 6. salaire → HORS PÉRIMÈTRE
      tx({ _id: "t6", amount: -2000, communication: "salaire mai 2026" }),
      // 7. revenu (amount > 0) → IGNORÉ
      tx({ _id: "t7", amount: 15000, counterPartyName: "Client Exemple SA" }),
    ];
    const expenses: Expense[] = [
      // expense Pluxee non liée, montant à 1 centime près → doit matcher t2
      exp({ _id: "e-pluxee", supplier: { name: "PLUXEE" }, totalAmount: 112.25, expenseDate: "2026-05-09" }),
      // expense Google déjà liée à t3 (dans matchedExpenseIds) → ne doit PAS créer de "à lier"
      exp({ _id: "e-google", supplier: { name: "Google" }, totalAmount: 20.4 }),
    ];

    const r = reconcile(transactions, expenses);

    expect(r.missing.map((m) => m.txId)).toEqual(["t1"]);
    expect(r.toLink.map((m) => m.txId)).toEqual(["t2"]);
    expect(r.toLink[0].alreadyInAccountable?.expenseId).toBe("e-pluxee");
    expect(r.documented).toBe(1);
    expect(r.outOfScope.map((o) => o.txId).sort()).toEqual(["t4", "t5", "t6"]);
    expect(r.totalExpenseTx).toBe(6); // t7 (revenu) exclu du total dépenses
  });

  it("respecte la tolérance de montant (±0,02 €)", () => {
    const t = [tx({ _id: "x", amount: -100.0 })];
    const eNear = [exp({ _id: "near", totalAmount: 100.02 })];
    const eFar = [exp({ _id: "far", totalAmount: 100.05 })];
    expect(reconcile(t, eNear).toLink).toHaveLength(1);
    expect(reconcile(t, eFar).missing).toHaveLength(1);
    expect(reconcile(t, eFar).toLink).toHaveLength(0);
  });
});
