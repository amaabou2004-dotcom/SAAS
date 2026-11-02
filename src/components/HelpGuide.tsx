import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  BellRing,
  Boxes,
  ClipboardList,
  Compass,
  Package,
  ScanBarcode,
  Search,
  Sparkles,
  Truck,
  Users,
} from 'lucide-react'
import { Modal } from './ui'
import { useUI } from '../lib/uiStore'

const STEPS = [
  {
    icon: Boxes,
    title: '1 · Je crée mes produits',
    text: 'Stock → « Nouveau produit ». Le code (SKU) est généré automatiquement. Indiquez le prix d’achat, le prix de vente et le seuil d’alerte.',
    to: '/stock',
  },
  {
    icon: ArrowDownToLine,
    title: '2 · Je saisis ce que j’ai en stock',
    text: 'Bouton « Mouvement » → Entrée. Une seule fois au départ : c’est votre stock de départ. Ensuite, chaque livraison fournisseur est une entrée.',
    to: '/mouvements',
  },
  {
    icon: ArrowUpFromLine,
    title: '3 · J’enregistre les sorties',
    text: 'Chaque vente ou perte est une Sortie. Le stock baisse tout seul, et une erreur se corrige avec « Annuler » (le stock revient).',
    to: '/mouvements',
  },
  {
    icon: BellRing,
    title: '4 · Je réapprovisionne au bon moment',
    text: 'Les Alertes listent ce qui va manquer, avec la quantité à commander. Un clic génère le bon de commande par fournisseur, prêt à envoyer.',
    to: '/alertes',
  },
]

const SCREENS = [
  { icon: Compass, label: 'Aujourd’hui', text: 'Votre tableau de bord : valeur du stock, alertes, mouvements du jour.', to: '/' },
  { icon: Package, label: 'Stock', text: 'Tous vos produits, leur quantité, leur prix et leur statut.', to: '/stock' },
  { icon: ClipboardList, label: 'Mouvements', text: 'Le journal : entrées, sorties, inventaires. Rien ne se perd.', to: '/mouvements' },
  { icon: BellRing, label: 'Alertes', text: 'Ce qu’il faut commander, groupé par fournisseur.', to: '/alertes' },
  { icon: BarChart3, label: 'Rapports', text: 'Ventes, marge, rotation, produits qui dorment.', to: '/rapports' },
  { icon: Truck, label: 'Fournisseurs', text: 'Contacts et délais de livraison.', to: '/fournisseurs' },
  { icon: Users, label: 'Équipe', text: 'Invitez vos collaborateurs et choisissez leur rôle.', to: '/equipe' },
]

const GLOSSARY: [string, string][] = [
  ['Produit', 'Un article que vous vendez (ex. « Riz parfumé 5 kg »).'],
  ['SKU / code', 'La référence interne unique du produit, générée automatiquement.'],
  ['Stock', 'La quantité réellement disponible aujourd’hui.'],
  ['Mouvement', 'Toute variation de stock : entrée, sortie ou inventaire.'],
  ['Inventaire', 'Vous comptez physiquement : Kanti calcule l’écart et l’enregistre.'],
  ['Seuil d’alerte', 'La quantité en dessous de laquelle le produit passe en alerte.'],
  ['Qté de réappro', 'Le minimum à commander quand le produit est en alerte.'],
  ['Bon de commande', 'La liste à envoyer au fournisseur (CSV, copie WhatsApp/e-mail).'],
]

export default function HelpGuide() {
  const open = useUI((s) => s.helpOpen)
  const close = useUI((s) => s.closeHelp)
  const navigate = useNavigate()

  const go = (to: string) => {
    close()
    navigate(to)
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Comment ça marche ?"
      subtitle="Kanti en 4 étapes — et où trouver chaque chose."
      icon={
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
          <Sparkles size={18} />
        </span>
      }
      size="lg"
      footer={
        <button onClick={close} className="btn-primary flex-1 justify-center">
          J’ai compris
        </button>
      }
    >
      <div className="space-y-7">
        <section>
          <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-ink-400">Le principe</h3>
          <ol className="mt-3 space-y-2.5">
            {STEPS.map((step) => (
              <li key={step.title}>
                <button
                  onClick={() => go(step.to)}
                  className="group flex w-full items-start gap-3 rounded-xl border border-ink-150 bg-white p-3 text-left transition hover:border-ink-300 hover:bg-ink-50"
                >
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-700">
                    <step.icon size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-ink-900">{step.title}</span>
                    <span className="mt-0.5 block text-[13px] leading-relaxed text-ink-500">{step.text}</span>
                  </span>
                  <ArrowRight size={15} className="mt-2 shrink-0 text-ink-300 transition group-hover:text-ink-600" />
                </button>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-ink-400">Où trouver quoi</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {SCREENS.map((screen) => (
              <button
                key={screen.label}
                onClick={() => go(screen.to)}
                className="flex items-start gap-2.5 rounded-xl border border-ink-150 p-3 text-left transition hover:border-ink-300 hover:bg-ink-50"
              >
                <screen.icon size={16} className="mt-0.5 shrink-0 text-brand-600" />
                <span className="min-w-0">
                  <span className="block text-[13px] font-bold text-ink-900">{screen.label}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-ink-500">{screen.text}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-ink-400">Le vocabulaire</h3>
          <dl className="mt-3 divide-y divide-ink-100 rounded-xl border border-ink-150">
            {GLOSSARY.map(([term, def]) => (
              <div key={term} className="flex flex-col gap-0.5 px-3 py-2 sm:flex-row sm:items-baseline sm:gap-3">
                <dt className="w-32 shrink-0 text-[13px] font-semibold text-ink-900">{term}</dt>
                <dd className="text-[13px] leading-relaxed text-ink-500">{def}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="rounded-xl border border-ink-150 bg-ink-50/60 p-3.5">
          <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-ink-400">Astuces</h3>
          <ul className="mt-2 space-y-1.5 text-[13px] text-ink-600">
            <li className="flex items-start gap-2">
              <Search size={14} className="mt-0.5 shrink-0 text-ink-400" />
              <span>
                <strong className="font-semibold text-ink-900">⌘K / Ctrl+K</strong> ouvre la recherche : tapez un nom, un
                code ou un code-barres, puis Entrée.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <ScanBarcode size={14} className="mt-0.5 shrink-0 text-ink-400" />
              <span>
                <strong className="font-semibold text-ink-900">Scanner</strong> : la caméra du téléphone lit le code-barres.
                Sur ordinateur, une douchette USB fonctionne directement.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <ClipboardList size={14} className="mt-0.5 shrink-0 text-ink-400" />
              <span>
                <strong className="font-semibold text-ink-900">Import CSV</strong> : dans Stock, collez votre tableau Excel
                (colonnes code, désignation, prix d’achat, prix de vente, quantité, seuil).
              </span>
            </li>
          </ul>
        </section>
      </div>
    </Modal>
  )
}
