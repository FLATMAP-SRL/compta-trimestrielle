import type { Period } from "../quarter.js";
import { fmtDate } from "./format.js";
import type { ReconcileResult } from "./reconcile.js";

/** Exporte le résultat de réconciliation en .xlsx (import dynamique d'exceljs). */
export async function writeMissingXlsx(
  result: ReconcileResult,
  period: Period,
  path: string,
): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();

  const header = (ws: import("exceljs").Worksheet, cols: string[]) => {
    ws.addRow(cols);
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } };
    ws.views = [{ state: "frozen", ySplit: 1 }];
  };

  const missing = wb.addWorksheet("À récupérer");
  header(missing, ["Date", "Montant", "Fournisseur", "Communication", "Transaction ID"]);
  for (const it of result.missing) {
    missing.addRow([fmtDate(it.date), it.amount, it.label, it.communication ?? "", it.txId]);
  }
  missing.columns.forEach((c, i) => (c.width = [12, 12, 28, 60, 26][i] ?? 16));

  const toLink = wb.addWorksheet("À lier");
  header(toLink, ["Date", "Montant", "Fournisseur", "Dépense ID"]);
  for (const it of result.toLink) {
    toLink.addRow([fmtDate(it.date), it.amount, it.label, it.alreadyInAccountable?.expenseId ?? ""]);
  }
  toLink.columns.forEach((c, i) => (c.width = [12, 12, 28, 26][i] ?? 16));

  const oos = wb.addWorksheet("Hors périmètre");
  header(oos, ["Date", "Montant", "Libellé", "Raison"]);
  for (const it of result.outOfScope) {
    oos.addRow([fmtDate(it.date), it.amount, it.label, it.reason]);
  }
  oos.columns.forEach((c, i) => (c.width = [12, 12, 40, 40][i] ?? 16));

  await wb.xlsx.writeFile(path);
}
