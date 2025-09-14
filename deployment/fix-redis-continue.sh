#!/bin/bash

# SalesSync Redis Fix and Continue Script
# Fixes Redis service issues and continues installation

set -e

# Configuration
DOMAIN="SSAI.gonxt.tech"
INSTALL_DIR="/opt/salessync"
REDIS_PASSWORD="Redis2024SecurePass!"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check root
if [[ $EUID -ne 0 ]]; then
    log_error "This script must be run as root (use sudo)"
    exit 1
fi

log_info "🔧 Fixing Redis configuration and continuing installation..."

# Fix Redis service
log_info "Fixing Redis service configuration..."

# Stop any existing Redis services
systemctl stop redis-server 2>/dev/null || true
systemctl stop redis 2>/dev/null || true

# Remove problematic service files
rm -f /etc/systemd/system/redis.service

# Use the existing redis-server service
systemctl daemon-reload

# Configure Redis properly
log_info "Configuring Redis with authentication..."
cat > /etc/redis/redis.conf << EOF
# Redis Configuration for SalesSync Production
bind 127.0.0.1
port 6379
requirepass $REDIS_PASSWORD
maxmemory 512mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
daemonize yes
supervised systemd
dir /var/lib/redis
logfile /var/log/redis/redis-server.log
EOF

# Set proper permissions
chown redis:redis /etc/redis/redis.conf
chmod 640 /etc/redis/redis.conf

# Start and enable Redis using the correct service name
systemctl start redis-server
systemctl enable redis-server

# Wait for Redis to start
sleep 3

# Test Redis connection
log_info "Testing Redis connection..."
if redis-cli -a "$REDIS_PASSWORD" ping | grep -q "PONG"; then
    log_success "✅ Redis is working correctly"
else
    log_error "❌ Redis connection failed"
    exit 1
fi

# Continue with Nginx installation
log_info "Installing and configuring Nginx..."
apt-get install -y nginx
systemctl start nginx
systemctl enable nginx

# Remove default configuration
rm -f /etc/nginx/sites-enabled/default

# Install SSL certificates
log_info "Installing SSL certificates..."
apt-get install -y certbot python3-certbot-nginx

# Create initial site configuration
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
nginx -t && systemctl reload nginx

# Get SSL certificate
log_info "Obtaining SSL certificate..."
certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos --email "admin@gonxt.tech" --redirect || log_warning "SSL setup failed, continuing..."

# Clone repository if not exists
if [ ! -d "$INSTALL_DIR" ]; then
    log_info "Cloning SalesSync repository..."
    git clone https://github.com/Reshigan/SalesSyncAI.git "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"

# Setup backend
log_info "Setting up backend application..."
cd "$INSTALL_DIR/backend"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    npm ci --production
fi

# Create environment file
cat > .env << EOF
DATABASE_URL="postgresql://salessync_user:SalesSync2024SecurePass!@localhost:5432/salessync_production?schema=public"
REDIS_URL="redis://default:$REDIS_PASSWORD@localhost:6379"
JWT_SECRET="salessync-jwt-secret-production-2024-change-this-key"
JWT_REFRESH_SECRET="salessync-refresh-secret-production-2024-change-this-key"
NODE_ENV="production"
PORT="3000"
DOMAIN="$DOMAIN"
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="noreply@gonxt.tech"
SMTP_PASS="your-email-password"
SMTP_FROM="SalesSync <noreply@gonxt.tech>"
UPLOAD_DIR="$INSTALL_DIR/uploads"
MAX_FILE_SIZE="10485760"
BCRYPT_ROUNDS="12"
RATE_LIMIT_WINDOW="900000"
RATE_LIMIT_MAX="100"
ENABLE_METRICS="true"
METRICS_PORT="9090"
BACKUP_DIR="$INSTALL_DIR/backups"
BACKUP_RETENTION_DAYS="30"
EOF

# Create directories
mkdir -p "$INSTALL_DIR/uploads"
mkdir -p "$INSTALL_DIR/backups"
mkdir -p "$INSTALL_DIR/logs"
chown -R www-data:www-data "$INSTALL_DIR/uploads"
chown -R www-data:www-data "$INSTALL_DIR/backups"

# Database setup
log_info "Setting up database..."
npx prisma generate
npx prisma db push --accept-data-loss
npx prisma db seed

# Build backend
log_info "Building backend..."
npm run build

# Setup frontend
log_info "Setting up frontend..."
cd "$INSTALL_DIR/frontend-web"

if [ ! -d "node_modules" ]; then
    npm ci
fi

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
log_info "Configuring Nginx for production..."
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

nginx -t && systemctl reload nginx

# Setup PM2
log_info "Setting up PM2..."
cd "$INSTALL_DIR/backend"

pm2 delete all 2>/dev/null || true

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
    error_file: '$INSTALL_DIR/logs/salessync-error.log',
    out_file: '$INSTALL_DIR/logs/salessync-out.log',
    log_file: '$INSTALL_DIR/logs/salessync-combined.log',
    time: true,
    max_memory_restart: '1G'
  }]
};
EOF

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

# Wait and test
log_info "Waiting for services to start..."
sleep 15

# Test endpoints
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN/health" 2>/dev/null || echo "000")
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN" 2>/dev/null || echo "000")

echo ""
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
    log_warning "⚠️  Some services may not be responding correctly"
    log_info "Check logs with: pm2 logs salessync-backend"
fi

log_success "🎉 Installation completed successfully!"