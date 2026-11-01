import { execFileSync, spawn } from 'node:child_process';

function readLocalStatus() {
  let output;
  try {
    output = execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'env'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    throw new Error('Supabase local doit être démarré. Lancez « pnpm supabase:start » (Docker est requis).');
  }

  const values = {};
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    values[match[1]] = value;
  }
  return values;
}

function localUrl(value, name) {
  if (!value) throw new Error(`La variable locale ${name} est absente de supabase status.`);
  const url = new URL(value);
  if (!['127.0.0.1', 'localhost', '::1'].includes(url.hostname)) {
    throw new Error(`${name} doit pointer vers Supabase local, pas vers un environnement distant.`);
  }
  return value.replace(/\/$/, '');
}

const status = readLocalStatus();
const supabaseUrl = localUrl(status.API_URL ?? 'http://127.0.0.1:54321', 'API_URL');
const databaseUrl = localUrl(status.DB_URL, 'DB_URL');
const mailpitUrl = localUrl(status.MAILPIT_URL ?? status.INBUCKET_URL ?? 'http://127.0.0.1:54324', 'MAILPIT_URL');
const publishableKey = status.PUBLISHABLE_KEY ?? status.ANON_KEY;
if (!publishableKey) throw new Error('Aucune clé publishable/anon locale n’a été trouvée.');

const env = {
  ...process.env,
  NODE_ENV: 'development',
  PORT: '3001',
  WEB_APP_URL: 'http://localhost:5173',
  CORS_ORIGINS: 'http://localhost:5173',
  SWAGGER_ENABLED: 'false',
  SUPABASE_URL: supabaseUrl,
  SUPABASE_PUBLISHABLE_KEY: publishableKey,
  API_PROXY_TARGET: 'http://127.0.0.1:3001',
  VITE_SUPABASE_URL: supabaseUrl,
  VITE_SUPABASE_PUBLISHABLE_KEY: publishableKey,
  VITE_APP_URL: 'http://localhost:5173',
  VITE_GOOGLE_AUTH_ENABLED: 'false',
  E2E_SUPABASE_URL: supabaseUrl,
  E2E_SUPABASE_PUBLISHABLE_KEY: publishableKey,
  E2E_DATABASE_URL: databaseUrl,
  E2E_MAILPIT_URL: mailpitUrl,
  E2E_API_URL: 'http://127.0.0.1:3001',
};

const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const child = spawn(command, ['exec', 'playwright', 'test', '--config', 'e2e/playwright.config.mjs'], {
  env,
  stdio: 'inherit',
});
child.on('error', (error) => {
  console.error(`Impossible de lancer Playwright : ${error.message}`);
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
