import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Check,
  Copy,
  Crown,
  Loader2,
  Mail,
  MailPlus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useUI } from '../lib/uiStore'
import { EmptyState, cx } from '../components/ui'
import {
  changeMemberRole,
  fetchTeam,
  inviteMember,
  permissionLabel,
  removeMember,
  revokeInvitation,
  type TeamInvitation,
  type TeamMember,
  type TeamRole,
} from '../lib/team'

const ROLE_TONE: Record<string, string> = {
  Propriétaire: 'bg-ink-900 text-white',
  Gestionnaire: 'bg-brand-100 text-brand-800',
  Magasinier: 'bg-sky-100 text-sky-800',
  Vendeur: 'bg-amber-100 text-amber-800',
  'Lecture seule': 'bg-ink-100 text-ink-600',
}

function initials(name: string): string {
  return name
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function Team() {
  const { activeTenant, profile, activeRoleId, refreshTenants } = useAuth()
  const toast = useUI((s) => s.toast)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [members, setMembers] = useState<TeamMember[]>([])
  const [roles, setRoles] = useState<TeamRole[]>([])
  const [invitations, setInvitations] = useState<TeamInvitation[]>([])

  const [formOpen, setFormOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [roleId, setRoleId] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [copied, setCopied] = useState('')

  const tenantId = activeTenant?.id ?? ''

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    setError('')
    try {
      const snapshot = await fetchTeam(tenantId)
      setMembers(snapshot.members)
      setRoles(snapshot.roles)
      setInvitations(snapshot.invitations)
      setRoleId((current) => current || (snapshot.roles.find((r) => r.name === 'Vendeur')?.id ?? snapshot.roles[1]?.id ?? snapshot.roles[0]?.id ?? ''))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    void load()
  }, [load])

  const myRole = useMemo(() => roles.find((role) => role.id === activeRoleId), [roles, activeRoleId])
  const canManage = myRole?.permissions.includes('members.manage') ?? false
  const ownerRoleId = roles.find((role) => role.name === 'Propriétaire')?.id
  const ownerCount = members.filter((member) => member.roleName === 'Propriétaire' && member.status === 'active').length

  const submitInvite = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError('')
    if (!tenantId) return
    if (!/^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$/.test(email.trim())) {
      setFormError('Saisissez une adresse e-mail valide.')
      return
    }
    if (!roleId) {
      setFormError('Choisissez un rôle.')
      return
    }
    setBusy(true)
    try {
      const result = await inviteMember({ tenantId, email, roleId, fullName })
      toast(
        result.status === 'added'
          ? `${email.trim()} a rejoint l’équipe.`
          : `Invitation enregistrée pour ${email.trim()}.`,
        'success',
      )
      setEmail('')
      setFullName('')
      setFormOpen(false)
      await load()
    } catch (err) {
      setFormError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const onRoleChange = async (member: TeamMember, nextRoleId: string) => {
    if (!tenantId) return
    setBusy(true)
    try {
      await changeMemberRole(tenantId, member.membershipId, nextRoleId)
      await load()
      await refreshTenants()
      toast(`Rôle de ${member.fullName} mis à jour.`, 'success')
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const onRemove = async (member: TeamMember) => {
    if (!tenantId) return
    if (!window.confirm(`Retirer ${member.fullName} de l’entreprise ? Son accès sera supprimé immédiatement.`)) return
    setBusy(true)
    try {
      await removeMember(tenantId, member.membershipId)
      await load()
      toast(`${member.fullName} ne fait plus partie de l’équipe.`, 'success')
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const onRevoke = async (invitation: TeamInvitation) => {
    if (!tenantId) return
    setBusy(true)
    try {
      await revokeInvitation(tenantId, invitation.id)
      await load()
      toast('Invitation annulée.', 'success')
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const copyInvite = async (invitation: TeamInvitation) => {
    const origin = window.location.origin
    const text = `Bonjour,\n\nJe vous invite à rejoindre « ${activeTenant?.name ?? 'notre entreprise'} » sur Kanti (gestion de stock).\n\n1. Ouvrez ${origin}/auth/inscription\n2. Créez votre compte avec l’adresse ${invitation.email}\n\nVous entrerez directement avec le rôle « ${invitation.roleName} ».`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(invitation.id)
      window.setTimeout(() => setCopied(''), 2500)
      toast('Message d’invitation copié.', 'success')
    } catch {
      toast('Impossible de copier : sélectionnez le texte manuellement.', 'error')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-ink-900">Équipe</h2>
          <p className="mt-0.5 text-sm text-ink-500">
            {members.length} membre(s) · {invitations.length} invitation(s) en attente
            {myRole ? ` · votre rôle : ${myRole.name}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void load()} className="btn-ghost shrink-0" disabled={loading}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Actualiser</span>
          </button>
          <button
            onClick={() => setFormOpen((open) => !open)}
            className="btn-brand shrink-0"
            disabled={!canManage}
            title={canManage ? undefined : 'Votre rôle ne permet pas d’inviter des membres.'}
          >
            {formOpen ? <X size={16} /> : <UserPlus size={16} />}
            <span className="hidden sm:inline">{formOpen ? 'Fermer' : 'Inviter'}</span>
          </button>
        </div>
      </div>

      {!canManage && myRole ? (
        <div className="card flex items-start gap-3 border-amber-200 bg-amber-50 p-4">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-amber-600" />
          <p className="text-[13px] leading-relaxed text-amber-900">
            Avec le rôle <strong>{myRole.name}</strong>, vous consultez l’équipe mais ne pouvez pas inviter, changer de
            rôle ou retirer quelqu’un. Demandez au propriétaire de vous passer « Gestionnaire ».
          </p>
        </div>
      ) : null}

      {formOpen ? (
        <form onSubmit={submitInvite} className="card space-y-3 p-4">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
              <MailPlus size={17} />
            </span>
            <div>
              <p className="text-sm font-bold text-ink-900">Inviter une personne</p>
              <p className="text-[12px] text-ink-500">Elle rejoint l’entreprise, avec uniquement les droits de son rôle.</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold text-ink-600">E-mail professionnel</span>
              <input
                className="input h-10"
                type="email"
                inputMode="email"
                autoComplete="off"
                placeholder="vendeur@entreprise.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold text-ink-600">Nom (optionnel)</span>
              <input
                className="input h-10"
                placeholder="Awa Diallo"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-[12px] font-semibold text-ink-600">Rôle</span>
              <select className="input h-10" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
                {roles
                  .filter((role) => role.name !== 'Propriétaire')
                  .map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name} — {role.description}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          {formError ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-[13px] font-medium text-rose-700">{formError}</p> : null}
          <p className="text-[12px] leading-relaxed text-ink-500">
            Si la personne a déjà un compte Kanti, elle est ajoutée immédiatement. Sinon, l’invitation l’attend : dès
            qu’elle crée son compte avec cet e-mail, elle rejoint l’entreprise automatiquement.
          </p>
          <button type="submit" className="btn-brand" disabled={busy}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
            Envoyer l’invitation
          </button>
        </form>
      ) : null}

      {error ? (
        <div className="card border-rose-200 bg-rose-50 p-4">
          <p className="text-sm font-semibold text-rose-800">{error}</p>
          <button onClick={() => void load()} className="btn-ghost mt-2">
            <RefreshCw size={15} /> Réessayer
          </button>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <section className="card overflow-hidden">
          <header className="flex items-center gap-2 border-b border-ink-100 px-4 py-3">
            <Users size={16} className="text-ink-400" />
            <h3 className="text-sm font-bold text-ink-900">Membres</h3>
            {loading ? <Loader2 size={14} className="animate-spin text-ink-400" /> : null}
          </header>

          {members.length === 0 && !loading ? (
            <EmptyState
              icon={<Users size={22} />}
              title="Aucun membre"
              description="Invitez votre premier collaborateur pour travailler à plusieurs."
            />
          ) : (
            <ul className="divide-y divide-ink-100">
              {members.map((member) => {
                const isMe = member.userId === profile?.id
                const lastOwner = member.roleName === 'Propriétaire' && ownerCount <= 1
                return (
                  <li key={member.membershipId} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span
                        className={cx(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-bold',
                          ROLE_TONE[member.roleName] ?? 'bg-ink-100 text-ink-600',
                        )}
                      >
                        {initials(member.fullName) || <Users size={15} />}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink-900">
                          {member.fullName}
                          {isMe ? <span className="ml-1.5 text-[11px] font-medium text-ink-400">(vous)</span> : null}
                        </p>
                        <p className="truncate text-[12px] text-ink-500">{member.email || '—'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:justify-end">
                      {canManage ? (
                        <select
                          className="input h-9 w-40 text-[13px]"
                          value={member.roleId}
                          disabled={busy || lastOwner}
                          onChange={(e) => void onRoleChange(member, e.target.value)}
                          title={lastOwner ? 'Il doit rester au moins un propriétaire.' : undefined}
                        >
                          {roles.map((role) => (
                            <option key={role.id} value={role.id}>
                              {role.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={cx('chip', ROLE_TONE[member.roleName] ?? 'bg-ink-100 text-ink-600')}>
                          {member.roleName}
                        </span>
                      )}
                      {canManage ? (
                        <button
                          onClick={() => void onRemove(member)}
                          className="btn-subtle h-9 w-9 p-0 text-rose-600 hover:bg-rose-50"
                          disabled={busy || lastOwner}
                          aria-label={`Retirer ${member.fullName}`}
                          title={lastOwner ? 'Il doit rester au moins un propriétaire.' : 'Retirer ce membre'}
                        >
                          <Trash2 size={15} />
                        </button>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <div className="space-y-4">
          <section className="card overflow-hidden">
            <header className="flex items-center gap-2 border-b border-ink-100 px-4 py-3">
              <Mail size={16} className="text-ink-400" />
              <h3 className="text-sm font-bold text-ink-900">Invitations en attente</h3>
            </header>
            {invitations.length === 0 ? (
              <p className="px-4 py-4 text-[13px] text-ink-500">Aucune invitation en attente.</p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {invitations.map((invitation) => (
                  <li key={invitation.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink-900">{invitation.email}</p>
                        <p className="text-[12px] text-ink-500">
                          {invitation.roleName} · invite le {formatDate(invitation.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => void copyInvite(invitation)}
                          className="btn-subtle h-8 w-8 p-0"
                          aria-label="Copier le message d’invitation"
                          title="Copier le message à envoyer"
                        >
                          {copied === invitation.id ? <Check size={14} className="text-brand-600" /> : <Copy size={14} />}
                        </button>
                        <button
                          onClick={() => void onRevoke(invitation)}
                          className="btn-subtle h-8 w-8 p-0 text-rose-600 hover:bg-rose-50"
                          disabled={busy}
                          aria-label="Annuler l’invitation"
                          title="Annuler l’invitation"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-ink-900">
              <Crown size={15} className="text-amber-500" /> Les rôles
            </h3>
            <ul className="mt-3 space-y-3">
              {roles.map((role) => (
                <li key={role.id}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={cx('chip', ROLE_TONE[role.name] ?? 'bg-ink-100 text-ink-600')}>{role.name}</span>
                    <span className="text-[11px] font-medium text-ink-400">
                      {role.memberCount} membre{role.memberCount > 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-ink-500">{role.description}</p>
                  <p className="mt-1 flex flex-wrap gap-1">
                    {role.permissions.slice(0, 6).map((code) => (
                      <span key={code} className="rounded-md bg-ink-50 px-1.5 py-0.5 text-[10px] font-medium text-ink-500">
                        {permissionLabel(code)}
                      </span>
                    ))}
                    {role.permissions.length > 6 ? (
                      <span className="rounded-md bg-ink-50 px-1.5 py-0.5 text-[10px] font-medium text-ink-400">
                        +{role.permissions.length - 6}
                      </span>
                    ) : null}
                  </p>
                </li>
              ))}
            </ul>
            {ownerRoleId ? (
              <p className="mt-3 border-t border-ink-100 pt-2 text-[11px] leading-relaxed text-ink-400">
                Le propriétaire est le seul à pouvoir supprimer l’entreprise. Il doit toujours en rester un.
              </p>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  )
}
