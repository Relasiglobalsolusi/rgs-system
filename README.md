# RGS ONE — Cleaning Service ERP

Enterprise resource planning system for **Relasi Global Solusi**. Manages projects, staff attendance, daily progress, leave requests, manager approvals, client portal access, and monthly invoicing compilations.

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000/login](http://localhost:3000/login). Set `NEXTAUTH_URL=http://localhost:3000` in `.env` for local development.

## Tech stack

- **Next.js 16** (App Router)
- **PostgreSQL** + **Prisma**
- **NextAuth** (credentials)
- **Tailwind CSS** + shadcn-style UI components

## Modules

| Module | Route | Roles |
|--------|-------|-------|
| Dashboard | `/dashboard` | Admin, Manager, Staff, Client |
| Projects | `/projects` | Admin, Manager, Client |
| Daily Progress | `/progress` | Admin, Manager, Staff |
| Attendance | `/attendance` | Admin, Manager, Staff |
| Leave & Sick | `/leaves` | Admin, Manager, Staff |
| Approvals | `/approvals` | Admin, Manager |
| Monthly Reports | `/reports` | Admin, Manager, Client |
| Clients | `/clients` | Admin, Manager |
| Users | `/users` | Admin |
| Employees | `/employees` | Admin, Manager |
| Departments | `/departments` | Admin, Manager |
| Settings | `/settings` | Admin |
| Website CMS | `/website` | Admin |

## Website CMS (rgs.co.id integration)

RGS ONE can publish homepage content for the public corporate website at **rgs.co.id**. Admins edit content at `/website`; the site fetches published JSON from the ERP API.

### Public API

```
GET https://one.rgs.co.id/api/website/content
```

Response:

```json
{
  "published": true,
  "updatedAt": "2026-07-15T10:00:00.000Z",
  "content": {
    "hero": { "titleLine1": "Creating", "..." : "..." },
    "services": { "..." : "..." },
    "contact": { "phone": "+62 21 2295 2228", "..." : "..." }
  }
}
```

Use `updatedAt` for cache busting (e.g. `revalidate` in Next.js or `?v=` query param).

### Environment (ERP — rgs-system)

```env
# Optional: restrict CORS to your public site
WEBSITE_CORS_ORIGIN="https://rgs.co.id"

# Optional: require x-api-key header on the public API
WEBSITE_CMS_API_KEY="your-secret-key"
```

### Connect rgs.co.id (corporate website)

In **rgs-corporate-website**, set:

```env
NEXT_PUBLIC_CMS_URL="https://one.rgs.co.id/api/website/content"
NEXT_PUBLIC_PORTAL_URL="https://one.rgs.co.id/login"
# Optional, if WEBSITE_CMS_API_KEY is set on the ERP:
CMS_API_KEY="your-secret-key"
```

Fetch on the server (recommended):

```typescript
const res = await fetch(process.env.NEXT_PUBLIC_CMS_URL!, {
  next: { revalidate: 60 },
  headers: process.env.CMS_API_KEY
    ? { "x-api-key": process.env.CMS_API_KEY }
    : undefined,
});
const { content, updatedAt } = await res.json();
```

Pass `content.hero`, `content.contact`, etc. into page components. See `lib/cms.ts` in rgs-corporate-website for a ready-made helper.

### Editable fields (MVP)

| Section | Fields |
|---------|--------|
| Hero | Title lines, subtitle, highlights, stats, CTAs |
| Services | Section header + 3 service cards (title, label, description) |
| Stats | Section copy, featured stat, sidebar text |
| CTA | Headline, subtitle, badges, footer note |
| Contact | Phone, email, address lines, social links, footer tagline |

Images remain static assets on rgs.co.id (`/images/...`) in this MVP.

## Local setup

### Prerequisites

- Node.js 20+
- PostgreSQL running locally

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and set your database URL:

```bash
cp .env.example .env
```

```env
DATABASE_URL="postgresql://user:password@localhost:5432/rgs_one"
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"
```

### 3. Setup database

If upgrading an existing database that used the legacy `CLEANING_STAFF` role, run the migration SQL first:

```bash
npx prisma db execute --file prisma/migrate-user-role.sql --schema prisma/schema.prisma
```

Then push the schema and seed:

```bash
npx prisma db push
npm run db:seed
```

Or double-click **`setup.bat`** on Windows.

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000/login](http://localhost:3000/login)

## Demo accounts

Sign in at `/login` with your **username** and password assigned by your administrator. There is no self-registration; accounts are created by an admin only.

| Role | Username | Password |
|------|----------|----------|
| Admin | vicko | admin123 |
| Manager | manager | manager123 |
| Staff | site | staff123 |
| Staff | site2 | staff123 |
| Client | client | client123 |

The demo client account (`client@rgs.co.id`) is linked to **PT Gedung Sejahtera** and can only see that client's projects and monthly reports.

## Monthly invoicing reports

Navigate to **Monthly Reports** (`/reports`) to view a per-project compilation for any month:

- Project name, location, and client
- Days with progress logged and total entries
- Activity summary and staff involved
- Attendance days per assigned staff (month-level)
- End-of-month progress percentage

Admins and managers can **Lock Report** to snapshot data into `InvoiceCompilation` for invoicing. Use **Print / Export** for a printable table view.

## Client portal

Users with the **Client** role see a limited sidebar (Dashboard, Projects, Monthly Reports). All project queries are scoped to their linked client record. Internal staff (Admin/Manager) manage clients at `/clients` and assign clients when creating or editing projects.

## Deploy — ERP at `one.rgs.co.id` (Vercel)

Target architecture:

| Surface | Host | Domain |
|---------|------|--------|
| Public site | Rumahweb | `rgs.co.id` |
| ERP (this app) | Vercel (or similar Node host) | `one.rgs.co.id` |

Login on the public site should point to `https://one.rgs.co.id/login`.

### #1 blocker: production PostgreSQL

Vercel **cannot** use your local Postgres. Create a cloud database first, then set `DATABASE_URL` in Vercel:

| Option | Notes |
|--------|--------|
| [Neon](https://neon.tech) | Free tier, easy Prisma, use pooled + `?sslmode=require` |
| [Vercel Postgres](https://vercel.com/storage/postgres) | Same dashboard as the app |
| [Supabase](https://supabase.com) | Use the connection string (prefer pooled/transaction mode for serverless) |
| Rumahweb Postgres | Only if they offer a remotely reachable Postgres host/port (not localhost-only) |

Then apply schema (from your machine with the production URL, or via Vercel build):

```bash
# with production DATABASE_URL in the environment
npx prisma migrate deploy
# optional demo data — skip on a real production DB if you already have users
# npm run db:seed
```

### Vercel project setup

1. Push this repo to GitHub and import it in [Vercel](https://vercel.com).
2. Framework preset: **Next.js**. Build uses `vercel.json` (`prisma migrate deploy && next build`). `postinstall` runs `prisma generate`.
3. **Environment variables** (Production):

| Variable | Example |
|----------|---------|
| `DATABASE_URL` | `postgresql://…?sslmode=require` |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://one.rgs.co.id` |
| `WEBSITE_CORS_ORIGIN` | `https://rgs.co.id` (optional) |
| `WEBSITE_CMS_API_KEY` | shared secret (optional) |
| SMTP_* | if you send invoice / reset emails |

4. Deploy once to get a `*.vercel.app` URL and confirm login works against the cloud DB.
5. **Custom domain**: Vercel → Project → Settings → Domains → add `one.rgs.co.id`.
6. **Rumahweb DNS** (domain for `rgs.co.id`): create a **CNAME** record:

| Type | Name/Host | Value |
|------|-----------|--------|
| CNAME | `one` | `cname.vercel-dns.com` |

   (Use the exact target Vercel shows after you add the domain — often `cname.vercel-dns.com`.)

7. Wait for DNS + SSL (Vercel issues the certificate automatically).
8. On the public site (Rumahweb / `rgs-corporate-website`): set Login → `https://one.rgs.co.id/login` and CMS URL → `https://one.rgs.co.id/api/website/content`.

### Uploads caveat (Vercel)

Progress photos, employee files, and invoice PDFs are stored under `public/uploads` on disk. On Vercel that filesystem is **ephemeral** (files can disappear between deploys/instances). For go-live MVP you can still open the app; for durable media plan **Vercel Blob / S3 / R2**, or host the ERP on a VPS with persistent disk (see below).

### CLI deploy (optional)

```bash
npx vercel login
npx vercel link
npx vercel env pull   # or set env in the dashboard
npx vercel --prod
```

### Alternative: Rumahweb VPS (Nginx + PM2)

If you prefer a single VPS (persistent uploads + local Postgres): `scripts/deploy-rumahweb.sh`. Update `ERP_DOMAIN` in that script to `one.rgs.co.id` if you use this path instead of Vercel.

| App | Domain | PM2 name | Port |
|-----|--------|----------|------|
| ERP (`rgs-system`) | `one.rgs.co.id` | `rgs-system` | 3000 |
| Website (`rgs-corporate-website`) | `rgs.co.id` | `rgs-website` | 3001 |

**Redeploy (VPS)** — `cd /var/www/rgs-system && git pull && npm install && npx prisma migrate deploy && npm run build && pm2 restart rgs-system`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server on port 3000 |
| `npm run build` | Production build |
| `npm run start` | Production server on port 3000 |
| `npm run db:deploy` | Apply migrations (`prisma migrate deploy`) |
| `npm run db:seed` | Seed demo data |
| `npm run db:studio` | Open Prisma Studio |
