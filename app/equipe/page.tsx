import { getDataSource } from "@/lib/data/repository";
import { PERMISSION_LABELS, ROLES as SNAPSHOT_ROLES } from "@/lib/data/snapshot";
import type { PermissionCode } from "@/lib/data/types";

export const dynamic = "force-dynamic";

const ALL_PERMISSIONS = Object.keys(PERMISSION_LABELS) as PermissionCode[];

export default async function TeamPage() {
  const source = getDataSource();
  const [members, roles] = await Promise.all([source.getMembers(), source.getRoles()]);
  const roleList = roles.length > 0 ? roles : SNAPSHOT_ROLES;

  const usedPermissions = new Set<PermissionCode>();
  for (const role of roleList) for (const code of role.permissions) usedPermissions.add(code);
  const matrix = ALL_PERMISSIONS.filter((code) => usedPermissions.has(code));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Équipe &amp; rôles</h1>
          <p className="sub">
            {members.length} membre(s) · {roleList.length} rôles · les permissions sont vérifiées en
            base, pas seulement dans l’interface.
          </p>
        </div>
      </div>

      <section className="card tight" style={{ marginBottom: 12 }}>
        <div style={{ padding: "11px 14px", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ margin: 0 }}>Membres</h2>
        </div>
        <table>
          <thead>
            <tr>
              <th>Membre</th>
              <th>Rôle</th>
              <th>Email</th>
              <th>Statut</th>
              <th className="num hide-sm">Depuis</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id}>
                <td style={{ fontWeight: 550 }}>{member.full_name}</td>
                <td><span className="pill info">{member.role_name}</span></td>
                <td className="muted small">{member.email}</td>
                <td>
                  <span className={`pill ${member.status === "active" ? "ok" : "low"}`}>
                    {member.status === "active" ? "Actif" : "Invité"}
                  </span>
                </td>
                <td className="num hide-sm muted">{member.joined_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card tight">
        <div style={{ padding: "11px 14px", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ margin: 0 }}>Matrice des permissions</h2>
          <p className="muted small" style={{ margin: "3px 0 0" }}>
            Colonnes = rôles système. Le contrôle final est fait par <code>has_tenant_permission()</code>{" "}
            dans les politiques RLS.
          </p>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="matrix">
            <thead>
              <tr>
                <th>Permission</th>
                {roleList.map((role) => (
                  <th key={role.id} className="nowrap" title={role.description ?? ""}>
                    {role.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map((code) => (
                <tr key={code}>
                  <td>
                    <div>{PERMISSION_LABELS[code]}</div>
                    <div className="muted small mono">{code}</div>
                  </td>
                  {roleList.map((role) => (
                    <td key={role.id}>
                      {role.permissions.includes(code) ? (
                        <span className="dot" aria-label="autorisé">✓</span>
                      ) : (
                        <span className="nodot" aria-label="refusé">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
