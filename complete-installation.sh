#!/bin/bash

# 🚀 Complete SalesSync Installation
# This script completes the installation from where it left off

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}" >&2
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" >&2
}

info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

header() {
    echo -e "${PURPLE}"
    echo "=================================================="
    echo "  $1"
    echo "=================================================="
    echo -e "${NC}"
}

# Configuration
DOMAIN="salessync.gonxt.tech"
APP_DIR="/opt/salessync"
DB_NAME="salessync_production"
DB_USER="salessync"
DB_PASS="salessync_secure_password_2024"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    error "This script must be run as root (use sudo)"
    exit 1
fi

header "🚀 Completing SalesSync Installation"

# Step 1: Fix Database Setup
log "Step 1: Setting up PostgreSQL database..."
wget -O /tmp/fix-db.sh https://raw.githubusercontent.com/Reshigan/SalesSyncAI/main/fix-database-setup.sh
chmod +x /tmp/fix-db.sh
/tmp/fix-db.sh

# Step 2: Install and Configure Nginx
header "🌐 Installing and Configuring Nginx"

if ! command -v nginx &> /dev/null; then
    log "Installing Nginx..."
    apt-get update
    apt-get install -y nginx
fi

log "Starting Nginx service..."
systemctl start nginx
systemctl enable nginx

# Remove default site
rm -f /etc/nginx/sites-enabled/default

# Step 3: Configure Firewall
header "🔥 Configuring Firewall"

log "Configuring UFW firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 22
ufw allow 80
ufw allow 443
ufw allow from 127.0.0.1 to any port 5432
ufw --force enable

log "✅ Firewall configured"

# Step 4: Install SSL Certificate
header "🔒 Installing SSL Certificate"

if ! command -v certbot &> /dev/null; then
    log "Installing Certbot..."
    apt-get install -y certbot python3-certbot-nginx
fi

# Create temporary Nginx config for domain verification
log "Creating temporary Nginx configuration..."
cat > /etc/nginx/sites-available/temp-salessync << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    
    location / {
        return 200 'SalesSync Installation in Progress';
        add_header Content-Type text/plain;
    }
}
EOF

ln -sf /etc/nginx/sites-available/temp-salessync /etc/nginx/sites-enabled/temp-salessync
systemctl reload nginx

# Get SSL certificate
log "Obtaining SSL certificate for $DOMAIN..."
certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN --redirect || {
    warning "SSL certificate setup failed, continuing without SSL"
}

# Remove temporary config
rm -f /etc/nginx/sites-enabled/temp-salessync
rm -f /etc/nginx/sites-available/temp-salessync

# Step 5: Configure Nginx for SalesSync
header "⚙️ Configuring Nginx for SalesSync"

log "Creating Nginx configuration for SalesSync..."

# Check if SSL certificates exist
if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    log "SSL certificates found, creating HTTPS configuration..."
    cat > /etc/nginx/sites-available/salessync << EOF
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
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript application/json;
    
    client_max_body_size 50M;
    
    location / {
        proxy_pass http://localhost:3000;
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
        proxy_pass http://localhost:3000/health;
        access_log off;
    }
}
EOF
else
    log "No SSL certificates found, creating HTTP-only configuration..."
    cat > /etc/nginx/sites-available/salessync << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript application/json;
    
    client_max_body_size 50M;
    
    location / {
        proxy_pass http://localhost:3000;
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
        proxy_pass http://localhost:3000/health;
        access_log off;
    }
}
EOF
fi

# Enable the site
ln -sf /etc/nginx/sites-available/salessync /etc/nginx/sites-enabled/salessync

# Test Nginx configuration
log "Testing Nginx configuration..."
nginx -t || {
    error "Nginx configuration test failed"
    exit 1
}

systemctl reload nginx

# Step 6: Start SalesSync with PM2
header "🚀 Starting SalesSync Application"

cd $APP_DIR/backend

# Create PM2 ecosystem file
log "Creating PM2 configuration..."
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'salessync-backend',
    script: './dist/index.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      DATABASE_URL: 'postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME'
    },
    error_file: '/var/log/salessync/error.log',
    out_file: '/var/log/salessync/out.log',
    log_file: '/var/log/salessync/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
};
EOF

# Create log directory
mkdir -p /var/log/salessync
chown -R www-data:www-data /var/log/salessync

log "Starting application with PM2..."
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup systemd -u root --hp /root

# Step 7: Create Maintenance Scripts
header "🔧 Creating Maintenance Scripts"

# Create backup script
cat > /usr/local/bin/salessync-backup << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/backups/salessync"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Backup database
pg_dump -U salessync -h localhost salessync_production > $BACKUP_DIR/db_backup_$DATE.sql

# Backup application files
tar -czf $BACKUP_DIR/app_backup_$DATE.tar.gz -C /opt salessync

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
EOF

# Create restart script
cat > /usr/local/bin/salessync-restart << 'EOF'
#!/bin/bash
echo "Restarting SalesSync..."
pm2 restart salessync-backend
systemctl reload nginx
echo "SalesSync restarted successfully"
EOF

# Create status script
cat > /usr/local/bin/salessync-status << 'EOF'
#!/bin/bash
echo "=== SalesSync Status ==="
echo "Application:"
pm2 list | grep salessync
echo ""
echo "Nginx:"
systemctl status nginx --no-pager -l
echo ""
echo "PostgreSQL:"
systemctl status postgresql --no-pager -l
echo ""
echo "Disk Usage:"
df -h /opt/salessync
echo ""
echo "Memory Usage:"
free -h
EOF

# Make scripts executable
chmod +x /usr/local/bin/salessync-backup
chmod +x /usr/local/bin/salessync-restart
chmod +x /usr/local/bin/salessync-status

# Setup daily backup cron job
echo "0 2 * * * root /usr/local/bin/salessync-backup" > /etc/cron.d/salessync-backup

# Step 8: Verify Installation
header "✅ Verifying Installation"

log "Checking services..."

# Check Nginx
if systemctl is-active --quiet nginx; then
    log "✅ Nginx is running"
else
    error "❌ Nginx is not running"
fi

# Check PostgreSQL
if systemctl is-active --quiet postgresql; then
    log "✅ PostgreSQL is running"
else
    error "❌ PostgreSQL is not running"
fi

# Check PM2 application
if pm2 list | grep -q salessync-backend; then
    log "✅ SalesSync backend is running"
else
    error "❌ SalesSync backend is not running"
fi

# Wait for application to start
log "Waiting for application to start..."
sleep 10

# Test application health
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health | grep -q "200"; then
    log "✅ Application health check passed"
else
    warning "⚠️ Application health check failed - checking logs..."
    pm2 logs salessync-backend --lines 20
fi

# Test external access
if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    if curl -s -I https://$DOMAIN | head -n 1 | grep -q "200"; then
        log "✅ HTTPS access is working"
    else
        warning "⚠️ HTTPS access test failed"
    fi
else
    if curl -s -I http://$DOMAIN | head -n 1 | grep -q "200"; then
        log "✅ HTTP access is working"
    else
        warning "⚠️ HTTP access test failed"
    fi
fi

# Final Information
header "🎉 Installation Complete!"

echo -e "${GREEN}"
echo "SalesSync has been successfully installed!"
echo ""
echo "📋 Installation Summary:"
if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    echo "  • URL: https://$DOMAIN"
else
    echo "  • URL: http://$DOMAIN"
fi
echo "  • Application Directory: $APP_DIR"
echo "  • Database: $DB_NAME"
echo ""
echo "🔐 Default Login Credentials:"
echo "  • Email: admin@demo.com"
echo "  • Password: admin123"
echo ""
echo "🔧 Management Commands:"
echo "  • Check status: salessync-status"
echo "  • Restart application: salessync-restart"
echo "  • Create backup: salessync-backup"
echo "  • View logs: pm2 logs salessync-backend"
echo ""
echo "🌐 Your SalesSync application is now live!"
echo -e "${NC}"

log "🚀 SalesSync installation completed successfully!"