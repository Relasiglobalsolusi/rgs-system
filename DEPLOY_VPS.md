# RGS ONE — VPS deploy runbook

Production host: **RumahWeb VPS** `103.253.213.233`  
SSH: `ssh root@103.253.213.233`

## Services on this VPS

| App | Path | PM2 name | Port | Domain |
|-----|------|----------|------|--------|
| ERP | `/var/www/rgs-system` | `rgs-system` | 3000 | one.rgs.co.id |
| Corporate | `/var/www/rgs-corporate-website` | `rgs-website` | 3001 | rgs.co.id, www |

Nginx terminates HTTPS (certbot). Do not change `one` DNS away from this IP without a migration plan.

## Update ERP only

```bash
cd /var/www/rgs-system
git pull --ff-only origin main
npm install
npx prisma generate
# Schema sync: prefer migrate deploy; if history is messy (P3005 / many "not applied"),
# use db push WITHOUT --accept-data-loss (established prod practice on this VPS).
npx prisma migrate deploy || npx prisma db push
npm run build
pm2 restart rgs-system --update-env
```

## Update corporate only

```bash
cd /var/www/rgs-corporate-website
git pull --ff-only origin main
npm install
npm run build
pm2 restart rgs-website --update-env
```

## Health checks

```bash
pm2 status
curl -sI https://one.rgs.co.id/login | head
curl -sI https://rgs.co.id | head
```

Expect `Server: nginx` and HTTP 200/307 as appropriate.

## Database

- Engine: PostgreSQL on localhost
- App user/db: typically `rgs_user` / `rgs_system` (see server `.env`)
- Prisma needs both `DATABASE_URL` and `DIRECT_URL` (same URL on this VPS)

## DNS (RumahWeb zone for rgs.co.id)

| Host | Type | Target |
|------|------|--------|
| `@` / rgs.co.id | A | 103.253.213.233 |
| www | A | 103.253.213.233 |
| one | A | 103.253.213.233 |
| mail / MX / SPF / DKIM / DMARC | leave alone | email |

No Vercel CNAMEs. No Neon.

## SSL renew

Certbot timers should auto-renew. Manual:

```bash
certbot renew
nginx -t && systemctl reload nginx
```

## Backups (critical)

1. Postgres dump regularly  
2. Folders: `public/uploads`, `public/proofs`, `public/progress`  
3. `/var/www/rgs-system/.env` and corporate `.env.local` (secrets)

## Do not

- Point production ERP at Vercel Hobby  
- Point production DB at Neon unless outbound 5432 is proven open  
- Commit `.env` or passwords into GitHub  
- Delete mail DNS records when changing website A records
