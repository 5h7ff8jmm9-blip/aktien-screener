import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Anmelden – Kursterminal" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "err" | "ok"; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg({ kind: "err", text: error.message === "Invalid login credentials" ? "E-Mail oder Passwort falsch." : error.message });
      else navigate({ to: "/screener" });
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) setMsg({ kind: "err", text: error.message });
      else if (data.session) navigate({ to: "/screener" });
      else setMsg({ kind: "ok", text: "Fast geschafft: Bitte bestätige deine E-Mail-Adresse über den Link in deinem Postfach." });
    }
    setBusy(false);
  }

  const input = "w-full rounded-sm border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="panel w-full max-w-sm">
        <div className="border-b border-border px-5 py-4">
          <div className="num text-sm font-semibold tracking-widest text-primary">KURSTERMINAL</div>
          <div className="mt-1 text-xs text-muted-foreground">{mode === "login" ? "Anmelden" : "Konto erstellen"}</div>
        </div>
        <form onSubmit={submit} className="space-y-3 px-5 py-4">
          <label className="block text-xs text-muted-foreground">
            E-Mail
            <input className={input + " mt-1"} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="block text-xs text-muted-foreground">
            Passwort
            <input className={input + " mt-1"} type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {msg && <div className={`text-xs ${msg.kind === "err" ? "text-negative" : "text-positive"}`}>{msg.text}</div>}
          <button disabled={busy} className="w-full rounded-sm bg-primary py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {busy ? "Bitte warten…" : mode === "login" ? "Anmelden" : "Registrieren"}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setMsg(null);
            }}
            className="w-full text-xs text-muted-foreground hover:text-foreground"
          >
            {mode === "login" ? "Noch kein Konto? Registrieren" : "Bereits registriert? Anmelden"}
          </button>
        </form>
      </div>
    </div>
  );
}
