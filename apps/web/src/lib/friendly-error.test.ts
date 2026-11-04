import { friendlyError } from './friendly-error';

describe('friendlyError', () => {
  it('traduit un refus de droits en phrase compréhensible', () => {
    expect(friendlyError(new Error('permission denied for table products'))).toBe(
      'Vous n’avez pas les droits nécessaires pour cette action.',
    );
  });

  it('traduit une coupure réseau', () => {
    expect(friendlyError(new Error('TypeError: Failed to fetch'))).toBe(
      'Connexion impossible. Vérifiez votre réseau puis réessayez.',
    );
  });

  it('traduit une session expirée', () => {
    expect(friendlyError(new Error('JWT expired'))).toBe(
      'Votre session a expiré. Reconnectez-vous pour continuer.',
    );
  });

  it('traduit une contrainte d’unicité', () => {
    expect(friendlyError(new Error('duplicate key value violates unique constraint "products_sku_key"'))).toBe(
      'Cet élément existe déjà. Vérifiez le nom ou le code saisi.',
    );
  });

  it('conserve un message métier rédigé pour le commerçant', () => {
    const message = 'Le code produit accepte lettres, chiffres, point, tiret et souligné.';
    expect(friendlyError(new Error(message))).toBe(message);
  });

  it('remplace un message technique inconnu par le texte de secours', () => {
    expect(friendlyError(new Error('PGRST202: could not find the function public.upsert_product'))).toBe(
      'Le service est momentanément indisponible. Réessayez dans un instant.',
    );
    expect(friendlyError(new Error('column "foo" does not exist'))).toBe(
      'Le service est momentanément indisponible. Réessayez dans un instant.',
    );
  });

  it('utilise le message de secours fourni quand la valeur est vide', () => {
    expect(friendlyError(undefined, 'La vente n’a pas pu être enregistrée.')).toBe(
      'La vente n’a pas pu être enregistrée.',
    );
  });
});
