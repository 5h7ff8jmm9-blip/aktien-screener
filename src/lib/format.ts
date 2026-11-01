const de = (opts: Intl.NumberFormatOptions) => new Intl.NumberFormat("de-DE", opts);

export function fmtNum(v: unknown, digits = 2): string {
  const n = Number(v);
  if (v == null || v === "" || !Number.isFinite(n)) return "–";
  return de({ minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
}

export function fmtBig(v: unknown): string {
  const n = Number(v);
  if (v == null || !Number.isFinite(n)) return "–";
  const a = Math.abs(n);
  if (a >= 1e12) return fmtNum(n / 1e12, 2) + " Bio.";
  if (a >= 1e9) return fmtNum(n / 1e9, 2) + " Mrd.";
  if (a >= 1e6) return fmtNum(n / 1e6, 1) + " Mio.";
  return fmtNum(n, 0);
}

/** Dezimalwert (0.12) -> "12,0 %" */
export function fmtPct(v: unknown, digits = 1): string {
  const n = Number(v);
  if (v == null || !Number.isFinite(n)) return "–";
  return fmtNum(n * 100, digits) + " %";
}

export function fmtStand(iso?: string | null): string {
  if (!iso) return "–";
  return new Date(iso).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
}

export function signClass(v: unknown): string {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return "";
  return n > 0 ? "text-positive" : "text-negative";
}
