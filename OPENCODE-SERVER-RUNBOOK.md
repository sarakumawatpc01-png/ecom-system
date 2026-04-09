# OpenCode Server Install + Go-Live Runbook

Use this as a copy-paste runbook to install and launch this repository on a production VPS.

## 0) Assumptions

- OS: Ubuntu/Debian
- Domain DNS already points to the VPS
- Repository path on server: `/projects/ecom-system`
- App logs: `/projects/logs`
- DB backups: `/projects/backups`

---

## 1) Prepare server

```bash
sudo apt update && sudo apt install -y curl git nginx certbot python3-certbot-nginx ufw postgresql-client
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2

sudo adduser --disabled-password --gecos "" ecom
sudo usermod -aG sudo ecom

sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

SSH hardening (key-only login): set `PasswordAuthentication no` in `/etc/ssh/sshd_config`, then `sudo systemctl reload sshd`.

---

## 2) Pull repository + create required directories

```bash
sudo mkdir -p /projects
sudo chown -R ecom:ecom /projects
sudo -u ecom -H bash -lc 'cd /projects && git clone https://github.com/sarakumawatpc01-png/ecom-system.git'
sudo mkdir -p /projects/logs /projects/backups
sudo chown -R ecom:ecom /projects/logs /projects/backups
```

---

## 3) Configure environment/secrets

Create server runtime env file:

```bash
sudo -u ecom -H bash -lc 'cat > /projects/ecom-system/.env.production <<EOF
NODE_ENV=production
DATABASE_URL=postgresql://USER:PASS@HOST:5432/DBNAME
JWT_SECRET=REPLACE_ME
AI_CONFIG_ENCRYPTION_SECRET=REPLACE_ME
PORT=5000
CORS_ALLOWED_ORIGINS=https://admin.example.com,https://www.example.com

REDIS_URL=redis://127.0.0.1:6379

SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
OPENREPLAY_PROJECT_KEY=

SMTP_FROM=no-reply@example.com

BACKUP_DIR=/projects/backups
APP_LOG_DIR=/projects/logs
EOF'
```

For per-site SMTP/GSC credentials, store in `sites.config` JSON as documented in `/projects/ecom-system/README.md`.

---

## 4) Install dependencies + generate Prisma client

```bash
sudo -u ecom -H bash -lc 'cd /projects/ecom-system && npm ci'
sudo -u ecom -H bash -lc 'cd /projects/ecom-system && npm run prisma:generate --workspace @ecom/db'
```

---

## 5) Validate repository before runtime

```bash
sudo -u ecom -H bash -lc 'cd /projects/ecom-system && npm run lint && npm run build && npm run test'
```

If any command fails, stop and fix before deployment.

---

## 6) Start services with PM2

```bash
sudo -u ecom -H bash -lc 'cd /projects/ecom-system && set -a && source .env.production && set +a && pm2 start ecosystem.config.js'
sudo -u ecom -H bash -lc 'pm2 status && pm2 save'
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ecom --hp /home/ecom
```

After the startup command prints a `sudo ...` command, run it exactly once.

---

## 7) Configure Nginx + HTTPS

Generate Nginx config from repository script:

```bash
sudo -u ecom -H bash -lc 'cd /projects/ecom-system && ./scripts/generate-nginx-site-config.sh example.com 3001'
sudo cp /projects/ecom-system/deploy/nginx/example.com.conf /etc/nginx/sites-available/example.com.conf
sudo ln -sf /etc/nginx/sites-available/example.com.conf /etc/nginx/sites-enabled/example.com.conf
sudo nginx -t && sudo systemctl reload nginx
```

Issue TLS cert:

```bash
sudo certbot --nginx -d example.com -d www.example.com
```

Verify HTTP redirects to HTTPS.

---

## 8) Install maintenance jobs

```bash
sudo -u ecom -H bash -lc 'cd /projects/ecom-system && chmod +x scripts/*.sh'
sudo -u ecom -H bash -lc 'cd /projects/ecom-system && set -a && source .env.production && set +a && ./scripts/install-cron.sh'
sudo ./projects/ecom-system/scripts/setup-logrotate.sh /projects/logs /etc/logrotate.d/projects-ecom-system
```

Ensure cron runtime has `DATABASE_URL` (source `.env.production` in cron wrapper or export in user crontab context).

---

## 9) Site-level deploy flow (for each new site)

```bash
sudo -u ecom -H bash -lc 'cd /projects/ecom-system && ./scripts/deploy-site.sh <site-slug> <port> <domain>'
sudo -u ecom -H bash -lc 'pm2 status'
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d <domain> -d www.<domain>
```

---

## 10) Production readiness checks (must pass)

```bash
curl -sS -H "Authorization: Bearer <SUPER_ADMIN_TOKEN>" https://api.example.com/api/infra/audit/deep
curl -sS -H "Authorization: Bearer <SUPER_ADMIN_TOKEN>" https://api.example.com/api/<siteId>/prelaunch/checklist
```

Required:

- `critical_failures` must be `0` on both endpoints
- PM2 restart behavior verified
- Backup + restore drill passed (`scripts/backup.sh`, `scripts/restore-backup.sh`)
- Monitoring verified (Sentry/OpenReplay/Uptime)
- Lighthouse targets met for home/category/product

---

## 11) Final go-live signoff

- CI, Lighthouse CI, and CodeQL workflows are green
- TLS auto-renew confirmed
- CORS strict allowlist in place (no wildcard)
- Super-admin 2FA and lockout/activity checks passing
- Evidence archived (endpoint outputs, logs, screenshots, test proof)

---

## Quick troubleshooting

- PM2 logs: `sudo -u ecom -H bash -lc "pm2 logs --lines 200"`
- Nginx test: `sudo nginx -t`
- HTTPS renew dry-run: `sudo certbot renew --dry-run`
- Backup test: `sudo -u ecom -H bash -lc "cd /projects/ecom-system && set -a && source .env.production && set +a && ./scripts/backup.sh"`
