# WhatsApp Bridge Service

Persistent WhatsApp Web service for the Healthcare Affiliate Marketing module.

Deploy this on **Railway**, **Render**, **Fly.io**, or any **VPS** (not Vercel serverless).

## Quick start (local)

```bash
cd apps/whatsapp-bridge
cp .env.example .env
npm install
npm run dev
```

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Default `4040` |
| `WHATSAPP_BRIDGE_SECRET` | Yes | Shared secret — same value in main API `WHATSAPP_BRIDGE_SECRET` |
| `SESSION_DIR` | No | Where WhatsApp session files are stored |

## Deploy on Railway (recommended)

1. Create new project → Deploy from GitHub repo
2. Set **Root Directory** to `apps/whatsapp-bridge`
3. Set **Start Command**: `npm start`
4. Add env vars:
   - `WHATSAPP_BRIDGE_SECRET` = a long random string
   - `PORT` = `4040` (Railway sets PORT automatically)
5. Copy the public URL (e.g. `https://wa-bridge-production.up.railway.app`)

## Connect to main app (Vercel)

In Vercel → Project → Settings → Environment Variables, add:

```
WHATSAPP_BRIDGE_URL=https://your-bridge-url.railway.app
WHATSAPP_BRIDGE_SECRET=same-secret-as-bridge
```

Or set in **Admin → Affiliate Marketing → Settings**.

Redeploy Vercel. WhatsApp QR login will work through the bridge.

## Health check

```
GET /health
Header: X-Bridge-Key: your-secret
```
