import { getSupabaseClient } from '../../lib/supabase';

/**
 * Logo de la boutique : choisi dans la galerie du téléphone, réduit en carré,
 * puis rangé dans le bucket `shop-logos` sous `{tenant_id}/...`.
 * La politique du bucket vérifie que la personne gère bien cette boutique.
 */
export const MAX_SHOP_LOGO_BYTES = 2 * 1024 * 1024;
/** Le logo reste net sur un écran de téléphone sans peser lourd. */
const LOGO_EDGE = 512;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const BUCKET = 'shop-logos';

/** `accept` du champ fichier : ouvre l'appareil photo ou la galerie. */
export const SHOP_LOGO_ACCEPT = 'image/*';

export function validateShopLogo(file: File): string | null {
  const type = file.type.toLowerCase();
  if (!ACCEPTED_TYPES.includes(type as (typeof ACCEPTED_TYPES)[number])) {
    return 'Choisissez une image JPEG, PNG ou WebP.';
  }
  if (file.size === 0) {
    return 'Cette image est vide. Choisissez-en une autre.';
  }
  if (file.size > MAX_SHOP_LOGO_BYTES) {
    return 'L’image est trop lourde : 2 Mo maximum. Choisissez-en une plus légère.';
  }
  return null;
}

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Réduit l'image et la recadre au centre en carré : un logo reste droit. */
async function toSquareLogo(file: File): Promise<Blob> {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const side = Math.min(bitmap.width, bitmap.height);
    const sourceX = (bitmap.width - side) / 2;
    const sourceY = (bitmap.height - side) / 2;
    const canvas = document.createElement('canvas');
    canvas.width = LOGO_EDGE;
    canvas.height = LOGO_EDGE;
    const context = canvas.getContext('2d');
    if (!context) {
      bitmap.close();
      return file;
    }
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, LOGO_EDGE, LOGO_EDGE);
    context.drawImage(bitmap, sourceX, sourceY, side, side, 0, 0, LOGO_EDGE, LOGO_EDGE);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((result) => resolve(result), 'image/jpeg', 0.9);
    });
    return blob && blob.size > 0 ? blob : file;
  } catch {
    // Une réduction ratée ne doit jamais empêcher l'envoi du logo d'origine.
    return file;
  }
}

export interface UploadedShopLogo {
  path: string;
  url: string;
}

export async function uploadShopLogo(
  tenantId: string,
  file: File,
  onProgress?: (message: string) => void,
): Promise<UploadedShopLogo> {
  const invalid = validateShopLogo(file);
  if (invalid) throw new Error(invalid);

  onProgress?.('Préparation du logo…');
  const blob = await toSquareLogo(file);
  const contentType = blob.type || file.type || 'image/jpeg';
  const extension = EXTENSIONS[contentType] ?? 'jpg';
  const path = `${tenantId}/logo-${crypto.randomUUID()}.${extension}`;

  onProgress?.('Envoi du logo…');
  const storage = getSupabaseClient().storage.from(BUCKET);
  const { error } = await storage.upload(path, blob, { contentType, cacheControl: '3600', upsert: false });
  if (error) {
    throw new Error(
      error.message.toLowerCase().includes('bucket')
        ? 'Le rangement des logos n’est pas encore installé sur ce serveur. Prévenez l’administrateur.'
        : 'L’envoi du logo a échoué. Vérifiez votre connexion puis réessayez.',
    );
  }

  const { data } = storage.getPublicUrl(path);
  return { path, url: data.publicUrl };
}

/** Retrouve le chemin de stockage à partir de l'adresse publique enregistrée. */
export function shopLogoPath(logoUrl: string | null | undefined): string | null {
  if (!logoUrl) return null;
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const index = logoUrl.indexOf(marker);
  if (index === -1) return null;
  const path = logoUrl.slice(index + marker.length).split('?')[0];
  return path ? decodeURIComponent(path) : null;
}

/** Supprime un logo devenu inutile (remplacé ou retiré). */
export async function deleteShopLogo(logoUrl: string | null | undefined): Promise<void> {
  const path = shopLogoPath(logoUrl);
  if (!path) return;
  try {
    await getSupabaseClient().storage.from(BUCKET).remove([path]);
  } catch {
    // Un logo orphelin ne doit jamais bloquer l'enregistrement de la boutique.
  }
}
