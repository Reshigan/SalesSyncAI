#!/bin/bash

# 🔧 Fix Existing Database Setup
# This script handles the case where database user already exists

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

log "🔧 Fixing existing database setup..."

# Update the existing user's password and permissions
log "Updating existing database user permissions..."
sudo -u postgres psql -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASS';" || true
sudo -u postgres psql -c "ALTER USER $DB_USER CREATEDB;" || true
sudo -u postgres psql -c "ALTER USER $DB_USER SUPERUSER;" || true

# Drop and recreate database to ensure clean state
log "Recreating database for clean state..."
sudo -u postgres psql -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null || true
sudo -u postgres createdb -O $DB_USER $DB_NAME

# Grant permissions
log "Setting up database permissions..."
sudo -u postgres psql -d $DB_NAME -c "GRANT ALL ON SCHEMA public TO $DB_USER;" || true
sudo -u postgres psql -d $DB_NAME -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;" || true
sudo -u postgres psql -d $DB_NAME -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;" || true

# Test connection with user
log "Testing connection with database user..."
if ! PGPASSWORD=$DB_PASS psql -h localhost -U $DB_USER -d $DB_NAME -c "SELECT 1;" > /dev/null 2>&1; then
    error "Cannot connect with user credentials"
    exit 1
fi

log "✅ Database user and database ready"

# Now continue with the application setup
log "🚀 Setting up SalesSync application..."

cd $APP_DIR/backend

# Set environment variable
export DATABASE_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME"

log "Generating Prisma client..."
npx prisma generate

log "Pushing database schema..."
npx prisma db push --force-reset --accept-data-loss

# Verify tables were created
log "Verifying tables were created..."
TABLES_COUNT=$(PGPASSWORD=$DB_PASS psql -h localhost -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null || echo "0")
log "Tables created: $TABLES_COUNT"

if [ "$TABLES_COUNT" -eq 0 ]; then
    error "No tables were created. Schema push failed."
    exit 1
fi

# List created tables
log "Created tables:"
PGPASSWORD=$DB_PASS psql -h localhost -U $DB_USER -d $DB_NAME -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"

# Check if companies table exists
COMPANIES_EXISTS=$(PGPASSWORD=$DB_PASS psql -h localhost -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'companies';" 2>/dev/null || echo "0")

if [ "$COMPANIES_EXISTS" -eq 0 ]; then
    error "Companies table was not created"
    exit 1
fi

log "✅ Companies table exists"

# Seed the database
log "Seeding database with demo data..."
node seed-simple.js

# Verify seeded data
log "Verifying seeded data..."
COMPANY_COUNT=$(PGPASSWORD=$DB_PASS psql -h localhost -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM companies;" 2>/dev/null || echo "0")
USER_COUNT=$(PGPASSWORD=$DB_PASS psql -h localhost -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")

log "Companies in database: $COMPANY_COUNT"
log "Users in database: $USER_COUNT"

# Build the application
log "Building TypeScript application..."
npx tsc --skipLibCheck

if [ -f "dist/index.js" ]; then
    log "✅ Application built successfully"
else
    error "❌ Application build failed"
    exit 1
fi

# Now set up the web server and complete installation
log "🌐 Setting up Nginx and completing installation..."

# Install Nginx if not installed
if ! command -v nginx &> /dev/null; then
    log "Installing Nginx..."
    apt-get update
    apt-get install -y nginx
fi

# Start Nginx
systemctl start nginx
systemctl enable nginx

# Configure firewall
log "Configuring firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 22
ufw allow 80
ufw allow 443
ufw allow from 127.0.0.1 to any port 5432
ufw --force enable

# Install SSL certificate
if ! command -v certbot &> /dev/null; then
    log "Installing Certbot..."
    apt-get install -y certbot python3-certbot-nginx
fi

# Remove default site
rm -f /etc/nginx/sites-enabled/default

# Create temporary Nginx config for SSL
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
log "Obtaining SSL certificate..."
certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN --redirect || {
    warning "SSL certificate setup failed, continuing without SSL"
}

# Remove temporary config
rm -f /etc/nginx/sites-enabled/temp-salessync
rm -f /etc/nginx/sites-available/temp-salessync

# Create final Nginx configuration
log "Creating final Nginx configuration..."

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
    log "No SSL certificates, creating HTTP configuration..."
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

# Test and reload Nginx
nginx -t && systemctl reload nginx

# Start application with PM2
log "Starting application with PM2..."

# Create PM2 ecosystem file
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

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root

# Create maintenance scripts
log "Creating maintenance scripts..."

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
EOF

cat > /usr/local/bin/salessync-restart << 'EOF'
#!/bin/bash
echo "Restarting SalesSync..."
pm2 restart salessync-backend
systemctl reload nginx
echo "SalesSync restarted successfully"
EOF

chmod +x /usr/local/bin/salessync-status
chmod +x /usr/local/bin/salessync-restart

# Final verification
log "🔍 Verifying installation..."

sleep 10

# Check services
if systemctl is-active --quiet nginx; then
    log "✅ Nginx is running"
else
    error "❌ Nginx is not running"
fi

if systemctl is-active --quiet postgresql; then
    log "✅ PostgreSQL is running"
else
    error "❌ PostgreSQL is not running"
fi

if pm2 list | grep -q salessync-backend; then
    log "✅ SalesSync backend is running"
else
    error "❌ SalesSync backend is not running"
fi

# Test application
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health | grep -q "200"; then
    log "✅ Application health check passed"
else
    warning "⚠️ Application health check failed"
    pm2 logs salessync-backend --lines 10
fi

# Final success message
echo ""
echo "🎉 SalesSync Installation Complete!"
echo ""
if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    echo "🌐 Your SalesSync is live at: https://$DOMAIN"
else
    echo "🌐 Your SalesSync is live at: http://$DOMAIN"
fi
echo ""
echo "🔐 Default Login:"
echo "  • Email: admin@demo.com"
echo "  • Password: admin123"
echo ""
echo "🔧 Management Commands:"
echo "  • salessync-status"
echo "  • salessync-restart"
echo "  • pm2 logs salessync-backend"
echo ""

log "✅ Installation completed successfully!"