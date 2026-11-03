/** Layout des écrans publics d'authentification : pas de sidebar, pas de données. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="auth-wrap">{children}</div>;
}
