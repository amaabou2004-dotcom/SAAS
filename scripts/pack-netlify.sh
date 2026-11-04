#!/usr/bin/env bash
# Reconstruit le site et produit l'archive à glisser sur Netlify Drop.
# Usage : ./scripts/pack-netlify.sh
#
# L'archive contient index.html À LA RACINE (pas de dossier intermédiaire) :
# c'est ce que Netlify attend. Un dossier imbriqué provoque « Page not found ».
set -euo pipefail
cd "$(dirname "$0")/.."
repo_root="$(pwd)"

# Les variables publiques doivent être cuites dans le build, sinon le site
# déployé affiche « configuration manquante ». Priorité : .env local, sinon les
# valeurs publiques de netlify.toml (URL et clé « publishable » : non secrètes).
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi
export VITE_SUPABASE_URL="${VITE_SUPABASE_URL:-https://suuchdahpftxwbvwhbyq.supabase.co}"
export VITE_SUPABASE_PUBLISHABLE_KEY="${VITE_SUPABASE_PUBLISHABLE_KEY:-sb_publishable_-zxno-IY7ZlBHBM9L_cbNw_QJxtaD0q}"
export VITE_DATA_MODE="${VITE_DATA_MODE:-direct}"
export VITE_GOOGLE_AUTH_ENABLED="${VITE_GOOGLE_AUTH_ENABLED:-true}"

pnpm --filter @saas/web build

# Note de structure pour la personne qui ouvre l'archive.
cat > apps/web/dist/LISEZ-MOI.txt <<'TXT'
Stokari — site prêt à publier
=============================

Ce dossier EST le site. Ne pas l'imbriquer dans un autre dossier.

Structure attendue à la racine :
  index.html      <- la page d'entrée (obligatoire)
  assets/         <- scripts et styles
  _redirects      <- routes de l'application
  _headers        <- cache + sécurité
  favicon.svg, stokari-logo.png

Mise en ligne sur Netlify :
  1. https://app.netlify.com/drop
  2. Glisser le fichier stokari-netlify-drop.zip (le .zip, pas le dossier décompressé)
  3. Attendre ~20 s, puis "Claim site"
  4. Site configuration -> Change site name -> stokari
TXT

mkdir -p deploiements
rm -f deploiements/stokari-netlify.zip deploiements/stokari-netlify-drop.zip
(cd apps/web/dist && zip -qr -9 "${repo_root}/deploiements/stokari-netlify.zip" .)
cp deploiements/stokari-netlify.zip deploiements/stokari-netlify-drop.zip

echo "Archives prêtes :"
echo "  deploiements/stokari-netlify.zip"
echo "  deploiements/stokari-netlify-drop.zip"
