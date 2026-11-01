import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Prüft das Bearer-Token des eingeloggten Nutzers für Server-Funktionen.
export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Supabase-Umgebungsvariablen fehlen (SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY).");

  const authHeader = getRequest()?.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");
  const token = authHeader.slice("Bearer ".length);
  if (token.split(".").length !== 3) throw new Error("Unauthorized: Invalid token");

  const supabase = createClient<Database>(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) throw new Error("Unauthorized: Invalid token");

  return next({ context: { supabase, userId: data.claims.sub, claims: data.claims } });
});
