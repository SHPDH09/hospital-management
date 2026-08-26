#!/usr/bin/env bash
# Writes apps/api/.env for local Cloud Agent development if it does not exist.
# The API resolves DATABASE_URL from this file (see apps/api/src/lib/database-url.ts).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO_ROOT/apps/api/.env"

if [ -f "$ENV_FILE" ]; then
  echo "apps/api/.env already exists — leaving it untouched."
  exit 0
fi

cat > "$ENV_FILE" <<'EOF'
# Local development (PostgreSQL running on the Cloud Agent VM)
DATABASE_URL="postgresql://healthcare:healthcare_dev@localhost:5432/healthcare_platform?schema=public"
DATABASE_URL_READ="postgresql://healthcare:healthcare_dev@localhost:5432/healthcare_platform?schema=public"

JWT_SECRET="dev-jwt-secret-change-in-production"
JWT_REFRESH_SECRET="dev-refresh-secret-change-in-production"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"
PORT=3001
NODE_ENV=development
CORS_ORIGIN="http://localhost:5173"

# Google OAuth (patient login only) — optional for local dev
GOOGLE_CLIENT_ID=""
VITE_GOOGLE_CLIENT_ID=""
EOF

echo "Wrote $ENV_FILE"
