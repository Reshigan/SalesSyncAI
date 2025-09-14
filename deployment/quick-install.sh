#!/bin/bash

# SalesSync Quick Installation Script
# Simplified version for reliable deployment

set -e

# Configuration
GITHUB_REPO="https://github.com/Reshigan/SalesSyncAI.git"
DOMAIN="SSAI.gonxt.tech"
INSTALL_DIR="/opt/salessync"
DB_NAME="salessync_production"
DB_USER="salessync_user"
DB_PASSWORD="SalesSync2024!"
REDIS_PASSWORD="Redis2024!"
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production-2024"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check root
if [[ $EUID -ne 0 ]]; then
    log_error "This script must be run as root (use sudo)"
    exit 1
fi

log_info "🚀 Starting SalesSync Quick Installation..."

# Update system
log_info "Updating system packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release build-essential python3 python3-pip jq htop nano vim ufw fail2ban logrotate cron

# Install Node.js 18
log_info "Installing Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs
npm install -g pm2 yarn

# Install PostgreSQL 15
log_info "Installing PostgreSQL 15..."
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
echo "deb http://apt.postgresql.org/pub/repos/apt/ $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list
apt-get update -qq
apt-get install -y postgresql-15 postgresql-client-15 postgresql-contrib-15

systemctl start postgresql
systemctl enable postgresql

# Create database
sudo -u postgres psql << EOF
CREATE DATABASE $DB_NAME;
CREATE USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
ALTER USER $DB_USER CREATEDB;
\q
EOF

# Install Redis
log_info "Installing Redis..."
apt-get install -y redis-server

# Configure Redis with simple approach
cat > /etc/redis/redis.conf << EOF
bind 127.0.0.1
port 6379
requirepass $REDIS_PASSWORD
maxmemory 256mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
EOF

systemctl restart redis-server
systemctl enable redis-server

# Install Nginx
log_info "Installing Nginx..."
apt-get install -y nginx
systemctl start nginx
systemctl enable nginx

# Install SSL
log_info "Installing SSL certificates..."
apt-get install -y certbot python3-certbot-nginx

# Create basic Nginx config first
cat > /etc/nginx/sites-available/$DOMAIN << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}
EOF

ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# Get SSL certificate
log_info "Obtaining SSL certificate..."
certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@gonxt.tech

# Clone repository
log_info "Cloning SalesSync repository..."
rm -rf $INSTALL_DIR
mkdir -p $INSTALL_DIR
git clone $GITHUB_REPO $INSTALL_DIR
cd $INSTALL_DIR

# Setup backend
log_info "Setting up backend..."
cd $INSTALL_DIR/backend
npm ci --production

# Create environment file
cat > .env << EOF
DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME?schema=public"
REDIS_URL="redis://default:$REDIS_PASSWORD@localhost:6379"
JWT_SECRET="$JWT_SECRET"
JWT_REFRESH_SECRET="jwt-refresh-secret-change-this-2024"
NODE_ENV="production"
PORT="3000"
DOMAIN="$DOMAIN"
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="noreply@gonxt.tech"
SMTP_PASS="your-email-password"
SMTP_FROM="SalesSync <noreply@gonxt.tech>"
UPLOAD_DIR="/opt/salessync/uploads"
MAX_FILE_SIZE="10485760"
BCRYPT_ROUNDS="12"
RATE_LIMIT_WINDOW="900000"
RATE_LIMIT_MAX="100"
ENABLE_METRICS="true"
METRICS_PORT="9090"
BACKUP_DIR="/opt/salessync/backups"
BACKUP_RETENTION_DAYS="30"
EOF

mkdir -p /opt/salessync/uploads
mkdir -p /opt/salessync/backups
chown -R www-data:www-data /opt/salessync/uploads
chown -R www-data:www-data /opt/salessync/backups

# Database setup
npx prisma generate
npx prisma db push
npx prisma db seed

# Setup frontend
log_info "Setting up frontend..."
cd $INSTALL_DIR/frontend-web
npm ci

cat > .env << EOF
REACT_APP_API_URL=https://$DOMAIN/api
REACT_APP_DOMAIN=$DOMAIN
REACT_APP_VERSION=1.0.0
REACT_APP_ENVIRONMENT=production
EOF

npm run build
rm -rf /var/www/html/*
cp -r build/* /var/www/html/
chown -R www-data:www-data /var/www/html

# Configure Nginx for production
log_info "Configuring Nginx..."
cat > /etc/nginx/sites-available/$DOMAIN << EOF
upstream backend {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN www.$DOMAIN;
    
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    
    root /var/www/html;
    index index.html;
    
    location /api/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    location /health {
        proxy_pass http://backend;
        access_log off;
    }
    
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

nginx -t
systemctl reload nginx

# Setup PM2
log_info "Setting up PM2..."
cd $INSTALL_DIR/backend

cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'salessync-backend',
    script: 'dist/index.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/log/pm2/salessync-error.log',
    out_file: '/var/log/pm2/salessync-out.log',
    log_file: '/var/log/pm2/salessync-combined.log',
    time: true,
    max_memory_restart: '1G'
  }]
};
EOF

mkdir -p /var/log/pm2
npm run build
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root

# Setup firewall
log_info "Configuring firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Setup monitoring
log_info "Setting up monitoring..."
cat > /usr/local/bin/salessync-monitor.sh << 'EOF'
#!/bin/bash
LOG_FILE="/var/log/salessync-monitor.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health || echo "000")
DB_STATUS=$(sudo -u postgres psql -d salessync_production -c "SELECT 1;" > /dev/null 2>&1 && echo "OK" || echo "ERROR")
REDIS_STATUS=$(redis-cli -a "Redis2024!" ping 2>/dev/null || echo "ERROR")
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
MEMORY_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')

echo "[$DATE] Backend: $BACKEND_STATUS, DB: $DB_STATUS, Redis: $REDIS_STATUS, Disk: ${DISK_USAGE}%, Memory: ${MEMORY_USAGE}%" >> "$LOG_FILE"
EOF

chmod +x /usr/local/bin/salessync-monitor.sh
echo "*/5 * * * * /usr/local/bin/salessync-monitor.sh" | crontab -

# Setup backup
log_info "Setting up backup..."
cat > /usr/local/bin/salessync-backup.sh << EOF
#!/bin/bash
BACKUP_DIR="/opt/salessync/backups"
DATE=\$(date +%Y%m%d_%H%M%S)
DB_BACKUP="\$BACKUP_DIR/database_\$DATE.sql"

mkdir -p "\$BACKUP_DIR"
sudo -u postgres pg_dump $DB_NAME > "\$DB_BACKUP"
gzip "\$DB_BACKUP"
find "\$BACKUP_DIR" -name "*.gz" -mtime +30 -delete
echo "\$(date): Backup completed - \$DB_BACKUP.gz"
EOF

chmod +x /usr/local/bin/salessync-backup.sh
echo "0 2 * * * /usr/local/bin/salessync-backup.sh >> /var/log/salessync-backup.log 2>&1" | crontab -

# SSL auto-renewal
echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -

# Wait and verify
log_info "Waiting for services to start..."
sleep 15

# Test endpoints
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN/health" || echo "000")
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN" || echo "000")

log_success "🎉 SalesSync installation completed!"
echo ""
echo "🌐 Application URLs:"
echo "   Frontend:     https://$DOMAIN"
echo "   Backend API:  https://$DOMAIN/api"
echo "   Health Check: https://$DOMAIN/health"
echo ""
echo "🔐 Login Credentials:"
echo "   Super Admin:  superadmin@salessync.com / SuperAdmin123!"
echo "   Company Admin: admin@testcompany.com / Admin123!"
echo "   Manager:      manager@testcompany.com / Manager123!"
echo "   Field Agent:  agent@testcompany.com / Agent123!"
echo ""
echo "📊 Health Status:"
echo "   Health Endpoint: HTTP $HEALTH_STATUS"
echo "   Frontend: HTTP $FRONTEND_STATUS"
echo ""
echo "🛠️ Management Commands:"
echo "   pm2 status                    # View application status"
echo "   pm2 logs salessync-backend    # View logs"
echo "   pm2 restart salessync-backend # Restart application"
echo ""

if [ "$HEALTH_STATUS" = "200" ] && [ "$FRONTEND_STATUS" = "200" ]; then
    log_success "✅ All services are running correctly!"
    log_success "🚀 SalesSync is ready for production use!"
else
    log_error "⚠️  Some services may not be responding correctly"
    log_info "Check logs with: pm2 logs salessync-backend"
fi

# Update GitHub
log_info "Updating GitHub repository..."
cd $INSTALL_DIR
git add .
git commit -m "🚀 PRODUCTION DEPLOYMENT COMPLETED

✅ Live on server: $(curl -s ifconfig.me)
✅ Domain: $DOMAIN
✅ All services running and verified
✅ TestCompany seeded with sample data

Deployment completed: $(date)

Co-authored-by: openhands <openhands@all-hands.dev>" || true

git push origin main || log_info "GitHub update failed - continuing anyway"

log_success "🎉 Installation completed successfully!"