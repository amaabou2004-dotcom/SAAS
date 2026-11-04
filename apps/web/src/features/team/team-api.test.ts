import {
  acceptMyInvitations,
  hasPermission,
  inviteMember,
  listInvitations,
  listMembers,
  listRoles,
  removeMember,
  revokeInvitation,
  updateMemberRole,
} from './team-api';

const tenantId = '4a4d6d39-38cd-4f77-b67e-21ceac76b636';
const membershipId = '5b4d6d39-38cd-4f77-b67e-21ceac76b636';
const roleId = '6b4d6d39-38cd-4f77-b67e-21ceac76b636';
const invitationId = '7b4d6d39-38cd-4f77-b67e-21ceac76b636';

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockJson(payload: unknown) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function bodyOf(init?: RequestInit): Record<string, unknown> {
  return typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : {};
}

const member = {
  membership_id: membershipId,
  user_id: '8b4d6d39-38cd-4f77-b67e-21ceac76b636',
  full_name: 'Aïcha',
  email: 'aicha@exemple.com',
  role_id: roleId,
  role_name: 'Vendeur',
  status: 'active',
  created_at: '2026-11-03T10:00:00Z',
};

describe('API de l’équipe', () => {
  it('charge les membres et les rôles', async () => {
    const fetchMock = mockJson([member]);
    const members = await listMembers('token', tenantId);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`/api/v1/tenants/${tenantId}/members`);
    expect(members[0]?.role_name).toBe('Vendeur');

    const rolesMock = mockJson([{
      id: roleId,
      name: 'Vendeur',
      description: 'Encaisse les ventes.',
      is_system: true,
      permissions: ['sales.read', 'sales.manage'],
      member_count: 1,
    }]);
    const roles = await listRoles('token', tenantId);
    expect(rolesMock.mock.calls[0]?.[0]).toBe(`/api/v1/tenants/${tenantId}/roles`);
    expect(roles[0]?.permissions).toContain('sales.manage');
  });

  it('envoie une invitation avec le rôle choisi', async () => {
    const fetchMock = mockJson({ status: 'invited', invitation_id: invitationId });

    const result = await inviteMember('token', tenantId, {
      email: 'nouveau@exemple.com',
      role_id: roleId,
      full_name: 'Nouveau',
    });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`/api/v1/tenants/${tenantId}/invitations`);
    expect(init?.method).toBe('POST');
    expect(bodyOf(init)).toEqual({ email: 'nouveau@exemple.com', role_id: roleId, full_name: 'Nouveau' });
    expect(result.status).toBe('invited');
  });

  it('liste et annule les invitations', async () => {
    mockJson([{
      id: invitationId,
      email: 'attente@exemple.com',
      full_name: '',
      role_id: roleId,
      role_name: 'Vendeur',
      status: 'pending',
      created_at: '2026-11-03T10:00:00Z',
      expires_at: '2026-11-17T10:00:00Z',
      token: '9b4d6d39-38cd-4f77-b67e-21ceac76b636',
    }]);

    const invitations = await listInvitations('token', tenantId);
    expect(invitations[0]?.email).toBe('attente@exemple.com');

    const revokeMock = mockJson({ ok: true });
    await revokeInvitation('token', tenantId, invitationId);
    expect(revokeMock.mock.calls[0]?.[0]).toBe(`/api/v1/tenants/${tenantId}/invitations/${invitationId}/revoke`);
  });

  it('change un rôle et retire un membre', async () => {
    const roleMock = mockJson({ ok: true });
    await updateMemberRole('token', tenantId, membershipId, roleId);
    const [patchUrl, patchInit] = roleMock.mock.calls[0]!;
    expect(patchUrl).toBe(`/api/v1/tenants/${tenantId}/members/${membershipId}`);
    expect(patchInit?.method).toBe('PATCH');
    expect(bodyOf(patchInit)).toEqual({ role_id: roleId });

    const deleteMock = mockJson({ ok: true });
    await removeMember('token', tenantId, membershipId);
    expect(deleteMock.mock.calls[0]?.[1]?.method).toBe('DELETE');
  });

  it('lit les droits et accepte les invitations', async () => {
    mockJson({ allowed: true });
    await expect(hasPermission('token', tenantId, 'members.manage')).resolves.toBe(true);

    const acceptMock = mockJson({ accepted: 1 });
    await expect(acceptMyInvitations('token')).resolves.toEqual({ accepted: 1 });
    expect(acceptMock.mock.calls[0]?.[0]).toBe('/api/v1/invitations/accept');
  });
});
