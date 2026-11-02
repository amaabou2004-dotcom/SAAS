const STORAGE_KEY = 'saas-commerce.pending-email';

export function savePendingEmail(email: string) {
  sessionStorage.setItem(STORAGE_KEY, email.trim().toLowerCase());
}

export function readPendingEmail() {
  return sessionStorage.getItem(STORAGE_KEY);
}

export function clearPendingEmail() {
  sessionStorage.removeItem(STORAGE_KEY);
}
