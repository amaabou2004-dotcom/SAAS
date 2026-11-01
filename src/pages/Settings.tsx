import { useRef, useState } from 'react'
import { Database, Download, Keyboard, RotateCcw, ShieldCheck, Upload, User } from 'lucide-react'
import { useData } from '../lib/store'
import { useUI } from '../lib/uiStore'
import { Field } from '../components/ui'
import { CURRENCIES } from '../lib/format'
import { downloadFile } from '../lib/csv'

export default function Settings() {
  const { settings, products, suppliers, movements, updateSettings, resetDemo, restoreBackup } = useData()
  const toast = useUI((s) => s.toast)
  const [form, setForm] = useState(settings)
  const fileRef = useRef<HTMLInputElement>(null)

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const save = () => {
    updateSettings(form)
    toast('Réglages enregistrés')
  }

  const backup = () => {
    const payload = {
      app: 'kanti-stock',
      version: 1,
      exportedAt: new Date().toISOString(),
      settings,
      products,
      suppliers,
      movements,
    }
    downloadFile(`kanti-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2), 'application/json')
    toast('Sauvegarde téléchargée')
  }

  const restore = async (file: File | undefined) => {
    if (!file) return
    try {
      const data = JSON.parse(await file.text())
      const res = restoreBackup(data)
      if (res.ok) {
        toast('Sauvegarde restaurée')
        setForm(useData.getState().settings)
      } else {
        toast(res.error ?? 'Fichier invalide', 'error')
      }
    } catch {
      toast('Impossible de lire ce fichier JSON', 'error')
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-ink-900">Réglages</h2>
        <p className="mt-0.5 text-sm text-ink-500">Votre entreprise, vos préférences, vos données</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card p-4 lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <User size={17} className="text-ink-500" />
            <div>
              <h3 className="section-title text-sm">Entreprise & utilisateur</h3>
              <p className="text-[11px] text-ink-400">Ces informations apparaissent sur vos exports et bons de commande</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom de l’entreprise" className="sm:col-span-2">
              <input className="input" value={form.company} onChange={(e) => set('company', e.target.value)} />
            </Field>
            <Field label="Votre nom">
              <input className="input" value={form.userName} onChange={(e) => set('userName', e.target.value)} />
            </Field>
            <Field label="Votre rôle">
              <input className="input" value={form.role} onChange={(e) => set('role', e.target.value)} />
            </Field>
            <Field label="Téléphone">
              <input className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
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
            <Field label="Adresse" className="sm:col-span-2">
              <input className="input" value={form.address} onChange={(e) => set('address', e.target.value)} />
            </Field>
          </div>
          <div className="mt-4 flex justify-end">
            <button onClick={save} className="btn-brand">
              Enregistrer les réglages
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
              <button onClick={backup} className="btn-ghost w-full justify-start">
                <Download size={16} /> Exporter une sauvegarde
              </button>
              <button onClick={() => fileRef.current?.click()} className="btn-ghost w-full justify-start">
                <Upload size={16} /> Restaurer une sauvegarde
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => restore(e.target.files?.[0])}
              />
              <button
                onClick={() => {
                  if (window.confirm('Réinitialiser toutes les données avec la démo Kanti ? Vos modifications seront perdues.')) {
                    resetDemo()
                    setForm(useData.getState().settings)
                    toast('Données de démonstration restaurées', 'info')
                  }
                }}
                className="btn-ghost w-full justify-start text-ink-600 hover:text-rose-600"
              >
                <RotateCcw size={16} /> Réinitialiser la démo
              </button>
            </div>
            <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-brand-50 px-2.5 py-2 text-[11px] leading-relaxed text-brand-900">
              <ShieldCheck size={13} className="mt-0.5 shrink-0" /> Vos données restent dans ce navigateur (stockage local).
              Exportez régulièrement une sauvegarde.
            </p>
          </section>

          <section className="card p-4">
            <div className="mb-2 flex items-center gap-2">
              <Keyboard size={17} className="text-ink-500" />
              <h3 className="section-title text-sm">Raccourcis clavier</h3>
            </div>
            <ul className="space-y-2 text-[12px] text-ink-600">
              <li className="flex items-center justify-between">
                Recherche rapide <span className="kbd">⌘ / Ctrl</span><span className="kbd">K</span>
              </li>
              <li className="flex items-center justify-between">
                Nouvelle entrée <span className="kbd">⌘ / Ctrl</span><span className="kbd">I</span>
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
          Kanti est une application de gestion de stock pensée pour les commerces et PME d’Afrique de l’Ouest : scan
          code-barres, mouvements en deux gestes, alertes intelligentes basées sur vos ventes réelles, bons de commande
          fournisseurs et rapports. Version démo 1.0 — les données sont stockées localement dans votre navigateur.
        </p>
      </section>
    </div>
  )
}
