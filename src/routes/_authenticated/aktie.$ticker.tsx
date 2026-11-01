import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getFinancials, getInsider, getNews, getOverview, getPrices, getTechnicals } from "@/lib/market.functions";
import { fmtBig, fmtNum, fmtPct, fmtStand, signClass } from "@/lib/format";
import { ErrorBox, Loading, Panel } from "@/components/DataBlock";

export const Route = createFileRoute("/_authenticated/aktie/$ticker")({
  head: ({ params }) => ({ meta: [{ title: `${params.ticker.toUpperCase()} – Kursterminal` }] }),
  component: StockPage,
});

const RANGES = ["1M", "6M", "1J", "5J"] as const;
const tooltipStyle = { background: "var(--popover)", border: "1px solid var(--border)", fontSize: 11, fontFamily: "var(--font-mono)" };
const axisTick = { fill: "var(--muted-foreground)", fontSize: 10, fontFamily: "var(--font-mono)" };

function StockPage() {
  const { ticker: raw } = Route.useParams();
  const ticker = raw.toUpperCase();
  const isAV = ticker.includes(".");
  const fOverview = useServerFn(getOverview);
  const overview = useQuery({ queryKey: ["overview", ticker], queryFn: () => fOverview({ data: { ticker } }) });
  const [tab, setTab] = useState<"fin" | "news" | "insider">("fin");

  return (
    <div className="space-y-3">
      <Header ticker={ticker} q={overview} />
      <div className="grid gap-3 xl:grid-cols-[1fr_380px]">
        <PriceChart ticker={ticker} />
        <Metrics q={overview} />
      </div>
      <Technicals ticker={ticker} />
      {isAV ? (
        <Panel title="Finanzen / News / Insider">
          <p className="text-xs text-muted-foreground">Detaillierte Finanzberichte, News und Insider-Trades sind nur für US-Aktien verfügbar.</p>
        </Panel>
      ) : (
        <div>
          <div className="flex gap-1 border-b border-border">
            {(
              [
                ["fin", "Finanzen"],
                ["news", "News"],
                ["insider", "Insider"],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`border-b-2 px-3 py-1.5 text-xs ${tab === k ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="pt-3">
            {tab === "fin" && <Financials ticker={ticker} />}
            {tab === "news" && <News ticker={ticker} />}
            {tab === "insider" && <Insider ticker={ticker} />}
          </div>
        </div>
      )}
    </div>
  );
}

type OverviewQ = ReturnType<typeof useQuery<Awaited<ReturnType<typeof getOverview>>>>;

function Header({ ticker, q }: { ticker: string; q: OverviewQ }) {
  const d = q.data;
  let name = "",
    price: number | null = null,
    chg: number | null = null,
    chgPct: number | null = null,
    mcap: unknown = null,
    stand: string | null = null,
    currency = "USD",
    err: any = null,
    sector = "";
  if (d?.source === "fd") {
    if (d.snapshot.ok) {
      const s = (d.snapshot.data as any).snapshot ?? {};
      price = s.price;
      chg = s.day_change;
      chgPct = s.day_change_percent;
      mcap = s.market_cap;
      stand = d.snapshot.fetchedAt;
    } else err = d.snapshot;
    if (d.facts.ok) {
      const f = (d.facts.data as any).company_facts ?? {};
      name = f.name;
      sector = f.sector;
      mcap = mcap ?? f.market_cap;
    }
    if (d.metrics.ok) mcap = mcap ?? (d.metrics.data as any).snapshot?.market_cap;
  } else if (d?.source === "av") {
    if (d.quote.ok) {
      const g = (d.quote.data as any)["Global Quote"] ?? {};
      price = Number(g["05. price"]);
      chg = Number(g["09. change"]);
      chgPct = parseFloat(g["10. change percent"]);
      stand = d.quote.fetchedAt;
    } else err = d.quote;
    if (d.overview.ok) {
      const o = d.overview.data as any;
      name = o.Name;
      sector = o.Sector;
      mcap = o.MarketCapitalization;
      currency = o.Currency ?? currency;
    }
  }
  return (
    <section className="panel flex flex-wrap items-end gap-x-8 gap-y-2 px-4 py-3">
      <div>
        <div className="num text-xl font-semibold text-primary">{ticker}</div>
        <div className="text-xs text-muted-foreground">
          {name || "—"}
          {sector ? ` · ${sector}` : ""}
        </div>
      </div>
      {q.isLoading ? (
        <Loading />
      ) : err ? (
        <ErrorBox error={err} />
      ) : (
        <>
          <div>
            <div className="num text-2xl font-semibold">
              {fmtNum(price)} <span className="text-xs text-muted-foreground">{currency}</span>
            </div>
            <div className={`num text-xs ${signClass(chg)}`}>
              {chg != null && chg > 0 ? "+" : ""}
              {fmtNum(chg)} ({chgPct != null && chgPct > 0 ? "+" : ""}
              {fmtNum(chgPct)} %)
            </div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground">Marktkap.</div>
            <div className="num text-sm">{fmtBig(mcap)}</div>
          </div>
        </>
      )}
      <div className="num ml-auto text-[10px] text-muted-foreground">Stand: {fmtStand(stand)}</div>
    </section>
  );
}

function PriceChart({ ticker }: { ticker: string }) {
  const [range, setRange] = useState<(typeof RANGES)[number]>("6M");
  const fn = useServerFn(getPrices);
  const q = useQuery({ queryKey: ["prices", ticker, range], queryFn: () => fn({ data: { ticker, range } }) });
  const r = q.data;
  const pts = r?.ok ? r.data : [];
  const up = pts.length > 1 && pts[pts.length - 1]!.close >= pts[0]!.close;
  const color = up ? "var(--positive)" : "var(--negative)";
  return (
    <Panel
      title="Kursverlauf"
      stand={r?.ok ? r.fetchedAt : null}
      right={
        <div className="flex gap-0.5">
          {RANGES.map((x) => (
            <button
              key={x}
              onClick={() => setRange(x)}
              className={`num rounded-sm px-1.5 py-0.5 text-[10px] ${x === range ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {x}
            </button>
          ))}
        </div>
      }
    >
      {q.isLoading ? (
        <Loading />
      ) : r && !r.ok ? (
        <ErrorBox error={r} />
      ) : pts.length === 0 ? (
        <div className="py-10 text-center text-xs text-muted-foreground">Keine Kursdaten verfügbar.</div>
      ) : (
        <div className="h-72">
          <ResponsiveContainer>
            <AreaChart data={pts} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
              <XAxis
                dataKey="date"
                tick={axisTick}
                minTickGap={40}
                tickFormatter={(d) => new Date(d).toLocaleDateString("de-DE", { month: "short", year: "2-digit" })}
              />
              <YAxis domain={["auto", "auto"]} tick={axisTick} width={50} orientation="right" tickFormatter={(v) => fmtNum(v, 0)} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v) => [fmtNum(v), "Schluss"]}
                labelFormatter={(d) => new Date(String(d)).toLocaleDateString("de-DE")}
              />
              <Area type="monotone" dataKey="close" stroke={color} strokeWidth={1.5} fill="url(#pg)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}

function Metrics({ q }: { q: OverviewQ }) {
  const d = q.data;
  let items: [string, string, unknown?][] = [];
  let stand: string | null = null;
  let err: any = null;
  if (d?.source === "fd") {
    if (d.metrics.ok) {
      const m = (d.metrics.data as any).snapshot ?? {};
      stand = d.metrics.fetchedAt;
      items = [
        ["KGV", fmtNum(m.price_to_earnings_ratio, 1)],
        ["KUV", fmtNum(m.price_to_sales_ratio, 1)],
        ["KBV", fmtNum(m.price_to_book_ratio, 1)],
        ["EV/EBITDA", fmtNum(m.enterprise_value_to_ebitda_ratio, 1)],
        ["PEG", fmtNum(m.peg_ratio, 2)],
        ["FCF-Rendite", fmtPct(m.free_cash_flow_yield)],
        ["Bruttomarge", fmtPct(m.gross_margin), m.gross_margin],
        ["Op. Marge", fmtPct(m.operating_margin), m.operating_margin],
        ["Nettomarge", fmtPct(m.net_margin), m.net_margin],
        ["ROE", fmtPct(m.return_on_equity), m.return_on_equity],
        ["ROA", fmtPct(m.return_on_assets), m.return_on_assets],
        ["ROIC", fmtPct(m.return_on_invested_capital), m.return_on_invested_capital],
        ["Umsatzw.", fmtPct(m.revenue_growth), m.revenue_growth],
        ["Gewinnw.", fmtPct(m.earnings_growth), m.earnings_growth],
        ["EPS", fmtNum(m.earnings_per_share)],
        ["D/E", fmtNum(m.debt_to_equity)],
        ["Current Ratio", fmtNum(m.current_ratio)],
        ["Ausschüttung", fmtPct(m.payout_ratio)],
      ];
    } else err = d.metrics;
  } else if (d?.source === "av") {
    if (d.overview.ok) {
      const o = d.overview.data as any;
      stand = d.overview.fetchedAt;
      items = [
        ["KGV", fmtNum(o.PERatio, 1)],
        ["KUV", fmtNum(o.PriceToSalesRatioTTM, 1)],
        ["KBV", fmtNum(o.PriceToBookRatio, 1)],
        ["EV/EBITDA", fmtNum(o.EVToEBITDA, 1)],
        ["PEG", fmtNum(o.PEGRatio, 2)],
        ["EPS", fmtNum(o.EPS)],
        ["Nettomarge", fmtPct(o.ProfitMargin), o.ProfitMargin],
        ["Op. Marge", fmtPct(o.OperatingMarginTTM), o.OperatingMarginTTM],
        ["ROE", fmtPct(o.ReturnOnEquityTTM), o.ReturnOnEquityTTM],
        ["Umsatzw. (Q/J)", fmtPct(o.QuarterlyRevenueGrowthYOY), o.QuarterlyRevenueGrowthYOY],
        ["Div.-Rendite", fmtPct(o.DividendYield, 2)],
        ["Beta", fmtNum(o.Beta)],
      ];
    } else err = d.overview;
  }
  return (
    <Panel title="Kennzahlen" stand={stand}>
      {q.isLoading ? (
        <Loading />
      ) : err ? (
        <ErrorBox error={err} />
      ) : (
        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-sm bg-border">
          {items.map(([l, v, raw]) => (
            <div key={l} className="bg-card px-2 py-1.5">
              <div className="text-[10px] text-muted-foreground">{l}</div>
              <div className={`num text-xs ${raw !== undefined ? signClass(raw) : ""}`}>{v}</div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function Technicals({ ticker }: { ticker: string }) {
  const fn = useServerFn(getTechnicals);
  const [on, setOn] = useState(false);
  const q = useQuery({ queryKey: ["tech", ticker], queryFn: () => fn({ data: { ticker } }), enabled: on });
  const d = q.data;
  return (
    <Panel
      title="Technische Indikatoren"
      stand={d?.fetchedAt ?? null}
      right={
        !on && (
          <button onClick={() => setOn(true)} className="text-[11px] text-primary hover:underline">
            Laden (3 Alpha-Vantage-Abrufe)
          </button>
        )
      }
    >
      {!on ? (
        <div className="text-xs text-muted-foreground">RSI(14), SMA(50), SMA(200) – auf Anfrage, um das Abrufkontingent zu schonen.</div>
      ) : q.isLoading ? (
        <Loading />
      ) : (
        <div className="space-y-2">
          {d?.error && <ErrorBox error={d.error} />}
          <div className="flex gap-8 text-xs">
            <div>
              <span className="text-muted-foreground">RSI(14) </span>
              <span className={`num ${d?.rsi != null ? (d.rsi > 70 ? "text-negative" : d.rsi < 30 ? "text-positive" : "") : ""}`}>{fmtNum(d?.rsi, 1)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">SMA(50) </span>
              <span className="num">{fmtNum(d?.sma50)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">SMA(200) </span>
              <span className="num">{fmtNum(d?.sma200)}</span>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}

type Period = { label: string; revenue: number | null; grossM: number | null; opM: number | null; netM: number | null; eps: number | null; fcf: number | null };

function toPeriods(inc: any[], cf: any[], quarterly: boolean): Period[] {
  const cfMap = new Map(cf.map((c) => [c.report_period, c]));
  return inc
    .map((i) => {
      const rev = i.revenue ?? null;
      const ratio = (x: any) => (rev && x != null ? x / rev : null);
      const d = new Date(i.report_period);
      const label = quarterly
        ? (i.fiscal_period ?? `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`)
        : String(i.fiscal_period ?? d.getFullYear()).replace(/-?FY/, "");
      return {
        label,
        revenue: rev,
        grossM: ratio(i.gross_profit),
        opM: ratio(i.operating_income),
        netM: ratio(i.net_income),
        eps: i.earnings_per_share ?? null,
        fcf: cfMap.get(i.report_period)?.free_cash_flow ?? null,
      };
    })
    .reverse();
}

const yoy = (a: number | null, b: number | null | undefined) => (a != null && b != null && b !== 0 ? (a - b) / Math.abs(b) : null);

function Financials({ ticker }: { ticker: string }) {
  const fn = useServerFn(getFinancials);
  const q = useQuery({ queryKey: ["fin", ticker], queryFn: () => fn({ data: { ticker } }) });
  const [period, setPeriod] = useState<"annual" | "quarterly">("annual");
  if (q.isLoading) return <Loading />;
  const d = q.data;
  if (!d) return null;
  const inc = period === "annual" ? d.incA : d.incQ;
  const cf = period === "annual" ? d.cfA : d.cfQ;
  if (!inc.ok) return <ErrorBox error={inc} />;
  const periods = toPeriods((inc.data as any).income_statements ?? [], cf.ok ? ((cf.data as any).cash_flow_statements ?? []) : [], period === "quarterly");
  const lag = period === "annual" ? 1 : 4;
  const rows: { label: string; key: keyof Period; fmt: (v: any) => string; ratio?: boolean }[] = [
    { label: "Umsatz", key: "revenue", fmt: fmtBig },
    { label: "Bruttomarge", key: "grossM", fmt: fmtPct, ratio: true },
    { label: "Operative Marge", key: "opM", fmt: fmtPct, ratio: true },
    { label: "Nettomarge", key: "netM", fmt: fmtPct, ratio: true },
    { label: "EPS", key: "eps", fmt: (v) => fmtNum(v) },
    { label: "Free Cashflow", key: "fcf", fmt: fmtBig },
  ];
  const shown = period === "quarterly" ? periods.slice(-8) : periods;
  const offset = periods.length - shown.length;

  return (
    <div className="space-y-3">
      <Panel
        title={period === "annual" ? "Finanzen – Jährlich" : "Finanzen – Quartalsweise (vs. Vorjahresquartal)"}
        stand={inc.fetchedAt}
        right={
          <div className="flex gap-0.5">
            {(
              [
                ["annual", "Jährlich"],
                ["quarterly", "Quartal"],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setPeriod(k)}
                className={`rounded-sm px-1.5 py-0.5 text-[10px] ${period === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {l}
              </button>
            ))}
          </div>
        }
      >
        {!cf.ok && (
          <div className="mb-2">
            <ErrorBox error={cf} />
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-[11px] text-muted-foreground">
                <th className="px-2 py-1 text-left font-medium">Kennzahl</th>
                {shown.map((p) => (
                  <th key={p.label} className="num px-2 py-1 text-right font-medium">
                    {p.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-b border-border/50">
                  <td className="px-2 py-1 text-muted-foreground">{row.label}</td>
                  {shown.map((p, i) => {
                    const prev = periods[offset + i - lag];
                    const v = p[row.key] as number | null;
                    const pv = prev?.[row.key] as number | null | undefined;
                    const delta = row.ratio ? (v != null && pv != null ? v - pv : null) : yoy(v, pv);
                    return (
                      <td key={p.label} className="num px-2 py-1 text-right">
                        <div>{row.fmt(v)}</div>
                        {delta != null && (
                          <div className={`text-[10px] ${signClass(delta)}`}>
                            {delta > 0 ? "+" : ""}
                            {row.ratio ? fmtNum(delta * 100, 1) + " Pp" : fmtPct(delta)}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Veränderung jeweils ggü. {period === "annual" ? "Vorjahr" : "Vorjahresquartal"} (Margen in Prozentpunkten).
          </p>
        </div>
      </Panel>
      <div className="grid gap-3 md:grid-cols-3">
        <MiniBar title="Umsatz" data={shown} dataKey="revenue" fmt={fmtBig} />
        <MiniBar title="EPS" data={shown} dataKey="eps" fmt={(v) => fmtNum(v)} />
        <MiniBar title="Free Cashflow" data={shown} dataKey="fcf" fmt={fmtBig} />
      </div>
      <Panel title="Margen" stand={inc.fetchedAt}>
        <div className="h-56">
          <ResponsiveContainer>
            <BarChart data={shown}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="label" tick={axisTick} />
              <YAxis tick={axisTick} tickFormatter={(v) => fmtNum(v * 100, 0) + "%"} width={45} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtPct(v)} cursor={{ fill: "var(--accent)" }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="grossM" name="Brutto" fill="var(--chart-1)" />
              <Bar dataKey="opM" name="Operativ" fill="var(--chart-3)" />
              <Bar dataKey="netM" name="Netto" fill="var(--chart-2)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </div>
  );
}

function MiniBar({ title, data, dataKey, fmt }: { title: string; data: Period[]; dataKey: keyof Period; fmt: (v: any) => string }) {
  return (
    <Panel title={title}>
      <div className="h-40">
        <ResponsiveContainer>
          <BarChart data={data}>
            <XAxis dataKey="label" tick={axisTick} />
            <YAxis tick={axisTick} tickFormatter={fmt} width={60} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(v)} cursor={{ fill: "var(--accent)" }} />
            <Bar dataKey={dataKey as string} name={title} fill="var(--chart-1)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

function News({ ticker }: { ticker: string }) {
  const fn = useServerFn(getNews);
  const q = useQuery({ queryKey: ["news", ticker], queryFn: () => fn({ data: { ticker } }) });
  const r = q.data;
  return (
    <Panel title="News" stand={r?.ok ? r.fetchedAt : null}>
      {q.isLoading ? (
        <Loading />
      ) : r && !r.ok ? (
        <ErrorBox error={r} />
      ) : (
        <ul className="divide-y divide-border">
          {((r?.ok && (r.data as any).news) || []).map((n: any, i: number) => (
            <li key={n.url ?? i} className="flex gap-3 py-1.5 text-xs">
              <span className="num w-28 shrink-0 text-[11px] text-muted-foreground">
                {n.date ? new Date(n.date).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) : "–"}
              </span>
              <a href={n.url} target="_blank" rel="noreferrer" className="flex-1 hover:text-primary">
                {n.title}
              </a>
              <span className="shrink-0 text-[11px] text-muted-foreground">{n.source}</span>
            </li>
          ))}
          {r?.ok && !((r.data as any).news ?? []).length && <li className="py-4 text-center text-xs text-muted-foreground">Keine News gefunden.</li>}
        </ul>
      )}
    </Panel>
  );
}

function Insider({ ticker }: { ticker: string }) {
  const fn = useServerFn(getInsider);
  const q = useQuery({ queryKey: ["insider", ticker], queryFn: () => fn({ data: { ticker } }) });
  const r = q.data;
  const trades: any[] = (r?.ok && (r.data as any).insider_trades) || [];
  return (
    <Panel title="Insider-Transaktionen" stand={r?.ok ? r.fetchedAt : null}>
      {q.isLoading ? (
        <Loading />
      ) : r && !r.ok ? (
        <ErrorBox error={r} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-[11px] text-muted-foreground">
                <th className="px-2 py-1 text-left font-medium">Datum</th>
                <th className="px-2 py-1 text-left font-medium">Name</th>
                <th className="px-2 py-1 text-left font-medium">Position</th>
                <th className="px-2 py-1 text-right font-medium">Stück</th>
                <th className="px-2 py-1 text-right font-medium">Preis</th>
                <th className="px-2 py-1 text-right font-medium">Wert</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="num px-2 py-1">{t.transaction_date ? new Date(t.transaction_date).toLocaleDateString("de-DE") : "–"}</td>
                  <td className="px-2 py-1">{t.name ?? "–"}</td>
                  <td className="px-2 py-1 text-muted-foreground">{t.title ?? "–"}</td>
                  <td className={`num px-2 py-1 text-right ${signClass(t.transaction_shares)}`}>{fmtNum(t.transaction_shares, 0)}</td>
                  <td className="num px-2 py-1 text-right">{fmtNum(t.transaction_price_per_share)}</td>
                  <td className={`num px-2 py-1 text-right ${signClass(t.transaction_shares)}`}>{fmtBig(t.transaction_value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {r?.ok && trades.length === 0 && <div className="py-4 text-center text-xs text-muted-foreground">Keine Insider-Transaktionen gefunden.</div>}
        </div>
      )}
    </Panel>
  );
}
