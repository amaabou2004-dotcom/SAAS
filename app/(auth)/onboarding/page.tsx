import { redirect } from "next/navigation";
import { getSession } from "@/lib/supabase/server";
import { OnboardingForm } from "./OnboardingForm";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/onboarding");

  return (
    <>
      <div className="auth-card" style={{ maxWidth: 440 }}>
        <h1 style={{ marginBottom: 4 }}>Créer votre entreprise</h1>
        <p className="sub" style={{ marginBottom: 18 }}>
          Un espace isolé est créé, avec le rôle Propriétaire et un premier dépôt.
        </p>
        <OnboardingForm />
      </div>
    </>
  );
}
