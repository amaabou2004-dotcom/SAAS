import { passwordSchema, signUpSchema, verifyEmailSchema } from './auth-schemas';

describe('authentication validation', () => {
  it('accepts a password satisfying the security policy', () => {
    expect(passwordSchema.safeParse('MotDePasse2026Securise').success).toBe(true);
  });

  it.each(['court1', 'MotDePasseSansChiffre', '123456789012'])(
    'rejects an unsafe password: %s',
    (password) => {
      expect(passwordSchema.safeParse(password).success).toBe(false);
    },
  );

  it('requires matching password confirmation', () => {
    const result = signUpSchema.safeParse({
      email: 'commercant@example.com',
      password: 'MotDePasse2026Securise',
      confirmPassword: 'MotDePasse2026Different',
    });
    expect(result.success).toBe(false);
  });

  it.each(['12345678', '00000000'])('accepts an eight digit OTP: %s', (code) => {
    expect(verifyEmailSchema.safeParse({ code }).success).toBe(true);
  });

  it.each(['123456', '1234567a', '123456789'])('rejects an invalid OTP: %s', (code) => {
    expect(verifyEmailSchema.safeParse({ code }).success).toBe(false);
  });
});
