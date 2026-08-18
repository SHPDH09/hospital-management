# Vercel Deployment

## Required Environment Variables

Set these in **Vercel → Project → Settings → Environment Variables**:

| Variable | Example | Required |
|----------|---------|----------|
| `DATABASE_URL` | `postgresql://postgres:PASSWORD@database-1.cluster-covwo0uikrnc.us-east-1.rds.amazonaws.com:5432/postgres?schema=public&sslmode=require` | ✅ Yes |
| `JWT_SECRET` | long-random-string | ✅ Yes |
| `JWT_REFRESH_SECRET` | another-long-random-string | ✅ Yes |
| `ADMIN_EMAIL` | `rk331159@gmail.com` | For admin seed |
| `ADMIN_PASSWORD` | your-password | For admin seed |

Optional:
- `CORS_ORIGIN` — defaults to Vercel URL if not set
- `VITE_API_URL` — leave empty to use same-origin `/api/v1`

## First Deploy Checklist

1. Push latest code and redeploy
2. Add environment variables above in Vercel dashboard
3. Run database setup (from local machine or EC2 with DATABASE_URL):
   ```bash
   npm run db:setup
   ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run admin:create
   ```
4. Test API: `https://your-app.vercel.app/health`
5. Test login: `https://your-app.vercel.app/login/admin`

## Architecture on Vercel

- **Frontend** — static files from `apps/web/dist`
- **API** — serverless function at `/api` (Express app)
- **Database** — AWS Aurora RDS (external)

## Troubleshooting

| Error | Fix |
|-------|-----|
| `Internal server error` on login | Set `DATABASE_URL` on Vercel; allow RDS port 5432 from Vercel; run `npm run db:setup` |
| `Authentication failed` | Wrong RDS password in `DATABASE_URL` |
| `404` on `/login/admin` | Redeploy with latest `vercel.json` SPA rewrites |
| CORS error | Set `CORS_ORIGIN` to your Vercel URL |
