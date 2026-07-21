#!/bin/bash
# Deploy corporate website only — do NOT touch rgs-system PM2 process.
set -euo pipefail

WEB_DIR="/var/www/rgs-corporate-website"
WEB_DOMAIN="rgs.co.id"
ERP_DOMAIN="one.rgs.co.id"
WEB_REPO="https://github.com/Relasiglobalsolusi/rgs-corporate-website.git"

echo "=== Clone / pull corporate website ==="
mkdir -p /var/www
if [ ! -d "$WEB_DIR/.git" ]; then
  rm -rf "$WEB_DIR"
  git clone "$WEB_REPO" "$WEB_DIR"
else
  cd "$WEB_DIR"
  git fetch origin
  git reset --hard origin/main || git reset --hard origin/master
fi

cd "$WEB_DIR"
echo "Repo at: $(git rev-parse --short HEAD) ($(git log -1 --oneline))"

echo "=== Ensure .env.local ==="
if [ ! -f .env.local ]; then
  cat > .env.local << EOF
NEXT_PUBLIC_CMS_URL="https://${ERP_DOMAIN}/api/website/content"
NEXT_PUBLIC_PORTAL_URL="https://${ERP_DOMAIN}/login"
SMTP_HOST="smtp.example.com"
SMTP_PORT="465"
SMTP_USER="noreply@rgs.co.id"
SMTP_PASS="CHANGE_THIS"
CONTACT_TO="contact@rgs.co.id"
EOF
  echo "Created .env.local (placeholder SMTP — contact form needs real SMTP later)"
else
  echo ".env.local already exists — leaving as-is"
fi

echo "=== npm install && build ==="
npm install
npm run build

echo "=== PM2 start/restart rgs-website only ==="
# Do not delete or restart rgs-system
if pm2 describe rgs-website >/dev/null 2>&1; then
  pm2 restart rgs-website --update-env
else
  # package.json start already binds -p 3001; PORT=3001 for clarity
  PORT=3001 pm2 start npm --name "rgs-website" --cwd "$WEB_DIR" -- start
fi
pm2 save
pm2 list

echo "=== Nginx site for rgs.co.id / www ==="
cat > /etc/nginx/sites-available/rgs-website << 'NGINX'
server {
    listen 80;
    server_name rgs.co.id www.rgs.co.id;

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/rgs-website /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx

echo "=== Verify local ports ==="
sleep 2
echo "--- curl :3001 ---"
curl -sS -o /dev/null -w "HTTP %{http_code} time %{time_total}s\n" http://127.0.0.1:3001/ || true
curl -sS -I http://127.0.0.1:3001/ | head -n 15 || true
echo "--- curl :3000 ---"
curl -sS -o /dev/null -w "HTTP %{http_code} time %{time_total}s\n" http://127.0.0.1:3000/login || true
curl -sS -I http://127.0.0.1:3000/login | head -n 15 || true
echo "--- nginx Host rgs.co.id ---"
curl -sS -o /dev/null -w "HTTP %{http_code}\n" -H "Host: rgs.co.id" http://127.0.0.1/ || true

echo "=== Done (no certbot — DNS must point here first) ==="
pm2 list
