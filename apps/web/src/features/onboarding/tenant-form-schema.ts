import { z } from 'zod';

export const tenantFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Saisissez au moins 2 caractères.')
    .max(120, 'Utilisez au maximum 120 caractères.'),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Utilisez uniquement des lettres minuscules, chiffres et tirets.')
    .min(2, 'Saisissez au moins 2 caractères.')
    .max(63, 'Utilisez au maximum 63 caractères.'),
  currency_code: z.enum(['XOF', 'EUR', 'USD', 'NGN', 'GHS', 'MAD']),
  timezone: z.enum([
    'Africa/Niamey',
    'Africa/Abidjan',
    'Africa/Dakar',
    'Africa/Douala',
    'Europe/Paris',
    'UTC',
  ]),
});

export type TenantFormValues = z.infer<typeof tenantFormSchema>;

export function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}
