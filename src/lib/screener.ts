import type { ScreenFilter } from "./market.functions";

export type RangeKey = "marketCap" | "pe" | "ps" | "revGrowth" | "netMargin" | "roe" | "de" | "divYield";
export type ScreenState = {
  ranges: Partial<Record<RangeKey, { min?: string; max?: string }>>;
  sectors: string[];
};

/** UI-Eingabe -> API-Feld und Umrechnungsfaktor (Mrd. USD bzw. Prozent -> Dezimal) */
export const RANGE_DEFS: { key: RangeKey; label: string; unit: string; field: string; factor: number }[] = [
  { key: "marketCap", label: "Marktkapitalisierung", unit: "Mrd. $", field: "market_cap", factor: 1e9 },
  { key: "pe", label: "KGV (P/E)", unit: "x", field: "pe_ratio", factor: 1 },
  { key: "ps", label: "KUV (P/S)", unit: "x", field: "ps_ratio", factor: 1 },
  { key: "revGrowth", label: "Umsatzwachstum", unit: "%", field: "revenue_growth", factor: 0.01 },
  { key: "netMargin", label: "Nettomarge", unit: "%", field: "net_margin", factor: 0.01 },
  { key: "roe", label: "ROE", unit: "%", field: "return_on_equity", factor: 0.01 },
  { key: "de", label: "Verschuldungsgrad (D/E)", unit: "x", field: "debt_to_equity", factor: 1 },
  { key: "divYield", label: "Dividendenrendite", unit: "%", field: "dividend_yield", factor: 0.01 },
];

export const SECTORS: { value: string; label: string }[] = [
  { value: "Information Technology", label: "IT" },
  { value: "Health Care", label: "Gesundheit" },
  { value: "Financials", label: "Finanzen" },
  { value: "Consumer Discretionary", label: "Zyklischer Konsum" },
  { value: "Consumer Staples", label: "Basiskonsum" },
  { value: "Communication Services", label: "Kommunikation" },
  { value: "Industrials", label: "Industrie" },
  { value: "Energy", label: "Energie" },
  { value: "Materials", label: "Rohstoffe" },
  { value: "Utilities", label: "Versorger" },
  { value: "Real Estate", label: "Immobilien" },
];

const parse = (s?: string) => {
  if (s == null || s.trim() === "") return null;
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** Spalten, die immer angefragt werden, damit die Tabelle gefüllt ist (API liefert nur gefilterte Felder). */
const ALWAYS = ["market_cap", "pe_ratio", "revenue_growth", "net_margin", "return_on_equity"];

export function buildFilters(state: ScreenState): ScreenFilter[] {
  const out: ScreenFilter[] = [];
  const used = new Set<string>();
  for (const d of RANGE_DEFS) {
    const r = state.ranges[d.key];
    const min = parse(r?.min);
    const max = parse(r?.max);
    if (min != null) out.push({ field: d.field, operator: "gte", value: min * d.factor });
    if (max != null) out.push({ field: d.field, operator: "lte", value: max * d.factor });
    if (min != null || max != null) used.add(d.field);
  }
  for (const f of ALWAYS) if (!used.has(f)) out.push({ field: f, operator: "gt", value: f === "market_cap" ? 0 : -1e12 });
  if (state.sectors.length) out.push({ field: "sector", operator: "in", value: state.sectors });
  return out;
}
