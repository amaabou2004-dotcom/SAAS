import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import pg from 'pg';

const apiUrl = process.env.E2E_API_URL ?? 'http://127.0.0.1:3001';
const mailpitUrl = (process.env.E2E_MAILPIT_URL ?? 'http://127.0.0.1:54324').replace(/\/$/, '');
const databaseUrl = process.env.E2E_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
const firstEmail = `e2e-first-${suffix}@example.test`;
const secondEmail = `e2e-second-${suffix}@example.test`;
const password = `E2e-${suffix}-Pass1!`;
const tenantName = `E2E Commerce ${suffix}`;
const tenantSlug = `e2e-${suffix}`;
const secondTenantName = `E2E Autre commerce ${suffix}`;
const secondTenantSlug = `e2e-other-${suffix}`;
const categoryName = `E2E Boissons ${suffix}`;
const productName = `E2E Eau ${suffix}`;
const sku = `E2E-${suffix.toUpperCase()}`;
const secondLocationName = `E2E Boutique ${suffix}`;
const secondLocationCode = `E2E${suffix.slice(0, 8).toUpperCase()}`;

function assertLocalDatabase() {
  const hostname = new URL(databaseUrl).hostname;
  if (!['127.0.0.1', 'localhost', '::1'].includes(hostname)) {
    throw new Error('Le nettoyage E2E est limité à PostgreSQL local.');
  }
}

async function waitForOtp(email) {
  const deadline = Date.now() + 45_000;
  let lastError = 'aucun message reçu';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${mailpitUrl}/api/v1/messages`);
      if (!response.ok) throw new Error(`Mailpit HTTP ${response.status}`);
      const payload = await response.json();
      const messages = Array.isArray(payload.messages) ? payload.messages : [];
      const summary = messages.find((message) =>
        Array.isArray(message.To) && message.To.some((recipient) =>
          typeof recipient.Address === 'string' && recipient.Address.toLowerCase() === email.toLowerCase(),
        ),
      );
      if (summary?.ID) {
        const detailResponse = await fetch(`${mailpitUrl}/api/v1/message/${encodeURIComponent(summary.ID)}`);
        if (!detailResponse.ok) throw new Error(`Mailpit message HTTP ${detailResponse.status}`);
        const detail = await detailResponse.json();
        const body = `${detail.Text ?? ''}\n${detail.HTML ?? ''}`;
        const match = body.match(/(?<!\d)(\d{8})(?!\d)/);
        if (match?.[1]) return match[1];
        lastError = 'le message reçu ne contient pas de code à 8 chiffres';
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Aucun OTP trouvé pour ${email}: ${lastError}`);
}

async function signUpAndVerify(page, email) {
  await page.goto('/auth/inscription');
  await page.getByLabel('Adresse e-mail professionnelle').fill(email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(password);
  await page.getByLabel('Confirmer le mot de passe').fill(password);
  await page.getByRole('button', { name: 'Recevoir mon e-mail de vérification' }).click();
  await expect(page).toHaveURL(/\/auth\/verification$/);

  const otp = await waitForOtp(email);
  await page.getByLabel('Code de vérification').fill(otp);
  await page.getByRole('button', { name: 'Vérifier mon adresse e-mail' }).click();
  await expect(page).toHaveURL(/\/onboarding$/);

  // OTP verification establishes the first session. Exercise the normal
  // password sign-in as a separate step as well, without disabling confirmation.
  await page.getByRole('button', { name: 'Déconnexion' }).click();
  await expect(page).toHaveURL(/\/auth\/connexion$/);
  await page.getByLabel('Adresse e-mail', { exact: true }).fill(email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
}

async function waitForOnboardingForm(page) {
  try {
    await page.getByLabel('Nom de l’entreprise').waitFor({ state: 'visible' });
  } catch (error) {
    const body = await page.locator('body').innerText().catch(() => '(page illisible)');
    let diagnostic = '';
    try {
      const token = await accessToken(page);
      const supabaseUrl = process.env.E2E_SUPABASE_URL ?? 'http://127.0.0.1:54321';
      const publishableKey = process.env.E2E_SUPABASE_PUBLISHABLE_KEY;
      if (!publishableKey) throw new Error('clé publishable locale absente');
      const response = await page.request.get(`${supabaseUrl}/rest/v1/tenants?select=id,name,slug,currency_code,timezone,status,created_at&order=created_at.asc`, {
        headers: { apikey: publishableKey, Authorization: `Bearer ${token}` },
      });
      const apiResponse = await page.request.get(`${apiUrl}/api/v1/tenants/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      diagnostic = ` Lecture REST directe: HTTP ${response.status()} ${(await response.text()).slice(0, 900)}; API NestJS: HTTP ${apiResponse.status()} ${(await apiResponse.text()).slice(0, 1200)}`;
    } catch (diagnosticError) {
      diagnostic = ` Diagnostic REST indisponible: ${diagnosticError instanceof Error ? diagnosticError.message : String(diagnosticError)}`;
    }
    throw new Error(`Le formulaire d’onboarding n’est pas visible à ${page.url()}. Contenu: ${body.slice(0, 1800)}.${diagnostic}`, { cause: error });
  }
}

async function accessToken(page) {
  const token = await page.evaluate(() => {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      const raw = key ? localStorage.getItem(key) : null;
      if (!raw) continue;
      try {
        const value = JSON.parse(raw);
        if (typeof value?.access_token === 'string') return value.access_token;
        if (typeof value?.currentSession?.access_token === 'string') return value.currentSession.access_token;
      } catch {
        // Ignore non-JSON local storage entries.
      }
    }
    return null;
  });
  if (!token) throw new Error('La session Supabase ne contient pas de jeton d’accès.');
  return token;
}

async function cleanup() {
  assertLocalDatabase();
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query('delete from public.tenants where slug = any($1::text[])', [[tenantSlug, secondTenantSlug]]);
    await client.query('delete from auth.users where email = any($1::text[])', [[firstEmail, secondEmail]]);
  } finally {
    await client.end();
  }
}

test('Auth, catalogue, stock et isolation fonctionnent avec Supabase local et Mailpit', async ({ page, browser }) => {
  let secondContext;
  try {
    await signUpAndVerify(page, firstEmail);
    await waitForOnboardingForm(page);

    await page.getByLabel('Nom de l’entreprise').fill(tenantName);
    await page.getByLabel('Identifiant de l’espace').fill(tenantSlug);
    await page.getByRole('button', { name: 'Créer mon entreprise' }).click();
    await expect(page).toHaveURL(/\/workspace\/produits$/);
    await expect(page.getByRole('heading', { name: 'Catalogue produits' })).toBeVisible();

    await page.getByRole('link', { name: 'Catégories', exact: true }).click();
    await page.getByLabel('Nom', { exact: true }).fill(categoryName);
    await page.getByRole('button', { name: 'Créer la catégorie' }).click();
    await expect(page.getByText(categoryName, { exact: true })).toBeVisible();

    await page.getByRole('link', { name: 'Produits', exact: true }).click();
    await page.getByLabel('Nom du produit').fill(productName);
    await page.getByLabel('SKU de la variante').fill(sku);
    await page.getByLabel(/Prix de vente/).fill('500');
    await page.getByLabel(/Prix de revient/).fill('300');
    await page.locator('#product-category').selectOption({ label: categoryName });
    await page.getByRole('button', { name: 'Créer le produit' }).click();
    await expect(page.getByRole('heading', { name: productName, exact: true })).toBeVisible();
    await expect(page.getByText(sku, { exact: true })).toBeVisible();

    await page.getByRole('link', { name: 'Emplacements', exact: true }).click();
    await page.getByLabel('Nom', { exact: true }).fill(secondLocationName);
    await page.getByLabel('Code unique').fill(secondLocationCode);
    await page.getByRole('button', { name: 'Créer l’emplacement' }).click();
    await expect(page.getByRole('heading', { name: secondLocationName, exact: true })).toBeVisible();

    await page.getByRole('link', { name: 'Stock & opérations', exact: true }).click();
    await page.getByLabel('Produit / variante').selectOption({ label: `${productName} — ${sku}` });
    await page.getByLabel('Emplacement', { exact: true }).selectOption({ label: 'Dépôt principal (PRINCIPAL)' });
    await page.getByLabel('Quantité (positive)').fill('10');
    await page.getByLabel('Motif', { exact: true }).fill('Réception initiale E2E');
    await page.getByLabel(/Référence/).fill('E2E-RECEIPT');
    await page.getByRole('button', { name: 'Enregistrer l’opération' }).click();
    await expect(page.getByText(/Opération enregistrée et tracée/)).toBeVisible();

    let row = page.locator('tbody tr').filter({ hasText: productName }).filter({ hasText: 'PRINCIPAL' });
    await expect(row.locator('td').nth(1)).toHaveText('10');
    await expect(row.locator('td').nth(3)).toHaveText('10');

    await page.getByLabel('Type d’opération').selectOption('transfer');
    await page.getByLabel('Produit / variante').selectOption({ label: `${productName} — ${sku}` });
    await page.getByLabel('Source', { exact: true }).selectOption({ label: 'Dépôt principal (PRINCIPAL)' });
    await page.getByLabel('Destination', { exact: true }).selectOption({ label: `${secondLocationName} (${secondLocationCode})` });
    await page.getByLabel('Quantité (positive)').fill('4');
    await page.getByLabel('Motif', { exact: true }).fill('Transfert E2E');
    await page.getByLabel(/Référence/).fill('E2E-TRANSFER');
    await page.getByRole('button', { name: 'Enregistrer l’opération' }).click();
    await expect(page.getByText(/Opération enregistrée et tracée/)).toBeVisible();

    row = page.locator('tbody tr').filter({ hasText: productName }).filter({ hasText: 'PRINCIPAL' });
    await expect(row.locator('td').nth(1)).toHaveText('6');
    const destinationRow = page.locator('tbody tr').filter({ hasText: productName }).filter({ hasText: secondLocationCode });
    await expect(destinationRow.locator('td').nth(1)).toHaveText('4');

    await page.getByRole('link', { name: 'Mouvements', exact: true }).click();
    const transferCard = page.locator('article').filter({ hasText: 'E2E-TRANSFER' });
    await expect(transferCard).toBeVisible();
    await transferCard.getByLabel('Motif de la contre-passation').fill('Correction du transfert E2E');
    await transferCard.getByRole('button', { name: 'Contre-passer' }).click();
    await expect(page.getByText('La contre-passation a été enregistrée. L’opération d’origine reste inchangée.')).toBeVisible();
    await expect(transferCard).toContainText('Contre-passée');
    await expect(transferCard).toContainText('E2E-TRANSFER');
    await expect(page.locator('article').filter({ hasText: 'Correction du transfert E2E' })).toBeVisible();

    await page.getByRole('link', { name: 'Stock & opérations', exact: true }).click();
    row = page.locator('tbody tr').filter({ hasText: productName }).filter({ hasText: 'PRINCIPAL' });
    await expect(row.locator('td').nth(1)).toHaveText('10');
    await expect(row.locator('td').nth(3)).toHaveText('10');

    const firstToken = await accessToken(page);
    const tenantsResponse = await page.request.get(`${apiUrl}/api/v1/tenants/me`, {
      headers: { Authorization: `Bearer ${firstToken}` },
    });
    expect(tenantsResponse.status()).toBe(200);
    const tenants = await tenantsResponse.json();
    const tenant = tenants.find((item) => item.slug === tenantSlug);
    expect(tenant).toBeDefined();

    secondContext = await browser.newContext({ baseURL: 'http://localhost:5173' });
    const secondPage = await secondContext.newPage();
    await signUpAndVerify(secondPage, secondEmail);
    await waitForOnboardingForm(secondPage);
    await secondPage.getByLabel('Nom de l’entreprise').fill(secondTenantName);
    await secondPage.getByLabel('Identifiant de l’espace').fill(secondTenantSlug);
    await secondPage.getByRole('button', { name: 'Créer mon entreprise' }).click();
    await expect(secondPage).toHaveURL(/\/workspace\/produits$/);
    await expect(secondPage.getByRole('heading', { name: 'Catalogue produits' })).toBeVisible();
    await expect(secondPage.getByText('Aucun produit pour le moment')).toBeVisible();
    const secondToken = await accessToken(secondPage);

    const readResponse = await secondPage.request.get(`${apiUrl}/api/v1/tenants/${tenant.id}/catalog/products`, {
      headers: { Authorization: `Bearer ${secondToken}` },
    });
    expect(readResponse.status()).toBe(200);
    expect(await readResponse.json()).toEqual([]);

    const stockResponse = await secondPage.request.get(`${apiUrl}/api/v1/tenants/${tenant.id}/inventory/stock`, {
      headers: { Authorization: `Bearer ${secondToken}` },
    });
    expect(stockResponse.status()).toBe(200);
    expect(await stockResponse.json()).toEqual([]);

    const writeResponse = await secondPage.request.post(`${apiUrl}/api/v1/tenants/${tenant.id}/catalog/categories`, {
      headers: { Authorization: `Bearer ${secondToken}` },
      data: { name: 'Écriture interdite E2E' },
    });
    expect(writeResponse.status()).toBe(403);
  } finally {
    if (secondContext) await secondContext.close();
    await cleanup();
  }
});
