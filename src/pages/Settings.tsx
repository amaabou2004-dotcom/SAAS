import { useEffect, useState } from 'react'
import {
  Building2,
  Database,
  Download,
  Keyboard,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react'
import { useData } from '../lib/store'
import { useUI } from '../lib/uiStore'
import { useAuth } from '../lib/auth'
import { Field, cx } from '../components/ui'
import { CURRENCIES } from '../lib/format'
import { exportMovementsCSV, exportProductsCSV } from '../lib/csv'

export default function Settings() {
  const { settings, products, suppliers, movements, updateSettings, seedDemo, reload } = useData()
  const { activeTenant, roleName, profile, tenants, selectTenant, signOut, refreshTenants } = useAuth()
  const toast = useUI((s) => s.toast)
  const [form, setForm] = useState(settings)
  const [busy, setBusy] = useState(false)
  const [seeding, setSeeding] = useState(false)

  useEffect(() => {
    setForm(settings)
  }, [settings])

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const save = async () => {
    setBusy(true)
    try {
      await updateSettings(form)
      await refreshTenants()
      toast('Réglages enregistrés')
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const loadDemo = async () => {
    if (!window.confirm('Charger le catalogue de démonstration (33 produits, 30 jours d’historique) dans cet espace ?')) return
    setSeeding(true)
    try {
      const result = await seedDemo()
      toast(`Démo chargée : ${result.products} produits, ${result.movements} mouvements`)
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-ink-900">Réglages</h2>
        <p className="mt-0.5 text-sm text-ink-500">Entreprise, compte et données</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card p-4 lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <Building2 size={17} className="text-ink-500" />
            <div>
              <h3 className="section-title text-sm">Entreprise</h3>
              <p className="text-[11px] text-ink-400">Ces informations apparaissent sur vos bons de commande et exports</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom de l’entreprise" className="sm:col-span-2">
              <input className="input" value={form.company} onChange={(e) => set('company', e.target.value)} />
            </Field>
            <Field label="Devise">
              <select className="input" value={form.currency} onChange={(e) => set('currency', e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Téléphone">
              <input className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+227 90 00 00 00" />
            </Field>
            <Field label="Adresse" className="sm:col-span-2">
              <input className="input" value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Rue du Grand Marché, Niamey" />
            </Field>
          </div>

          <div className="mt-5 border-t border-ink-100 pt-4">
            <div className="mb-3 flex items-center gap-2">
              <User size={16} className="text-ink-500" />
              <h3 className="section-title text-sm">Mon compte</h3>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom affiché">
                <input className="input" value={form.userName} onChange={(e) => set('userName', e.target.value)} />
              </Field>
              <Field label="E-mail">
                <input className="input bg-ink-50 text-ink-500" value={profile?.email ?? ''} readOnly />
              </Field>
            </div>
            <p className="mt-2 text-[11px] text-ink-400">
              Rôle dans cet espace : <strong className="font-semibold text-ink-700">{roleName || '—'}</strong>
            </p>
          </div>

          <div className="mt-4 flex justify-end">
            <button onClick={save} disabled={busy} className="btn-brand">
              {busy ? <Loader2 size={16} className="animate-spin" /> : null} Enregistrer
            </button>
          </div>
        </section>

        <div className="space-y-4">
          <section className="card p-4">
            <div className="mb-3 flex items-center gap-2">
              <Database size={17} className="text-ink-500" />
              <div>
                <h3 className="section-title text-sm">Données</h3>
                <p className="text-[11px] text-ink-400">
                  {products.length} produits · {suppliers.length} fournisseurs · {movements.length} mouvements
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => {
                  exportProductsCSV(products, suppliers)
                  toast('Produits exportés en CSV')
                }}
                className="btn-ghost w-full justify-start"
              >
                <Download size={16} /> Exporter le catalogue
              </button>
              <button
                onClick={() => {
                  exportMovementsCSV(movements, products)
                  toast('Mouvements exportés en CSV')
                }}
                className="btn-ghost w-full justify-start"
              >
                <Download size={16} /> Exporter l’historique
              </button>
              <button onClick={() => reload()} className="btn-ghost w-full justify-start">
                <RefreshCw size={16} /> Recharger depuis le serveur
              </button>
              <button onClick={loadDemo} disabled={seeding} className="btn-ghost w-full justify-start">
                {seeding ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Charger la démo
              </button>
            </div>
            <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-brand-50 px-2.5 py-2 text-[11px] leading-relaxed text-brand-900">
              <ShieldCheck size={13} className="mt-0.5 shrink-0" /> Données hébergées sur Supabase (PostgreSQL + RLS).
              Chaque entreprise ne voit que ses propres enregistrements.
            </p>
          </section>

          <section className="card p-4">
            <h3 className="section-title text-sm">Mes espaces ({tenants.length})</h3>
            <ul className="mt-2 space-y-1">
              {tenants.map((tenant) => (
                <li key={tenant.id}>
                  <button
                    onClick={() => selectTenant(tenant.id)}
                    className={cx(
                      'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] font-medium',
                      tenant.id === activeTenant?.id ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-ink-100',
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{tenant.name}</span>
                    <span className={cx('shrink-0 text-[10px] uppercase', tenant.id === activeTenant?.id ? 'text-white/60' : 'text-ink-400')}>
                      {tenant.currency}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <button
              onClick={async () => {
                await signOut()
              }}
              className="btn-ghost mt-3 w-full justify-start text-rose-600 hover:bg-rose-50"
            >
              <LogOut size={16} /> Se déconnecter
            </button>
          </section>

          <section className="card p-4">
            <div className="mb-2 flex items-center gap-2">
              <Keyboard size={17} className="text-ink-500" />
              <h3 className="section-title text-sm">Raccourcis</h3>
            </div>
            <ul className="space-y-2 text-[12px] text-ink-600">
              <li className="flex items-center justify-between">
                Recherche rapide <span className="flex gap-1"><span className="kbd">⌘ / Ctrl</span><span className="kbd">K</span></span>
              </li>
              <li className="flex items-center justify-between">
                Nouvelle entrée <span className="flex gap-1"><span className="kbd">⌘ / Ctrl</span><span className="kbd">I</span></span>
              </li>
              <li className="flex items-center justify-between">
                Fermer une fenêtre <span className="kbd">Échap</span>
              </li>
            </ul>
          </section>
        </div>
      </div>

      <section className="card p-4">
        <h3 className="section-title text-sm">À propos de Kanti</h3>
        <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-ink-500">
          Kanti est un SaaS de gestion de stock pensé pour les commerces et PME d’Afrique de l’Ouest : scan code-barres,
          mouvements tracés, alertes calculées sur vos ventes réelles, bons de commande fournisseurs et rapports.
          L’application est multi-entreprises, multi-utilisateurs (rôles et permissions via RLS PostgreSQL) et
          synchronisée dans le cloud.
        </p>
      </section>
    </div>
  )
}
