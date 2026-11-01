import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { runScreen, type ScreenRow } from "@/lib/market.functions";
import { RANGE_DEFS, SECTORS, buildFilters, type ScreenState } from "@/lib/screener";
import { fmtBig, fmtNum, fmtPct, signClass } from "@/lib/format";
import { ErrorBox, Loading, Panel } from "@/components/DataBlock";

export const Route = createFileRoute("/_authenticated/screener")({
  head: () => ({ meta: [{ title: "Screener – Kursterminal" }] }),
  component: ScreenerPage,
});

type SortKey = "ticker" | "name" | "sector" | "market_cap" | "pe_ratio" | "revenue_growth" | "net_margin" | "return_on_equity" | "dividend_yield";
const COLS: { key: SortKey; label: string; num?: boolean; fmt?: (v: any) => string; sign?: boolean }[] = [
  { key: "ticker", label: "Ticker" },
  { key: "name", label: "Name" },
  { key: "sector", label: "Sektor" },
  { key: "market_cap", label: "Marktkap.", num: true, fmt: fmtBig },
  { key: "pe_ratio", label: "KGV", num: true, fmt: (v) => fmtNum(v, 1) },
  { key: "revenue_growth", label: "Umsatzw.", num: true, fmt: fmtPct, sign: true },
  { key: "net_margin", label: "Nettomarge", num: true, fmt: fmtPct, sign: true },
  { key: "return_on_equity", label: "ROE", num: true, fmt: fmtPct, sign: true },
  { key: "dividend_yield", label: "Div.-Rendite", num: true, fmt: (v) => fmtPct(v, 2) },
];

const EMPTY: ScreenState = { ranges: {}, sectors: [] };

function ScreenerPage() {
  const screen = useServerFn(runScreen);
  const qc = useQueryClient();
  const [state, setState] = useState<ScreenState>(EMPTY);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "market_cap", dir: -1 });
  const [saveName, setSaveName] = useState("");

  const run = useMutation({ mutationFn: () => screen({ data: { filters: buildFilters(state), limit: 100 } }) });

  const saved = useQuery({
    queryKey: ["saved_screens"],
    queryFn: async () => {
      const { data, error } = await supabase.from("saved_screens").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function save() {
    if (!saveName.trim()) return;
    const { error } = await supabase.from("saved_screens").insert({ name: saveName.trim(), filters: state as never });
    if (error) {
      toast.error("Speichern fehlgeschlagen: " + error.message);
      return;
    }
    setSaveName("");
    toast.success("Screen gespeichert");
    qc.invalidateQueries({ queryKey: ["saved_screens"] });
  }
  async function remove(id: string) {
    await supabase.from("saved_screens").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["saved_screens"] });
  }

  const result = run.data;
  const rows = useMemo(() => {
    if (!result?.ok) return [];
    return [...result.data].sort((a: ScreenRow, b: ScreenRow) => {
      const x = a[sort.key],
        y = b[sort.key];
      if (x == null) return 1;
      if (y == null) return -1;
      return (typeof x === "number" ? x - y : String(x).localeCompare(String(y))) * sort.dir;
    });
  }, [result, sort]);

  const setRange = (key: string, side: "min" | "max", v: string) =>
    setState((s) => ({ ...s, ranges: { ...s.ranges, [key]: { ...s.ranges[key as keyof typeof s.ranges], [side]: v } } }));
  const toggleSector = (v: string) =>
    setState((s) => ({ ...s, sectors: s.sectors.includes(v) ? s.sectors.filter((x) => x !== v) : [...s.sectors, v] }));

  const inp = "num w-full rounded-sm border border-input bg-background px-1.5 py-1 text-xs outline-none focus:border-primary";

  return (
    <div className="grid gap-3 lg:grid-cols-[280px_1fr]">
      <aside className="space-y-3">
        <Panel title="Filter">
          <div className="space-y-2.5">
            {RANGE_DEFS.map((d) => (
              <div key={d.key}>
                <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                  <span>{d.label}</span>
                  <span className="num">{d.unit}</span>
                </div>
                <div className="flex gap-1.5">
                  <input className={inp} placeholder="min" value={state.ranges[d.key]?.min ?? ""} onChange={(e) => setRange(d.key, "min", e.target.value)} />
                  <input className={inp} placeholder="max" value={state.ranges[d.key]?.max ?? ""} onChange={(e) => setRange(d.key, "max", e.target.value)} />
                </div>
              </div>
            ))}
            <div>
              <div className="mb-1 text-[11px] text-muted-foreground">Sektor</div>
              <div className="flex flex-wrap gap-1">
                {SECTORS.map((s) => {
                  const on = state.sectors.includes(s.value);
                  return (
                    <button
                      key={s.value}
                      onClick={() => toggleSector(s.value)}
                      className={`rounded-sm border px-1.5 py-0.5 text-[11px] ${on ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => run.mutate()}
                disabled={run.isPending}
                className="flex-1 rounded-sm bg-primary py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
              >
                {run.isPending ? "Screene…" : "Screenen"}
              </button>
              <button onClick={() => setState(EMPTY)} className="rounded-sm border border-border px-2 text-xs text-muted-foreground hover:text-foreground">
                Zurücksetzen
              </button>
            </div>
          </div>
        </Panel>

        <Panel title="Gespeicherte Screens">
          <div className="mb-2 flex gap-1.5">
            <input className={inp} placeholder="Name des Screens" value={saveName} onChange={(e) => setSaveName(e.target.value)} />
            <button onClick={save} className="rounded-sm border border-primary px-2 text-xs text-primary">
              Speichern
            </button>
          </div>
          {saved.isLoading && <Loading />}
          {saved.data?.length === 0 && <div className="text-xs text-muted-foreground">Noch keine Screens gespeichert.</div>}
          <ul className="divide-y divide-border">
            {saved.data?.map((s) => (
              <li key={s.id} className="flex items-center gap-2 py-1">
                <button className="flex-1 truncate text-left text-xs hover:text-primary" onClick={() => setState(s.filters as unknown as ScreenState)}>
                  {s.name}
                </button>
                <button onClick={() => remove(s.id)} className="text-[11px] text-muted-foreground hover:text-negative">
                  Löschen
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      </aside>

      <Panel title={`Ergebnisse${result?.ok ? ` (${rows.length})` : ""}`} stand={result?.ok ? result.fetchedAt : undefined}>
        {run.isPending && <Loading label="Screener läuft…" />}
        {run.error && <ErrorBox error={{ message: String(run.error.message) }} />}
        {result && !result.ok && <ErrorBox error={result} />}
        {!result && !run.isPending && <div className="py-8 text-center text-xs text-muted-foreground">Filter setzen und „Screenen“ klicken.</div>}
        {result?.ok && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-[11px] text-muted-foreground">
                  {COLS.map((c) => (
                    <th
                      key={c.key}
                      onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? (s.dir === 1 ? -1 : 1) : c.num ? -1 : 1 }))}
                      className={`cursor-pointer select-none px-2 py-1.5 font-medium hover:text-foreground ${c.num ? "text-right" : "text-left"}`}
                    >
                      {c.label}
                      {sort.key === c.key && <span className="ml-0.5 text-primary">{sort.dir === 1 ? "▲" : "▼"}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.ticker} className="border-b border-border/50 hover:bg-accent/50">
                    {COLS.map((c) => (
                      <td key={c.key} className={`px-2 py-1 ${c.num ? "num text-right" : ""} ${c.sign ? signClass(r[c.key]) : ""}`}>
                        {c.key === "ticker" ? (
                          <Link to="/aktie/$ticker" params={{ ticker: r.ticker }} className="num font-semibold text-primary hover:underline">
                            {r.ticker}
                          </Link>
                        ) : c.fmt ? (
                          c.fmt(r[c.key])
                        ) : (
                          <span className="block max-w-[220px] truncate">{r[c.key] ?? "–"}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <div className="py-6 text-center text-xs text-muted-foreground">Keine Treffer für diese Filter.</div>}
            <p className="mt-2 text-[10px] text-muted-foreground">
              Div.-Rendite wird nur angezeigt, wenn danach gefiltert wird. Name/Sektor werden für die ersten 30 Treffer geladen.
            </p>
          </div>
        )}
      </Panel>
    </div>
  );
}
