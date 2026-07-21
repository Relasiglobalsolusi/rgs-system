# RGS ONE ERP — Continuity Brief (READ THIS FIRST)

> **For any AI assistant (including Cursor) opening this project with no prior chat history.**  
> Treat this file as the source of truth for production architecture and how to continue work.  
> Last updated: 2026-07-21 (Asia/Jakarta).

---

## One-sentence product

**RGS ONE** is the company ERP for PT Relasi Global Solusi (cleaning / facility management): projects, staff, CICO, leave, approvals, clients, billing, and a website CMS that feeds **rgs.co.id**.

---

## Production (live) — DO NOT reinvent

| Item | Value |
|------|--------|
| Public URL | **https://one.rgs.co.id** |
| Login | https://one.rgs.co.id/login |
| Host | **RumahWeb VPS** (not Vercel, not Neon) |
| VPS public IP | **103.253.213.233** |
| SSH | `ssh root@103.253.213.233` |
| App path on server | `/var/www/rgs-system` |
| Process | PM2 name **`rgs-system`** → `npm start` → **port 3000** |
| Reverse proxy | Nginx → `127.0.0.1:3000` + Let’s Encrypt |
| Database | **PostgreSQL on the same VPS** (localhost) |
| Sibling site | Corporate **https://rgs.co.id** on same VPS, PM2 **`rgs-website`**, port **3001** |
| Code remote | `https://github.com/Relasiglobalsolusi/rgs-system.git` (branch `main`; local may track as `master`→`main`) |

### What we abandoned (do not revive unless asked)

- **Vercel** for ERP — Hobby plan hit 12 serverless function limit; production moved to VPS.
- **Neon** — VPS could not reach Neon port 5432 (`PORT_FAIL`); DB is local Postgres.
- Domain **`app.rgs.co.id`** — obsolete; always use **`one.rgs.co.id`**.

---

## Local development

- Port **3000** only (`npm run dev` / `npm start`).
- Corporate site is a **separate repo** on port **3001** — never put ERP on 3001.
- Copy `.env.example` → `.env`. Set `DIRECT_URL` to the **same** value as `DATABASE_URL` for local Postgres.
- UI capitalization: see `.cursor/rules/ui-capitalization.mdc` (Title Case labels; sentence case for errors/help).

### Seed admin (change after first login)

- Username: **`vicko`** / Password: **`admin123`**
- Not `admin@rgs.co.id` (that was wrong in old scripts).

---

## Required env vars (names only — never commit real secrets)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres connection |
| `DIRECT_URL` | Same as `DATABASE_URL` on VPS local Postgres |
| `NEXTAUTH_SECRET` | Auth signing secret |
| `NEXTAUTH_URL` | `https://one.rgs.co.id` in prod |
| `WEBSITE_CORS_ORIGIN` | Prefer `https://rgs.co.id,https://www.rgs.co.id` |
| `SMTP_*` | Password reset / invoices (optional but needed for mail features) |
| `OPENAI_API_KEY` | Payment/tax AI verification (fail-closed if unset) |

Secrets live only in: VPS `/var/www/rgs-system/.env` and local `.env` (gitignored).

---

## How to deploy updates to production

On the VPS (as root):

```bash
cd /var/www/rgs-system
git pull --ff-only origin main
npm install
npx prisma generate
# Schema: try migrate deploy first. Prod migration history is messy (many
# "not applied" including init) — fallback is `npx prisma db push` without
# --accept-data-loss. Never use --accept-data-loss on this VPS.
npx prisma migrate deploy || npx prisma db push
npm run build
pm2 restart rgs-system --update-env
pm2 status
```

Do **not** run the full `scripts/deploy-rumahweb.sh` blindly on a live box (it also touches the corporate site). Prefer targeted pulls. Website-only helper: `scripts/deploy-website-only.sh`.

---

## Architecture notes for AI

- Stack: Next.js 16 App Router, Prisma, NextAuth credentials, Tailwind.
- Auth entry: `lib/auth.ts` — login field is **username** (also accepts recovery email).
- Edge protection: `proxy.ts` (Next.js 16 style middleware).
- Prisma singleton: `lib/prisma.ts`.
- Uploads: disk under `public/uploads`, `public/proofs`, `public/progress` — **back these up**; they are gitignored.
- CMS API for corporate site: `GET /api/website/content`.
- UI rule file: `.cursor/rules/ui-capitalization.mdc`.

---

## Pair project

Corporate website repo: **`rgs-corporate-website`**  
Path on VPS: `/var/www/rgs-corporate-website`  
Continuity twin: that repo’s `CONTINUITY.md`.

---

## First message the human should send on a new PC

> Open this folder in Cursor. Read `CONTINUITY.md` and `DEPLOY_VPS.md` fully. Production is RumahWeb VPS at one.rgs.co.id (not Vercel/Neon). Confirm you understand, then help me with: \<task\>.

---

## Owner

PT Relasi Global Solusi — operator: Vicko Liem.  
Accounts that matter for recovery: **GitHub (Relasiglobalsolusi)** + **RumahWeb** (domain + VPS).
