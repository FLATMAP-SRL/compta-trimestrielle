import type { Expense, Transaction } from "../schemas.js";

export interface MissingItem {
  txId: string;
  date: string; // YYYY-MM-DD
  amount: number; // négatif
  label: string;
  communication?: string;
  /** Renseigné si un document non-lié existe déjà dans Accountable (statut « à lier »). */
  alreadyInAccountable?: { expenseId: string; supplier?: string; amount: number };
}

export interface OutOfScopeItem {
  txId: string;
  date: string;
  amount: number;
  label: string;
  reason: string;
}

export interface ReconcileResult {
  missing: MissingItem[];
  toLink: MissingItem[];
  documented: number;
  outOfScope: OutOfScopeItem[];
  totalExpenseTx: number;
}

export interface ExclusionRule {
  name: string;
  test: (tx: Transaction) => boolean;
}

export interface ReconcileOptions {
  amountTolerance?: number; // défaut 0.02 €
  dateWindowDays?: number; // défaut 10 j
  exclusions?: ExclusionRule[];
}

/**
 * Détection des règlements de carte (transfert interne, pas une dépense à documenter).
 * Motif générique par défaut ; on peut y ajouter la référence de règlement propre à sa
 * banque via `ACCOUNTABLE_CARD_SETTLEMENT_REF` (ex. le n° de compte carte apparaissant
 * dans le libellé du débit mensuel).
 */
const cardSettlementRe: RegExp = (() => {
  const base = "mastercard\\s*\\d{3}|décompte de frais";
  const extra = process.env.ACCOUNTABLE_CARD_SETTLEMENT_REF?.trim();
  const escaped = extra?.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(escaped ? `${escaped}|${base}` : base, "i");
})();

export const DEFAULT_EXCLUSIONS: ExclusionRule[] = [
  {
    name: "Paiement TVA / impôt",
    test: (tx) =>
      tx.transactionCategory === "VATPayment" || tx.transactionCategory === "companyTaxPayment",
  },
  {
    name: "Règlement carte Mastercard (transfert interne)",
    test: (tx) => cardSettlementRe.test(text(tx)),
  },
  {
    name: "Salaire",
    test: (tx) => /\bsalaire\b|\bpecule\b/i.test(text(tx)),
  },
];

export function reconcile(
  transactions: Transaction[],
  expenses: Expense[],
  opts: ReconcileOptions = {},
): ReconcileResult {
  const tol = opts.amountTolerance ?? 0.02;
  const windowMs = (opts.dateWindowDays ?? 10) * 86_400_000;
  const exclusions = opts.exclusions ?? DEFAULT_EXCLUSIONS;

  // Documents déjà liés à une transaction (n'importe laquelle).
  const matchedExpenseIds = new Set<string>();
  for (const tx of transactions) {
    for (const mi of tx.matchedItems ?? []) {
      const id = mi.documentId ?? mi._id;
      if (id) matchedExpenseIds.add(id);
    }
  }
  const unmatchedExpenses = expenses.filter((e) => !matchedExpenseIds.has(e._id));

  const result: ReconcileResult = {
    missing: [],
    toLink: [],
    documented: 0,
    outOfScope: [],
    totalExpenseTx: 0,
  };

  for (const tx of transactions) {
    if (tx.amount >= 0) continue; // dépenses uniquement
    result.totalExpenseTx++;
    const date = txDate(tx);
    const label = txLabel(tx);

    const excl = exclusions.find((r) => r.test(tx));
    if (excl) {
      result.outOfScope.push({ txId: tx._id, date, amount: tx.amount, label, reason: excl.name });
      continue;
    }

    const matched = (tx.matchedItems ?? []).length > 0;
    if (matched) {
      result.documented++;
      continue;
    }

    // Non liée : un document non-matché du même montant existe-t-il déjà ?
    const abs = Math.abs(tx.amount);
    const cand = unmatchedExpenses.find((e) => {
      const amt = e.totalAmount ?? e.amount ?? null;
      if (amt == null || Math.abs(amt - abs) > tol) return false;
      if (!e.expenseDate) return true;
      return Math.abs(Date.parse(e.expenseDate) - Date.parse(date)) <= windowMs;
    });

    const item: MissingItem = {
      txId: tx._id,
      date,
      amount: tx.amount,
      label,
      communication: (tx.communication ?? undefined)?.replace(/\s+/g, " ").trim().slice(0, 140),
    };
    if (cand) {
      item.alreadyInAccountable = {
        expenseId: cand._id,
        supplier: cand.supplier?.name,
        amount: cand.totalAmount ?? cand.amount ?? abs,
      };
      result.toLink.push(item);
    } else {
      result.missing.push(item);
    }
  }

  const byDateDesc = (a: MissingItem, b: MissingItem) => b.date.localeCompare(a.date);
  result.missing.sort(byDateDesc);
  result.toLink.sort(byDateDesc);
  return result;
}

/** Regroupe des items par libellé de fournisseur (pour l'affichage type tracker). */
export function groupBySupplier(items: MissingItem[]): Map<string, MissingItem[]> {
  const map = new Map<string, MissingItem[]>();
  for (const it of items) {
    const key = it.label || "(inconnu)";
    (map.get(key) ?? map.set(key, []).get(key)!).push(it);
  }
  return map;
}

function text(tx: Transaction): string {
  return `${tx.counterPartyName ?? ""} ${tx.originalCounterPartyName ?? ""} ${tx.communication ?? ""}`;
}

export function txDate(tx: Transaction): string {
  return (tx.valueDate ?? tx.executionDate ?? "").slice(0, 10);
}

/** Alias fournisseur → regroupement propre (aligné sur fournisseurs.xlsx). */
const SUPPLIER_ALIASES: [RegExp, string][] = [
  [/claude|anthropic/i, "Anthropic (Claude.ai)"],
  [/google.?workspace/i, "Google Workspace"],
  [/google.?cloud/i, "Google Cloud"],
  [/hetzner/i, "Hetzner Online"],
  [/eu\.store\.ui|ubiquiti|ui\.com/i, "Ubiquiti"],
  [/amazon/i, "Amazon"],
  [/4411|parking & mobilit/i, "4411 Parking & Mobility"],
  [/jetbrains/i, "JetBrains"],
  [/tesla/i, "Tesla Belgium"],
  [/pluxee/i, "Pluxee"],
  [/doccle/i, "Doccle"],
  [/orange/i, "Orange"],
  [/telenet/i, "Telenet"],
  [/proximus/i, "Proximus"],
];

function matchAlias(text: string): string | null {
  for (const [re, name] of SUPPLIER_ALIASES) if (re.test(text)) return name;
  return null;
}

/** Extrait le marchand d'une communication de paiement carte (segment après l'heure). */
function merchantFromCard(comm: string): string | null {
  if (!/mastercard|bancontact|debit/i.test(comm)) return null;
  const seg = comm.split(/\s+-\s+/);
  const i = seg.findIndex((s) => /^\d{1,2}h\d{2}$/.test(s.trim()));
  if (i >= 0 && seg[i + 1]) {
    return seg[i + 1]
      .replace(/\*/g, " ")
      .replace(/\s+\d[\d ]*$/, "") // code postal / store en fin
      .replace(/\s+/g, " ")
      .trim();
  }
  return null;
}

export function txLabel(tx: Transaction): string {
  const name = (tx.counterPartyName ?? tx.originalCounterPartyName ?? "").trim();
  const comm = (tx.communication ?? "").replace(/\s+/g, " ").trim();
  const alias = matchAlias(`${name} ${comm}`);
  if (alias) return alias;
  if (name) return name;
  return merchantFromCard(comm) || comm.slice(0, 40) || "(inconnu)";
}
