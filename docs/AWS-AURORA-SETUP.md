# AWS Aurora PostgreSQL — Healthcare Platform

## Your RDS Details

| Field | Value |
|-------|-------|
| **Writer endpoint** | `database-1.cluster-covwo0uikrnc.us-east-1.rds.amazonaws.com` |
| **Reader endpoint** | `database-1.cluster-ro-covwo0uikrnc.us-east-1.rds.amazonaws.com` |
| **Username** | `postgres` |
| **Database** | `postgres` |
| **Port** | `5432` |

> **Writer** = migrations, API writes, seed data  
> **Reader (-ro-)** = optional read-only queries only — NOT for migrations

---

## EC2 Setup (5 Steps)

### Step 1 — Pull code

```bash
cd /opt/healthcare-platform   # your project path
git pull
```

### Step 2 — Create `.env` (password sirf yahan)

```bash
cp .env.rds.example apps/api/.env
nano apps/api/.env
```

Replace `YOUR_RDS_PASSWORD` with your RDS master password:

```env
DATABASE_URL="postgresql://postgres:APNA_PASSWORD@database-1.cluster-covwo0uikrnc.us-east-1.rds.amazonaws.com:5432/postgres?schema=public&sslmode=require"
```

Also set `CORS_ORIGIN` to your EC2 IP or domain.

**Password URL-encode karo agar special chars hain:** `@` → `%40`, `#` → `%23`

### Step 3 — Security group

RDS inbound rule:

| Type | Port | Source |
|------|------|--------|
| PostgreSQL | 5432 | EC2 security group ID |

EC2 aur Aurora **same VPC** mein hone chahiye.

### Step 4 — Test connection

```bash
npm install
node scripts/test-db-connection.mjs
```

Expected: `OK — Connected to Aurora PostgreSQL`

### Step 5 — Setup + start

```bash
chmod +x scripts/setup-production.sh
./scripts/setup-production.sh
```

Ya manually:

```bash
npm run db:setup          # tables + demo data
npm run build
docker compose -f docker-compose.prod.yml up -d --build
```

### Step 6 — Verify

```bash
curl http://localhost:3001/health
```

Browser: `http://YOUR_EC2_IP` (port 80)

---

## Local Dev (Docker Postgres)

```bash
docker compose --profile local-db up -d
cp apps/api/.env.example apps/api/.env   # localhost URL
npm run db:setup
npm run dev
```

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `P1000 Authentication failed` | Wrong password in `.env` |
| `Connection timeout` | RDS SG: allow 5432 from EC2 SG |
| `read-only transaction` | Galat endpoint — `-ro-` URL mat use karo migrations ke liye |
| `YOUR_RDS_PASSWORD` in error | `.env` mein password replace karo |

---

## Demo Accounts (after seed)

Password: `Password123!`

| Role | Email |
|------|-------|
| Super Admin | admin@healthcare.platform |
| Hospital Admin | admin@cityhospital.com |
| Patient | patient@example.com |
