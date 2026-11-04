#!/usr/bin/env node
/**
 * Petit serveur local pour voir le build de production (dossier `apps/web/dist`)
 * exactement comme un hébergeur statique : routes SPA, cache des assets,
 * et page de téléchargement des archives de `deploiements/`.
 *
 * Usage : node scripts/serve-dist.mjs [port]
 *   http://localhost:4180/            -> le site
 *   http://localhost:4180/telecharger -> les archives ZIP à télécharger
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve(process.cwd(), 'apps/web/dist');
const downloads = resolve(process.cwd(), 'deploiements');
const port = Number(process.argv[2] ?? process.env.PORT ?? 4180);

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.zip': 'application/zip',
};

function headers(path) {
  const base = {
    'Content-Type': types[extname(path)] ?? 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };
  if (path.includes('/assets/')) base['Cache-Control'] = 'public, max-age=31536000, immutable';
  else base['Cache-Control'] = 'no-cache';
  return base;
}

function sendFile(res, path, extra = {}) {
  res.writeHead(200, { ...headers(path), ...extra });
  createReadStream(path).pipe(res);
}

const downloadsPage = `<!doctype html><html lang="fr"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Télécharger Stokari</title>
<style>
  body { margin:0; min-height:100vh; display:grid; place-items:center; background:#0f172a;
         color:#e2e8f0; font-family:system-ui,-apple-system,"Segoe UI",sans-serif; padding:24px; }
  main { width:100%; max-width:440px; }
  h1 { font-size:1.35rem; margin:0 0 6px; }
  p { color:#94a3b8; font-size:.9rem; line-height:1.5; margin:0 0 18px; }
  a { display:block; text-align:center; text-decoration:none; font-weight:700; padding:16px;
      border-radius:14px; margin-bottom:12px; background:#14b8a6; color:#04211d; }
  a.second { background:#1e293b; color:#e2e8f0; }
  small { color:#64748b; }
</style></head><body><main>
<h1>Télécharger Stokari</h1>
<p>Appuie sur un bouton : le fichier part dans les téléchargements de ton téléphone.</p>
<a href="/telecharger/stokari-netlify-drop.zip" download target="_blank" rel="noopener">
  Télécharger le site prêt à publier (ZIP)</a>
<a class="second" href="/telecharger/stokari-netlify.zip" download target="_blank" rel="noopener">
  Même archive, autre nom</a>
<small>Si rien ne se passe : ouvre cette page dans un onglet normal, puis réessaie.</small>
</main></body></html>`;

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const pathname = decodeURIComponent(url.pathname);

  if (pathname === '/telecharger' || pathname === '/telecharger/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    res.end(downloadsPage);
    return;
  }

  if (pathname.startsWith('/telecharger/')) {
    const name = normalize(pathname.slice('/telecharger/'.length));
    const file = join(downloads, name);
    if (!file.startsWith(downloads) || !existsSync(file)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Fichier introuvable');
      return;
    }
    sendFile(res, file, { 'Content-Disposition': `attachment; filename="${name}"` });
    return;
  }

  const candidate = join(root, normalize(pathname));
  const safe = candidate.startsWith(root);
  if (safe && existsSync(candidate) && statSync(candidate).isFile()) {
    sendFile(res, candidate);
    return;
  }
  // Routes de l'application (React Router) : on renvoie index.html.
  const index = join(root, 'index.html');
  if (existsSync(index)) {
    sendFile(res, index);
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Build introuvable : lancez `pnpm --filter @saas/web build`.');
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Site (build de production) : http://0.0.0.0:${port}`);
  console.log(`Téléchargements            : http://0.0.0.0:${port}/telecharger`);
});
