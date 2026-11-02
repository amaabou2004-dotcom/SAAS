import { supabase, frenchError } from './supabase'

export type TeamMember = {
  membershipId: string
  userId: string
  fullName: string
  email: string
  roleId: string
  roleName: string
  status: string
  createdAt: string
}

export type TeamRole = {
  id: string
  name: string
  description: string
  isSystem: boolean
  permissions: string[]
  memberCount: number
}

export type TeamInvitation = {
  id: string
  email: string
  fullName: string
  roleId: string
  roleName: string
  status: string
  createdAt: string
  expiresAt: string
  token: string
}

export type TeamSnapshot = {
  members: TeamMember[]
  roles: TeamRole[]
  invitations: TeamInvitation[]
}

/** Libellés français des permissions techniques du backend. */
export const PERMISSION_LABELS: Record<string, string> = {
  'audit.read': 'Voir le journal',
  'catalog.manage': 'Gérer les produits',
  'catalog.read': 'Voir les produits',
  'inventory.manage': 'Gérer le stock',
  'inventory.read': 'Voir le stock',
  'members.manage': 'Gérer l’équipe',
  'members.read': 'Voir l’équipe',
  'reports.manage': 'Configurer les rapports',
  'reports.read': 'Voir les rapports',
  'sales.manage': 'Enregistrer les ventes',
  'sales.read': 'Voir les ventes',
  'stores.manage': 'Gérer les emplacements',
  'stores.read': 'Voir les emplacements',
  'tenant.manage': 'Modifier l’entreprise',
  'tenant.read': 'Voir l’entreprise',
}

export function permissionLabel(code: string): string {
  return PERMISSION_LABELS[code] ?? code
}

function fail(error: { message?: string } | null): never {
  throw new Error(frenchError(error?.message))
}

export async function fetchTeam(tenantId: string): Promise<TeamSnapshot> {
  const [rolesRes, membersRes, invitationsRes] = await Promise.all([
    supabase.rpc('list_tenant_roles', { p_tenant_id: tenantId }),
    supabase.rpc('list_tenant_members', { p_tenant_id: tenantId }),
    supabase.rpc('list_tenant_invitations', { p_tenant_id: tenantId }),
  ])

  if (rolesRes.error) fail(rolesRes.error)
  if (membersRes.error) fail(membersRes.error)

  return {
    roles: ((rolesRes.data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: row.id as string,
      name: row.name as string,
      description: (row.description as string | null) ?? '',
      isSystem: Boolean(row.is_system),
      permissions: (row.permissions as string[] | null) ?? [],
      memberCount: Number(row.member_count ?? 0),
    })),
    members: ((membersRes.data ?? []) as Record<string, unknown>[]).map((row) => ({
      membershipId: row.membership_id as string,
      userId: row.user_id as string,
      fullName: (row.full_name as string | null) ?? 'Membre',
      email: (row.email as string | null) ?? '',
      roleId: row.role_id as string,
      roleName: row.role_name as string,
      status: (row.status as string | null) ?? 'active',
      createdAt: row.created_at as string,
    })),
    // Un rôle « lecture seule » ne peut pas lister les invitations : on n'échoue pas pour autant.
    invitations: invitationsRes.error
      ? []
      : ((invitationsRes.data ?? []) as Record<string, unknown>[]).map((row) => ({
          id: row.id as string,
          email: (row.email as string | null) ?? '',
          fullName: (row.full_name as string | null) ?? '',
          roleId: row.role_id as string,
          roleName: row.role_name as string,
          status: (row.status as string | null) ?? 'pending',
          createdAt: row.created_at as string,
          expiresAt: row.expires_at as string,
          token: row.token as string,
        })),
  }
}

export async function inviteMember(input: {
  tenantId: string
  email: string
  roleId: string
  fullName?: string
}): Promise<{ status: 'added' | 'invited' }> {
  const { data, error } = await supabase.rpc('invite_member', {
    p_tenant_id: input.tenantId,
    p_email: input.email.trim(),
    p_role_id: input.roleId,
    p_full_name: input.fullName?.trim() || null,
  })
  if (error) fail(error)
  const status = (data as { status?: string } | null)?.status
  return { status: status === 'added' ? 'added' : 'invited' }
}

export async function revokeInvitation(tenantId: string, invitationId: string): Promise<void> {
  const { error } = await supabase.rpc('revoke_invitation', {
    p_tenant_id: tenantId,
    p_invitation_id: invitationId,
  })
  if (error) fail(error)
}

export async function changeMemberRole(tenantId: string, membershipId: string, roleId: string): Promise<void> {
  const { error } = await supabase.rpc('update_member_role', {
    p_tenant_id: tenantId,
    p_membership_id: membershipId,
    p_role_id: roleId,
  })
  if (error) fail(error)
}

export async function removeMember(tenantId: string, membershipId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_member', {
    p_tenant_id: tenantId,
    p_membership_id: membershipId,
  })
  if (error) fail(error)
}

/** Rattache l'utilisateur connecté aux entreprises qui l'ont invité. */
export async function acceptPendingInvitations(): Promise<number> {
  const { data, error } = await supabase.rpc('accept_invitations')
  if (error) return 0
  return Number(data ?? 0)
}
