#!/bin/bash

# SalesSync Continue Installation Script
# For when the main script gets stuck or needs to continue

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
YELLOW='\033[1;33m'
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

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check root
if [[ $EUID -ne 0 ]]; then
    log_error "This script must be run as root (use sudo)"
    exit 1
fi

log_info "🔄 Continuing SalesSync Installation..."

# Skip system updates and package installation since they're done
log_info "Skipping system package installation (already done)..."

# Configure Redis (fix any configuration issues)
log_info "Configuring Redis..."
systemctl stop redis-server || true

# Create a clean Redis config
cat > /etc/redis/redis.conf << EOF
bind 127.0.0.1
port 6379
requirepass $REDIS_PASSWORD
maxmemory 256mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
daemonize yes
supervised systemd
dir /var/lib/redis
logfile /var/log/redis/redis-server.log
EOF

systemctl start redis-server
systemctl enable redis-server

# Test Redis
log_info "Testing Redis connection..."
if redis-cli -a "$REDIS_PASSWORD" ping > /dev/null 2>&1; then
    log_success "Redis is working correctly"
else
    log_error "Redis connection failed"
    exit 1
fi

# Ensure PostgreSQL is running
log_info "Ensuring PostgreSQL is running..."
systemctl start postgresql
systemctl enable postgresql

# Test database connection
log_info "Testing database connection..."
if sudo -u postgres psql -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
    log_success "Database connection working"
else
    log_error "Database connection failed"
    exit 1
fi

# Install/Configure Nginx
log_info "Configuring Nginx..."
systemctl start nginx
systemctl enable nginx

# Remove default site
rm -f /etc/nginx/sites-enabled/default

# Create basic Nginx config for SSL
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

# Install SSL if not already done
log_info "Setting up SSL certificates..."
if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    log_info "Installing SSL certificate..."
    certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@gonxt.tech
else
    log_success "SSL certificate already exists"
fi

# Clone/Update repository
log_info "Setting up SalesSync repository..."
if [ -d "$INSTALL_DIR" ]; then
    log_info "Updating existing repository..."
    cd $INSTALL_DIR
    git pull origin main
else
    log_info "Cloning repository..."
    git clone $GITHUB_REPO $INSTALL_DIR
    cd $INSTALL_DIR
fi

# Setup backend
log_info "Setting up backend application..."
cd $INSTALL_DIR/backend

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    log_info "Installing backend dependencies..."
    npm ci --production
fi

# Create/update environment file
log_info "Creating environment configuration..."
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

# Create directories
mkdir -p /opt/salessync/uploads
mkdir -p /opt/salessync/backups
chown -R www-data:www-data /opt/salessync/uploads
chown -R www-data:www-data /opt/salessync/backups

# Database setup
log_info "Setting up database schema..."
npx prisma generate
npx prisma db push --accept-data-loss
log_info "Seeding database with TestCompany data..."
npx prisma db seed

# Build backend
log_info "Building backend application..."
npm run build

# Setup frontend
log_info "Setting up frontend application..."
cd $INSTALL_DIR/frontend-web

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    log_info "Installing frontend dependencies..."
    npm ci
fi

# Create environment file
cat > .env << EOF
REACT_APP_API_URL=https://$DOMAIN/api
REACT_APP_DOMAIN=$DOMAIN
REACT_APP_VERSION=1.0.0
REACT_APP_ENVIRONMENT=production
EOF

# Build frontend
log_info "Building frontend application..."
npm run build

# Deploy frontend
log_info "Deploying frontend..."
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
    
    # Security headers
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    
    root /var/www/html;
    index index.html;
    
    # API routes
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
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Health check
    location /health {
        proxy_pass http://backend;
        access_log off;
    }
    
    # Frontend routes
    location / {
        try_files \$uri \$uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)\$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # Security - deny access to sensitive files
    location ~ /\. {
        deny all;
    }
    
    location ~ \.(env|log|sql)\$ {
        deny all;
    }
}
EOF

# Test and reload Nginx
nginx -t
systemctl reload nginx

# Setup PM2
log_info "Setting up PM2 process manager..."
cd $INSTALL_DIR/backend

# Stop any existing PM2 processes
pm2 delete salessync-backend 2>/dev/null || true

# Create PM2 ecosystem file
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
    max_memory_restart: '1G',
    watch: false,
    ignore_watch: ['node_modules', 'logs', 'uploads'],
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
EOF

# Create PM2 log directory
mkdir -p /var/log/pm2

# Start application
log_info "Starting SalesSync application..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root

# Setup basic firewall
log_info "Configuring firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Wait for services to start
log_info "Waiting for services to initialize..."
sleep 15

# Test the application
log_info "Testing application endpoints..."

# Test health endpoint
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN/health" 2>/dev/null || echo "000")
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN" 2>/dev/null || echo "000")

# Display results
echo ""
log_success "🎉 SalesSync installation completed!"
echo ""
echo "🌐 Application URLs:"
echo "   Frontend:        https://$DOMAIN"
echo "   Backend API:     https://$DOMAIN/api"
echo "   Health Check:    https://$DOMAIN/health"
echo "   API Docs:        https://$DOMAIN/api/docs"
echo ""
echo "🔐 Login Credentials:"
echo "   Super Admin:     superadmin@salessync.com / SuperAdmin123!"
echo "   Company Admin:   admin@testcompany.com / Admin123!"
echo "   Manager:         manager@testcompany.com / Manager123!"
echo "   Field Agent:     agent@testcompany.com / Agent123!"
echo "   Marketing:       marketing@testcompany.com / Marketing123!"
echo ""
echo "📊 Health Status:"
echo "   Health Endpoint: HTTP $HEALTH_STATUS"
echo "   Frontend:        HTTP $FRONTEND_STATUS"
echo ""
echo "🛠️ Management Commands:"
echo "   pm2 status                    # View application status"
echo "   pm2 logs salessync-backend    # View logs"
echo "   pm2 restart salessync-backend # Restart application"
echo "   pm2 monit                     # Monitor performance"
echo ""

if [ "$HEALTH_STATUS" = "200" ] && [ "$FRONTEND_STATUS" = "200" ]; then
    log_success "✅ All services are running correctly!"
    log_success "🚀 SalesSync is ready for production use!"
    echo ""
    echo "🎯 Next Steps:"
    echo "1. Visit https://$DOMAIN to access the application"
    echo "2. Login with the credentials above"
    echo "3. Explore the TestCompany sample data"
    echo "4. Configure your own company settings"
    echo ""
else
    log_warning "⚠️  Some services may not be responding correctly"
    echo ""
    echo "🔍 Troubleshooting:"
    echo "1. Check PM2 logs: pm2 logs salessync-backend"
    echo "2. Check Nginx logs: sudo tail -f /var/log/nginx/error.log"
    echo "3. Test backend directly: curl http://localhost:3000/health"
    echo "4. Check SSL certificate: sudo certbot certificates"
    echo ""
fi

log_success "🎉 Installation process completed!"