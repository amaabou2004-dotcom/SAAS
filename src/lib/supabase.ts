import { createClient } from '@supabase/supabase-js'

const url = import.meta.env?.VITE_SUPABASE_URL
const anonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

if (!isSupabaseConfigured) {
  console.error(
    'Supabase non configuré : renseignez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans .env.local',
  )
}

export const supabase = createClient(url ?? 'http://localhost:54321', anonKey ?? 'anon', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
})

const ERROR_MAP: { test: RegExp; message: string }[] = [
  { test: /insufficient available stock/i, message: 'Stock insuffisant pour cette sortie.' },
  { test: /counted quantity cannot be negative/i, message: 'La quantité comptée ne peut pas être négative.' },
  { test: /inventory management permission required/i, message: 'Votre rôle ne permet pas de gérer les mouvements.' },
  { test: /catalog management permission required/i, message: 'Votre rôle ne permet pas de modifier le catalogue.' },
  { test: /tenant management permission required/i, message: 'Votre rôle ne permet pas de modifier l’entreprise.' },
  { test: /active tenant required/i, message: 'Entreprise suspendue : contactez le support.' },
  { test: /invalid product name/i, message: 'Le nom du produit est invalide (2 à 160 caractères).' },
  { test: /invalid sku/i, message: 'SKU invalide : majuscules, chiffres, points, tirets (3 caractères min.).' },
  { test: /invalid barcode/i, message: 'Code-barres invalide.' },
  { test: /invalid product prices/i, message: 'Les prix doivent être positifs.' },
  { test: /invalid supplier name/i, message: 'Le nom du fournisseur est invalide.' },
  { test: /invalid unit/i, message: 'Unité invalide.' },
  { test: /a reason is required/i, message: 'Un motif est obligatoire pour cette opération.' },
  { test: /duplicate key.*sku/i, message: 'Ce SKU existe déjà dans votre catalogue.' },
  { test: /duplicate key.*suppliers/i, message: 'Un fournisseur porte déjà ce nom.' },
  { test: /duplicate key/i, message: 'Cet enregistrement existe déjà.' },
  { test: /invalid login credentials/i, message: 'E-mail ou mot de passe incorrect.' },
  { test: /email not confirmed/i, message: 'Confirmez votre e-mail avant de vous connecter.' },
  { test: /user already registered/i, message: 'Un compte existe déjà avec cet e-mail.' },
  { test: /password should be at least/i, message: 'Le mot de passe est trop court.' },
  { test: /rate limit|email rate/i, message: 'Trop de tentatives. Réessayez dans quelques minutes.' },
  { test: /demo data can only be loaded/i, message: 'Le catalogue de démonstration ne peut être chargé que dans un espace vide.' },
  { test: /jwt|not authenticated|authentication required/i, message: 'Session expirée, reconnectez-vous.' },
]

/** Traduit les erreurs PostgREST/Postgres en message utilisateur. */
export function frenchError(message: string | undefined | null): string {
  const raw = (message ?? '').trim()
  if (!raw) return 'Une erreur inattendue est survenue.'
  const match = ERROR_MAP.find((entry) => entry.test.test(raw))
  return match ? match.message : raw
}
