import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Stock from './pages/Stock'
import Movements from './pages/Movements'
import Alerts from './pages/Alerts'
import Reports from './pages/Reports'
import Suppliers from './pages/Suppliers'
import Settings from './pages/Settings'
import ProductForm from './components/ProductForm'
import MovementForm from './components/MovementForm'
import ProductDetail from './components/ProductDetail'
import SupplierForm from './components/SupplierForm'
import OrderModal from './components/OrderModal'
import SearchPalette from './components/SearchPalette'
import ScannerModal from './components/ScannerModal'
import { Toaster } from './components/ui'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
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
      </Routes>

      <ProductForm />
      <MovementForm />
      <ProductDetail />
      <SupplierForm />
      <OrderModal />
      <SearchPalette />
      <ScannerModal />
      <Toaster />
    </BrowserRouter>
  )
}
