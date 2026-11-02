/** Helpers purs de tenancy (testés dans tests/tenancy.test.ts). */

export interface TenantLike {
  id: string;
  slug: string;
}

/** Slug d'URL : minuscules ASCII, tirets, 2 à 63 caractères (contrainte SQL). */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

export function isValidSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length >= 2 && value.length <= 63;
}

/**
 * Tenant actif :
 *  - le cookie s'il correspond à une adhésion réelle (jamais de valeur forgée) ;
 *  - sinon le seul tenant de l'utilisateur, sans lui imposer un choix ;
 *  - sinon `null` → l'application redirige vers /select-tenant.
 */
export function pickActiveTenantId(
  tenants: TenantLike[],
  cookieValue: string | undefined,
): string | null {
  if (tenants.length === 0) return null;
  if (cookieValue && tenants.some((tenant) => tenant.id === cookieValue)) return cookieValue;
  if (tenants.length === 1) return tenants[0].id;
  return null;
}
