import { describe, expect, it } from 'vitest';
import { MAX_SHOP_LOGO_BYTES, shopLogoPath, validateShopLogo } from './shop-logo';

function imageFile(size: number, type = 'image/jpeg', name = 'logo.jpg') {
  return new File([new Uint8Array(size)], name, { type });
}

describe('logo de la boutique', () => {
  it('accepte une photo JPEG depuis la galerie', () => {
    expect(validateShopLogo(imageFile(120_000))).toBeNull();
  });

  it('refuse un fichier trop lourd avec un message clair', () => {
    expect(validateShopLogo(imageFile(MAX_SHOP_LOGO_BYTES + 1))).toBe(
      'L’image est trop lourde : 2 Mo maximum. Choisissez-en une plus légère.',
    );
  });

  it('refuse un format qui n’est pas une image', () => {
    expect(validateShopLogo(imageFile(2_000, 'application/pdf', 'facture.pdf'))).toBe(
      'Choisissez une image JPEG, PNG ou WebP.',
    );
  });

  it('retrouve le chemin de stockage du logo', () => {
    expect(
      shopLogoPath(
        'https://projet.supabase.co/storage/v1/object/public/shop-logos/6af31c9a-4286-4813-81c6-e17d6ca96b9a/logo-1.jpg',
      ),
    ).toBe('6af31c9a-4286-4813-81c6-e17d6ca96b9a/logo-1.jpg');
    expect(shopLogoPath('https://exemple.test/logo.png')).toBeNull();
    expect(shopLogoPath(null)).toBeNull();
  });
});
