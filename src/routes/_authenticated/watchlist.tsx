import { createFileRoute } from "@tanstack/react-router";
import { Panel } from "@/components/DataBlock";

export const Route = createFileRoute("/_authenticated/watchlist")({
  head: () => ({ meta: [{ title: "Watchlist – Kursterminal" }] }),
  component: () => (
    <Panel title="Watchlist">
      <p className="text-xs text-muted-foreground">Die Watchlist folgt im nächsten Schritt.</p>
    </Panel>
  ),
});
