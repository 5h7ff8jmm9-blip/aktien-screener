import type { ReactNode } from "react";
import { fmtStand } from "@/lib/format";

type Err = { ok: false; code: string; message: string };

export function ErrorBox({ error }: { error: Err | { message: string; code?: string } }) {
  const title =
    error.code === "MISSING_KEY"
      ? "API-Schlüssel fehlt"
      : error.code === "RATE_LIMIT"
        ? "Abruflimit erreicht"
        : error.code === "INVALID_KEY"
          ? "API-Schlüssel ungültig"
          : error.code === "NOT_FOUND"
            ? "Keine Daten"
            : "Fehler beim Datenabruf";
  return (
    <div className="rounded-sm border border-negative/40 bg-negative/10 px-3 py-2 text-xs">
      <div className="font-semibold text-negative">{title}</div>
      <div className="mt-0.5 text-muted-foreground">{error.message}</div>
    </div>
  );
}

export function Panel({
  title,
  stand,
  right,
  children,
  className = "",
}: {
  title: string;
  stand?: string | null | undefined;
  right?: ReactNode | undefined;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
        <div className="flex items-center gap-3">
          {right}
          {stand !== undefined && <span className="num text-[10px] text-muted-foreground">Stand: {fmtStand(stand)}</span>}
        </div>
      </header>
      <div className="p-3">{children}</div>
    </section>
  );
}

export function Loading({ label = "Lade Daten…" }: { label?: string }) {
  return <div className="animate-pulse py-6 text-center text-xs text-muted-foreground">{label}</div>;
}
