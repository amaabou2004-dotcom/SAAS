import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { WorkspaceContext } from '../workspace/workspace-context';
import { hasPermission, inviteMember, listInvitations, listMembers, listRoles, removeMember, revokeInvitation, updateMemberRole } from './team-api';
import { TeamPage } from './team-page';

vi.mock('../auth/auth-context', () => ({
  useAuth: () => ({
    user: { id: '8b4d6d39-38cd-4f77-b67e-21ceac76b636', email: 'patron@exemple.com' },
    session: null,
    loading: false,
  }),
}));

vi.mock('./team-api', () => ({
  hasPermission: vi.fn(),
  inviteMember: vi.fn(),
  listInvitations: vi.fn(),
  listMembers: vi.fn(),
  listRoles: vi.fn(),
  removeMember: vi.fn(),
  revokeInvitation: vi.fn(),
  updateMemberRole: vi.fn(),
}));

const tenant = {
  id: '4a4d6d39-38cd-4e1f-b1f0-c8d7ef8edbd0',
  name: 'Boutique test',
  slug: 'boutique-test',
  currency_code: 'XOF',
  timezone: 'Africa/Niamey',
  status: 'active' as const,
  created_at: new Date(0).toISOString(),
};
const ownerId = '8b4d6d39-38cd-4f77-b67e-21ceac76b636';
const vendeurId = '9b4d6d39-38cd-4f77-b67e-21ceac76b636';
const ownerRoleId = 'ab4d6d39-38cd-4f77-b67e-21ceac76b636';
const vendeurRoleId = 'bb4d6d39-38cd-4f77-b67e-21ceac76b636';
const ownerMembershipId = 'cb4d6d39-38cd-4f77-b67e-21ceac76b636';
const vendeurMembershipId = 'db4d6d39-38cd-4f77-b67e-21ceac76b636';
const invitationId = 'eb4d6d39-38cd-4f77-b67e-21ceac76b636';

const roles = [
  {
    id: ownerRoleId,
    name: 'Propriétaire',
    description: 'Administre tout.',
    is_system: true,
    permissions: ['members.manage', 'sales.manage'],
    member_count: 1,
  },
  {
    id: vendeurRoleId,
    name: 'Vendeur',
    description: 'Encaisse les ventes.',
    is_system: true,
    permissions: ['sales.read', 'sales.manage'],
    member_count: 0,
  },
];
const members = [
  {
    membership_id: ownerMembershipId,
    user_id: ownerId,
    full_name: 'Patron',
    email: 'patron@exemple.com',
    role_id: ownerRoleId,
    role_name: 'Propriétaire',
    status: 'active' as const,
    created_at: new Date(0).toISOString(),
  },
  {
    membership_id: vendeurMembershipId,
    user_id: vendeurId,
    full_name: 'Aïcha',
    email: 'aicha@exemple.com',
    role_id: vendeurRoleId,
    role_name: 'Vendeur',
    status: 'active' as const,
    created_at: new Date(0).toISOString(),
  },
];
const invitations = [{
  id: invitationId,
  email: 'attente@exemple.com',
  full_name: '',
  role_id: vendeurRoleId,
  role_name: 'Vendeur',
  status: 'pending' as const,
  created_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 86_400_000).toISOString(),
  token: 'fb4d6d39-38cd-4f77-b67e-21ceac76b636',
}];

function renderWithWorkspace(children: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <WorkspaceContext.Provider value={{ tenant, accessToken: 'user-token' }}>
        {children}
      </WorkspaceContext.Provider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listMembers).mockResolvedValue(members);
  vi.mocked(listRoles).mockResolvedValue(roles);
  vi.mocked(listInvitations).mockResolvedValue(invitations);
  vi.mocked(hasPermission).mockResolvedValue(true);
  vi.mocked(inviteMember).mockResolvedValue({ status: 'invited', invitation_id: invitationId });
  vi.mocked(updateMemberRole).mockResolvedValue(undefined);
  vi.mocked(removeMember).mockResolvedValue(undefined);
  vi.mocked(revokeInvitation).mockResolvedValue(undefined);
});

describe('page Équipe', () => {
  it('liste les membres et les invitations en attente', async () => {
    renderWithWorkspace(<TeamPage />);

    expect(await screen.findByText('Aïcha')).toBeInTheDocument();
    expect(screen.getByText('aicha@exemple.com')).toBeInTheDocument();
    expect(await screen.findByText('attente@exemple.com')).toBeInTheDocument();
    expect(screen.getByText('vous')).toBeInTheDocument();
  });

  it('invite une personne avec le rôle Vendeur par défaut', async () => {
    const user = userEvent.setup();
    renderWithWorkspace(<TeamPage />);

    await screen.findByText('Aïcha');
    await user.type(screen.getByLabelText('Adresse e-mail'), 'nouveau@exemple.com');
    await user.click(screen.getByRole('button', { name: /Envoyer l’invitation/ }));

    await waitFor(() => expect(inviteMember).toHaveBeenCalledTimes(1));
    expect(vi.mocked(inviteMember).mock.calls[0]![2]).toMatchObject({
      email: 'nouveau@exemple.com',
      role_id: vendeurRoleId,
      full_name: null,
    });
    expect(await screen.findByText(/Invitation enregistrée/)).toBeInTheDocument();
  });

  it('refuse une adresse invalide sans appeler le serveur', async () => {
    const user = userEvent.setup();
    renderWithWorkspace(<TeamPage />);

    await screen.findByText('Aïcha');
    await user.type(screen.getByLabelText('Adresse e-mail'), 'pas-un-email');
    await user.click(screen.getByRole('button', { name: /Envoyer l’invitation/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/adresse e-mail valide/i);
    expect(inviteMember).not.toHaveBeenCalled();
  });

  it('change le rôle d’un membre', async () => {
    const user = userEvent.setup();
    renderWithWorkspace(<TeamPage />);

    await screen.findByText('Aïcha');
    await user.selectOptions(screen.getByLabelText('Rôle de Aïcha'), ownerRoleId);

    await waitFor(() => expect(updateMemberRole).toHaveBeenCalledWith('user-token', tenant.id, vendeurMembershipId, ownerRoleId));
  });

  it('reste en lecture seule sans le droit members.manage', async () => {
    vi.mocked(hasPermission).mockResolvedValue(false);
    renderWithWorkspace(<TeamPage />);

    expect(await screen.findByText(/seuls les propriétaires peuvent inviter/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Envoyer l’invitation/ })).toBeDisabled();
    expect(screen.getByLabelText('Adresse e-mail')).toBeDisabled();
    expect(screen.queryByLabelText('Rôle de Aïcha')).not.toBeInTheDocument();
  });
});
