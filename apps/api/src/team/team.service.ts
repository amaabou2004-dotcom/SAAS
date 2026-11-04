import { Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { SupabaseService } from '../auth/supabase.service.js';
import { toDatabaseHttpException, type DatabaseError } from '../database/database-error.js';
import type { InviteMemberDto, UpdateMemberRoleDto } from './team.dto.js';

export interface MemberRecord {
  membership_id: string;
  user_id: string;
  full_name: string;
  email: string;
  role_id: string;
  role_name: string;
  status: string;
  created_at: string;
}

export interface RoleRecord {
  id: string;
  name: string;
  description: string;
  is_system: boolean;
  permissions: string[];
  member_count: number;
}

export interface InvitationRecord {
  id: string;
  email: string;
  full_name: string;
  role_id: string;
  role_name: string;
  status: string;
  created_at: string;
  expires_at: string;
  token: string;
}

export interface InvitationResult {
  status: 'added' | 'invited';
  user_id?: string;
  membership_id?: string;
  invitation_id?: string;
}

@Injectable()
export class TeamService {
  private readonly logger = new Logger(TeamService.name);

  constructor(@Inject(SupabaseService) private readonly supabase: SupabaseService) {}

  private fail(error: DatabaseError, fallback: string): never {
    const exception = toDatabaseHttpException(error, fallback);
    if (exception.getStatus() >= 500) {
      this.logger.error(`Team operation failed with database code ${error.code ?? 'unknown'}`);
    }
    throw exception;
  }

  private asArray<T>(data: unknown, fallback: string): T[] {
    if (!Array.isArray(data)) throw new InternalServerErrorException(fallback);
    return data as T[];
  }

  async listMembers(accessToken: string, tenantId: string): Promise<MemberRecord[]> {
    const { data, error } = await this.supabase.createUserClient(accessToken).rpc('list_tenant_members', {
      p_tenant_id: tenantId,
    });
    if (error) this.fail(error, 'Le chargement de l’équipe a échoué.');
    return this.asArray<MemberRecord>(data, 'La base a retourné une réponse inattendue.');
  }

  async listRoles(accessToken: string, tenantId: string): Promise<RoleRecord[]> {
    const { data, error } = await this.supabase.createUserClient(accessToken).rpc('list_tenant_roles', {
      p_tenant_id: tenantId,
    });
    if (error) this.fail(error, 'Le chargement des rôles a échoué.');
    return this.asArray<RoleRecord>(data, 'La base a retourné une réponse inattendue.');
  }

  async listInvitations(accessToken: string, tenantId: string): Promise<InvitationRecord[]> {
    const { data, error } = await this.supabase.createUserClient(accessToken).rpc('list_tenant_invitations', {
      p_tenant_id: tenantId,
    });
    if (error) this.fail(error, 'Le chargement des invitations a échoué.');
    return this.asArray<InvitationRecord>(data, 'La base a retourné une réponse inattendue.');
  }

  async invite(accessToken: string, tenantId: string, input: InviteMemberDto): Promise<InvitationResult> {
    const { data, error } = await this.supabase.createUserClient(accessToken).rpc('invite_member', {
      p_tenant_id: tenantId,
      p_email: input.email,
      p_role_id: input.role_id,
      p_full_name: input.full_name ?? null,
    });
    if (error) this.fail(error, 'L’invitation n’a pas pu être envoyée.');
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new InternalServerErrorException('La base a retourné une réponse inattendue.');
    }
    return data as InvitationResult;
  }

  async revokeInvitation(accessToken: string, tenantId: string, invitationId: string) {
    const { error } = await this.supabase.createUserClient(accessToken).rpc('revoke_invitation', {
      p_tenant_id: tenantId,
      p_invitation_id: invitationId,
    });
    if (error) this.fail(error, 'L’invitation n’a pas pu être annulée.');
    return { ok: true };
  }

  async updateMemberRole(
    accessToken: string,
    tenantId: string,
    membershipId: string,
    input: UpdateMemberRoleDto,
  ) {
    const { error } = await this.supabase.createUserClient(accessToken).rpc('update_member_role', {
      p_tenant_id: tenantId,
      p_membership_id: membershipId,
      p_role_id: input.role_id,
    });
    if (error) this.fail(error, 'Le rôle du membre n’a pas pu être modifié.');
    return { ok: true };
  }

  async removeMember(accessToken: string, tenantId: string, membershipId: string) {
    const { error } = await this.supabase.createUserClient(accessToken).rpc('remove_member', {
      p_tenant_id: tenantId,
      p_membership_id: membershipId,
    });
    if (error) this.fail(error, 'Le membre n’a pas pu être retiré.');
    return { ok: true };
  }

  async hasPermission(accessToken: string, tenantId: string, permission: string) {
    const { data, error } = await this.supabase.createUserClient(accessToken).rpc('has_tenant_permission', {
      target_tenant_id: tenantId,
      target_permission: permission,
    });
    if (error) this.fail(error, 'La vérification des droits a échoué.');
    return { allowed: data === true };
  }

  async acceptMyInvitations(accessToken: string) {
    const { data, error } = await this.supabase.createUserClient(accessToken).rpc('accept_my_invitations');
    if (error) this.fail(error, 'Les invitations n’ont pas pu être acceptées.');
    const payload = data ?? {};
    return { accepted: typeof payload.accepted === 'number' ? payload.accepted : 0 };
  }
}
