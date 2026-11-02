import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { AuthProvider, useAuth } from './lib/auth'
import DataBridge from './components/DataBridge'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Stock from './pages/Stock'
import Movements from './pages/Movements'
import Alerts from './pages/Alerts'
import Reports from './pages/Reports'
import Suppliers from './pages/Suppliers'
import Settings from './pages/Settings'
import AuthPage, { AuthCallback } from './pages/Auth'
import Onboarding from './pages/Onboarding'
import ProductForm from './components/ProductForm'
import MovementForm from './components/MovementForm'
import ProductDetail from './components/ProductDetail'
import SupplierForm from './components/SupplierForm'
import OrderModal from './components/OrderModal'
import SearchPalette from './components/SearchPalette'
import ScannerModal from './components/ScannerModal'
import HelpGuide from './components/HelpGuide'
import { Toaster } from './components/ui'

function Splash() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-ink-50 text-ink-500">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-ink-950 text-brand-400">
        <Loader2 size={20} className="animate-spin" />
      </div>
      <p className="text-sm">Ouverture de Kanti…</p>
    </div>
  )
}

function ProtectedShell() {
  const { ready, session, tenants, loadingTenants } = useAuth()

  if (!ready) return <Splash />
  if (!session) return <Navigate to="/auth/connexion" replace />
  if (loadingTenants && tenants.length === 0) return <Splash />
  if (tenants.length === 0) return <Onboarding />

  return (
    <DataBridge>
      <Outlet />
    </DataBridge>
  )
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { ready, session, tenants } = useAuth()
  if (!ready) return <Splash />
  if (session && tenants.length > 0) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/auth/connexion"
            element={
              <PublicOnly>
                <AuthPage mode="signin" />
              </PublicOnly>
            }
          />
          <Route
            path="/auth/inscription"
            element={
              <PublicOnly>
                <AuthPage mode="signup" />
              </PublicOnly>
            }
          />
          <Route path="/auth/mot-de-passe-oublie" element={<AuthPage mode="forgot" />} />
          <Route path="/auth/reinitialisation" element={<AuthPage mode="reset" />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          <Route element={<ProtectedShell />}>
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="stock" element={<Stock />} />
              <Route path="mouvements" element={<Movements />} />
              <Route path="alertes" element={<Alerts />} />
              <Route path="rapports" element={<Reports />} />
              <Route path="fournisseurs" element={<Suppliers />} />
              <Route path="reglages" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        <ProductForm />
        <MovementForm />
        <ProductDetail />
        <SupplierForm />
        <OrderModal />
        <SearchPalette />
        <ScannerModal />
        <HelpGuide />
        <Toaster />
      </BrowserRouter>
    </AuthProvider>
  )
}
