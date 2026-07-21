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
WEBSITE_CORS_ORIGIN="https://rgs.co.id,https://www.rgs.co.id"

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
DATABASE_URL="postgresql://user:password@localhost:5432/rgs_system"
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

## Deploy — ERP at `one.rgs.co.id` (RumahWeb VPS)

**Production architecture (current):**

| Surface | Host | Domain |
|---------|------|--------|
| Public site | **RumahWeb VPS** (Nginx + PM2 `rgs-website` → `127.0.0.1:3001`) | `https://rgs.co.id` |
| ERP (this app) | **RumahWeb VPS** (Nginx + PM2 `rgs-system` → `127.0.0.1:3000` + local Postgres) | `https://one.rgs.co.id` |

Corporate Login / CMS must point at `https://one.rgs.co.id` (not `app.rgs.co.id`).

### First-time VPS setup

Use `scripts/deploy-rumahweb.sh` (Node 20, Nginx, PM2, Postgres on the VPS). Or install manually:

1. Ubuntu VPS, DNS **A** record: `one` → VPS IP
2. Postgres on the same machine (`DATABASE_URL` + `DIRECT_URL` both `localhost`)
3. App env (example):

| Variable | Example |
|----------|---------|
| `DATABASE_URL` | `postgresql://rgs_user:…@127.0.0.1:5432/rgs_system` |
| `DIRECT_URL` | same as `DATABASE_URL` on local Postgres |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://one.rgs.co.id` |
| `WEBSITE_CORS_ORIGIN` | `https://rgs.co.id,https://www.rgs.co.id` |
| `OPENAI_API_KEY` | required before AI payment/tax verification works |
| SMTP_* | optional (invoice / reset emails) |

4. `npx prisma db push` or `migrate deploy` → `npm run db:seed` (first time) → `npm run build` → PM2 `rgs-system` on port **3000**
5. Nginx reverse proxy + Certbot for HTTPS
6. Seed admin login: **`vicko` / `admin123`** — change immediately

Uploads live under `public/uploads`, `public/proofs`, `public/progress` — back these up; they are not in Git.

### Redeploy (VPS)

```bash
cd /var/www/rgs-system
git pull origin main
npm install
npx prisma generate
npx prisma migrate deploy || npx prisma db push
npm run build
pm2 restart rgs-system --update-env
```

### Not for production: Vercel

Do **not** host this ERP on Vercel (function limits + ephemeral uploads). `vercel.json` is only a non-destructive build helper (`prisma generate && next build`) for experiments — do **not** run `db push --accept-data-loss` in production builds.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server on port 3000 |
| `npm run build` | Production build |
| `npm run start` | Production server on port 3000 |
| `npm run db:deploy` | Apply migrations (`prisma migrate deploy`) |
| `npm run db:seed` | Seed demo data |
| `npm run db:studio` | Open Prisma Studio |
