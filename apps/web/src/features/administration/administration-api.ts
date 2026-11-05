import { getSupabaseClient } from '../../lib/supabase';

/**
 * Vue d'ensemble de la plateforme — réservée à l'administration.
 *
 * Elle donne les comptes, les entreprises et des agrégats (membres, produits,
 * ventes, chiffre d'affaires). Le détail métier d'une entreprise (clients,
 * lignes de vente, stocks) reste hors de portée : l'isolation entre
 * commerçants n'est pas contournée par cet écran.
 */

export interface PlatformCompany {
  name: string;
  role: string;
  status: string;
}

export interface PlatformUser {
  id: string;
  email: string;
  fullName: string | null;
  createdAt: string | null;
  emailConfirmedAt: string | null;
  lastSignInAt: string | null;
  isAdmin: boolean;
  companies: PlatformCompany[];
}

export interface PlatformTenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  currencyCode: string;
  createdAt: string | null;
  members: number;
  products: number;
  sales: number;
  revenue: number;
  firstMemberEmail: string | null;
}

export interface PlatformTotals {
  users: number;
  confirmed: number;
  tenants: number;
  admins: number;
  sales: number;
}

export interface PlatformOverview {
  totals: PlatformTotals;
  users: PlatformUser[];
  tenants: PlatformTenant[];
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function number(value: unknown): number {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
}

function money(value: unknown): number {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function readCompany(value: unknown): PlatformCompany {
  const company = record(value);
  return {
    name: text(company.name) ?? 'Entreprise',
    role: text(company.role) ?? '—',
    status: text(company.status) ?? 'active',
  };
}

/** Transforme la réponse brute en objet sûr : aucune valeur manquante ne casse l'écran. */
export function readPlatformOverview(raw: unknown): PlatformOverview {
  const source = record(raw);
  const totals = record(source.totals);

  const users = Array.isArray(source.users)
    ? source.users.map((value) => {
        const user = record(value);
        return {
          id: text(user.id) ?? '',
          email: text(user.email) ?? '',
          fullName: text(user.full_name),
          createdAt: text(user.created_at),
          emailConfirmedAt: text(user.email_confirmed_at),
          lastSignInAt: text(user.last_sign_in_at),
          isAdmin: user.is_admin === true,
          companies: Array.isArray(user.companies) ? user.companies.map(readCompany) : [],
        } satisfies PlatformUser;
      })
    : [];

  const tenants = Array.isArray(source.tenants)
    ? source.tenants.map((value) => {
        const tenant = record(value);
        return {
          id: text(tenant.id) ?? '',
          name: text(tenant.name) ?? 'Entreprise',
          slug: text(tenant.slug) ?? '',
          status: text(tenant.status) ?? 'active',
          currencyCode: text(tenant.currency_code) ?? 'XOF',
          createdAt: text(tenant.created_at),
          members: number(tenant.members),
          products: number(tenant.products),
          sales: number(tenant.sales),
          revenue: money(tenant.revenue),
          firstMemberEmail: text(tenant.first_member_email),
        } satisfies PlatformTenant;
      })
    : [];

  return {
    totals: {
      users: number(totals.users),
      confirmed: number(totals.confirmed),
      tenants: number(totals.tenants),
      admins: number(totals.admins),
      sales: number(totals.sales),
    },
    users,
    tenants,
  };
}

/** Charge la vue d'ensemble. Échoue si le compte n'est pas administrateur. */
export async function fetchPlatformOverview(search = ''): Promise<PlatformOverview> {
  const response = await getSupabaseClient().rpc('platform_overview', {
    p_search: search.trim() === '' ? null : search.trim(),
  });
  if (response.error) {
    throw new Error('Les comptes n’ont pas pu être chargés.');
  }
  return readPlatformOverview(response.data as unknown);
}
