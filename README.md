# Kursterminal – Aktien-Screener

Professioneller Aktien-Screener und Analyse-Tool (Deutsch). Grundgerüst ursprünglich in Lovable erstellt, Weiterentwicklung hier.

**Stack:** TanStack Start (React 19, SSR + Server-Funktionen), Tailwind CSS 4, Recharts, Supabase (Login + Datenbank).

## Funktionen
- **Screener:** Filter für Marktkap., KGV, KUV, Umsatzwachstum, Nettomarge, ROE, Verschuldung, Dividende, Sektor. Screens speicherbar.
- **Aktien-Detailseite:** Kurs, Chart (1M–5J), Kennzahlen, Finanzen jährlich/quartalsweise (vs. Vorjahr), News, Insider-Trades, RSI/SMA.
- **Ticker-Suche** (inkl. deutscher Werte wie `SAP.DEX` über Alpha Vantage).
- Geplant: Watchlist, Depot-Import (Trade Republic CSV), Aktienvergleich.

## Einrichtung
1. Kostenloses Projekt auf [supabase.com](https://supabase.com) anlegen.
2. Im Supabase-SQL-Editor `supabase/migrations/0000_cache_and_saved_screens.sql` ausführen.
3. `.env.example` nach `.env` kopieren und Werte eintragen (Supabase: Project Settings → API).
4. `npm install` und `npm run dev` → http://localhost:3000

## Architektur
- Externe Marktdaten-APIs werden **nur serverseitig** in `src/lib/market.server.ts` aufgerufen, über login-geschützte Server-Funktionen in `src/lib/market.functions.ts`. API-Keys erreichen nie den Browser.
- Alle API-Antworten werden in der Tabelle `api_cache` gecacht (Kurse 15 Min., Fundamentaldaten 24 h).
- Server-Funktionen liefern `ApiResult` (`{ok,data,fetchedAt}` oder `{ok:false,code,message}`), damit die UI deutsche Fehlermeldungen und „Stand“-Zeitstempel zeigen kann.
- Ticker mit Punkt (z. B. `SAP.DEX`) → Alpha Vantage, sonst → Financial Datasets.
