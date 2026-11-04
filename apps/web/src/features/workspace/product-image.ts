import { getSupabaseClient } from '../../lib/supabase';

/** Le bucket refuse les fichiers de plus de 8 Mo. */
export const MAX_PRODUCT_IMAGE_BYTES = 8 * 1024 * 1024;
/** Côté le plus long après réduction : assez net sur un téléphone, léger à envoyer. */
const MAX_EDGE = 1600;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const PRODUCT_IMAGE_ACCEPT = 'image/*';

/**
 * Vérifie la photo choisie dans la galerie et renvoie un message clair en
 * français, ou `null` si tout va bien.
 */
export function validateProductImage(file: File): string | null {
  const type = file.type.toLowerCase();
  if (!ACCEPTED_TYPES.includes(type as (typeof ACCEPTED_TYPES)[number])) {
    return 'Choisissez une photo JPEG, PNG ou WebP.';
  }
  if (file.size === 0) {
    return 'Cette photo est vide. Choisissez-en une autre.';
  }
  if (file.size > MAX_PRODUCT_IMAGE_BYTES) {
    return 'La photo est trop lourde : 8 Mo maximum. Choisissez une photo plus légère.';
  }
  return null;
}

async function shrink(file: File): Promise<Blob> {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      bitmap.close();
      return file;
    }
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((result) => resolve(result), 'image/jpeg', 0.85);
    });
    // Une réduction ratée ne doit jamais empêcher l'envoi de la photo d'origine.
    return blob && blob.size > 0 && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

export interface UploadedProductImage {
  path: string;
  url: string;
}

/**
 * Envoie la photo dans le bucket `product-images`, dans le dossier de
 * l'entreprise (`{tenant_id}/{fichier}`). La politique du bucket vérifie que
 * la personne a le droit de gérer le catalogue de cette entreprise.
 */
export async function uploadProductImage(
  tenantId: string,
  file: File,
  onProgress?: (message: string) => void,
): Promise<UploadedProductImage> {
  const invalid = validateProductImage(file);
  if (invalid) throw new Error(invalid);

  onProgress?.('Préparation de la photo…');
  const blob = await shrink(file);
  const contentType = blob.type || file.type || 'image/jpeg';
  const extension = EXTENSIONS[contentType] ?? 'jpg';
  const path = `${tenantId}/${crypto.randomUUID()}.${extension}`;

  onProgress?.('Envoi de la photo…');
  const storage = getSupabaseClient().storage.from('product-images');
  const { error } = await storage.upload(path, blob, { contentType, cacheControl: '3600', upsert: false });
  if (error) {
    throw new Error(
      error.message.toLowerCase().includes('bucket')
        ? 'Le rangement des photos n’est pas encore installé sur ce serveur. Prévenez l’administrateur.'
        : 'L’envoi de la photo a échoué. Vérifiez votre connexion puis réessayez.',
    );
  }

  const { data } = storage.getPublicUrl(path);
  return { path, url: data.publicUrl };
}

/** Supprime une photo devenue inutile (remplacée ou retirée). */
export async function deleteProductImage(path: string): Promise<void> {
  try {
    await getSupabaseClient().storage.from('product-images').remove([path]);
  } catch {
    // Une photo orpheline ne doit jamais bloquer l'enregistrement du produit.
  }
}

/** Retrouve le chemin de stockage à partir de l'adresse publique enregistrée. */
export function productImagePath(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  const marker = '/storage/v1/object/public/product-images/';
  const index = imageUrl.indexOf(marker);
  if (index === -1) return null;
  const path = imageUrl.slice(index + marker.length).split('?')[0];
  return path ? decodeURIComponent(path) : null;
}
