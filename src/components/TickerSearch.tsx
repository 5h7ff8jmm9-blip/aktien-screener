import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { searchSymbols } from "@/lib/market.functions";

type Match = { symbol: string; name: string; region: string; currency: string };

export function TickerSearch() {
  const navigate = useNavigate();
  const search = useServerFn(searchSymbols);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Match[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setItems([]);
      setErr(null);
      return;
    }
    timer.current = setTimeout(async () => {
      setLoading(true);
      const r = await search({ data: { q } });
      setLoading(false);
      if (r.ok) {
        setItems(r.data);
        setErr(null);
      } else {
        setItems([]);
        setErr(r.message);
      }
    }, 500);
    return () => clearTimeout(timer.current);
  }, [q, search]);

  function go(sym: string) {
    setOpen(false);
    setQ("");
    navigate({ to: "/aktie/$ticker", params: { ticker: sym.toUpperCase() } });
  }

  return (
    <div className="relative">
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && q.trim()) go(items[0]?.symbol ?? q.trim());
        }}
        placeholder="Ticker / Name suchen…"
        className="num w-60 rounded-sm border border-input bg-background px-2 py-1 text-xs outline-none focus:border-primary"
      />
      {open && q.trim().length >= 2 && (
        <div className="absolute right-0 top-full z-40 mt-1 w-96 overflow-hidden rounded-sm border border-border bg-popover shadow-lg">
          {loading && <div className="px-3 py-2 text-xs text-muted-foreground">Suche…</div>}
          {err && <div className="px-3 py-2 text-xs text-negative">{err}</div>}
          {!loading && !err && items.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">Keine Treffer – Enter öffnet „{q.toUpperCase()}“ direkt.</div>
          )}
          {items.map((m) => (
            <button
              key={m.symbol}
              onMouseDown={() => go(m.symbol)}
              className="flex w-full items-center gap-3 px-3 py-1.5 text-left text-xs hover:bg-accent"
            >
              <span className="num w-24 shrink-0 font-semibold text-primary">{m.symbol}</span>
              <span className="truncate">{m.name}</span>
              <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                {m.region} · {m.currency}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
