#!/bin/bash
# Artisan Kitchen — one-shot installer for an Oracle Cloud Ubuntu VM (Riyadh region).
# Run as root (Oracle runs it automatically when pasted as the instance's cloud-init script):
#   curl -fsSL https://raw.githubusercontent.com/hasomh86-lang/Kitchen-App/oracle-release/deploy/install.sh | bash
# Safe to re-run. Everything (database, photos) stays on this server.
set -euo pipefail
exec > >(tee -a /var/log/artisan-install.log) 2>&1
echo "=== Artisan Kitchen install $(date -Is) ==="

REPO="https://github.com/hasomh86-lang/Kitchen-App.git"
BRANCH="oracle-release"
APP=/opt/artisan-kitchen
DATA=/var/lib/artisan-kitchen
export DEBIAN_FRONTEND=noninteractive

# 1) Swap on small machines (the free AMD micro VM has 1 GB RAM)
if [ ! -f /swapfile ] && [ "$(free -m | awk '/Mem:/{print $2}')" -lt 3000 ]; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# 2) Packages: Node.js 24, Caddy (automatic HTTPS), sqlite3 (backups)
apt-get update -y
apt-get install -y curl git ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https sqlite3 iptables-persistent
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
fi
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y && apt-get install -y caddy
fi

# 3) App code (prebuilt — nothing to compile on the server)
id kitchen >/dev/null 2>&1 || useradd --system --home "$DATA" --shell /usr/sbin/nologin kitchen
mkdir -p "$DATA/backups" && chown -R kitchen:kitchen "$DATA" && chmod 750 "$DATA"
if [ -d "$APP/.git" ]; then git -C "$APP" fetch --depth 1 origin "$BRANCH" && git -C "$APP" reset --hard "origin/$BRANCH"
else rm -rf "$APP" && git clone --depth 1 -b "$BRANCH" "$REPO" "$APP"; fi

# 4) Service
touch /etc/artisan-kitchen.env && chmod 600 /etc/artisan-kitchen.env
cat > /etc/systemd/system/artisan-kitchen.service <<EOF
[Unit]
Description=Artisan Kitchen menu
After=network-online.target
Wants=network-online.target

[Service]
User=kitchen
Group=kitchen
Environment=NODE_ENV=production PORT=8080 HOST=127.0.0.1 DATA_DIR=$DATA APP_DIR=$APP
EnvironmentFile=-/etc/artisan-kitchen.env
ExecStart=/usr/bin/node --no-warnings $APP/server.mjs
Restart=always
RestartSec=3
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=$DATA
ProtectHome=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

# 5) Firewall — Oracle's Ubuntu images reject everything except SSH by default
for p in 80 443; do
  if ! iptables -C INPUT -p tcp -m state --state NEW --dport $p -j ACCEPT 2>/dev/null; then
    n=$(iptables -L INPUT --line-numbers | awk '/REJECT/{print $1; exit}')
    if [ -n "$n" ]; then iptables -I INPUT "$n" -p tcp -m state --state NEW --dport $p -j ACCEPT
    else iptables -A INPUT -p tcp -m state --state NEW --dport $p -j ACCEPT; fi
  fi
done
netfilter-persistent save || true

# 6) HTTPS address: <ip>.sslip.io resolves to this server, Caddy gets a free certificate.
#    To use your own domain later: edit /etc/caddy/Caddyfile and `systemctl reload caddy`.
IP=$(curl -fsS https://api.ipify.org || curl -fsS https://ifconfig.me)
DOMAIN="${DOMAIN:-${IP//./-}.sslip.io}"
if ! grep -q "managed-by-artisan" /etc/caddy/Caddyfile 2>/dev/null || [ -n "${FORCE_CADDY:-}" ]; then
cat > /etc/caddy/Caddyfile <<EOF
# managed-by-artisan
$DOMAIN {
	encode zstd gzip
	reverse_proxy 127.0.0.1:8080
	header Strict-Transport-Security "max-age=31536000"
}
http://$IP {
	redir https://$DOMAIN{uri} permanent
}
EOF
fi
echo "https://$DOMAIN" > "$DATA/url.txt"

# 7) Daily backup at 03:15 Riyadh time, keep 14 days (database + photos list stay on this disk)
timedatectl set-timezone Asia/Riyadh || true
cat > /usr/local/bin/artisan-backup <<EOF
#!/bin/bash
set -e
d=\$(date +%F)
sqlite3 $DATA/kitchen.db ".backup '$DATA/backups/kitchen-\$d.db'"
tar -czf $DATA/backups/images-\$d.tgz -C $DATA images 2>/dev/null || true
find $DATA/backups -type f -mtime +14 -delete
EOF
chmod +x /usr/local/bin/artisan-backup
echo "15 3 * * * kitchen /usr/local/bin/artisan-backup" > /etc/cron.d/artisan-backup

# 8) Update helper: `sudo artisan-update`
cat > /usr/local/bin/artisan-update <<EOF
#!/bin/bash
set -e
git -C $APP fetch --depth 1 origin $BRANCH && git -C $APP reset --hard origin/$BRANCH
systemctl restart artisan-kitchen
echo "Updated to \$(git -C $APP log -1 --format=%h)"
EOF
chmod +x /usr/local/bin/artisan-update

systemctl daemon-reload
systemctl enable --now artisan-kitchen
systemctl restart artisan-kitchen
systemctl enable caddy && systemctl restart caddy

sleep 3
curl -fsS http://127.0.0.1:8080/api/health && echo
echo "=== Done: open https://$DOMAIN/setup to create the administrator ==="
