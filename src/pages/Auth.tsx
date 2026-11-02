import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Boxes,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import { cx } from '../components/ui'

type Mode = 'signin' | 'signup' | 'forgot' | 'reset'

const DEMO = { email: 'demo@kanti.app', password: 'KantiDemo2026!' }

const HIGHLIGHTS = [
  'Sorties de stock en 2 gestes, même hors du bureau',
  'Alertes calculées sur vos ventes et vos délais fournisseur',
  'Bons de commande générés en un clic',
  'Multi-utilisateurs avec rôles et permissions',
]

export default function AuthPage({ mode }: { mode: Mode }) {
  const navigate = useNavigate()
  const { session, signIn, signUp, signInWithGoogle, sendPasswordReset, updatePassword } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    setError('')
    setNotice('')
  }, [mode])

  useEffect(() => {
    if (mode === 'signin' && session) navigate('/', { replace: true })
  }, [session, mode, navigate])

  const titles: Record<Mode, { title: string; subtitle: string }> = {
    signin: { title: 'Content de vous revoir', subtitle: 'Connectez-vous pour reprendre la gestion de votre stock.' },
    signup: { title: 'Créer votre compte', subtitle: '30 secondes, sans carte bancaire. Votre espace est privé.' },
    forgot: { title: 'Mot de passe oublié', subtitle: 'Nous vous envoyons un lien sécurisé pour le réinitialiser.' },
    reset: { title: 'Nouveau mot de passe', subtitle: 'Choisissez un mot de passe solide (8 caractères minimum).' },
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setNotice('')

    if (mode === 'forgot') {
      if (!email.includes('@')) return setError('Saisissez une adresse e-mail valide.')
      setBusy(true)
      try {
        await sendPasswordReset(email)
        setNotice('Si un compte existe, un e-mail de réinitialisation vient de partir.')
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setBusy(false)
      }
      return
    }

    if (mode === 'reset') {
      if (password.length < 8) return setError('8 caractères minimum.')
      if (password !== confirm) return setError('Les deux mots de passe ne correspondent pas.')
      setBusy(true)
      try {
        await updatePassword(password)
        navigate('/', { replace: true })
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setBusy(false)
      }
      return
    }

    if (!email.includes('@')) return setError('Saisissez une adresse e-mail valide.')
    if (password.length < 8) return setError('Le mot de passe doit contenir au moins 8 caractères.')

    setBusy(true)
    try {
      if (mode === 'signin') {
        await signIn(email, password)
        navigate('/', { replace: true })
      } else {
        if (fullName.trim().length < 2) throw new Error('Indiquez votre nom complet.')
        const result = await signUp({ email, password, fullName })
        if (result.needsConfirmation) {
          setNotice('Compte créé. Vérifiez votre boîte mail pour confirmer votre adresse, puis connectez-vous.')
        } else {
          navigate('/', { replace: true })
        }
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const demo = async () => {
    setBusy(true)
    setError('')
    try {
      await signIn(DEMO.email, DEMO.password)
      navigate('/', { replace: true })
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  const google = async () => {
    setBusy(true)
    setError('')
    try {
      await signInWithGoogle()
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-ink-950 px-10 py-12 text-white lg:flex lg:flex-col">
        <div className="absolute inset-0 grid-fade opacity-[0.25]" />
        <div className="relative flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-brand-400">
            <Boxes size={21} />
          </div>
          <div>
            <p className="text-lg font-extrabold tracking-tight">Kanti</p>
            <p className="text-[11px] font-medium text-white/50">Gestion de stock</p>
          </div>
        </div>

        <div className="relative mt-auto max-w-md">
          <span className="chip bg-brand-500/15 text-brand-300">
            <Sparkles size={12} /> Pensé pour le terrain
          </span>
          <h1 className="mt-4 text-[34px] font-extrabold leading-[1.15] tracking-tight text-balance">
            Votre stock, compris en un regard.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-white/60">
            Scan, mouvements, alertes et commandes fournisseurs dans une seule application rapide, conçue pour les
            commerces et PME d’Afrique de l’Ouest.
          </p>
          <ul className="mt-6 space-y-2.5">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-[13px] text-white/75">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-brand-300">
                  <Check size={12} />
                </span>
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-8 flex items-center gap-1.5 text-[11px] text-white/40">
            <ShieldCheck size={13} /> Données isolées par entreprise (Row Level Security PostgreSQL)
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-sm">
          <Link to="/" className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-950 text-brand-400">
              <Boxes size={19} />
            </div>
            <span className="text-lg font-extrabold tracking-tight text-ink-900">Kanti</span>
          </Link>

          <h2 className="text-2xl font-extrabold tracking-tight text-ink-900">{titles[mode].title}</h2>
          <p className="mt-1.5 text-sm text-ink-500">{titles[mode].subtitle}</p>

          {mode === 'signin' ? (
            <div className="mt-5 rounded-xl border border-brand-200 bg-brand-50/70 p-3.5">
              <p className="flex items-center gap-1.5 text-[13px] font-bold text-brand-900">
                <Sparkles size={14} /> Pas envie de créer un compte ?
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-brand-900/70">
                Ouvrez l’espace de démonstration <strong>Kanti Démo SARL</strong> : 33 produits, 5 fournisseurs et
                45 jours d’historique, déjà remplis.
              </p>
              <button type="button" onClick={demo} disabled={busy} className="btn-primary mt-2.5 h-10 w-full justify-center">
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                Entrer dans la démo
              </button>
            </div>
          ) : null}

          <form onSubmit={submit} className="mt-6 space-y-3.5">
            {mode === 'signup' ? (
              <Field icon={<User size={15} />}>
                <input
                  className="input border-0 bg-transparent pl-9 focus:ring-0"
                  placeholder="Nom complet"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </Field>
            ) : null}

            {mode !== 'reset' ? (
              <Field icon={<Mail size={15} />}>
                <input
                  className="input border-0 bg-transparent pl-9 focus:ring-0"
                  type="email"
                  placeholder="vous@entreprise.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
            ) : null}

            {mode !== 'forgot' ? (
              <Field icon={<Lock size={15} />}>
                <input
                  className="input border-0 bg-transparent pl-9 pr-10 focus:ring-0"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={mode === 'reset' ? 'Nouveau mot de passe' : 'Mot de passe'}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-ink-400 hover:text-ink-700"
                  aria-label={showPassword ? 'Masquer' : 'Afficher'}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </Field>
            ) : null}

            {mode === 'reset' ? (
              <Field icon={<Lock size={15} />}>
                <input
                  className="input border-0 bg-transparent pl-9 focus:ring-0"
                  type="password"
                  placeholder="Confirmer le mot de passe"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </Field>
            ) : null}

            {error ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-[13px] font-medium text-rose-700">{error}</p> : null}
            {notice ? <p className="rounded-lg bg-brand-50 px-3 py-2 text-[13px] font-medium text-brand-800">{notice}</p> : null}

            <button type="submit" disabled={busy} className="btn-brand h-11 w-full">
              {busy ? <Loader2 size={16} className="animate-spin" /> : null}
              {mode === 'signin' && 'Se connecter'}
              {mode === 'signup' && 'Créer mon compte'}
              {mode === 'forgot' && 'Envoyer le lien'}
              {mode === 'reset' && 'Mettre à jour'}
              {!busy ? <ArrowRight size={16} /> : null}
            </button>
          </form>

          {mode === 'signin' || mode === 'signup' ? (
            <>
              <div className="my-4 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                <span className="h-px flex-1 bg-ink-200" /> ou <span className="h-px flex-1 bg-ink-200" />
              </div>
              <button onClick={google} disabled={busy} className="btn-ghost h-11 w-full">
                <GoogleMark /> Continuer avec Google
              </button>
            </>
          ) : null}

          <div className="mt-6 space-y-2 text-center text-[13px] text-ink-500">
            {mode === 'signin' ? (
              <>
                <p>
                  Pas encore de compte ?{' '}
                  <Link to="/auth/inscription" className="link">
                    Créer un espace
                  </Link>
                </p>
                <p>
                  <Link to="/auth/mot-de-passe-oublie" className="font-medium text-ink-500 hover:text-ink-800">
                    Mot de passe oublié ?
                  </Link>
                </p>
              </>
            ) : null}
            {mode === 'signup' ? (
              <p>
                Déjà un compte ?{' '}
                <Link to="/auth/connexion" className="link">
                  Se connecter
                </Link>
              </p>
            ) : null}
            {mode === 'forgot' || mode === 'reset' ? (
              <p>
                <Link to="/auth/connexion" className="link">
                  Retour à la connexion
                </Link>
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="relative flex items-center rounded-xl border border-ink-200 bg-white focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/10">
      <span className="pointer-events-none absolute left-3 text-ink-400">{icon}</span>
      {children}
    </div>
  )
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.54 5.54 0 0 1-2.4 3.63v3h3.86c2.26-2.09 3.56-5.17 3.56-8.87z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A12 12 0 0 0 12 24z"
      />
      <path fill="#FBBC05" d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.29a12 12 0 0 0 0 10.76l3.98-3.09z" />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  )
}

export function AuthCallback() {
  const navigate = useNavigate()
  const { session, ready } = useAuth()

  useEffect(() => {
    if (!ready) return
    navigate(session ? '/' : '/auth/connexion', { replace: true })
  }, [ready, session, navigate])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-ink-500">
      <Loader2 size={22} className="animate-spin text-brand-600" />
      <p className="text-sm">Connexion en cours…</p>
    </div>
  )
}

export function AuthLoading({ label = 'Chargement de votre espace…' }: { label?: string }) {
  return (
    <div className={cx('flex min-h-[60vh] flex-col items-center justify-center gap-3 text-ink-500')}>
      <Loader2 size={22} className="animate-spin text-brand-600" />
      <p className="text-sm">{label}</p>
    </div>
  )
}
