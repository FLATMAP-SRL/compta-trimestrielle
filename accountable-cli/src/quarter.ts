export interface Period {
  start: string; // YYYY-MM-DD inclus
  end: string; // YYYY-MM-DD exclus (1er jour de la période suivante)
  label: string;
}

/** "2026-Q3" → { start:"2026-07-01", end:"2026-10-01", label:"2026-Q3" }. */
export function parseQuarter(input: string): Period {
  const m = /^(\d{4})-?Q([1-4])$/i.exec(input.trim());
  if (!m) throw new Error(`Trimestre invalide: "${input}" (attendu ex. 2026-Q3)`);
  const year = Number(m[1]);
  const q = Number(m[2]);
  const startMonth = (q - 1) * 3; // 0,3,6,9
  const start = new Date(Date.UTC(year, startMonth, 1));
  const end = new Date(Date.UTC(year, startMonth + 3, 1)); // gère Q4 → année+1 automatiquement
  return { start: iso(start), end: iso(end), label: `${year}-Q${q}` };
}

/** "2026-07-01/2026-10-01" → Period. */
export function parsePeriod(input: string): Period {
  const [start, end] = input.split("/");
  if (!isDate(start) || !isDate(end)) {
    throw new Error(`Période invalide: "${input}" (attendu YYYY-MM-DD/YYYY-MM-DD)`);
  }
  return { start, end, label: `${start}→${end}` };
}

export function currentQuarter(now = new Date()): Period {
  const y = now.getUTCFullYear();
  const q = Math.floor(now.getUTCMonth() / 3) + 1;
  return parseQuarter(`${y}-Q${q}`);
}

/** Résout la période depuis les options CLI (--quarter / --period), défaut = trimestre courant. */
export function resolvePeriod(opts: { quarter?: string; period?: string }): Period {
  if (opts.period) return parsePeriod(opts.period);
  if (opts.quarter) return parseQuarter(opts.quarter);
  return currentQuarter();
}

/** true si `dateIso` (YYYY-MM-DD ou ISO complet) est dans [start, end). */
export function inPeriod(dateIso: string | null | undefined, period: Period): boolean {
  if (!dateIso) return false;
  const d = dateIso.slice(0, 10);
  return d >= period.start && d < period.end;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isDate(s: string | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
