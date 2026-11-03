"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setInfo(null);

    const supabase = createSupabaseBrowserClient();

    if (mode === "signup") {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName || email.split("@")[0] },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (signUpError) {
        setError(signUpError.message);
        setPending(false);
        return;
      }
      if (data.session) {
        router.push(next);
        router.refresh();
        return;
      }
      setInfo("Compte créé. Vérifiez votre boîte mail pour confirmer l’adresse, puis connectez-vous.");
      setMode("signin");
      setPending(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(
        signInError.message === "Invalid login credentials"
          ? "Email ou mot de passe incorrect."
          : signInError.message,
      );
      setPending(false);
      return;
    }
    router.push(next);
    router.refresh();
  }

  async function signInWithGoogle() {
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (oauthError) setError(oauthError.message);
  }

  return (
    <>
      <div className="row" style={{ marginBottom: 16, gap: 6 }}>
        <button
          type="button"
          className={mode === "signin" ? "primary small" : "small"}
          onClick={() => { setMode("signin"); setError(null); setInfo(null); }}
        >
          Se connecter
        </button>
        <button
          type="button"
          className={mode === "signup" ? "primary small" : "small"}
          onClick={() => { setMode("signup"); setError(null); setInfo(null); }}
        >
          Créer un compte
        </button>
      </div>

      {error ? <div className="alert error">{error}</div> : null}
      {info ? <div className="alert ok">{info}</div> : null}

      <form onSubmit={submit}>
        {mode === "signup" ? (
          <div className="field">
            <label htmlFor="fullName">Nom complet</label>
            <input
              id="fullName"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Aboubakar Amadou"
              autoComplete="name"
            />
          </div>
        ) : null}

        <div className="field">
          <label htmlFor="email">Email professionnel</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="vous@entreprise.ne"
            autoComplete="email"
          />
        </div>

        <div className="field">
          <label htmlFor="password">Mot de passe</label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="6 caractères minimum"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />
        </div>

        <button type="submit" className="primary" style={{ width: "100%" }} disabled={pending}>
          {pending ? "…" : mode === "signup" ? "Créer mon compte" : "Se connecter"}
        </button>
      </form>

      <div className="row" style={{ margin: "14px 0 10px" }}>
        <hr style={{ flex: 1, border: 0, borderTop: "1px solid var(--border)" }} />
        <span className="muted small">ou</span>
        <hr style={{ flex: 1, border: 0, borderTop: "1px solid var(--border)" }} />
      </div>

      <button type="button" onClick={signInWithGoogle} style={{ width: "100%" }}>
        Continuer avec Google
      </button>
    </>
  );
}
