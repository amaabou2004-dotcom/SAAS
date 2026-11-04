import { ForbiddenException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { InviteMemberDto, UpdateMemberRoleDto } from './team.dto.js';
import { TeamService } from './team.service.js';
import type { SupabaseService } from '../auth/supabase.service.js';

const TENANT_ID = '0969579a-c676-4542-b846-d9df6235f6e6';
const MEMBERSHIP_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ROLE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const INVITATION_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function buildService(result: { data: unknown; error: { code?: string; message?: string } | null } = { data: [], error: null }) {
  const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client = {
    rpc: (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      return Promise.resolve(result);
    },
  };
  const supabase = { createUserClient: () => client } as unknown as SupabaseService;
  return { service: new TeamService(supabase), rpcCalls };
}

describe('TeamService', () => {
  it('liste les membres via la RPC list_tenant_members', async () => {
    const { service, rpcCalls } = buildService({
      data: [{
        membership_id: MEMBERSHIP_ID,
        user_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        full_name: 'Aïcha',
        email: 'aicha@exemple.com',
        role_id: ROLE_ID,
        role_name: 'Vendeur',
        status: 'active',
        created_at: '2026-11-03T10:00:00Z',
      }],
      error: null,
    });

    const members = await service.listMembers('token', TENANT_ID);

    expect(rpcCalls[0]).toEqual({ name: 'list_tenant_members', args: { p_tenant_id: TENANT_ID } });
    expect(members[0]?.role_name).toBe('Vendeur');
  });

  it('invite une personne en passant le rôle et le nom nettoyé', async () => {
    const { service, rpcCalls } = buildService({ data: { status: 'invited', invitation_id: INVITATION_ID }, error: null });

    const result = await service.invite('token', TENANT_ID, {
      email: 'nouveau@exemple.com',
      role_id: ROLE_ID,
      full_name: 'Nouveau Vendeur',
    });

    expect(rpcCalls[0]).toEqual({
      name: 'invite_member',
      args: { p_tenant_id: TENANT_ID, p_email: 'nouveau@exemple.com', p_role_id: ROLE_ID, p_full_name: 'Nouveau Vendeur' },
    });
    expect(result).toMatchObject({ status: 'invited', invitation_id: INVITATION_ID });
  });

  it('change un rôle et retire un membre', async () => {
    const { service, rpcCalls } = buildService({ data: null, error: null });

    await service.updateMemberRole('token', TENANT_ID, MEMBERSHIP_ID, { role_id: ROLE_ID });
    await service.removeMember('token', TENANT_ID, MEMBERSHIP_ID);

    expect(rpcCalls[0]).toEqual({
      name: 'update_member_role',
      args: { p_tenant_id: TENANT_ID, p_membership_id: MEMBERSHIP_ID, p_role_id: ROLE_ID },
    });
    expect(rpcCalls[1]).toEqual({
      name: 'remove_member',
      args: { p_tenant_id: TENANT_ID, p_membership_id: MEMBERSHIP_ID },
    });
  });

  it('expose les droits sous forme de booléen et accepte les invitations', async () => {
    const allowed = buildService({ data: true, error: null });
    await expect(allowed.service.hasPermission('token', TENANT_ID, 'members.manage')).resolves.toEqual({ allowed: true });
    expect(allowed.rpcCalls[0]!.args).toEqual({ target_tenant_id: TENANT_ID, target_permission: 'members.manage' });

    const accepted = buildService({ data: { accepted: 2 }, error: null });
    await expect(accepted.service.acceptMyInvitations('token')).resolves.toEqual({ accepted: 2 });
  });

  it('traduit le refus de permission en 403', async () => {
    const { service } = buildService({
      data: null,
      error: { code: '42501', message: 'Seul un administrateur peut inviter des membres.' },
    });

    await expect(
      service.invite('token', TENANT_ID, { email: 'x@exemple.com', role_id: ROLE_ID }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('InviteMemberDto', () => {
  it('refuse une adresse invalide et un rôle non UUID', () => {
    const invalid = validateSync(plainToInstance(InviteMemberDto, { email: 'pas-un-email', role_id: 'abc' }));
    const fields = invalid.map((error) => error.property);
    expect(fields).toEqual(expect.arrayContaining(['email', 'role_id']));
  });

  it('accepte une invitation valide et nettoie le nom', () => {
    const dto = plainToInstance(InviteMemberDto, { email: ' aicha@exemple.com ', role_id: ROLE_ID, full_name: ' Aïcha ' });
    expect(validateSync(dto)).toHaveLength(0);
    expect(dto.email).toBe('aicha@exemple.com');
    expect(dto.full_name).toBe('Aïcha');
  });
});

describe('UpdateMemberRoleDto', () => {
  it('exige un rôle UUID', () => {
    expect(validateSync(plainToInstance(UpdateMemberRoleDto, { role_id: 'x' }))).not.toHaveLength(0);
    expect(validateSync(plainToInstance(UpdateMemberRoleDto, { role_id: ROLE_ID }))).toHaveLength(0);
  });
});

it('refuse une invitation sans e-mail', () => {
  expect(() => validateSync(plainToInstance(InviteMemberDto, { role_id: ROLE_ID }))).not.toThrow();
});
