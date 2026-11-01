import { createFileRoute } from "@tanstack/react-router";
import { Panel } from "@/components/DataBlock";

export const Route = createFileRoute("/_authenticated/depot")({
  head: () => ({ meta: [{ title: "Mein Depot – Kursterminal" }] }),
  component: () => (
    <Panel title="Mein Depot">
      <p className="text-xs text-muted-foreground">Der Depot-Import (Trade Republic CSV) folgt im nächsten Schritt.</p>
    </Panel>
  ),
});
