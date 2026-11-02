import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Boxes, Check, Loader2, LogOut, Sparkles } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { CURRENCIES } from '../lib/format'
import { cx } from '../components/ui'

const TIMEZONES = [
  { value: 'Africa/Niamey', label: 'Niamey (GMT+1)' },
  { value: 'Africa/Abidjan', label: 'Abidjan / Dakar (GMT)' },
  { value: 'Africa/Lagos', label: 'Lagos (GMT+1)' },
  { value: 'Africa/Douala', label: 'Douala (GMT+1)' },
  { value: 'Africa/Casablanca', label: 'Casablanca (GMT+1)' },
  { value: 'Europe/Paris', label: 'Paris (GMT+1/+2)' },
]

export default function Onboarding() {
  const { profile, createWorkspace, signOut } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('XOF')
  const [timezone, setTimezone] = useState('Africa/Niamey')
  const [seed, setSeed] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (name.trim().length < 2) {
      setError('Le nom de l’entreprise doit contenir au moins 2 caractères.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await createWorkspace({ name, currency, timezone, seedDemo: seed })
      navigate('/', { replace: true })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-ink-50 px-5 py-10 sm:px-8">
      <div className="mx-auto max-w-xl">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-950 text-brand-400">
              <Boxes size={20} />
            </div>
            <div>
              <p className="text-[15px] font-extrabold tracking-tight text-ink-900">Kanti</p>
              <p className="text-[11px] text-ink-400">
                {profile?.fullName ? `Bonjour ${profile.fullName.split(' ')[0]}` : 'Bienvenue'}
              </p>
            </div>
          </div>
          <button onClick={() => signOut()} className="btn-subtle text-xs">
            <LogOut size={14} /> Déconnexion
          </button>
        </div>

        <div className="card p-5 sm:p-7">
          <span className="chip bg-brand-50 text-brand-700">
            <Sparkles size={12} /> Étape 1 sur 1
          </span>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-ink-900">Créez votre espace de travail</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-500">
            Chaque entreprise dispose de ses propres produits, mouvements et membres. Vous pourrez inviter votre équipe
            juste après.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block">
              <span className="label">Nom de l’entreprise</span>
              <input
                autoFocus
                className="input"
                placeholder="Ex. Boutique Kanti Niamey"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="label">Devise</span>
                <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="label">Fuseau horaire</span>
                <select className="input" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                  {TIMEZONES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <button
              type="button"
              onClick={() => setSeed((v) => !v)}
              className={cx(
                'flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition',
                seed ? 'border-brand-300 bg-brand-50/60' : 'border-ink-200 bg-white hover:bg-ink-50',
              )}
            >
              <span
                className={cx(
                  'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border',
                  seed ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-300 bg-white',
                )}
              >
                {seed ? <Check size={12} /> : null}
              </span>
              <span>
                <span className="block text-sm font-semibold text-ink-900">Charger un catalogue de démonstration</span>
                <span className="mt-0.5 block text-[12px] leading-relaxed text-ink-500">
                  33 produits, 5 fournisseurs, 30 jours d’historique — idéal pour tester immédiatement le scan et les
                  alertes. Vous pourrez repartir de zéro plus tard.
                </span>
              </span>
            </button>

            {error ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-[13px] font-medium text-rose-700">{error}</p> : null}

            <button type="submit" disabled={busy} className="btn-brand h-11 w-full">
              {busy ? <Loader2 size={16} className="animate-spin" /> : null}
              Créer mon espace
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-[11px] text-ink-400">
          Vos données sont hébergées dans l’Union européenne (PostgreSQL Supabase, région eu-north-1) et isolées par
          entreprise grâce à Row Level Security.
        </p>
      </div>
    </div>
  )
}
