import { getSupabaseClient } from '../../lib/supabase';

export async function signUpWithPassword(email: string, password: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/verification`,
    },
  });

  if (error) throw error;

  if (data.session && !data.user?.email_confirmed_at) {
    await supabase.auth.signOut();
    throw new Error('La confirmation par e-mail doit être activée pour sécuriser les comptes.');
  }

  return data;
}

export async function verifyEmailCode(email: string, token: string) {
  const { data, error } = await getSupabaseClient().auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token,
    type: 'email',
  });

  if (error) throw error;
  if (!data.session || !data.user?.email_confirmed_at) {
    throw new Error('La vérification n’a pas produit de session confirmée. Réessayez.');
  }

  return data;
}

export async function resendVerificationCode(email: string) {
  const { error } = await getSupabaseClient().auth.resend({
    type: 'signup',
    email: email.trim().toLowerCase(),
  });

  if (error) throw error;
}

export async function signInWithPassword(email: string, password: string) {
  const { data, error } = await getSupabaseClient().auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error) throw error;
  return data;
}

interface GoogleSignInOptions {
  skipBrowserRedirect?: boolean;
}

export async function signInWithGoogle({ skipBrowserRedirect = false }: GoogleSignInOptions = {}) {
  const { data, error } = await getSupabaseClient().auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      ...(skipBrowserRedirect ? { skipBrowserRedirect: true } : {}),
    },
  });

  if (error) throw error;
  return data;
}

export async function requestPasswordReset(email: string) {
  const { error } = await getSupabaseClient().auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
    { redirectTo: `${window.location.origin}/auth/reinitialisation` },
  );

  if (error) throw error;
}

export async function updatePassword(password: string) {
  const { data, error } = await getSupabaseClient().auth.updateUser({ password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await getSupabaseClient().auth.signOut();
  if (error) throw error;
}
