import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ApiResult } from "./market.server";

const srv = () => import("./market.server");
const isAV = (t: string) => t.includes(".");
const T = (t: string) => t.trim().toUpperCase();

export type ScreenFilter = { field: string; operator: string; value: number | string | string[] };

export type ScreenRow = Record<string, any> & { ticker: string; name?: string; sector?: string };

export const runScreen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { filters: ScreenFilter[]; limit?: number }) => d)
  .handler(async ({ data }): Promise<ApiResult<ScreenRow[]>> => {
    const s = await srv();
    const r = await s.fdPost<{ results: ScreenRow[] }>(
      "/financials/search/screener",
      { filters: data.filters, limit: Math.min(data.limit ?? 100, 200) },
      s.TTL_FUND,
    );
    if (!r.ok) return r;
    const rows = r.data.results ?? [];
    // Namen/Sektor für die ersten 30 Treffer ergänzen (24h gecached)
    const facts = await Promise.all(rows.slice(0, 30).map((row) => s.fdGet("/company/facts", { ticker: row.ticker }, s.TTL_FUND)));
    const out = rows.map((row, i) => {
      const f = facts[i];
      const cf = f && f.ok ? (f.data as any).company_facts : null;
      return { ...row, name: cf?.name, sector: row.sector ?? cf?.sector };
    });
    return { ...r, data: out };
  });

export const getOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ticker: string }) => d)
  .handler(async ({ data }) => {
    const s = await srv();
    const t = T(data.ticker);
    if (isAV(t)) {
      const [quote, overview] = await Promise.all([
        s.avGet({ function: "GLOBAL_QUOTE", symbol: t }, s.TTL_PRICE),
        s.avGet({ function: "OVERVIEW", symbol: t }, s.TTL_FUND),
      ]);
      return { source: "av" as const, quote, overview, snapshot: null, facts: null, metrics: null };
    }
    const [snapshot, facts, metrics] = await Promise.all([
      s.fdGet("/prices/snapshot", { ticker: t }, s.TTL_PRICE),
      s.fdGet("/company/facts", { ticker: t }, s.TTL_FUND),
      s.fdGet("/financial-metrics/snapshot", { ticker: t }, s.TTL_FUND),
    ]);
    return { source: "fd" as const, snapshot, facts, metrics, quote: null, overview: null };
  });

export type PricePoint = { date: string; close: number };

export const getPrices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ticker: string; range: "1M" | "6M" | "1J" | "5J" }) => d)
  .handler(async ({ data }): Promise<ApiResult<PricePoint[]>> => {
    const s = await srv();
    const t = T(data.ticker);
    const days = { "1M": 31, "6M": 183, "1J": 366, "5J": 1827 }[data.range];
    const start = new Date(Date.now() - days * 86400000);
    if (isAV(t)) {
      const r = await s.avGet(
        { function: "TIME_SERIES_DAILY", symbol: t, outputsize: data.range === "1M" ? "compact" : "full" },
        s.TTL_PRICE,
      );
      if (!r.ok) return r;
      const series = (r.data as any)["Time Series (Daily)"] ?? {};
      const pts = Object.entries(series)
        .map(([date, v]: [string, any]) => ({ date, close: Number(v["4. close"]) }))
        .filter((p) => new Date(p.date) >= start)
        .sort((a, b) => a.date.localeCompare(b.date));
      return { ...r, data: pts };
    }
    const today = new Date().toISOString().slice(0, 10);
    const r = await s.fdGet(
      "/prices",
      {
        ticker: t,
        interval: data.range === "5J" ? "week" : "day",
        start_date: start.toISOString().slice(0, 10),
        end_date: today,
      },
      s.TTL_PRICE,
    );
    if (!r.ok) return r;
    const pts = ((r.data as any).prices ?? []).map((p: any) => ({
      date: String(p.time ?? p.date).slice(0, 10),
      close: Number(p.close),
    }));
    return { ...r, data: pts };
  });

export const getFinancials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ticker: string }) => d)
  .handler(async ({ data }) => {
    const s = await srv();
    const t = T(data.ticker);
    const [incA, incQ, cfA, cfQ] = await Promise.all([
      s.fdGet("/financials/income-statements", { ticker: t, period: "annual", limit: 6 }, s.TTL_FUND),
      s.fdGet("/financials/income-statements", { ticker: t, period: "quarterly", limit: 12 }, s.TTL_FUND),
      s.fdGet("/financials/cash-flow-statements", { ticker: t, period: "annual", limit: 6 }, s.TTL_FUND),
      s.fdGet("/financials/cash-flow-statements", { ticker: t, period: "quarterly", limit: 12 }, s.TTL_FUND),
    ]);
    return { incA, incQ, cfA, cfQ };
  });

export const getBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ticker: string; period: "annual" | "quarterly" }) => d)
  .handler(async ({ data }) => {
    const s = await srv();
    return s.fdGet("/financials/balance-sheets", { ticker: T(data.ticker), period: data.period, limit: 6 }, s.TTL_FUND);
  });

export const getNews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ticker: string }) => d)
  .handler(async ({ data }) => {
    const s = await srv();
    return s.fdGet("/news", { ticker: T(data.ticker), limit: 30 }, s.TTL_PRICE);
  });

export const getInsider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ticker: string }) => d)
  .handler(async ({ data }) => {
    const s = await srv();
    return s.fdGet("/insider-trades", { ticker: T(data.ticker), limit: 50 }, s.TTL_FUND);
  });

export const getTechnicals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ticker: string }) => d)
  .handler(async ({ data }) => {
    const s = await srv();
    const t = T(data.ticker);
    const base = { symbol: t, interval: "daily", series_type: "close" };
    const [rsi, sma50, sma200] = await Promise.all([
      s.avGet({ ...base, function: "RSI", time_period: "14" }, s.TTL_FUND),
      s.avGet({ ...base, function: "SMA", time_period: "50" }, s.TTL_FUND),
      s.avGet({ ...base, function: "SMA", time_period: "200" }, s.TTL_FUND),
    ]);
    const latest = (r: ApiResult<any>, key: string, field: string) => {
      if (!r.ok) return null;
      const series = r.data[key] ?? {};
      const d = Object.keys(series).sort().at(-1);
      return d ? Number(series[d][field]) : null;
    };
    const err = [rsi, sma50, sma200].find((r) => !r.ok);
    return {
      error: err && !err.ok ? err : null,
      rsi: latest(rsi, "Technical Analysis: RSI", "RSI"),
      sma50: latest(sma50, "Technical Analysis: SMA", "SMA"),
      sma200: latest(sma200, "Technical Analysis: SMA", "SMA"),
      fetchedAt: rsi.ok ? rsi.fetchedAt : null,
    };
  });

export const searchSymbols = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { q: string }) => d)
  .handler(async ({ data }) => {
    const s = await srv();
    const r = await s.avGet({ function: "SYMBOL_SEARCH", keywords: data.q.trim() }, s.TTL_FUND);
    if (!r.ok) return r;
    const matches = ((r.data as any).bestMatches ?? []).map((m: any) => ({
      symbol: m["1. symbol"] as string,
      name: m["2. name"] as string,
      region: m["4. region"] as string,
      currency: m["8. currency"] as string,
    }));
    return { ...r, data: matches as { symbol: string; name: string; region: string; currency: string }[] };
  });
