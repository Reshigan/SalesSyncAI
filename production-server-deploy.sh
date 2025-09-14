#!/bin/bash

# SalesSyncAI Production Server Deployment Script
# Single command deployment for production servers
# Run this script directly on your production server

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
HOME_DIR="$HOME"
APP_DIR="$HOME_DIR/salessync-prod"
DB_NAME="salessync_prod"
DB_USER="salessync_prod"
DB_PASSWORD=$(openssl rand -base64 32 2>/dev/null || echo "salessync_secure_$(date +%s)")
REDIS_PASSWORD=$(openssl rand -base64 32 2>/dev/null || echo "redis_secure_$(date +%s)")
JWT_SECRET=$(openssl rand -base64 64 2>/dev/null || echo "jwt_secret_$(date +%s)_$(whoami)")
DOMAIN=${DOMAIN:-$(curl -s ifconfig.me 2>/dev/null || echo "localhost")}

# Logging functions
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

section() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}========================================${NC}"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
    info "Running as root - will use direct system commands"
    SUDO=""
else
    info "Running as user: $(whoami) - will use sudo for system operations"
    SUDO="sudo"
fi

section "🚀 SALESSYNC PRODUCTION SERVER DEPLOYMENT"
log "This script will deploy SalesSyncAI to your production server"
log ""
log "📍 Installation Directory: $APP_DIR"
log "🌐 Domain/IP: $DOMAIN"
log "👤 User: $(whoami)"
log "🏠 Home: $HOME_DIR"
log ""
log "🔧 What will be installed:"
log "  - Node.js 20 LTS"
log "  - PostgreSQL with secure database"
log "  - Redis with authentication"
log "  - Nginx reverse proxy"
log "  - PM2 process manager"
log "  - SalesSyncAI application"
log ""

# Ask for confirmation
read -p "Do you want to proceed with the deployment? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log "Deployment cancelled."
    exit 0
fi

section "🧹 CLEANUP: Removing Old Installations"

log "🔍 Cleaning up any existing installations..."

# Function to safely remove directories
safe_remove() {
    local dir="$1"
    local description="$2"
    
    if [ -d "$dir" ]; then
        warning "Found existing $description at: $dir"
        log "🗑️ Removing $description..."
        
        # Stop any running services first
        if [ -f "$dir/ecosystem.config.js" ] || [ -f "$dir/backend/ecosystem.config.js" ]; then
            pm2 delete all 2>/dev/null || true
            pm2 kill 2>/dev/null || true
        fi
        
        # Stop any Docker containers
        if [ -f "$dir/docker-compose.yml" ] || [ -f "$dir/docker-compose.prod.yml" ]; then
            cd "$dir" && docker-compose down 2>/dev/null || true
            cd "$dir" && docker-compose -f docker-compose.prod.yml down 2>/dev/null || true
        fi
        
        # Remove the directory
        if [[ "$dir" == /opt/* ]] || [[ "$dir" == /root/* ]]; then
            $SUDO rm -rf "$dir" 2>/dev/null || warning "Could not remove $dir"
        else
            rm -rf "$dir" 2>/dev/null || warning "Could not remove $dir"
        fi
        
        log "✅ Removed $description"
    fi
}

# Clean up common installation locations
safe_remove "/opt/salessync" "SalesSync in /opt/salessync"
safe_remove "/opt/SalesSyncAI" "SalesSyncAI in /opt/SalesSyncAI"
safe_remove "/root/salessync" "SalesSync in /root/salessync"
safe_remove "/root/SalesSyncAI" "SalesSyncAI in /root/SalesSyncAI"
safe_remove "$APP_DIR" "Previous home installation"

# Clean up PM2 and Nginx
pm2 delete all 2>/dev/null || true
pm2 kill 2>/dev/null || true
$SUDO rm -f /etc/nginx/sites-enabled/salessync* 2>/dev/null || true
$SUDO rm -f /etc/nginx/sites-available/salessync* 2>/dev/null || true

section "📦 SYSTEM SETUP: Installing Dependencies"

# Set environment variables to avoid prompts
export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=a
export NEEDRESTART_SUSPEND=1

# Update system
log "📦 Updating system packages..."
$SUDO apt-get update > /dev/null 2>&1

# Install essential packages
log "🔧 Installing essential packages..."
$SUDO apt-get install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release build-essential > /dev/null 2>&1

# Install Node.js 20 LTS
log "📦 Installing Node.js 20 LTS..."
if ! command -v node &> /dev/null || [[ $(node --version | sed 's/v\([0-9]*\).*/\1/') -lt 18 ]]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO bash - > /dev/null 2>&1
    $SUDO apt-get install -y nodejs > /dev/null 2>&1
fi

node_version=$(node --version)
npm_version=$(npm --version)
log "✅ Node.js: $node_version, npm: $npm_version"

# Install PostgreSQL
log "🗄️ Installing PostgreSQL..."
if ! command -v psql &> /dev/null; then
    $SUDO apt-get install -y postgresql postgresql-contrib postgresql-client > /dev/null 2>&1
fi
$SUDO systemctl start postgresql
$SUDO systemctl enable postgresql

# Install Redis
log "🔄 Installing Redis..."
if ! command -v redis-cli &> /dev/null; then
    $SUDO apt-get install -y redis-server > /dev/null 2>&1
fi
$SUDO systemctl start redis-server
$SUDO systemctl enable redis-server

# Install Nginx
log "🌐 Installing Nginx..."
if ! command -v nginx &> /dev/null; then
    $SUDO apt-get install -y nginx > /dev/null 2>&1
fi
$SUDO systemctl start nginx
$SUDO systemctl enable nginx

# Install PM2
log "⚙️ Installing PM2..."
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2 > /dev/null 2>&1
fi

section "🏗️ APPLICATION SETUP: Deploying SalesSyncAI"

# Create application directory
log "📁 Creating application directory..."
mkdir -p "$APP_DIR"
cd "$APP_DIR"

# Clone repository
log "📥 Cloning SalesSyncAI repository..."
git clone https://github.com/Reshigan/SalesSyncAI.git . > /dev/null 2>&1

# Wait for PostgreSQL to be ready
log "⏳ Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
    if $SUDO -u postgres psql -c "SELECT 1;" > /dev/null 2>&1; then
        break
    fi
    if [ $i -eq 30 ]; then
        error "PostgreSQL failed to start"
    fi
    sleep 2
done

# Setup database
log "🗄️ Setting up database..."
$SUDO -u postgres psql -c "DROP DATABASE IF EXISTS $DB_NAME;" > /dev/null 2>&1 || true
$SUDO -u postgres psql -c "DROP USER IF EXISTS $DB_USER;" > /dev/null 2>&1 || true
$SUDO -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" > /dev/null 2>&1
$SUDO -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" > /dev/null 2>&1
$SUDO -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" > /dev/null 2>&1

# Configure Redis
log "🔒 Configuring Redis..."
$SUDO sed -i "s/# requirepass foobared/requirepass $REDIS_PASSWORD/" /etc/redis/redis.conf 2>/dev/null || true
$SUDO systemctl restart redis-server

# Setup backend
log "🔧 Setting up backend..."
cd "$APP_DIR/backend"
npm ci --only=production > /dev/null 2>&1

# Create environment file
cat > .env << EOF
NODE_ENV=production
PORT=3000
DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME?schema=public"
REDIS_URL="redis://localhost:6379"
REDIS_PASSWORD="$REDIS_PASSWORD"
JWT_SECRET="$JWT_SECRET"
JWT_EXPIRES_IN="7d"
CORS_ORIGIN="http://$DOMAIN,https://$DOMAIN,http://localhost:3000"
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
LOG_LEVEL="info"
UPLOAD_MAX_SIZE=10485760
ALLOWED_FILE_TYPES="image/jpeg,image/png,image/gif,application/pdf"
EOF

# Setup database schema
log "🗄️ Setting up database schema..."
npx prisma generate > /dev/null 2>&1
npx prisma db push > /dev/null 2>&1
npm run seed > /dev/null 2>&1 || warning "Seeding completed with warnings"

# Build backend if possible
if npm run | grep -q "build"; then
    log "🔨 Building backend..."
    npm run build > /dev/null 2>&1
fi

# Setup frontend
log "🎨 Setting up frontend..."
cd "$APP_DIR/frontend"
npm ci --only=production > /dev/null 2>&1

# Create frontend environment
cat > .env.production << EOF
REACT_APP_API_URL=http://$DOMAIN/api
REACT_APP_APP_NAME="SalesSync AI"
REACT_APP_VERSION="1.0.0"
GENERATE_SOURCEMAP=false
EOF

# Build frontend
log "🔨 Building frontend..."
npm run build > /dev/null 2>&1

section "🌐 SERVICE CONFIGURATION"

# Configure Nginx
log "🌐 Configuring Nginx..."
$SUDO tee /etc/nginx/sites-available/salessync > /dev/null << EOF
server {
    listen 80;
    server_name $DOMAIN localhost;
    
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
    gzip_types text/plain text/css text/xml text/javascript application/javascript;
    
    # Frontend
    location / {
        root $APP_DIR/frontend/build;
        index index.html;
        try_files \$uri \$uri/ /index.html;
        
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # API
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
    }
    
    # Health check
    location /health {
        proxy_pass http://localhost:3000/health;
        access_log off;
    }
    
    client_max_body_size 10M;
}
EOF

# Enable site
$SUDO ln -sf /etc/nginx/sites-available/salessync /etc/nginx/sites-enabled/
$SUDO rm -f /etc/nginx/sites-enabled/default
$SUDO nginx -t

# Setup PM2
log "⚙️ Setting up PM2..."
cd "$APP_DIR"
mkdir -p logs

cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'salessync-backend',
    script: './backend/src/index.js',
    cwd: '$APP_DIR',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '$APP_DIR/logs/error.log',
    out_file: '$APP_DIR/logs/out.log',
    log_file: '$APP_DIR/logs/combined.log',
    time: true,
    max_memory_restart: '500M',
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
EOF

section "🚀 STARTING SERVICES"

# Start services
log "🚀 Starting all services..."

# Start backend
pm2 start ecosystem.config.js > /dev/null 2>&1
pm2 save > /dev/null 2>&1

# Setup PM2 startup
if [[ $EUID -eq 0 ]]; then
    pm2 startup systemd -u root --hp /root > /dev/null 2>&1 || true
else
    $SUDO env PATH=$PATH:/usr/bin pm2 startup systemd -u $(whoami) --hp $HOME > /dev/null 2>&1 || true
fi

# Restart Nginx
$SUDO systemctl restart nginx

# Setup firewall if available
if command -v ufw &> /dev/null; then
    log "🔥 Configuring firewall..."
    $SUDO ufw --force enable 2>/dev/null || true
    $SUDO ufw allow ssh 2>/dev/null || true
    $SUDO ufw allow 80/tcp 2>/dev/null || true
    $SUDO ufw allow 443/tcp 2>/dev/null || true
fi

# Create deployment info
cat > "$APP_DIR/deployment-info.txt" << EOF
SalesSyncAI Production Deployment
================================

Deployment Date: $(date)
Server IP/Domain: $DOMAIN
Installation Directory: $APP_DIR
User: $(whoami)

Database:
- Name: $DB_NAME
- User: $DB_USER
- Password: $DB_PASSWORD

Redis Password: $REDIS_PASSWORD
JWT Secret: $JWT_SECRET

URLs:
- Application: http://$DOMAIN
- API: http://$DOMAIN/api
- Health: http://$DOMAIN/health

Management:
- PM2 Status: pm2 status
- PM2 Logs: pm2 logs salessync-backend
- Restart: pm2 restart salessync-backend
- Nginx: sudo systemctl restart nginx

Services:
- Backend: PM2 (port 3000)
- Frontend: Nginx static files
- Database: PostgreSQL
- Cache: Redis
- Proxy: Nginx
EOF

chmod 600 "$APP_DIR/deployment-info.txt"

section "✅ DEPLOYMENT COMPLETED!"

log ""
log "🎉 SalesSyncAI has been successfully deployed!"
log ""
log "📍 Installation Details:"
log "  📁 Directory: $APP_DIR"
log "  🌐 URL: http://$DOMAIN"
log "  🔗 API: http://$DOMAIN/api"
log "  ❤️ Health: http://$DOMAIN/health"
log ""
log "🔧 Management Commands:"
log "  📊 Status: pm2 status"
log "  📋 Logs: pm2 logs salessync-backend"
log "  🔄 Restart: pm2 restart salessync-backend"
log "  🌐 Nginx: sudo systemctl restart nginx"
log ""
log "📄 Configuration saved to: $APP_DIR/deployment-info.txt"
log ""

# Final status check
log "🔍 Service Status Check:"
pm2 status 2>/dev/null || warning "PM2 status unavailable"

services=("nginx" "postgresql" "redis-server")
for service in "${services[@]}"; do
    if systemctl is-active --quiet "$service" 2>/dev/null; then
        log "✅ $service is running"
    else
        warning "❌ $service may not be running"
    fi
done

log ""
log "🚀 Deployment complete! Your application should be accessible at:"
log "   http://$DOMAIN"
log ""
log "🔐 For SSL (recommended):"
log "   sudo apt install certbot python3-certbot-nginx"
log "   sudo certbot --nginx -d $DOMAIN"
log ""
log "📖 Check deployment-info.txt for credentials and detailed information."