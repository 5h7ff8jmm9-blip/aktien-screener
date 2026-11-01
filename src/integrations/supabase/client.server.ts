// Server-only: Supabase-Client mit Service-Role-Key (umgeht RLS).
// Nur in *.server.ts oder per dynamischem Import in Server-Handlern verwenden.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

function createSupabaseAdminClient() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) {
    throw new Error("Supabase-Umgebungsvariablen fehlen (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY). Siehe .env.example.");
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

let _admin: ReturnType<typeof createSupabaseAdminClient> | undefined;

export const supabaseAdmin = new Proxy({} as ReturnType<typeof createSupabaseAdminClient>, {
  get(_, prop, receiver) {
    if (!_admin) _admin = createSupabaseAdminClient();
    return Reflect.get(_admin, prop, receiver);
  },
});
