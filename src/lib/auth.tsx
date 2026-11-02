import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, frenchError } from './supabase'
import { uid } from './format'

export type Tenant = {
  id: string
  name: string
  slug: string
  currency: string
  timezone: string
  address: string | null
  phone: string | null
}

export type Membership = { tenantId: string; roleId: string; roleName: string }

export type Profile = { id: string; fullName: string; email: string }

type AuthContextValue = {
  ready: boolean
  session: Session | null
  user: User | null
  profile: Profile | null
  tenants: Tenant[]
  activeTenant: Tenant | null
  roleName: string
  activeRoleId: string | null
  loadingTenants: boolean
  selectTenant: (tenantId: string) => void
  refreshTenants: () => Promise<Tenant[]>
  signIn: (email: string, password: string) => Promise<void>
  signUp: (input: { email: string; password: string; fullName: string }) => Promise<{ needsConfirmation: boolean }>
  signInWithGoogle: () => Promise<void>
  sendPasswordReset: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  signOut: () => Promise<void>
  createWorkspace: (input: { name: string; currency: string; timezone: string; seedDemo: boolean }) => Promise<Tenant>
  updateProfileName: (name: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)
const ACTIVE_TENANT_KEY = 'kanti-active-tenant'

function slugify(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || `espace-${Math.random().toString(36).slice(2, 7)}`
  )
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [activeTenantId, setActiveTenantId] = useState<string | null>(() => localStorage.getItem(ACTIVE_TENANT_KEY))
  const [loadingTenants, setLoadingTenants] = useState(false)

  const loadProfile = async (user: User) => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('id', user.id)
      .maybeSingle()
    setProfile({
      id: user.id,
      fullName: (data?.full_name as string | null) ?? (user.user_metadata?.full_name as string | undefined) ?? user.email?.split('@')[0] ?? 'Utilisateur',
      email: user.email ?? '',
    })
  }

  const loadTenants = async (user: User): Promise<Tenant[]> => {
    setLoadingTenants(true)
    try {
      const { data: rows, error } = await supabase
        .from('memberships')
        .select('tenant_id, role_id, status')
        .eq('user_id', user.id)
        .eq('status', 'active')
      if (error) throw error

      const tenantIds = (rows ?? []).map((r) => r.tenant_id as string)
      if (tenantIds.length === 0) {
        setTenants([])
        setMemberships([])
        return []
      }

      const [{ data: tenantRows }, { data: roleRows }] = await Promise.all([
        supabase
          .from('tenants')
          .select('id, name, slug, currency_code, timezone, address, phone, status')
          .in('id', tenantIds),
        supabase.from('roles').select('id, tenant_id, name').in('tenant_id', tenantIds),
      ])

      const mappedTenants: Tenant[] = (tenantRows ?? []).map((t) => ({
        id: t.id as string,
        name: t.name as string,
        slug: t.slug as string,
        currency: t.currency_code as string,
        timezone: t.timezone as string,
        address: (t.address as string | null) ?? null,
        phone: (t.phone as string | null) ?? null,
      }))

      const mappedMemberships: Membership[] = (rows ?? []).map((m) => {
        const role = (roleRows ?? []).find((r) => r.id === m.role_id)
        return {
          tenantId: m.tenant_id as string,
          roleId: m.role_id as string,
          roleName: (role?.name as string | undefined) ?? 'Membre',
        }
      })

      setTenants(mappedTenants)
      setMemberships(mappedMemberships)

      setActiveTenantId((current) => {
        const stillValid = current && mappedTenants.some((t) => t.id === current)
        const next = stillValid ? current : (mappedTenants[0]?.id ?? null)
        if (next) localStorage.setItem(ACTIVE_TENANT_KEY, next)
        return next
      })

      return mappedTenants
    } finally {
      setLoadingTenants(false)
    }
  }

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      setSession(data.session)
      if (data.session?.user) {
        await Promise.all([loadProfile(data.session.user), loadTenants(data.session.user)])
      }
      if (mounted) setReady(true)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      if (!nextSession?.user) {
        setProfile(null)
        setTenants([])
        setMemberships([])
        return
      }
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
        void loadProfile(nextSession.user)
        void loadTenants(nextSession.user)
      }
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(() => {
    const activeTenant = tenants.find((t) => t.id === activeTenantId) ?? tenants[0] ?? null
    const membership = memberships.find((m) => m.tenantId === activeTenant?.id)

    return {
      ready,
      session,
      user: session?.user ?? null,
      profile,
      tenants,
      activeTenant,
      roleName: membership?.roleName ?? '',
      activeRoleId: membership?.roleId ?? null,
      loadingTenants,
      selectTenant: (tenantId) => {
        localStorage.setItem(ACTIVE_TENANT_KEY, tenantId)
        setActiveTenantId(tenantId)
      },
      refreshTenants: async () => (session?.user ? loadTenants(session.user) : []),
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw new Error(frenchError(error.message))
      },
      signUp: async ({ email, password, fullName }) => {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        })
        if (error) throw new Error(frenchError(error.message))
        return { needsConfirmation: !data.session }
      },
      signInWithGoogle: async () => {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: `${window.location.origin}/auth/callback` },
        })
        if (error) throw new Error(frenchError(error.message))
      },
      sendPasswordReset: async (email) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/auth/reinitialisation`,
        })
        if (error) throw new Error(frenchError(error.message))
      },
      updatePassword: async (password) => {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw new Error(frenchError(error.message))
      },
      signOut: async () => {
        await supabase.auth.signOut()
        localStorage.removeItem(ACTIVE_TENANT_KEY)
        setActiveTenantId(null)
      },
      createWorkspace: async ({ name, currency, timezone, seedDemo }) => {
        if (!session?.user) throw new Error('Session expirée, reconnectez-vous.')
        const baseSlug = slugify(name)
        let slug = baseSlug
        let attempt = 0
        // Un slug unique est requis ; on tente quelques suffixes si besoin.
        for (;;) {
          const { data, error } = await supabase.rpc('create_tenant', {
            p_name: name.trim(),
            p_slug: slug,
            p_currency_code: currency,
            p_timezone: timezone,
          })
          if (!error) {
            const created: Tenant = {
              id: data.id as string,
              name: data.name as string,
              slug: data.slug as string,
              currency: data.currency_code as string,
              timezone: data.timezone as string,
              address: null,
              phone: null,
            }
            if (seedDemo) {
              const { error: seedError } = await supabase.rpc('seed_demo_data', { p_tenant_id: created.id })
              if (seedError) console.warn('seed_demo_data', seedError.message)
              else await supabase.rpc('seed_demo_history', { p_tenant_id: created.id, p_days: 30 })
            }
            localStorage.setItem(ACTIVE_TENANT_KEY, created.id)
            setActiveTenantId(created.id)
            await loadTenants(session.user)
            return created
          }
          if (/duplicate key|tenants_slug_key/i.test(error.message) && attempt < 4) {
            attempt += 1
            slug = `${baseSlug}-${Math.random().toString(36).slice(2, 5)}`
            continue
          }
          throw new Error(frenchError(error.message))
        }
      },
      updateProfileName: async (name) => {
        if (!session?.user) return
        const { error } = await supabase.from('profiles').update({ full_name: name.trim() }).eq('id', session.user.id)
        if (error) throw new Error(frenchError(error.message))
        setProfile((p) => (p ? { ...p, fullName: name.trim() } : p))
      },
    }
  }, [ready, session, profile, tenants, memberships, activeTenantId, loadingTenants])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth doit être utilisé dans <AuthProvider>')
  return context
}

export function newIdempotencyKey(prefix = 'op'): string {
  return `${prefix}-${uid('').slice(0, 32)}`
}
