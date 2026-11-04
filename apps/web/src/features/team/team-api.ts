import { z } from 'zod';
import { apiFetch } from '../onboarding/tenant-api';

const memberSchema = z.object({
  membership_id: z.uuid(),
  user_id: z.uuid(),
  full_name: z.string(),
  email: z.string(),
  role_id: z.uuid(),
  role_name: z.string(),
  status: z.enum(['invited', 'active', 'suspended']),
  created_at: z.string(),
});

const roleSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string(),
  is_system: z.boolean(),
  permissions: z.array(z.string()),
  member_count: z.number(),
});

const invitationSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  full_name: z.string(),
  role_id: z.uuid(),
  role_name: z.string(),
  status: z.enum(['pending', 'accepted', 'revoked']),
  created_at: z.string(),
  expires_at: z.string(),
  token: z.uuid(),
});

const invitationResultSchema = z.object({
  status: z.enum(['added', 'invited']),
  user_id: z.uuid().optional(),
  membership_id: z.uuid().optional(),
  invitation_id: z.uuid().optional(),
});

export type TeamMember = z.infer<typeof memberSchema>;
export type TeamRole = z.infer<typeof roleSchema>;
export type TeamInvitation = z.infer<typeof invitationSchema>;
export type InvitationResult = z.infer<typeof invitationResultSchema>;

export interface InviteInput {
  email: string;
  role_id: string;
  full_name: string | null;
}

const base = (tenantId: string) => `/tenants/${tenantId}`;

export async function listMembers(token: string, tenantId: string) {
  return z.array(memberSchema).parse(await apiFetch(`${base(tenantId)}/members`, token));
}

export async function listRoles(token: string, tenantId: string) {
  return z.array(roleSchema).parse(await apiFetch(`${base(tenantId)}/roles`, token));
}

export async function listInvitations(token: string, tenantId: string) {
  return z.array(invitationSchema).parse(await apiFetch(`${base(tenantId)}/invitations`, token));
}

export async function inviteMember(token: string, tenantId: string, input: InviteInput) {
  return invitationResultSchema.parse(
    await apiFetch(`${base(tenantId)}/invitations`, token, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}

export async function revokeInvitation(token: string, tenantId: string, invitationId: string) {
  await apiFetch(`${base(tenantId)}/invitations/${invitationId}/revoke`, token, { method: 'POST' });
}

export async function updateMemberRole(token: string, tenantId: string, membershipId: string, roleId: string) {
  await apiFetch(`${base(tenantId)}/members/${membershipId}`, token, {
    method: 'PATCH',
    body: JSON.stringify({ role_id: roleId }),
  });
}

export async function removeMember(token: string, tenantId: string, membershipId: string) {
  await apiFetch(`${base(tenantId)}/members/${membershipId}`, token, { method: 'DELETE' });
}

/** Vrai si l'utilisateur connecté possède la permission demandée sur cette entreprise. */
export async function hasPermission(token: string, tenantId: string, permission: string) {
  const value = await apiFetch<unknown>(`${base(tenantId)}/permissions/${permission}`, token);
  return z.boolean().parse(
    typeof value === 'object' && value !== null && 'allowed' in value ? value.allowed : value,
  );
}

/** Transforme les invitations envoyées à l'adresse de l'utilisateur en adhésions réelles. */
export async function acceptMyInvitations(token: string) {
  const payload = await apiFetch<unknown>('/invitations/accept', token, { method: 'POST' });
  return z.object({ accepted: z.number() }).parse(payload);
}
