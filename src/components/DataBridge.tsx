import { useEffect, type ReactNode } from 'react'
import { useAuth } from '../lib/auth'
import { useData } from '../lib/store'

/** Synchronise le contexte d'authentification (entreprise, utilisateur, rôle) avec le store de données. */
export default function DataBridge({ children }: { children: ReactNode }) {
  const { activeTenant, profile, roleName } = useAuth()
  const configure = useData((s) => s.configure)
  const clear = useData((s) => s.clear)

  useEffect(() => {
    if (!activeTenant || !profile) {
      clear()
      return
    }
    void configure({
      tenantId: activeTenant.id,
      userId: profile.id,
      userName: profile.fullName,
      roleName: roleName || 'Membre',
      company: activeTenant.name,
      currency: activeTenant.currency,
      timezone: activeTenant.timezone,
      phone: activeTenant.phone ?? '',
      address: activeTenant.address ?? '',
    })
  }, [activeTenant, profile, roleName, configure, clear])

  return <>{children}</>
}
