import { z } from 'zod';
import { isDirectDataMode } from '../../lib/data-mode';
import { directApiFetch } from './direct-data';

const tenantSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  currency_code: z.string().length(3),
  timezone: z.string(),
  status: z.enum(['active', 'suspended']),
  created_at: z.string(),
});

export type Tenant = z.infer<typeof tenantSchema>;

export interface CreateTenantInput {
  name: string;
  slug: string;
  currency_code: string;
  timezone: string;
}

interface ApiErrorPayload {
  message?: string | string[];
}

async function readError(response: Response) {
  const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
  const message = Array.isArray(payload?.message) ? payload.message.join(' ') : payload?.message;
  return message ?? 'Le serveur n’a pas pu traiter la demande.';
}

export async function apiFetch<T>(path: string, accessToken: string, init?: RequestInit): Promise<T> {
  // Mode direct : le navigateur interroge Supabase (RLS + RPC) sans passer par l'API.
  if (isDirectDataMode) {
    return directApiFetch<T>(path, init);
  }

  const response = await fetch(`/api/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return (await response.json()) as T;
}

export async function listTenants(accessToken: string) {
  const payload = await apiFetch<unknown>('/tenants/me', accessToken);
  return z.array(tenantSchema).parse(payload);
}

export async function createTenant(accessToken: string, input: CreateTenantInput) {
  const payload = await apiFetch<unknown>('/tenants', accessToken, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return tenantSchema.parse(payload);
}
