import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, LoaderCircle, Mail, ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { useAuth } from '../auth/auth-context';
import { WorkspaceSection } from '../workspace/workspace-layout';
import { useWorkspace } from '../workspace/workspace-context';
import {
  hasPermission,
  inviteMember,
  listInvitations,
  listMembers,
  listRoles,
  removeMember,
  revokeInvitation,
  updateMemberRole,
  type TeamMember,
} from './team-api';

const inputClass =
  'min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-ink outline-none focus:border-mint focus:ring-4 focus:ring-teal-100';

function errorMessage(error: unknown) {
  return error instanceof Error && error.message.trim()
    ? error.message
    : 'Une erreur inattendue est survenue.';
}

function expiry(value: string) {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(value));
}

function MemberRow({
  member,
  canManage,
  roles,
  isSelf,
}: {
  member: TeamMember;
  canManage: boolean;
  roles: Array<{ id: string; name: string }>;
  isSelf: boolean;
}) {
  const { tenant, accessToken } = useWorkspace();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['team', 'members', tenant.id] }),
      queryClient.invalidateQueries({ queryKey: ['team', 'roles', tenant.id] }),
    ]);

  const roleMutation = useMutation({
    mutationFn: (roleId: string) => updateMemberRole(accessToken, tenant.id, member.membership_id, roleId),
    onSuccess: async () => {
      setError(null);
      await refresh();
    },
    onError: (caught) => setError(errorMessage(caught)),
  });
  const removeMutation = useMutation({
    mutationFn: () => removeMember(accessToken, tenant.id, member.membership_id),
    onSuccess: async () => {
      setConfirming(false);
      setError(null);
      await refresh();
    },
    onError: (caught) => {
      setConfirming(false);
      setError(errorMessage(caught));
    },
  });

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
            <span className="truncate">{member.full_name || member.email || 'Membre'}</span>
            {isSelf ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">vous</span> : null}
            {member.status !== 'active' ? (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-800">
                {member.status === 'invited' ? 'invité' : 'suspendu'}
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 truncate text-sm text-slate-600">{member.email}</p>
          <p className="mt-1 text-xs text-slate-500">Membre depuis le {expiry(member.created_at)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canManage ? (
            <select
              aria-label={`Rôle de ${member.full_name || member.email}`}
              className="min-h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm"
              value={member.role_id}
              disabled={roleMutation.isPending}
              onChange={(event) => roleMutation.mutate(event.target.value)}
            >
              {roles.map((role) => (
                <option key={role.id} value={role.id}>{role.name}</option>
              ))}
              {roles.every((role) => role.id !== member.role_id) ? (
                <option value={member.role_id}>{member.role_name}</option>
              ) : null}
            </select>
          ) : (
            <span className="rounded-lg bg-teal-50 px-2.5 py-1 text-xs font-bold text-mint-dark">{member.role_name}</span>
          )}
          {canManage ? (
            confirming ? (
              <span className="flex items-center gap-1">
                <Button type="button" variant="outline" size="sm" loading={removeMutation.isPending} onClick={() => removeMutation.mutate()}>
                  <Check className="size-4" aria-hidden="true" />
                  Confirmer
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                  Annuler
                </Button>
              </span>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirming(true)}
                aria-label={`Retirer ${member.full_name || member.email}`}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            )
          ) : null}
        </div>
      </div>
      {error ? <Alert tone="error" className="mt-3">{error}</Alert> : null}
    </li>
  );
}

export function TeamPage() {
  const { tenant, accessToken } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [roleId, setRoleId] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const permissionQuery = useQuery({
    queryKey: ['team', 'permission', tenant.id],
    queryFn: () => hasPermission(accessToken, tenant.id, 'members.manage'),
  });
  const membersQuery = useQuery({
    queryKey: ['team', 'members', tenant.id],
    queryFn: () => listMembers(accessToken, tenant.id),
  });
  const rolesQuery = useQuery({
    queryKey: ['team', 'roles', tenant.id],
    queryFn: () => listRoles(accessToken, tenant.id),
  });
  const invitationsQuery = useQuery({
    queryKey: ['team', 'invitations', tenant.id],
    queryFn: () => listInvitations(accessToken, tenant.id),
    enabled: permissionQuery.data === true,
  });

  const canManage = permissionQuery.data === true;
  const members = membersQuery.data ?? [];
  const roles = rolesQuery.data ?? [];
  const invitations = invitationsQuery.data ?? [];
  const selectedRoleId = roleId || roles.find((role) => role.name === 'Vendeur')?.id || roles[0]?.id || '';

  const inviteMutation = useMutation({
    mutationFn: () =>
      inviteMember(accessToken, tenant.id, {
        email: email.trim(),
        role_id: selectedRoleId,
        full_name: fullName.trim() || null,
      }),
  });
  const revokeMutation = useMutation({
    mutationFn: (invitationId: string) => revokeInvitation(accessToken, tenant.id, invitationId),
  });

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['team', 'members', tenant.id] }),
      queryClient.invalidateQueries({ queryKey: ['team', 'roles', tenant.id] }),
      queryClient.invalidateQueries({ queryKey: ['team', 'invitations', tenant.id] }),
      queryClient.invalidateQueries({ queryKey: ['tenants', user?.id] }),
    ]);

  const submitInvite = async () => {
    setFormError(null);
    setFeedback(null);
    if (!/^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$/.test(email.trim())) {
      setFormError('Saisissez une adresse e-mail valide.');
      return;
    }
    if (!selectedRoleId) {
      setFormError('Choisissez un rôle.');
      return;
    }
    try {
      const result = await inviteMutation.mutateAsync();
      setEmail('');
      setFullName('');
      setFeedback(
        result.status === 'added'
          ? 'Cette personne a déjà un compte : elle fait maintenant partie de l’équipe.'
          : 'Invitation enregistrée. Elle sera activée dès que cette personne créera son compte avec cette adresse.',
      );
      await refresh();
    } catch (caught) {
      setFormError(errorMessage(caught));
    }
  };

  const revoke = async (invitationId: string) => {
    setFormError(null);
    setFeedback(null);
    try {
      await revokeMutation.mutateAsync(invitationId);
      await refresh();
    } catch (caught) {
      setFormError(errorMessage(caught));
    }
  };

  return (
    <WorkspaceSection
      title="Équipe"
      description="Les personnes qui travaillent dans cette entreprise. Chacune a un rôle : le vendeur encaisse, le magasinier gère le stock, le propriétaire administre tout."
    >
      {permissionQuery.isError ? <Alert tone="error" className="mb-5">{errorMessage(permissionQuery.error)}</Alert> : null}
      {!canManage && permissionQuery.isSuccess ? (
        <Alert tone="info" className="mb-5">
          Vous pouvez consulter l’équipe, mais seuls les propriétaires peuvent inviter, changer les rôles ou retirer un
          membre.
        </Alert>
      ) : null}

      <div className="grid gap-7 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="min-w-0">
          <h2 className="mb-3 flex items-center gap-2 font-bold text-ink">
            <Users className="size-5 text-mint-dark" aria-hidden="true" />
            Membres {members.length > 0 ? <span className="text-sm font-semibold text-slate-500">({members.length})</span> : null}
          </h2>
          {membersQuery.isLoading ? (
            <div className="grid min-h-48 place-items-center" role="status">
              <LoaderCircle className="size-7 animate-spin text-mint" aria-label="Chargement de l’équipe" />
            </div>
          ) : membersQuery.isError ? (
            <Alert tone="error">
              {errorMessage(membersQuery.error)}{' '}
              <Button type="button" variant="link" onClick={() => { void membersQuery.refetch(); }}>Réessayer</Button>
            </Alert>
          ) : (
            <ul className="space-y-3">
              {members.map((member) => (
                <MemberRow
                  key={member.membership_id}
                  member={member}
                  canManage={canManage}
                  roles={roles}
                  isSelf={member.user_id === user?.id}
                />
              ))}
            </ul>
          )}

          {canManage ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="flex items-center gap-2 font-bold text-ink">
                <Mail className="size-5 text-mint-dark" aria-hidden="true" />
                Invitations en attente
              </h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Une invitation s’active automatiquement quand la personne se connecte avec cette adresse. Elle expire au
                bout de 14 jours.
              </p>
              {invitationsQuery.isLoading ? (
                <div className="grid min-h-24 place-items-center" role="status">
                  <LoaderCircle className="size-6 animate-spin text-mint" aria-label="Chargement des invitations" />
                </div>
              ) : invitations.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">Aucune invitation en attente.</p>
              ) : (
                <ul className="mt-3 divide-y divide-slate-100">
                  {invitations.map((invitation) => (
                    <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">{invitation.email}</p>
                        <p className="text-xs text-slate-500">
                          {invitation.role_name}
                          {invitation.full_name ? ` · ${invitation.full_name}` : ''} · expire le {expiry(invitation.expires_at)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        loading={revokeMutation.isPending && revokeMutation.variables === invitation.id}
                        onClick={() => { void revoke(invitation.id); }}
                      >
                        Annuler l’invitation
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>

        <div className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="flex items-center gap-2 font-bold text-ink">
            <UserPlus className="size-5 text-mint-dark" aria-hidden="true" />
            Inviter une personne
          </h2>
          <p className="mt-1 mb-4 text-xs leading-5 text-slate-500">
            Si la personne a déjà un compte Stokari, elle rejoint l’entreprise immédiatement. Sinon, l’invitation attend
            son inscription — aucun e-mail n’est envoyé automatiquement.
          </p>
          {formError ? <Alert tone="error" className="mb-4">{formError}</Alert> : null}
          {feedback ? <Alert tone="success" className="mb-4">{feedback}</Alert> : null}
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submitInvite();
            }}
          >
            <div>
              <Label htmlFor="invite-email" className="mb-2 block">Adresse e-mail</Label>
              <input
                id="invite-email"
                type="text"
                inputMode="email"
                autoComplete="email"
                className={inputClass}
                value={email}
                maxLength={160}
                required
                disabled={!canManage}
                onChange={(event) => { setFeedback(null); setEmail(event.target.value); }}
              />
            </div>
            <div>
              <Label htmlFor="invite-name" className="mb-2 block">
                Nom <span className="font-normal text-slate-400">(optionnel)</span>
              </Label>
              <input
                id="invite-name"
                className={inputClass}
                value={fullName}
                maxLength={120}
                disabled={!canManage}
                onChange={(event) => setFullName(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="invite-role" className="mb-2 block">Rôle</Label>
              <select
                id="invite-role"
                className={inputClass}
                value={selectedRoleId}
                disabled={!canManage}
                onChange={(event) => setRoleId(event.target.value)}
              >
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </select>
            </div>
            <Button type="submit" variant="mint" className="w-full" loading={inviteMutation.isPending} disabled={!canManage || roles.length === 0}>
              <UserPlus className="size-4" aria-hidden="true" />
              Envoyer l’invitation
            </Button>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
              <ShieldCheck className="size-4 text-mint-dark" aria-hidden="true" />
              Ce que chaque rôle peut faire
            </h3>
            <ul className="mt-3 space-y-3">
              {roles.map((role) => (
                <li key={role.id}>
                  <p className="text-sm font-semibold text-ink">
                    {role.name}
                    <span className="ml-2 text-xs font-normal text-slate-500">
                      {role.member_count} {role.member_count > 1 ? 'membres' : 'membre'}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs leading-5 text-slate-500">{role.description || 'Rôle personnalisé.'}</p>
                  <p className="mt-1 font-mono text-[11px] leading-4 text-slate-400">{role.permissions.join(' · ') || 'aucune permission'}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </WorkspaceSection>
  );
}
