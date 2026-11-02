/** Mock du contexte d'authentification pour les tests de rendu hors navigateur. */
export function useAuth() {
  return {
    ready: true,
    session: { user: { id: 'test-user', email: 'demo@kanti.app' } },
    user: { id: 'test-user', email: 'demo@kanti.app' },
    profile: { id: 'test-user', fullName: 'Moussa Démo', email: 'demo@kanti.app' },
    tenants: [{ id: 'tenant-1', name: 'Kanti Démo SARL', slug: 'kanti-demo', currency: 'XOF', timezone: 'Africa/Niamey', address: null, phone: null }],
    activeTenant: { id: 'tenant-1', name: 'Kanti Démo SARL', slug: 'kanti-demo', currency: 'XOF', timezone: 'Africa/Niamey', address: null, phone: null },
    roleName: 'Propriétaire',
    activeRoleId: 'role-1',
    loadingTenants: false,
    selectTenant: () => {},
    refreshTenants: async () => [],
    signIn: async () => {},
    signUp: async () => ({ needsConfirmation: false }),
    signInWithGoogle: async () => {},
    sendPasswordReset: async () => {},
    updatePassword: async () => {},
    signOut: async () => {},
    createWorkspace: async () => ({}),
    updateProfileName: async () => {},
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return children
}

export function newIdempotencyKey(prefix = 'op') {
  return `${prefix}-test`
}
