import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const configured = isSupabaseConfigured();

  // Sans configuration Supabase, la démo est ouverte : pas d'écran de connexion.
  if (!configured) redirect("/");

  return (
    <>
      <div className="auth-card">
        <div className="row" style={{ marginBottom: 18 }}>
          <div className="logo" style={{ width: 34, height: 34, borderRadius: 9, background: "var(--accent)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 700 }}>
            KA
          </div>
          <div>
            <div style={{ fontWeight: 650 }}>Kanti</div>
            <div className="muted small">Gestion de stock</div>
          </div>
        </div>

        <h1 style={{ marginBottom: 4 }}>Connexion</h1>
        <p className="sub" style={{ marginBottom: 18 }}>
          Accédez à l’espace de votre entreprise.
        </p>

        {params.error ? <div className="alert error">{decodeURIComponent(params.error)}</div> : null}

        <LoginForm next={params.next ?? "/"} />
      </div>
      <p className="muted small" style={{ textAlign: "center", marginTop: 14 }}>
        Pas encore de compte ? Choisissez « Créer un compte », puis créez votre entreprise.
      </p>
    </>
  );
}
