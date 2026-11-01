import { createFileRoute, Outlet, redirect, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TickerSearch } from "@/components/TickerSearch";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AppLayout,
});

function AppLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const link = "px-3 py-3 text-xs font-medium text-muted-foreground hover:text-foreground border-b-2 border-transparent";
  const active = { className: "text-foreground border-primary" };

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-card px-4">
        <Link to="/screener" className="num mr-4 text-xs font-semibold tracking-widest text-primary">
          KURSTERMINAL
        </Link>
        <Link to="/screener" className={link} activeProps={active}>
          Screener
        </Link>
        <Link to="/watchlist" className={link} activeProps={active}>
          Watchlist
        </Link>
        <Link to="/depot" className={link} activeProps={active}>
          Mein Depot
        </Link>
        <div className="ml-auto flex items-center gap-3">
          <TickerSearch />
          <span className="hidden text-[11px] text-muted-foreground md:inline">{user.email}</span>
          <button onClick={signOut} className="text-[11px] text-muted-foreground hover:text-foreground">
            Abmelden
          </button>
        </div>
      </nav>
      <main className="p-3">
        <Outlet />
      </main>
    </div>
  );
}
