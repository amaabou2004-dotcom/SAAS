import { useEffect, useState } from 'react'
import { Truck } from 'lucide-react'
import { useData } from '../lib/store'
import { useUI } from '../lib/uiStore'
import { Field, Modal } from './ui'

type Form = { name: string; contact: string; phone: string; email: string; city: string; leadTimeDays: string; notes: string }

const EMPTY: Form = { name: '', contact: '', phone: '', email: '', city: '', leadTimeDays: '7', notes: '' }

export default function SupplierForm() {
  const { open, supplierId } = useUI((s) => s.supplierForm)
  const close = useUI((s) => s.closeSupplierForm)
  const { suppliers, addSupplier, updateSupplier } = useData()
  const toast = useUI((s) => s.toast)
  const [form, setForm] = useState<Form>(EMPTY)
  const [error, setError] = useState('')

  const existing = suppliers.find((s) => s.id === supplierId)

  useEffect(() => {
    if (!open) return
    setError('')
    if (existing) {
      setForm({
        name: existing.name,
        contact: existing.contact,
        phone: existing.phone,
        email: existing.email ?? '',
        city: existing.city,
        leadTimeDays: String(existing.leadTimeDays),
        notes: existing.notes ?? '',
      })
    } else {
      setForm(EMPTY)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, supplierId])

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }))

  const submit = () => {
    if (!form.name.trim()) {
      setError('Le nom du fournisseur est obligatoire.')
      return
    }
    const payload = {
      name: form.name.trim(),
      contact: form.contact.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      city: form.city.trim(),
      leadTimeDays: Math.max(1, Number(form.leadTimeDays) || 7),
      notes: form.notes.trim(),
    }
    if (existing) {
      updateSupplier(existing.id, payload)
      toast('Fournisseur mis à jour')
    } else {
      addSupplier(payload)
      toast('Fournisseur ajouté')
    }
    close()
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={existing ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}
      subtitle="Coordonnées et délai de livraison"
      icon={
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-100 text-ink-700">
          <Truck size={18} />
        </span>
      }
      footer={
        <>
          <button onClick={close} className="btn-ghost flex-1 sm:flex-none">
            Annuler
          </button>
          <button onClick={submit} className="btn-brand flex-1 sm:flex-none">
            {existing ? 'Enregistrer' : 'Ajouter'}
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom du fournisseur *" className="sm:col-span-2">
          <input autoFocus className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex. Grand Marché Distribution" />
        </Field>
        <Field label="Personne de contact">
          <input className="input" value={form.contact} onChange={(e) => set('contact', e.target.value)} placeholder="Ex. Abdou Salam" />
        </Field>
        <Field label="Téléphone">
          <input className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+227 90 00 00 00" />
        </Field>
        <Field label="E-mail">
          <input className="input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="contact@exemple.com" />
        </Field>
        <Field label="Ville">
          <input className="input" value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Niamey" />
        </Field>
        <Field label="Délai de livraison (jours)" hint="Utilisé pour calculer les quantités de réapprovisionnement">
          <input className="input" inputMode="numeric" value={form.leadTimeDays} onChange={(e) => set('leadTimeDays', e.target.value)} />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <textarea className="input min-h-[80px] resize-y" value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Conditions de paiement, jours de livraison…" />
        </Field>
        {error ? <p className="sm:col-span-2 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p> : null}
      </div>
    </Modal>
  )
}
