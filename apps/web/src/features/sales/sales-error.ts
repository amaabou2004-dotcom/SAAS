/**
 * Messages d'erreur des ventes.
 *
 * La base renvoie des messages courts en anglais (`Insufficient available
 * stock`, `A payment reference is required…`). La caisse les traduit pour que le
 * vendeur comprenne l'action à faire, sans masquer l'erreur d'origine.
 */

const translations: Array<[RegExp, string]> = [
  [/Insufficient available stock/i, 'Stock disponible insuffisant pour ce produit à cet emplacement.'],
  [/A payment reference is required for mobile money/i, 'Renseignez la référence Mobile Money (numéro de transaction).'],
  [/A sale requires at least one item/i, 'Ajoutez au moins un produit au panier.'],
  [/Idempotency key payload mismatch/i, 'Cette vente a déjà été envoyée avec d’autres informations. Rechargez la page avant de réessayer.'],
  [/Unknown or inactive sale item/i, 'Un produit du panier n’existe plus ou a été désactivé.'],
  [/Duplicate sale item/i, 'Un produit apparaît deux fois dans le panier.'],
  [/Invalid sale quantity or price/i, 'Vérifiez les quantités et les prix saisis.'],
  [/Invalid payment method/i, 'Choisissez un moyen de paiement valide.'],
  [/Unknown stock location/i, 'Choisissez un emplacement actif.'],
  [/Invalid customer name/i, 'Le nom du client doit contenir entre 2 et 120 caractères.'],
  [/Inventory management permission required/i, 'L’annulation exige aussi le droit de gérer le stock.'],
  [/Sales management permission required/i, 'Votre compte n’a pas le droit d’encaisser des ventes.'],
  [/Sale is already voided/i, 'Cette vente est déjà annulée.'],
  [/Une erreur inattendue/i, 'Une erreur inattendue est survenue.'],
];

export function salesErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : '';
  const match = translations.find(([pattern]) => pattern.test(raw));
  return match ? match[1] : raw.trim() || 'Une erreur inattendue est survenue.';
}
