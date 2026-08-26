#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

# Ensure database services are running (needed during build install)
bash .cursor/scripts/cloud-agent-start.sh

# Create local development .env if missing
if [ ! -f apps/api/.env ]; then
  cp apps/api/.env.example apps/api/.env
  sed -i 's|^DATABASE_URL=.*|DATABASE_URL="postgresql://healthcare:healthcare_dev@localhost:5432/healthcare_platform?schema=public"|' apps/api/.env
  sed -i '/^DATABASE_URL_READ=/d' apps/api/.env
fi

# Create database user and database (idempotent)
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='healthcare'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE USER healthcare WITH PASSWORD 'healthcare_dev';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='healthcare_platform'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE DATABASE healthcare_platform OWNER healthcare;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE healthcare_platform TO healthcare;" 2>/dev/null || true

# Install dependencies and build shared types
npm ci
npm run build --workspace=packages/shared

# Setup database schema and seed data (skip seed if already populated)
npm run db:generate --workspace=apps/api
npm run db:push --workspace=apps/api
if ! PGPASSWORD=healthcare_dev psql -h localhost -U healthcare -d healthcare_platform -tAc "SELECT 1 FROM users WHERE email='admin@healthcare.platform'" 2>/dev/null | grep -q 1; then
  npm run db:seed --workspace=apps/api
fi
