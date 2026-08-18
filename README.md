# Healthcare Hospital & Clinic Network Platform

A multi-tenant SaaS marketplace connecting patients with hospitals, clinics, and doctors, with a full-featured CRM for healthcare providers.

## Architecture

```
apps/
  api/          # Node.js + Express + Prisma REST API
  web/          # React + TypeScript + Vite + Tailwind frontend
packages/
  shared/       # Shared TypeScript types and constants
```

### Applications

| Portal | Route | Users |
|--------|-------|-------|
| Public Website | `/` | General public |
| Patient Portal | `/patient` | Registered patients |
| Hospital CRM | `/crm` | Hospital admins, doctors, staff |
| Super Admin | `/admin` | Platform operators |

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, React Query, React Router
- **Backend:** Node.js, Express, TypeScript, Prisma ORM
- **Database:** PostgreSQL 16 (AWS RDS in production)
- **Auth:** JWT access + refresh tokens, bcrypt password hashing
- **Infrastructure:** AWS RDS PostgreSQL, Docker Compose for local dev

## Getting Started

### Prerequisites

- Node.js 20+
- Docker & Docker Compose (local dev only)

### Local Setup

```bash
# Install dependencies
npm install

# Start PostgreSQL and Redis
docker compose up -d

# Configure environment
cp apps/api/.env.example apps/api/.env

# Setup database (generate client, migrate, seed)
npm run db:setup

# Start development servers (API on :3001, Web on :5173)
npm run dev
```

### AWS RDS Setup

The project is configured for AWS RDS PostgreSQL with a writer and read-replica endpoint:

| Role | Endpoint |
|------|----------|
| **Writer** (migrations, writes) | `database-1.cluster-covwo0uikrnc.us-east-1.rds.amazonaws.com` |
| **Read replica** (read queries) | `database-1.cluster-ro-covwo0uikrnc.us-east-1.rds.amazonaws.com` |

1. Copy the example env file and set your RDS credentials:

```bash
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env — replace YOUR_PASSWORD and adjust DB user/name if needed
```

2. Run migrations and seed against RDS:

```bash
npm run db:setup
```

Connection strings use `sslmode=require` for RDS. The API uses the writer endpoint by default; `DATABASE_URL_READ` is used for read-heavy public search queries when configured.

### Demo Accounts

All accounts use password: `Password123!`

| Role | Email |
|------|-------|
| Super Admin | admin@healthcare.platform |
| Hospital Admin | admin@cityhospital.com |
| Doctor | dr.sharma@cityhospital.com |
| Patient | patient@example.com |

## API

REST API available at `http://localhost:3001/api/v1`

Key endpoints:
- `POST /auth/register/patient` — Patient registration
- `POST /auth/login` — Login (all roles)
- `GET /organizations/search` — Public provider search
- `GET /doctors/search` — Public doctor search
- `POST /appointments/book` — Book appointment (patient)
- `GET /dashboard/crm` — CRM dashboard stats
- `GET /dashboard/admin` — Platform admin stats

## Phase 1 MVP Features

### Patient
- Registration & login
- Search hospitals, clinics, doctors
- View provider profiles
- Book appointments
- Patient dashboard with upcoming appointments

### Hospital/Clinic CRM
- Organization registration (pending verification)
- Dashboard with key metrics
- Patient management
- Doctor management
- Appointment lifecycle management
- Basic billing

### Super Admin
- Platform dashboard
- Organization verification workflow
- Subscription plan management
- Advertisement management

## Multi-Tenancy

Every tenant-owned record is scoped by `organization_id`. The API resolves the caller's organization from their JWT token and injects it into all queries. Cross-tenant data access is prevented at the application layer.

## License

Proprietary — All rights reserved.
