#!/usr/bin/env bash
# Reconstruit le site et produit l'archive à glisser sur Netlify Drop.
# Usage : ./scripts/pack-netlify.sh
set -euo pipefail
cd "$(dirname "$0")/.."

pnpm --filter @saas/web build

mkdir -p deploiements
rm -f deploiements/stokari-netlify.zip
(cd apps/web/dist && zip -qr -9 "../../deploiements/stokari-netlify.zip" .)

echo "Archive prête : deploiements/stokari-netlify.zip"
