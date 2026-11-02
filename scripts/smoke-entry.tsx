import { StrictMode, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Layout from '../src/components/Layout'
import Dashboard from '../src/pages/Dashboard'
import Stock from '../src/pages/Stock'
import Movements from '../src/pages/Movements'
import Alerts from '../src/pages/Alerts'
import Reports from '../src/pages/Reports'
import Suppliers from '../src/pages/Suppliers'
import Settings from '../src/pages/Settings'
import AuthPage from '../src/pages/Auth'
import Onboarding from '../src/pages/Onboarding'
import ProductForm from '../src/components/ProductForm'
import MovementForm from '../src/components/MovementForm'
import ProductDetail from '../src/components/ProductDetail'
import SupplierForm from '../src/components/SupplierForm'
import OrderModal from '../src/components/OrderModal'
import SearchPalette from '../src/components/SearchPalette'
import ScannerModal from '../src/components/ScannerModal'
import HelpGuide from '../src/components/HelpGuide'
import { Toaster } from '../src/components/ui'

export function renderAt(path: string, el: HTMLElement): Root {
  const root = createRoot(el)
  root.render(
    <StrictMode>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="stock" element={<Stock />} />
            <Route path="mouvements" element={<Movements />} />
            <Route path="alertes" element={<Alerts />} />
            <Route path="rapports" element={<Reports />} />
            <Route path="fournisseurs" element={<Suppliers />} />
            <Route path="reglages" element={<Settings />} />
          </Route>
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
      </MemoryRouter>
    </StrictMode>,
  )
  return root
}

export function renderStandalone(node: ReactNode, path: string, el: HTMLElement): Root {
  const root = createRoot(el)
  root.render(
    <StrictMode>
      <MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>
    </StrictMode>,
  )
  return root
}

export function renderAuth(mode: 'signin' | 'signup' | 'forgot' | 'reset', el: HTMLElement): Root {
  return renderStandalone(<AuthPage mode={mode} />, `/auth/${mode}`, el)
}

export function renderOnboarding(el: HTMLElement): Root {
  return renderStandalone(<Onboarding />, '/', el)
}
export { useUI } from '../src/lib/uiStore'
export { useScanner } from '../src/lib/scannerStore'
export { useData } from '../src/lib/store'
