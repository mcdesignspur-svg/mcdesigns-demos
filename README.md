# MC Designs — Demos

Demos privados para clientes y prospects de MC Designs.

**Live:** https://demos.mcdesignspr.com

## Stack

- Static HTML + Tailwind (CDN) + Vite
- Vercel Serverless Functions para backend (`api/`)
- Deploy automático en push a `main`

## Estructura

```
mcdesigns-demos/
├── index.html              → /
├── westside/
│   ├── index.html          → /westside
│   └── dashboard.html      → /westside/dashboard
├── api/
│   └── westside-submit.js  → POST /api/westside-submit
├── assets/                 → imágenes, logos compartidos
├── package.json
├── vite.config.js
├── vercel.json
└── tailwind.config.js
```

## Demos activos

| Cliente | URL | Propósito | Estado |
|---|---|---|---|
| WestSide Fitness | `/westside` | Pilar 1 (leads) + dashboard simulado | Activo |
| Parts Aviation Solutions | `/aviation` | RFQ triage con AI (Claude + routing) | Activo |

## Local dev

```bash
npm install
npm run dev
```

Para probar el serverless function localmente necesitas Vercel CLI:
```bash
npm i -g vercel
vercel dev
```

## Deploy

Push a `main` → Vercel redeploy automático.

## DNS (GoDaddy)

```
Type:  CNAME
Name:  demos
Value: cname.vercel-dns.com
TTL:   1 hour
```

Agregar `demos.mcdesignspr.com` como dominio custom en Vercel → Project Settings → Domains.

## Seguridad

- Todos los demos tienen `noindex, nofollow` — no indexables en Google.
- Los demos no almacenan datos reales — son simulaciones.
- Para demos con datos reales (prod): conectar Supabase + auth.

## Variables de entorno (futuro)

```
ANTHROPIC_API_KEY=sk-ant-...
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
RESEND_API_KEY=re_...
```

---

© 2026 MC Designs · Puerto Rico
