#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Healthcare Platform — Production Setup (Aurora RDS)"
echo ""

# 1. Check .env
if [ ! -f apps/api/.env ]; then
  echo "Creating apps/api/.env from .env.rds.example ..."
  cp .env.rds.example apps/api/.env
  echo ""
  echo "IMPORTANT: Edit apps/api/.env and replace YOUR_RDS_PASSWORD"
  echo "  nano apps/api/.env"
  echo ""
  exit 1
fi

if grep -q 'YOUR_RDS_PASSWORD\|YOUR_PASSWORD' apps/api/.env; then
  echo "ERROR: Replace YOUR_RDS_PASSWORD in apps/api/.env first"
  echo "  nano apps/api/.env"
  exit 1
fi

# 2. Test DB connection
echo "==> Testing Aurora connection ..."
node scripts/test-db-connection.mjs

# 3. Install dependencies
echo ""
echo "==> Installing dependencies ..."
npm install

# 4. Database schema + seed
echo ""
echo "==> Pushing schema to Aurora ..."
npm run db:setup

# 5. Build
echo ""
echo "==> Building application ..."
npm run build

# 6. Start with Docker (Aurora — no local postgres)
echo ""
echo "==> Starting services (api + web + redis) ..."
docker compose -f docker-compose.prod.yml up -d --build

echo ""
echo "==> Done!"
echo ""
echo "  Health:  curl http://localhost:3001/health"
echo "  Web UI:  http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo 'YOUR_EC2_IP')"
echo ""
echo "  Demo login: patient@example.com / Password123!"
