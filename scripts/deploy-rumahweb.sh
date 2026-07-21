#!/bin/bash
# RGS System — Rumahweb VPS deployment script (Node 20 + PM2 + Nginx + Postgres)
# Run on Ubuntu VPS as root or with sudo.
#
# Shared hosting (PHP-only) will NOT work. Use VPS / Cloud with Node.js.
# Corporate site can stay on LaunchUniversal (or any host); only ERP needs this VPS
# unless you also want to host the website here (optional block below).
#
# Domains (examples):
#   ERP:     one.rgs.co.id  → PM2 rgs-system  → 127.0.0.1:3000
#   Website: rgs.co.id      → PM2 rgs-website → 127.0.0.1:3001 (optional)
#
# Before first run:
#   1. Point DNS A record for the ERP subdomain to this VPS
#   2. Ensure GitHub remotes exist and code is pushed
#   3. Edit DB password + .env values below (CHANGE_THIS_*)
#   4. Set OPENAI_API_KEY + company bank for payment/tax AI verification

set -e

ERP_DIR="/var/www/rgs-system"
WEB_DIR="/var/www/rgs-corporate-website"
ERP_DOMAIN="one.rgs.co.id"
WEB_DOMAIN="rgs.co.id"
ERP_REPO="https://github.com/Relasiglobalsolusi/rgs-system.git"
WEB_REPO="https://github.com/Relasiglobalsolusi/rgs-corporate-website.git"
DB_PASSWORD="CHANGE_THIS_PASSWORD"

echo "=== 1. Install dependencies ==="
apt update
apt install -y curl git nginx postgresql postgresql-contrib

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

npm install -g pm2

echo "=== 2. Setup PostgreSQL ==="
sudo -u postgres psql -c "CREATE USER rgs_user WITH PASSWORD '${DB_PASSWORD}';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE rgs_system OWNER rgs_user;" 2>/dev/null || true

echo "=== 3. Clone & build ERP ==="
mkdir -p /var/www
if [ ! -d "$ERP_DIR" ]; then
  git clone "$ERP_REPO" "$ERP_DIR"
fi

cd "$ERP_DIR"
git pull --ff-only || true
npm install

# Create .env if not exists
if [ ! -f .env ]; then
  cat > .env << EOF
DATABASE_URL="postgresql://rgs_user:${DB_PASSWORD}@localhost:5432/rgs_system"
NEXTAUTH_SECRET="$(openssl rand -base64 32)"
NEXTAUTH_URL="https://${ERP_DOMAIN}"
WEBSITE_CORS_ORIGIN="https://${WEB_DOMAIN}"
# WEBSITE_CMS_API_KEY="shared-secret-with-website"
#
# AI payment / tax verification (server-side only; fail-closed if unset)
# OPENAI_API_KEY="sk-..."
# OPENAI_PAYMENT_VERIFY_MODEL="gpt-4o-mini"
# COMPANY_BANK_ACCOUNT_NUMBER="CHANGE_THIS"
# COMPANY_BANK_NAME="BCA"
# COMPANY_BANK_ACCOUNT_NAME="PT Relasi Global Solusi"
#
# SMTP (invoices) — optional; install nodemailer first: npm i nodemailer
# SMTP_HOST="smtp.rumahweb.com"
# SMTP_PORT="465"
# SMTP_USER="noreply@rgs.co.id"
# SMTP_PASS="CHANGE_THIS"
# SMTP_FROM="Relasi Global Solusi <noreply@rgs.co.id>"
EOF
  echo "Created ERP .env — set OPENAI_API_KEY, company bank, SMTP before go-live!"
fi

# Persist uploads across deploys (gitignored locally)
mkdir -p public/uploads public/proofs public/progress public/uploads/website

npx prisma generate
# Prefer migrate deploy when migrations are committed; fallback for fresh DB:
npx prisma migrate deploy || npx prisma db push
# Seed only on first install (comment out after go-live if you have real data)
# npm run db:seed
npm run build

echo "=== 4. Clone & build corporate website ==="
if [ ! -d "$WEB_DIR" ]; then
  git clone "$WEB_REPO" "$WEB_DIR"
fi

cd "$WEB_DIR"
git pull --ff-only || true
npm install

if [ ! -f .env.local ]; then
  cat > .env.local << EOF
NEXT_PUBLIC_CMS_URL="https://${ERP_DOMAIN}/api/website/content"
NEXT_PUBLIC_PORTAL_URL="https://${ERP_DOMAIN}/login"
# CMS_API_KEY="shared-secret-with-erp"   # only if WEBSITE_CMS_API_KEY is set on ERP
SMTP_HOST="smtp.example.com"
SMTP_PORT="465"
SMTP_USER="noreply@rgs.co.id"
SMTP_PASS="CHANGE_THIS"
EOF
  echo "Created website .env.local — set real SMTP before contact form works!"
fi

npm run build

echo "=== 5. Start with PM2 ==="
cd "$ERP_DIR"
pm2 delete rgs-system 2>/dev/null || true
pm2 start npm --name "rgs-system" -- start

cd "$WEB_DIR"
pm2 delete rgs-website 2>/dev/null || true
pm2 start npm --name "rgs-website" -- start

pm2 save
pm2 startup

echo "=== 6. Nginx config ==="
cat > /etc/nginx/sites-available/rgs-system << NGINX
server {
    listen 80;
    server_name ${ERP_DOMAIN};

    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINX

cat > /etc/nginx/sites-available/rgs-website << NGINX
server {
    listen 80;
    server_name ${WEB_DOMAIN} www.${WEB_DOMAIN};

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/rgs-system /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/rgs-website /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "=== 7. SSL ==="
echo "Install certbot if needed, then:"
echo "  certbot --nginx -d ${ERP_DOMAIN} -d ${WEB_DOMAIN} -d www.${WEB_DOMAIN}"

echo ""
echo "=== Done ==="
echo "ERP:     https://${ERP_DOMAIN}   (PM2: rgs-system)"
echo "Website: https://${WEB_DOMAIN}   (PM2: rgs-website)"
echo "Uploads: ${ERP_DIR}/public/uploads (and proofs/, progress/) — back these up"
echo "Default seed login (if seeded): admin@rgs.co.id / admin123 — change immediately"
