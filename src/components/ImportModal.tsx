import { useRef, useState } from 'react'
import { FileSpreadsheet, Upload } from 'lucide-react'
import { useData } from '../lib/store'
import { useUI } from '../lib/uiStore'
import { Modal } from './ui'
import { downloadFile, parseProductsCSV, toCSV } from '../lib/csv'
import type { ImportSummary } from '../lib/types'

const TEMPLATE_HEADERS = [
  'SKU',
  'Code-barres',
  'Nom',
  'Catégorie',
  'Unité',
  'Prix achat',
  'Prix vente',
  'Stock',
  'Seuil alerte',
  'Qté réappro',
  'Fournisseur',
  'Emplacement',
]

const TEMPLATE_EXAMPLE = [
  ['LAIT-1L', '6191234509999', 'Lait UHT 1 L', 'Alimentation', 'brique', 750, 1000, 48, 24, 48, 'Grand Marché Distribution', 'Rayon B1'],
  ['SAVON-200', '6191234509982', 'Savon de toilette 200 g', 'Hygiène', 'pièce', 250, 400, 120, 60, 120, 'Sahel Hygiène & Entretien', 'Rayon D1'],
]

export default function ImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { suppliers, importProducts } = useData()
  const toast = useUI((s) => s.toast)
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState('')
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setText('')
    setFileName('')
    setSummary(null)
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    const content = await file.text()
    setText(content)
    setFileName(file.name)
    setSummary(null)
  }

  const preview = text.trim() ? parseProductsCSV(text, suppliers) : null

  const apply = () => {
    if (!text.trim()) return
    const parsed = parseProductsCSV(text, suppliers)
    const result = importProducts(parsed.drafts)
    result.skipped += parsed.skipped
    setSummary(result)
    toast(`${result.added} ajouté(s), ${result.updated} mis à jour`)
  }

  const downloadTemplate = () => {
    downloadFile('kanti-modele-import.csv', toCSV(TEMPLATE_HEADERS, TEMPLATE_EXAMPLE))
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      size="lg"
      title="Importer des produits"
      subtitle="Collez un tableau (Excel, Sheets) ou chargez un fichier CSV"
      icon={
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <Upload size={18} />
        </span>
      }
      footer={
        <>
          <button onClick={downloadTemplate} className="btn-ghost mr-auto">
            <FileSpreadsheet size={16} /> Modèle CSV
          </button>
          <button
            onClick={() => {
              reset()
              onClose()
            }}
            className="btn-ghost"
          >
            Fermer
          </button>
          <button onClick={apply} disabled={!preview || preview.drafts.length === 0} className="btn-brand">
            Importer {preview?.drafts.length ? `${preview.drafts.length} ligne(s)` : ''}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div
          className="rounded-2xl border-2 border-dashed border-ink-200 bg-ink-50/50 p-5 text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            handleFile(e.dataTransfer.files?.[0])
          }}
        >
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-white text-ink-500 shadow-sm">
            <Upload size={18} />
          </div>
          <p className="mt-2 text-sm font-semibold text-ink-800">
            {fileName || 'Glissez votre fichier CSV ici'}
          </p>
          <p className="mt-0.5 text-[11px] text-ink-400">Séparateur ; ou , — en-têtes reconnus automatiquement</p>
          <button onClick={() => fileRef.current?.click()} className="btn-ghost mt-3 bg-white">
            Choisir un fichier
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt,text/csv"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="label mb-0">Ou collez vos données</label>
            <button onClick={downloadTemplate} className="text-[11px] font-semibold text-brand-700 hover:underline">
              Télécharger le modèle
            </button>
          </div>
          <textarea
            className="input min-h-[140px] font-mono text-[12px] leading-relaxed"
            placeholder={'SKU;Nom;Prix achat;Prix vente;Stock;Seuil\nRIZ-25;Riz 25 kg;17500;19500;40;20'}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setFileName('')
              setSummary(null)
            }}
          />
        </div>

        {preview ? (
          <div className="rounded-xl bg-ink-50 px-3 py-2.5 text-xs text-ink-600">
            <strong className="text-ink-900">{preview.drafts.length}</strong> produit(s) détecté(s)
            {preview.skipped > 0 ? ` · ${preview.skipped} ligne(s) ignorée(s) (nom manquant)` : ''}. Les SKU existants
            seront mis à jour.
          </div>
        ) : null}

        {summary ? (
          <div className="rounded-xl border border-brand-200 bg-brand-50 px-3 py-2.5 text-xs text-brand-900">
            <p className="font-bold">Import terminé</p>
            <p className="mt-0.5">
              {summary.added} ajouté(s) · {summary.updated} mis à jour · {summary.skipped} ignoré(s)
            </p>
            {summary.errors.length > 0 ? (
              <ul className="mt-1 list-inside list-disc text-[11px]">
                {summary.errors.slice(0, 4).map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
