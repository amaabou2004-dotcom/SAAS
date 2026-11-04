import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_PRODUCT_IMAGE_BYTES, productImagePath, uploadProductImage, validateProductImage } from './product-image';

const upload = vi.fn();
const remove = vi.fn();
const getPublicUrl = vi.fn();

vi.mock('../../lib/supabase', () => ({
  getSupabaseClient: () => ({
    storage: {
      from: () => ({ upload, remove, getPublicUrl }),
    },
  }),
}));

const tenantId = '4a4d6d39-38cd-4e1f-b1f0-c8d7ef8edbd0';

function imageFile(name = 'photo.jpg', type = 'image/jpeg', size = 1024): File {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

beforeAll(() => {
  // jsdom ne fournit ni createImageBitmap ni canvas : l'envoi se fait alors
  // sans réduction, ce qui est exactement le repli prévu par le code.
  Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:preview'), writable: true });
});

beforeEach(() => {
  vi.clearAllMocks();
  upload.mockResolvedValue({ data: { path: 'ok' }, error: null });
  getPublicUrl.mockReturnValue({ data: { publicUrl: `https://exemple.test/storage/v1/object/public/product-images/${tenantId}/a.jpg` } });
});

describe('validateProductImage', () => {
  it('accepte une photo JPEG, PNG ou WebP', () => {
    expect(validateProductImage(imageFile('a.jpg', 'image/jpeg'))).toBeNull();
    expect(validateProductImage(imageFile('b.png', 'image/png'))).toBeNull();
    expect(validateProductImage(imageFile('c.webp', 'image/webp'))).toBeNull();
  });

  it('refuse un fichier qui n’est pas une image', () => {
    expect(validateProductImage(imageFile('facture.pdf', 'application/pdf'))).toMatch(/JPEG, PNG ou WebP/);
  });

  it('refuse une photo de plus de 8 Mo', () => {
    expect(validateProductImage(imageFile('gros.jpg', 'image/jpeg', MAX_PRODUCT_IMAGE_BYTES + 1))).toMatch(/8 Mo maximum/);
  });

  it('refuse un fichier vide', () => {
    expect(validateProductImage(imageFile('vide.jpg', 'image/jpeg', 0))).toMatch(/photo est vide/);
  });
});

describe('uploadProductImage', () => {
  it('range la photo dans le dossier de l’entreprise et renvoie l’adresse publique', async () => {
    const result = await uploadProductImage(tenantId, imageFile('photo.jpg'));

    expect(upload).toHaveBeenCalledTimes(1);
    const [path, , options] = upload.mock.calls[0] as [string, unknown, { contentType: string }];
    expect(path).toMatch(new RegExp(`^${tenantId}/[0-9a-f-]{36}\\.jpg$`));
    expect(options.contentType).toBe('image/jpeg');
    expect(result).toEqual({
      path,
      url: `https://exemple.test/storage/v1/object/public/product-images/${tenantId}/a.jpg`,
    });
  });

  it('explique l’échec sans jargon quand l’envoi échoue', async () => {
    upload.mockResolvedValue({ data: null, error: { message: 'Bucket not found' } });
    await expect(uploadProductImage(tenantId, imageFile())).rejects.toThrow(/n’est pas encore installé/);
  });

  it('refuse un fichier invalide avant tout envoi', async () => {
    await expect(uploadProductImage(tenantId, imageFile('liste.pdf', 'application/pdf'))).rejects.toThrow(/JPEG, PNG ou WebP/);
    expect(upload).not.toHaveBeenCalled();
  });
});

describe('productImagePath', () => {
  it('retrouve le chemin de stockage à partir de l’adresse publique', () => {
    expect(productImagePath(`https://projet.supabase.co/storage/v1/object/public/product-images/${tenantId}/photo%201.jpg`))
      .toBe(`${tenantId}/photo 1.jpg`);
  });

  it('ignore une adresse qui ne vient pas du rangement des photos', () => {
    expect(productImagePath('https://exemple.test/photo.jpg')).toBeNull();
    expect(productImagePath(null)).toBeNull();
  });
});
