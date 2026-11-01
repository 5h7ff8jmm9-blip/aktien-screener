import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "./client";

// Hängt das Login-Token des Browsers an jeden Server-Funktions-Aufruf an.
// Ist in src/start.ts als globale functionMiddleware registriert.
export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
});
