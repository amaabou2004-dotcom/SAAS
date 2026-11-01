import { useEffect, useRef, useState } from 'react'
import { Camera, CameraOff, ScanBarcode, Search } from 'lucide-react'
import { useScanner } from '../lib/scannerStore'
import { useData } from '../lib/store'
import { useUI } from '../lib/uiStore'
import { Modal } from './ui'

type DetectedBarcode = { rawValue: string }
type DetectorLike = { detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]> }
type DetectorCtor = new (options?: { formats?: string[] }) => DetectorLike

export default function ScannerModal() {
  const open = useScanner((s) => s.scannerOpen)
  const close = useScanner((s) => s.closeScanner)
  const { products } = useData()
  const openMovementForm = useUI((s) => s.openMovementForm)
  const toast = useUI((s) => s.toast)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastCode = useRef('')
  const [status, setStatus] = useState<'idle' | 'starting' | 'running' | 'error' | 'unsupported'>('idle')
  const [message, setMessage] = useState('')
  const [manual, setManual] = useState('')
  const [manualError, setManualError] = useState('')

  const stop = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  const handleCode = (code: string) => {
    const clean = code.trim()
    if (!clean || clean === lastCode.current) return
    lastCode.current = clean
    const product = products.find((p) => p.barcode === clean || p.sku.toLowerCase() === clean.toLowerCase())
    if (!product) {
      setManualError(`Aucun produit avec le code « ${clean} ».`)
      toast('Code inconnu — créez la fiche produit', 'error')
      window.setTimeout(() => (lastCode.current = ''), 2500)
      return
    }
    stop()
    close()
    toast(`${product.name} · ${product.stock} en stock`)
    setTimeout(() => openMovementForm({ productId: product.id, type: 'out' }), 120)
  }

  useEffect(() => {
    if (!open) {
      stop()
      setStatus('idle')
      setMessage('')
      setManual('')
      setManualError('')
      lastCode.current = ''
      return
    }

    let cancelled = false

    const start = async () => {
      const ctor = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector
      const supportsMedia = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)
      if (!supportsMedia) {
        setStatus('unsupported')
        setMessage('La caméra n’est pas disponible ici. Utilisez la saisie manuelle ou une douchette USB.')
        return
      }
      setStatus('starting')
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => undefined)
        }
        setStatus('running')
        setMessage('')

        if (!ctor) {
          setMessage('Pointez le code-barres puis saisissez-le ci-dessous si la détection n’est pas prise en charge.')
          return
        }

        const detector = new ctor({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'qr_code'],
        })
        let lastScan = 0
        const tick = async (time: number) => {
          rafRef.current = requestAnimationFrame(tick)
          if (time - lastScan < 350 || !videoRef.current || videoRef.current.readyState < 2) return
          lastScan = time
          try {
            const codes = await detector.detect(videoRef.current)
            if (codes.length > 0) handleCode(codes[0].rawValue)
          } catch {
            /* détection ponctuellement indisponible */
          }
        }
        rafRef.current = requestAnimationFrame(tick)
      } catch {
        setStatus('error')
        setMessage('Accès caméra refusé. Autorisez la caméra dans votre navigateur ou saisissez le code manuellement.')
      }
    }

    start()
    return () => {
      cancelled = true
      stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const submitManual = () => {
    const code = manual.trim()
    if (!code) return
    const product = products.find((p) => p.barcode === code || p.sku.toLowerCase() === code.toLowerCase() || p.name.toLowerCase() === code.toLowerCase())
    if (!product) {
      setManualError(`Aucun produit avec le code « ${code} ».`)
      return
    }
    setManualError('')
    stop()
    close()
    setTimeout(() => openMovementForm({ productId: product.id, type: 'out' }), 100)
  }

  const demoCode = products.find((p) => p.barcode)?.barcode ?? ''

  return (
    <Modal
      open={open}
      onClose={() => {
        stop()
        close()
      }}
      title="Scanner un produit"
      subtitle="Le scan ouvre un mouvement de sortie en 2 gestes"
      icon={
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-900 text-brand-400">
          <ScanBarcode size={18} />
        </span>
      }
    >
      <div className="space-y-4">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-ink-950">
          <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
          {status === 'running' ? (
            <>
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="relative h-36 w-64 max-w-[80%] rounded-xl border-2 border-brand-400/90 shadow-[0_0_0_9999px_rgba(14,19,32,0.45)]">
                  <div className="absolute inset-x-0 top-1/2 h-0.5 animate-pulse bg-brand-400/80" />
                </div>
              </div>
              <p className="absolute inset-x-0 bottom-3 text-center text-xs font-medium text-white/90">
                Placez le code-barres dans le cadre
              </p>
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
              {status === 'starting' ? (
                <>
                  <Camera size={26} className="animate-pulse text-white/70" />
                  <p className="text-xs text-white/70">Activation de la caméra…</p>
                </>
              ) : (
                <>
                  <CameraOff size={26} className="text-white/50" />
                  <p className="max-w-xs text-xs leading-relaxed text-white/70">
                    {message || 'Caméra inactive.'}
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-ink-200 p-3">
          <label className="label">Saisie manuelle / douchette</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                className="input pl-9"
                inputMode="numeric"
                placeholder="Code-barres ou SKU"
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitManual()
                }}
              />
            </div>
            <button onClick={submitManual} className="btn-primary shrink-0">
              Valider
            </button>
          </div>
          {manualError ? <p className="mt-2 text-xs font-semibold text-rose-600">{manualError}</p> : null}
          {demoCode ? (
            <button
              onClick={() => {
                setManual(demoCode)
                setManualError('')
              }}
              className="mt-2 text-[11px] font-semibold text-brand-700 underline-offset-2 hover:underline"
            >
              Essayer avec un code de démo ({demoCode})
            </button>
          ) : null}
        </div>

        <p className="text-[11px] leading-relaxed text-ink-400">
          Astuce : une douchette USB fonctionne comme un clavier. Scannez directement dans le champ de recherche global
          (⌘K) — le produit s’ouvre instantanément.
        </p>
      </div>
    </Modal>
  )
}
