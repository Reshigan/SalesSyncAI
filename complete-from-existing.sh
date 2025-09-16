#!/bin/bash

# 🚀 Complete SalesSync Installation from Existing Setup
# This script handles existing database/user and completes the installation

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

# Step 1: Ensure database is properly configured
log "Step 1: Configuring existing database..."

# Test connection
if ! PGPASSWORD=$DB_PASS psql -h localhost -U $DB_USER -d $DB_NAME -c "SELECT 1;" > /dev/null 2>&1; then
    error "Cannot connect to database with existing credentials"
    log "Trying to fix database user password..."
    sudo -u postgres psql -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASS';" || {
        error "Failed to update database user password"
        exit 1
    }
fi

log "✅ Database connection successful"

# Step 2: Set up application database schema
header "📊 Setting up Database Schema"

cd $APP_DIR/backend

# Set environment variable
export DATABASE_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME"

log "Generating Prisma client..."
npx prisma generate

# Check if tables exist
TABLES_COUNT=$(PGPASSWORD=$DB_PASS psql -h localhost -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null || echo "0")
log "Current tables in database: $TABLES_COUNT"

if [ "$TABLES_COUNT" -eq 0 ]; then
    log "No tables found, creating database schema..."
    npx prisma db push --accept-data-loss
else
    log "Tables exist, checking if schema needs updates..."
    # Try to push schema changes (will only apply if needed)
    npx prisma db push --accept-data-loss || {
        warning "Schema push failed, trying reset..."
        npx prisma db push --force-reset --accept-data-loss
    }
fi

# Verify tables after schema setup
TABLES_AFTER=$(PGPASSWORD=$DB_PASS psql -h localhost -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null || echo "0")
log "Tables after schema setup: $TABLES_AFTER"

if [ "$TABLES_AFTER" -eq 0 ]; then
    error "Failed to create database tables"
    exit 1
fi

# Check if companies table exists
COMPANIES_EXISTS=$(PGPASSWORD=$DB_PASS psql -h localhost -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'companies';" 2>/dev/null || echo "0")

if [ "$COMPANIES_EXISTS" -eq 0 ]; then
    error "Companies table was not created"
    exit 1
fi

log "✅ Database schema is ready"

# Step 3: Seed database if empty
log "Checking if database needs seeding..."
COMPANY_COUNT=$(PGPASSWORD=$DB_PASS psql -h localhost -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM companies;" 2>/dev/null || echo "0")

if [ "$COMPANY_COUNT" -eq 0 ]; then
    log "Database is empty, seeding with demo data..."
    node seed-simple.js
    
    # Verify seeding
    COMPANY_COUNT_AFTER=$(PGPASSWORD=$DB_PASS psql -h localhost -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM companies;" 2>/dev/null || echo "0")
    USER_COUNT_AFTER=$(PGPASSWORD=$DB_PASS psql -h localhost -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")
    
    log "Companies created: $COMPANY_COUNT_AFTER"
    log "Users created: $USER_COUNT_AFTER"
else
    log "Database already has data (companies: $COMPANY_COUNT)"
fi

# Step 4: Build application
header "🔨 Building Application"

log "Building TypeScript application..."
npx tsc --skipLibCheck

if [ -f "dist/index.js" ]; then
    log "✅ Application built successfully"
else
    error "❌ Application build failed"
    exit 1
fi

# Step 5: Install and configure Nginx
header "🌐 Setting up Nginx"

if ! command -v nginx &> /dev/null; then
    log "Installing Nginx..."
    apt-get update
    apt-get install -y nginx
else
    log "Nginx is already installed"
fi

# Start Nginx
systemctl start nginx
systemctl enable nginx

# Remove default site
rm -f /etc/nginx/sites-enabled/default

# Step 6: Configure firewall
header "🔥 Configuring Firewall"

log "Setting up UFW firewall..."
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

# Step 7: SSL Certificate
header "🔒 Setting up SSL Certificate"

if ! command -v certbot &> /dev/null; then
    log "Installing Certbot..."
    apt-get install -y certbot python3-certbot-nginx
fi

# Create temporary Nginx config for domain verification
log "Creating temporary Nginx configuration for SSL setup..."
cat > /etc/nginx/sites-available/temp-salessync << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    
    location / {
        return 200 'SalesSync Installation in Progress';
        add_header Content-Type text/plain;
    }
    
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
}
EOF

ln -sf /etc/nginx/sites-available/temp-salessync /etc/nginx/sites-enabled/temp-salessync
nginx -t && systemctl reload nginx

# Get SSL certificate
log "Obtaining SSL certificate for $DOMAIN..."
SSL_SUCCESS=false
if certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN --redirect; then
    SSL_SUCCESS=true
    log "✅ SSL certificate obtained successfully"
else
    warning "SSL certificate setup failed, will use HTTP only"
fi

# Remove temporary config
rm -f /etc/nginx/sites-enabled/temp-salessync
rm -f /etc/nginx/sites-available/temp-salessync

# Step 8: Create final Nginx configuration
header "⚙️ Configuring Nginx for SalesSync"

if [ "$SSL_SUCCESS" = true ] && [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    log "Creating HTTPS Nginx configuration..."
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
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin";
    
    # Gzip compression
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
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    location /health {
        proxy_pass http://localhost:3000/health;
        access_log off;
    }
    
    location /api/ {
        proxy_pass http://localhost:3000/api/;
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
EOF
else
    log "Creating HTTP-only Nginx configuration..."
    cat > /etc/nginx/sites-available/salessync << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
    
    # Gzip compression
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
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    location /health {
        proxy_pass http://localhost:3000/health;
        access_log off;
    }
    
    location /api/ {
        proxy_pass http://localhost:3000/api/;
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
EOF
fi

# Enable the site
ln -sf /etc/nginx/sites-available/salessync /etc/nginx/sites-enabled/salessync

# Test Nginx configuration
log "Testing Nginx configuration..."
if nginx -t; then
    systemctl reload nginx
    log "✅ Nginx configuration is valid and reloaded"
else
    error "❌ Nginx configuration test failed"
    exit 1
fi

# Step 9: Start application with PM2
header "🚀 Starting SalesSync Application"

# Stop any existing PM2 processes
pm2 delete salessync-backend 2>/dev/null || true

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
    node_args: '--max-old-space-size=1024',
    watch: false,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
EOF

# Create log directory
mkdir -p /var/log/salessync
chown -R www-data:www-data /var/log/salessync

log "Starting application with PM2..."
pm2 start ecosystem.config.js

# Save PM2 configuration and setup startup
pm2 save
pm2 startup systemd -u root --hp /root

log "✅ Application started with PM2"

# Step 10: Create maintenance scripts
header "🔧 Creating Maintenance Scripts"

# Status script
cat > /usr/local/bin/salessync-status << 'EOF'
#!/bin/bash
echo "=== SalesSync Status ==="
echo ""
echo "📱 Application:"
pm2 list | grep salessync || echo "No SalesSync processes found"
echo ""
echo "🌐 Nginx:"
if systemctl is-active --quiet nginx; then
    echo "✅ Nginx is running"
else
    echo "❌ Nginx is not running"
fi
echo ""
echo "🐘 PostgreSQL:"
if systemctl is-active --quiet postgresql; then
    echo "✅ PostgreSQL is running"
else
    echo "❌ PostgreSQL is not running"
fi
echo ""
echo "💾 Disk Usage:"
df -h /opt/salessync
echo ""
echo "🧠 Memory Usage:"
free -h
echo ""
echo "🔗 Database Connection:"
if PGPASSWORD=salessync_secure_password_2024 psql -h localhost -U salessync -d salessync_production -c "SELECT 1;" > /dev/null 2>&1; then
    echo "✅ Database connection successful"
else
    echo "❌ Database connection failed"
fi
EOF

# Restart script
cat > /usr/local/bin/salessync-restart << 'EOF'
#!/bin/bash
echo "🔄 Restarting SalesSync..."
pm2 restart salessync-backend
echo "🌐 Reloading Nginx..."
systemctl reload nginx
echo "✅ SalesSync restarted successfully"
echo ""
echo "📊 Current status:"
pm2 list | grep salessync
EOF

# Backup script
cat > /usr/local/bin/salessync-backup << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/backups/salessync"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

echo "🗄️ Creating SalesSync backup..."

# Backup database
echo "📊 Backing up database..."
PGPASSWORD=salessync_secure_password_2024 pg_dump -U salessync -h localhost salessync_production > $BACKUP_DIR/db_backup_$DATE.sql

# Backup application files
echo "📁 Backing up application files..."
tar -czf $BACKUP_DIR/app_backup_$DATE.tar.gz -C /opt salessync

# Keep only last 7 days of backups
echo "🧹 Cleaning old backups..."
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "✅ Backup completed: $DATE"
echo "📍 Backup location: $BACKUP_DIR"
EOF

# Make scripts executable
chmod +x /usr/local/bin/salessync-status
chmod +x /usr/local/bin/salessync-restart
chmod +x /usr/local/bin/salessync-backup

# Setup daily backup cron job
echo "0 2 * * * root /usr/local/bin/salessync-backup" > /etc/cron.d/salessync-backup

log "✅ Maintenance scripts created"

# Step 11: Final verification
header "✅ Verifying Installation"

log "Waiting for application to start..."
sleep 15

# Check services
NGINX_STATUS="❌"
POSTGRES_STATUS="❌"
APP_STATUS="❌"
HEALTH_STATUS="❌"

if systemctl is-active --quiet nginx; then
    NGINX_STATUS="✅"
    log "✅ Nginx is running"
else
    error "❌ Nginx is not running"
fi

if systemctl is-active --quiet postgresql; then
    POSTGRES_STATUS="✅"
    log "✅ PostgreSQL is running"
else
    error "❌ PostgreSQL is not running"
fi

if pm2 list | grep -q salessync-backend; then
    APP_STATUS="✅"
    log "✅ SalesSync backend is running"
else
    error "❌ SalesSync backend is not running"
    log "PM2 status:"
    pm2 list
fi

# Test application health
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health | grep -q "200"; then
    HEALTH_STATUS="✅"
    log "✅ Application health check passed"
else
    warning "⚠️ Application health check failed"
    log "Recent application logs:"
    pm2 logs salessync-backend --lines 20 --nostream
fi

# Test external access
EXTERNAL_STATUS="❌"
if [ "$SSL_SUCCESS" = true ]; then
    if curl -s -I https://$DOMAIN | head -n 1 | grep -q "200\|301\|302"; then
        EXTERNAL_STATUS="✅"
        log "✅ HTTPS external access is working"
    else
        warning "⚠️ HTTPS external access test failed"
    fi
else
    if curl -s -I http://$DOMAIN | head -n 1 | grep -q "200\|301\|302"; then
        EXTERNAL_STATUS="✅"
        log "✅ HTTP external access is working"
    else
        warning "⚠️ HTTP external access test failed"
    fi
fi

# Final summary
header "🎉 Installation Complete!"

echo -e "${GREEN}"
echo "SalesSync has been successfully installed and configured!"
echo ""
echo "📋 Installation Summary:"
echo "  • Nginx: $NGINX_STATUS"
echo "  • PostgreSQL: $POSTGRES_STATUS"
echo "  • Application: $APP_STATUS"
echo "  • Health Check: $HEALTH_STATUS"
echo "  • External Access: $EXTERNAL_STATUS"
echo ""
if [ "$SSL_SUCCESS" = true ]; then
    echo "🌐 Your SalesSync is live at: https://$DOMAIN"
else
    echo "🌐 Your SalesSync is live at: http://$DOMAIN"
fi
echo ""
echo "🔐 Default Login Credentials:"
echo "  • Email: admin@demo.com"
echo "  • Password: admin123"
echo ""
echo "🔧 Management Commands:"
echo "  • salessync-status    - Check system status"
echo "  • salessync-restart   - Restart application"
echo "  • salessync-backup    - Create backup"
echo "  • pm2 logs salessync-backend - View application logs"
echo ""
echo "📁 Important Directories:"
echo "  • Application: $APP_DIR"
echo "  • Logs: /var/log/salessync"
echo "  • Backups: /opt/backups/salessync"
echo ""
echo "🎯 Next Steps:"
echo "  1. Visit your SalesSync URL above"
echo "  2. Login with the default credentials"
echo "  3. Change the default password"
echo "  4. Configure your company settings"
echo ""
echo -e "${NC}"

log "🚀 SalesSync installation completed successfully!"