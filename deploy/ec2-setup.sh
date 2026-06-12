#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# EC2 First-Time Setup Script
# Run on a fresh Ubuntu 22.04 t2.micro (or t3.micro) instance.
# Usage:  sudo bash ec2-setup.sh
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_URL="https://github.com/devil2k25/onlyfans.git"   # ← your repo
DOMAIN=""          # ← your domain (leave blank to use IP only)
DB_PASSWORD=$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 24)

echo "==> Updating system..."
apt-get update -y && apt-get upgrade -y

# ── Docker ────────────────────────────────────────────────────────
echo "==> Installing Docker..."
curl -fsSL https://get.docker.com | sh
usermod -aG docker ubuntu
newgrp docker

# ── Node.js 20 ───────────────────────────────────────────────────
echo "==> Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# ── PM2 ──────────────────────────────────────────────────────────
echo "==> Installing PM2..."
npm install -g pm2
pm2 startup systemd -u ubuntu --hp /home/ubuntu | tail -1 | bash

# ── Nginx ────────────────────────────────────────────────────────
echo "==> Installing Nginx..."
apt-get install -y nginx certbot python3-certbot-nginx

# ── PostgreSQL (Docker container) ────────────────────────────────
echo "==> Starting PostgreSQL..."
docker run -d \
  --name onlyfans-postgres \
  --restart always \
  -e POSTGRES_DB=onlyfans \
  -e POSTGRES_USER=onlyfans \
  -e "POSTGRES_PASSWORD=${DB_PASSWORD}" \
  -p 127.0.0.1:5432:5432 \
  -v onlyfans-pgdata:/var/lib/postgresql/data \
  postgres:16-alpine

echo "Waiting for Postgres to be ready..."
sleep 10

# ── Clone repo ───────────────────────────────────────────────────
echo "==> Cloning repository..."
git clone "$REPO_URL" /home/ubuntu/onlyfans
chown -R ubuntu:ubuntu /home/ubuntu/onlyfans

# ── Run schema ───────────────────────────────────────────────────
echo "==> Applying database schema..."
docker exec -i onlyfans-postgres psql -U onlyfans -d onlyfans \
  < /home/ubuntu/onlyfans/backend/src/db/schema.sql

# ── Backend .env ─────────────────────────────────────────────────
echo "==> Creating backend .env (EDIT THIS FILE before starting!)..."
JWT_SECRET=$(openssl rand -base64 48)
JWT_REFRESH=$(openssl rand -base64 48)

cat > /home/ubuntu/onlyfans/backend/.env <<EOF
PORT=5000
DATABASE_URL=postgresql://onlyfans:${DB_PASSWORD}@localhost:5432/onlyfans
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH}
STRIPE_SECRET_KEY=sk_test_REPLACE_ME
STRIPE_WEBHOOK_SECRET=whsec_REPLACE_ME
CLIENT_URL=http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
# ─── AWS S3 (optional — remove if using local storage) ───
AWS_REGION=us-east-1
AWS_S3_BUCKET=REPLACE_ME
# AWS credentials are picked up from the EC2 IAM role automatically
EOF
chown ubuntu:ubuntu /home/ubuntu/onlyfans/backend/.env
chmod 600 /home/ubuntu/onlyfans/backend/.env

# ── Install backend deps ─────────────────────────────────────────
echo "==> Installing backend dependencies..."
cd /home/ubuntu/onlyfans/backend
sudo -u ubuntu npm ci --omit=dev

# ── Nginx config ─────────────────────────────────────────────────
echo "==> Configuring Nginx..."
cp /home/ubuntu/onlyfans/deploy/nginx.conf /etc/nginx/sites-available/onlyfans
ln -sf /etc/nginx/sites-available/onlyfans /etc/nginx/sites-enabled/onlyfans
rm -f /etc/nginx/sites-enabled/default

if [ -n "$DOMAIN" ]; then
  sed -i "s/server_name _;/server_name ${DOMAIN};/" /etc/nginx/sites-available/onlyfans
fi

nginx -t && systemctl reload nginx

# ── SSL (only if domain is set) ──────────────────────────────────
if [ -n "$DOMAIN" ]; then
  echo "==> Obtaining SSL certificate for ${DOMAIN}..."
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m admin@"$DOMAIN"
fi

# ── Start backend ────────────────────────────────────────────────
echo "==> Starting backend with PM2..."
sudo -u ubuntu bash -c "
  cd /home/ubuntu/onlyfans/backend
  pm2 start src/server.js --name onlyfans-backend --env production
  pm2 save
"

# ── Create /var/www/onlyfans for frontend ────────────────────────
mkdir -p /var/www/onlyfans
chown -R www-data:www-data /var/www/onlyfans

echo ""
echo "════════════════════════════════════════════════"
echo "  Setup complete!"
echo "  DB password (save this): ${DB_PASSWORD}"
echo "  Edit /home/ubuntu/onlyfans/backend/.env to add"
echo "  your Stripe keys and S3 bucket name."
echo ""
echo "  To add your SSH key for GitHub Actions:"
echo "  cat ~/.ssh/authorized_keys"
echo "════════════════════════════════════════════════"
