#!/bin/bash

# SalesSyncAI Production Deployment Script
# For AWS t4g.medium instance (13.247.192.46)
# Ubuntu 22.04 LTS ARM64

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="13.247.192.46"
APP_DIR="/opt/salessync"
DB_NAME="salessync_prod"
DB_USER="salessync_prod"
DB_PASSWORD=$(openssl rand -base64 32)
REDIS_PASSWORD=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 64)

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   error "This script must be run as root (use sudo)"
fi

log "🚀 Starting SalesSyncAI Production Deployment"
log "Target Server: $DOMAIN"
log "Installation Directory: $APP_DIR"

# Update system
log "📦 Updating system packages..."
apt update && apt upgrade -y

# Install essential packages
log "🔧 Installing essential packages..."
apt install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release

# Install Node.js 18 LTS
log "📦 Installing Node.js 18 LTS..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Verify Node.js installation
node_version=$(node --version)
npm_version=$(npm --version)
log "✅ Node.js installed: $node_version"
log "✅ npm installed: $npm_version"

# Install PostgreSQL 15
log "🗄️ Installing PostgreSQL 15..."
apt install -y postgresql postgresql-contrib postgresql-client

# Start and enable PostgreSQL
systemctl start postgresql
systemctl enable postgresql

# Install Redis
log "🔄 Installing Redis..."
apt install -y redis-server

# Configure Redis with password
log "🔒 Configuring Redis security..."
sed -i "s/# requirepass foobared/requirepass $REDIS_PASSWORD/" /etc/redis/redis.conf
sed -i "s/bind 127.0.0.1 ::1/bind 127.0.0.1/" /etc/redis/redis.conf
systemctl restart redis-server
systemctl enable redis-server

# Install Nginx
log "🌐 Installing Nginx..."
apt install -y nginx

# Install PM2 globally
log "⚙️ Installing PM2 process manager..."
npm install -g pm2

# Install Certbot for SSL
log "🔐 Installing Certbot for SSL certificates..."
apt install -y certbot python3-certbot-nginx

# Create application directory
log "📁 Creating application directory..."
mkdir -p $APP_DIR
cd $APP_DIR

# Clone repository
log "📥 Cloning SalesSyncAI repository..."
if [ -d ".git" ]; then
    git pull origin main
else
    git clone https://github.com/Reshigan/SalesSyncAI.git .
fi

# Setup PostgreSQL database
log "🗄️ Setting up PostgreSQL database..."
sudo -u postgres psql << EOF
CREATE DATABASE $DB_NAME;
CREATE USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
ALTER USER $DB_USER CREATEDB;
\q
EOF

# Configure PostgreSQL for production
log "🔒 Configuring PostgreSQL for production..."
PG_VERSION=$(sudo -u postgres psql -t -c "SELECT version();" | grep -oP '\d+\.\d+' | head -1)
PG_CONFIG_DIR="/etc/postgresql/$PG_VERSION/main"

# Update PostgreSQL configuration
cat >> $PG_CONFIG_DIR/postgresql.conf << EOF

# Production optimizations
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 4MB
min_wal_size = 1GB
max_wal_size = 4GB
max_connections = 200
EOF

# Update pg_hba.conf for local connections
sed -i "s/#listen_addresses = 'localhost'/listen_addresses = 'localhost'/" $PG_CONFIG_DIR/postgresql.conf

# Restart PostgreSQL
systemctl restart postgresql

# Setup backend
log "🔧 Setting up backend..."
cd $APP_DIR/backend

# Install backend dependencies
npm ci --only=production

# Create production environment file
cat > .env << EOF
NODE_ENV=production
PORT=3000
DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME?schema=public"
REDIS_URL="redis://localhost:6379"
REDIS_PASSWORD="$REDIS_PASSWORD"
JWT_SECRET="$JWT_SECRET"
JWT_EXPIRES_IN="7d"
CORS_ORIGIN="http://$DOMAIN,https://$DOMAIN"
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
LOG_LEVEL="info"
UPLOAD_MAX_SIZE=10485760
ALLOWED_FILE_TYPES="image/jpeg,image/png,image/gif,application/pdf"
EOF

# Generate Prisma client
npx prisma generate

# Run database migrations
log "🗄️ Running database migrations..."
npx prisma migrate deploy

# Seed database with production data
log "🌱 Seeding database with demo data..."
npm run seed

# Build backend
log "🔨 Building backend..."
npm run build

# Setup frontend
log "🎨 Setting up frontend..."
cd $APP_DIR/frontend

# Install frontend dependencies
npm ci --only=production

# Create production environment file
cat > .env.production << EOF
REACT_APP_API_URL=http://$DOMAIN/api
REACT_APP_APP_NAME="SalesSync AI"
REACT_APP_VERSION="1.0.0"
GENERATE_SOURCEMAP=false
EOF

# Build frontend
log "🔨 Building frontend for production..."
npm run build

# Setup Nginx configuration
log "🌐 Configuring Nginx..."
cat > /etc/nginx/sites-available/salessync << EOF
server {
    listen 80;
    server_name $DOMAIN;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript;
    
    # Frontend static files
    location / {
        root $APP_DIR/frontend/build;
        index index.html index.htm;
        try_files \$uri \$uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # API proxy
    location /api {
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
    
    # Health check endpoint
    location /health {
        proxy_pass http://localhost:3000/health;
        access_log off;
    }
    
    # File uploads
    client_max_body_size 10M;
    
    # Logs
    access_log /var/log/nginx/salessync_access.log;
    error_log /var/log/nginx/salessync_error.log;
}
EOF

# Enable the site
ln -sf /etc/nginx/sites-available/salessync /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
nginx -t || error "Nginx configuration test failed"

# Setup PM2 ecosystem file
log "⚙️ Setting up PM2 process management..."
cat > $APP_DIR/ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'salessync-backend',
    script: './backend/dist/index.js',
    cwd: '$APP_DIR',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '$APP_DIR/logs/backend-error.log',
    out_file: '$APP_DIR/logs/backend-out.log',
    log_file: '$APP_DIR/logs/backend-combined.log',
    time: true,
    max_memory_restart: '500M',
    node_args: '--max-old-space-size=512',
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
EOF

# Create logs directory
mkdir -p $APP_DIR/logs

# Setup firewall
log "🔥 Configuring firewall..."
ufw --force enable
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp

# Setup log rotation
log "📝 Setting up log rotation..."
cat > /etc/logrotate.d/salessync << EOF
$APP_DIR/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 root root
    postrotate
        pm2 reloadLogs
    endscript
}
EOF

# Create systemd service for PM2
log "🔄 Setting up PM2 systemd service..."
pm2 startup systemd -u root --hp /root

# Start services
log "🚀 Starting services..."
cd $APP_DIR

# Start backend with PM2
pm2 start ecosystem.config.js
pm2 save

# Start Nginx
systemctl restart nginx
systemctl enable nginx

# Create deployment info file
cat > $APP_DIR/deployment-info.txt << EOF
SalesSyncAI Production Deployment
================================

Deployment Date: $(date)
Server: $DOMAIN
Installation Directory: $APP_DIR

Database Configuration:
- Database: $DB_NAME
- User: $DB_USER
- Password: $DB_PASSWORD

Redis Configuration:
- Password: $REDIS_PASSWORD

JWT Configuration:
- Secret: $JWT_SECRET

Services:
- Backend: PM2 managed Node.js application on port 3000
- Frontend: Static files served by Nginx
- Database: PostgreSQL 15
- Cache: Redis with authentication
- Web Server: Nginx reverse proxy

URLs:
- Application: http://$DOMAIN
- API: http://$DOMAIN/api
- Health Check: http://$DOMAIN/health

Log Files:
- Backend: $APP_DIR/logs/
- Nginx: /var/log/nginx/salessync_*.log
- PostgreSQL: /var/log/postgresql/
- Redis: /var/log/redis/

Management Commands:
- View backend logs: pm2 logs salessync-backend
- Restart backend: pm2 restart salessync-backend
- View PM2 status: pm2 status
- Restart Nginx: systemctl restart nginx
- Check services: systemctl status postgresql redis-server nginx

Security:
- Firewall configured (UFW)
- Database password protected
- Redis password protected
- Security headers configured in Nginx
EOF

# Set proper permissions
chown -R root:root $APP_DIR
chmod -R 755 $APP_DIR
chmod 600 $APP_DIR/backend/.env
chmod 600 $APP_DIR/deployment-info.txt

log "✅ Basic deployment completed!"
log ""
log "🔐 Next steps for SSL (recommended):"
log "1. Point your domain to this server's IP: $DOMAIN"
log "2. Run: certbot --nginx -d $DOMAIN"
log ""
log "📊 To seed the database with demo data:"
log "cd $APP_DIR/backend && npm run seed"
log ""
log "🌐 Your application is available at:"
log "http://$DOMAIN"
log ""
log "📋 Deployment information saved to: $APP_DIR/deployment-info.txt"
log ""
log "🔍 Check service status:"
log "pm2 status"
log "systemctl status nginx postgresql redis-server"

# Final service status check
log "🔍 Final service status check..."
pm2 status
systemctl is-active --quiet nginx && log "✅ Nginx is running" || warning "❌ Nginx is not running"
systemctl is-active --quiet postgresql && log "✅ PostgreSQL is running" || warning "❌ PostgreSQL is not running"
systemctl is-active --quiet redis-server && log "✅ Redis is running" || warning "❌ Redis is not running"

log "🎉 SalesSyncAI production deployment completed successfully!"