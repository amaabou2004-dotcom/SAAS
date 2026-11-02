import { getDataSource, isSupabaseConfigured } from "@/lib/data/repository";
import { TENANT } from "@/lib/data/snapshot";

export const dynamic = "force-dynamic";

const TABLES = [
  ["tenants", "Entreprise, devise, fuseau horaire"],
  ["memberships", "Lien utilisateur ↔ entreprise ↔ rôle"],
  ["roles / permissions / role_permissions", "Contrôle d’accès (15 permissions, 5 rôles)"],
  ["products / product_variants", "Catalogue et déclinaisons (SKU, code-barres, unité, seuils)"],
  ["categories / suppliers", "Référentiels"],
  ["stock_locations", "Dépôts"],
  ["stock_balances", "Solde par variante et par dépôt"],
  ["stock_operations", "En-tête d’opération (type, référence, idempotence, acteur)"],
  ["stock_movements", "Lignes de mouvement + solde après coup"],
];

const RPCS = [
  ["create_tenant", "Crée l’entreprise, le rôle Propriétaire et l’adhésion"],
  ["upsert_product", "Création/mise à jour catalogue avec validation SKU et prix"],
  ["post_stock_operation", "Cœur du stock : idempotence, verrous, refus si insuffisant"],
  ["list_tenant_members / list_tenant_roles", "Annuaire et matrice de permissions"],
  ["invite_member / accept_invitations", "Invitations avec expiration à 14 jours"],
  ["seed_demo_data / seed_demo_history", "Jeu de démonstration"],
];

export default async function SettingsPage() {
  const source = getDataSource();
  const tenant = await source.getTenant();
  const live = isSupabaseConfigured();

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Intégrations</h1>
          <p className="sub">Connexion à Supabase et contrat de données utilisé par l’application.</p>
        </div>
      </div>

      <div className="grid c2" style={{ marginBottom: 12, alignItems: "start" }}>
        <section className="card">
          <div className="card-head">
            <h2>Source de données</h2>
            <span className="spacer" />
            <span className={`pill ${live ? "ok" : "low"}`}>{live ? "Supabase (live)" : "Snapshot démo"}</span>
          </div>
          <ul className="list-clean">
            <li><span className="muted">Mode actif</span><span>{source.kind}</span></li>
            <li><span className="muted">Projet</span><span className="mono small">suuchdahpftxwbvwhbyq</span></li>
            <li><span className="muted">Région</span><span>eu-north-1 · Postgres 17</span></li>
            <li><span className="muted">Entreprise</span><span>{tenant.name}</span></li>
            <li><span className="muted">Fuseau</span><span className="mono small">{tenant.timezone}</span></li>
          </ul>
          <p className="muted small" style={{ marginTop: 10, marginBottom: 0 }}>
            Variables attendues : <code>NEXT_PUBLIC_SUPABASE_URL</code>,{" "}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, <code>SUPABASE_SERVICE_ROLE_KEY</code> (ou un JWT
            utilisateur). Aucune clé n’est exposée au navigateur : tous les appels passent par les route
            handlers.
          </p>
        </section>

        <section className="card">
          <h2>Contrat d’erreurs du RPC de stock</h2>
          <ul className="list-clean">
            <li><span className="muted">42501</span><span>permission ou entreprise invalide</span></li>
            <li><span className="muted">22023</span><span>données invalides (SKU, motif, quantité, devise)</span></li>
            <li><span className="muted">P0001</span><span>stock disponible insuffisant</span></li>
          </ul>
          <p className="muted small" style={{ marginTop: 10, marginBottom: 0 }}>
            L’API interne renvoie <code>422</code> pour la validation de forme et <code>409</code> quand
            la base refuse l’opération — le message SQL est relayé tel quel.
          </p>
        </section>
      </div>

      <div className="grid c2" style={{ alignItems: "start" }}>
        <section className="card tight">
          <div style={{ padding: "11px 14px", borderBottom: "1px solid var(--border)" }}>
            <h2 style={{ margin: 0 }}>Tables exploitées</h2>
          </div>
          <table>
            <tbody>
              {TABLES.map(([name, role]) => (
                <tr key={name}>
                  <td className="mono" style={{ whiteSpace: "nowrap" }}>{name}</td>
                  <td className="muted small">{role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card tight">
          <div style={{ padding: "11px 14px", borderBottom: "1px solid var(--border)" }}>
            <h2 style={{ margin: 0 }}>Fonctions SQL</h2>
          </div>
          <table>
            <tbody>
              {RPCS.map(([name, role]) => (
                <tr key={name}>
                  <td className="mono" style={{ whiteSpace: "nowrap" }}>{name}</td>
                  <td className="muted small">{role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <p className="muted small" style={{ marginTop: 14 }}>
        Référence : schéma <code>public</code> de {TENANT.name}. Toutes les tables métier sont
        protégées par RLS ; les écritures passent uniquement par des fonctions{" "}
        <code>SECURITY DEFINER</code> qui revalident les permissions.
      </p>
    </>
  );
}
