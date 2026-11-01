// Server-only: API-Proxies für Financial Datasets + Alpha Vantage mit DB-Cache.
export type ApiErrorCode = "MISSING_KEY" | "RATE_LIMIT" | "INVALID_KEY" | "NOT_FOUND" | "API_ERROR";
export type ApiResult<T> =
  | { ok: true; data: T; fetchedAt: string; cached: boolean }
  | { ok: false; code: ApiErrorCode; message: string };

export const TTL_PRICE = 15 * 60 * 1000;
export const TTL_FUND = 24 * 60 * 60 * 1000;

class ApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
  ) {
    super(message);
  }
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function cached<T>(key: string, ttl: number, fetcher: () => Promise<T>): Promise<ApiResult<T>> {
  const db = await admin();
  try {
    const { data: row } = await db.from("api_cache").select("payload, fetched_at").eq("key", key).maybeSingle();
    if (row && Date.now() - new Date(row.fetched_at).getTime() < ttl) {
      return { ok: true, data: row.payload as T, fetchedAt: row.fetched_at, cached: true };
    }
    const fresh = await fetcher();
    const fetchedAt = new Date().toISOString();
    await db.from("api_cache").upsert({ key, payload: fresh as never, fetched_at: fetchedAt });
    return { ok: true, data: fresh, fetchedAt, cached: false };
  } catch (e) {
    if (e instanceof ApiError) {
      // Bei Rate-Limit: abgelaufene Cache-Daten sind besser als nichts
      if (e.code === "RATE_LIMIT") {
        const { data: row } = await db.from("api_cache").select("payload, fetched_at").eq("key", key).maybeSingle();
        if (row) return { ok: true, data: row.payload as T, fetchedAt: row.fetched_at, cached: true };
      }
      return { ok: false, code: e.code, message: e.message };
    }
    console.error(e);
    return { ok: false, code: "API_ERROR", message: "Unerwarteter Fehler beim Datenabruf." };
  }
}

function fdKey() {
  const k = process.env["FINANCIAL_DATASETS_API_KEY"];
  if (!k) throw new ApiError("MISSING_KEY", "API-Schlüssel FINANCIAL_DATASETS_API_KEY fehlt. Bitte in der .env bzw. beim Hoster hinterlegen.");
  return k;
}
function avKey() {
  const k = process.env["ALPHA_VANTAGE_API_KEY"];
  if (!k) throw new ApiError("MISSING_KEY", "API-Schlüssel ALPHA_VANTAGE_API_KEY fehlt. Bitte in der .env bzw. beim Hoster hinterlegen.");
  return k;
}

async function fdHandle(res: Response) {
  if (res.ok) return res.json();
  const txt = await res.text().catch(() => "");
  if (res.status === 429) throw new ApiError("RATE_LIMIT", "Financial Datasets: Abruflimit erreicht. Bitte später erneut versuchen.");
  if (res.status === 401 || res.status === 403) throw new ApiError("INVALID_KEY", "Financial Datasets: API-Schlüssel ungültig oder ohne Berechtigung.");
  if (res.status === 402) throw new ApiError("RATE_LIMIT", "Financial Datasets: Guthaben/Kontingent erschöpft.");
  if (res.status === 404) throw new ApiError("NOT_FOUND", "Financial Datasets: Keine Daten für diese Anfrage gefunden.");
  throw new ApiError("API_ERROR", `Financial Datasets Fehler (${res.status}): ${txt.slice(0, 200)}`);
}

const FD_BASE = "https://api.financialdatasets.ai";

export function fdGet<T = any>(path: string, params: Record<string, string | number>, ttl: number) {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
  return cached<T>(`fd:${path}?${qs}`, ttl, async () => {
    const res = await fetch(`${FD_BASE}${path}?${qs}`, { headers: { "X-API-KEY": fdKey() } });
    return fdHandle(res);
  });
}

export function fdPost<T = any>(path: string, body: unknown, ttl: number) {
  return cached<T>(`fd:POST${path}:${JSON.stringify(body)}`, ttl, async () => {
    const res = await fetch(`${FD_BASE}${path}`, {
      method: "POST",
      headers: { "X-API-KEY": fdKey(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return fdHandle(res);
  });
}

export function avGet<T = any>(params: Record<string, string>, ttl: number) {
  const qs = new URLSearchParams(params).toString();
  return cached<T>(`av:${qs}`, ttl, async () => {
    const res = await fetch(`https://www.alphavantage.co/query?${qs}&apikey=${encodeURIComponent(avKey())}`);
    if (!res.ok) throw new ApiError("API_ERROR", `Alpha Vantage Fehler (${res.status}).`);
    const json = await res.json();
    if (json["Note"] || json["Information"]) {
      const info = String(json["Note"] ?? json["Information"]);
      if (/api key/i.test(info) && /invalid/i.test(info)) throw new ApiError("INVALID_KEY", "Alpha Vantage: API-Schlüssel ungültig.");
      throw new ApiError("RATE_LIMIT", "Alpha Vantage: Abruflimit erreicht (Free-Tier: 25 Anfragen/Tag). Bitte später erneut versuchen.");
    }
    if (json["Error Message"]) throw new ApiError("NOT_FOUND", "Alpha Vantage: Symbol nicht gefunden oder ungültige Anfrage.");
    return json;
  });
}
