#!/usr/bin/env bash
# Cloud Agent install phase for the Healthcare Platform.
# Idempotent: installs PostgreSQL, project dependencies, and prepares the
# development database (schema + seed). Safe to run multiple times.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "==> [1/6] Ensuring PostgreSQL is installed"
if ! command -v pg_ctlcluster >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql postgresql-contrib
fi

# Resolve the installed major version (e.g. "16") rather than hardcoding it.
PG_VER="$(ls /etc/postgresql 2>/dev/null | sort -V | tail -1)"
if [ -z "${PG_VER}" ]; then
  echo "ERROR: no PostgreSQL cluster config found under /etc/postgresql" >&2
  exit 1
fi

echo "==> [2/6] Starting PostgreSQL ${PG_VER} cluster"
sudo pg_ctlcluster "${PG_VER}" main start 2>/dev/null || true
for _ in $(seq 1 30); do
  if sudo -u postgres pg_isready -q; then break; fi
  sleep 1
done

echo "==> [3/6] Ensuring database role and database exist"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='healthcare'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE ROLE healthcare LOGIN PASSWORD 'healthcare_dev';"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='healthcare_platform'" | grep -q 1 \
  || sudo -u postgres createdb -O healthcare healthcare_platform
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE healthcare_platform TO healthcare;" >/dev/null

echo "==> [4/6] Ensuring apps/api/.env exists"
bash "$REPO_ROOT/.cursor/write-env.sh"

echo "==> [5/6] Installing Node.js dependencies"
npm install

echo "==> [6/6] Generating Prisma client and syncing schema"
npm run db:generate --workspace=apps/api
npm run db:push --workspace=apps/api

# Seed demo data only once — the seed creates some rows that are not
# upsert-safe, so re-running it against an already-seeded database fails.
if sudo -u postgres psql -d healthcare_platform -tAc \
  "SELECT 1 FROM users WHERE email='admin@healthcare.platform' LIMIT 1" 2>/dev/null | grep -q 1; then
  echo "==> Database already seeded — skipping seed."
else
  echo "==> Seeding demo data"
  npm run db:seed --workspace=apps/api
fi

echo "==> Install complete."
