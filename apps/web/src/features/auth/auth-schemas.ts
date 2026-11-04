import { z } from 'zod';

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Saisissez votre adresse e-mail.')
  .max(254, 'Cette adresse e-mail est trop longue.')
  .pipe(z.email('Saisissez une adresse e-mail valide.'));

export const passwordSchema = z
  .string()
  .min(12, 'Utilisez au moins 12 caractères.')
  .max(128, 'Utilisez au maximum 128 caractères.')
  .regex(/[A-Za-zÀ-ÖØ-öø-ÿ]/, 'Ajoutez au moins une lettre.')
  .regex(/\d/, 'Ajoutez au moins un chiffre.');

export const signUpSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Les mots de passe ne correspondent pas.',
  });

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Saisissez votre mot de passe.'),
});

export const verifyEmailSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{8}$/, 'Saisissez le code à 8 chiffres reçu par e-mail.'),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Les mots de passe ne correspondent pas.',
  });

export type SignUpValues = z.infer<typeof signUpSchema>;
export type SignInValues = z.infer<typeof signInSchema>;
export type VerifyEmailValues = z.infer<typeof verifyEmailSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
