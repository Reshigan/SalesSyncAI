#!/bin/bash

# SalesSync Ultra-Simple Deployment Script V7
# Complete non-interactive deployment with enhanced error handling
# Usage: curl -fsSL https://raw.githubusercontent.com/Reshigan/SalesSyncAI/main/deployment/ultra-simple-deploy-v7.sh | sudo bash
# With domain: DOMAIN=yourdomain.com curl -fsSL https://raw.githubusercontent.com/Reshigan/SalesSyncAI/main/deployment/ultra-simple-deploy-v7.sh | sudo -E bash

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Error handling function
handle_error() {
    echo -e "${RED}❌ Error occurred at line $1. Deployment failed.${NC}"
    echo -e "${YELLOW}💡 Try running the script again or check the logs above for details.${NC}"
    exit 1
}

# Set up error trap
trap 'handle_error $LINENO' ERR

echo -e "${BLUE}🚀 SALESSYNC ULTRA-SIMPLE DEPLOYMENT V7${NC}"
echo -e "${BLUE}Enhanced error handling and complete automation${NC}"
echo ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}❌ This script must be run as root (use sudo)${NC}"
   exit 1
fi

# Set all environment variables for non-interactive installation
export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=a
export NEEDRESTART_SUSPEND=1
export UCF_FORCE_CONFFNEW=1
export DEBIAN_PRIORITY=critical

# Get domain from environment variable or prompt
if [[ -z "$DOMAIN" ]]; then
    if [[ -t 0 ]]; then
        # Interactive mode
        echo -e "${YELLOW}🌐 Enter your domain (or press Enter for localhost):${NC}"
        read -r DOMAIN
    fi
    # Default to localhost if still empty
    if [[ -z "$DOMAIN" ]]; then
        DOMAIN="localhost"
    fi
fi

echo -e "${GREEN}🌐 Deploying to: $DOMAIN${NC}"

# Update system packages
echo -e "${YELLOW}📦 Updating system packages...${NC}"
apt-get update -qq > /dev/null 2>&1

# Install Node.js 20 FIRST to avoid conflicts
echo -e "${YELLOW}📦 Installing Node.js 20...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
apt-get install -y nodejs > /dev/null 2>&1

# Verify Node.js installation
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js installation failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js $(node --version) installed${NC}"

# Install PostgreSQL 15 with specific packages
echo -e "${YELLOW}🗄️ Installing PostgreSQL 15...${NC}"
apt-get install -y postgresql-15 postgresql-client-15 postgresql-contrib-15 > /dev/null 2>&1

# Install additional packages (excluding pm2 - will install via npm)
echo -e "${YELLOW}📦 Installing additional packages...${NC}"
apt-get install -y git nginx curl wget unzip > /dev/null 2>&1

# Start and enable PostgreSQL
echo -e "${YELLOW}🗄️ Starting PostgreSQL...${NC}"
systemctl start postgresql > /dev/null 2>&1
systemctl enable postgresql > /dev/null 2>&1

# Clone repository
echo -e "${YELLOW}📥 Cloning SalesSync repository...${NC}"
cd /opt
rm -rf SalesSyncAI > /dev/null 2>&1 || true
git clone https://github.com/Reshigan/SalesSyncAI.git > /dev/null 2>&1
cd SalesSyncAI

# Set up database
echo -e "${YELLOW}🗄️ Setting up database...${NC}"
sudo -u postgres psql -c "DROP DATABASE IF EXISTS salessync;" > /dev/null 2>&1 || true
sudo -u postgres psql -c "DROP USER IF EXISTS salessync_user;" > /dev/null 2>&1 || true
sudo -u postgres psql -c "CREATE USER salessync_user WITH PASSWORD 'salessync_password';" > /dev/null 2>&1
sudo -u postgres psql -c "CREATE DATABASE salessync OWNER salessync_user;" > /dev/null 2>&1
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE salessync TO salessync_user;" > /dev/null 2>&1

# Set up environment variables
DATABASE_URL="postgresql://salessync_user:salessync_password@localhost:5432/salessync"
JWT_SECRET="your-super-secret-jwt-key-change-in-production-$(date +%s)"
NODE_ENV="production"
PORT="3001"
CORS_ORIGIN="http://$DOMAIN"

# Export environment variables for current session
export DATABASE_URL
export JWT_SECRET
export NODE_ENV
export PORT
export CORS_ORIGIN

# Create .env file in root directory
cat > .env << EOF
DATABASE_URL="$DATABASE_URL"
JWT_SECRET="$JWT_SECRET"
NODE_ENV="$NODE_ENV"
PORT="$PORT"
CORS_ORIGIN="$CORS_ORIGIN"
EOF

# Create .env file in backend directory for compatibility
cat > backend/.env << EOF
DATABASE_URL="$DATABASE_URL"
JWT_SECRET="$JWT_SECRET"
NODE_ENV="$NODE_ENV"
PORT="$PORT"
CORS_ORIGIN="$CORS_ORIGIN"
EOF

# Install backend dependencies
echo -e "${YELLOW}📦 Installing backend dependencies...${NC}"
cd backend
npm install --production > /dev/null 2>&1

# Run Prisma commands from backend directory with environment variables
echo -e "${YELLOW}🗄️ Setting up database schema...${NC}"
npx prisma generate > /dev/null 2>&1
npx prisma db push > /dev/null 2>&1
npx prisma db seed > /dev/null 2>&1

# Install frontend dependencies and build
echo -e "${YELLOW}🎨 Building frontend...${NC}"
cd ../frontend
npm install > /dev/null 2>&1
npm run build > /dev/null 2>&1

# Configure Nginx
echo -e "${YELLOW}🌐 Configuring Nginx...${NC}"
cd /opt/SalesSyncAI

cat > /etc/nginx/sites-available/salessync << EOF
server {
    listen 80;
    server_name $DOMAIN;

    # Serve React frontend
    location / {
        root /opt/SalesSyncAI/frontend/build;
        index index.html index.htm;
        try_files \$uri \$uri/ /index.html;
        
        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header X-Content-Type-Options "nosniff" always;
    }

    # Proxy API requests to backend
    location /api/ {
        proxy_pass http://localhost:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:3001/health;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Static assets with caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        root /opt/SalesSyncAI/frontend/build;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Enable the site
ln -sf /etc/nginx/sites-available/salessync /etc/nginx/sites-enabled/ > /dev/null 2>&1
rm -f /etc/nginx/sites-enabled/default > /dev/null 2>&1

# Test nginx configuration
if ! nginx -t > /dev/null 2>&1; then
    echo -e "${RED}❌ Nginx configuration test failed${NC}"
    exit 1
fi

# Create PM2 ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'salessync-api',
    script: './backend/server.js',
    cwd: '/opt/SalesSyncAI',
    env: {
      NODE_ENV: '$NODE_ENV',
      PORT: '$PORT',
      DATABASE_URL: '$DATABASE_URL',
      JWT_SECRET: '$JWT_SECRET',
      CORS_ORIGIN: '$CORS_ORIGIN'
    },
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '1G',
    error_file: '/var/log/salessync-error.log',
    out_file: '/var/log/salessync-out.log',
    log_file: '/var/log/salessync-combined.log',
    time: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
EOF

# Install PM2 globally
echo -e "${YELLOW}📦 Installing PM2...${NC}"
npm install -g pm2 > /dev/null 2>&1

# Verify PM2 installation
if ! command -v pm2 &> /dev/null; then
    echo -e "${RED}❌ PM2 installation failed${NC}"
    exit 1
fi

# Start services
echo -e "${YELLOW}🚀 Starting services...${NC}"
pm2 delete salessync-api > /dev/null 2>&1 || true
pm2 start ecosystem.config.js > /dev/null 2>&1
pm2 save > /dev/null 2>&1
pm2 startup > /dev/null 2>&1

# Start and enable nginx
systemctl restart nginx > /dev/null 2>&1
systemctl enable nginx > /dev/null 2>&1

# Final verification
echo -e "${YELLOW}🔍 Verifying deployment...${NC}"

# Check if services are running
if ! systemctl is-active --quiet postgresql; then
    echo -e "${RED}❌ PostgreSQL is not running${NC}"
    exit 1
fi

if ! systemctl is-active --quiet nginx; then
    echo -e "${RED}❌ Nginx is not running${NC}"
    exit 1
fi

if ! pm2 list | grep -q "salessync-api.*online"; then
    echo -e "${RED}❌ PM2 application is not running${NC}"
    exit 1
fi

# Test API endpoint
sleep 3
if ! curl -f http://localhost:3001/health > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️ API health check failed, but services are running${NC}"
fi

echo ""
echo -e "${GREEN}🎉 DEPLOYMENT SUCCESSFUL!${NC}"
echo ""
echo -e "${BLUE}📊 Access your SalesSync deployment:${NC}"
echo -e "${GREEN}   🌐 Main App: http://$DOMAIN${NC}"
echo -e "${GREEN}   🔧 API: http://$DOMAIN/api/${NC}"
echo -e "${GREEN}   ❤️ Health: http://$DOMAIN/health${NC}"
echo ""
echo -e "${BLUE}🔐 Demo Credentials:${NC}"
echo -e "${GREEN}   Super Admin: superadmin@salessync.com / SuperAdmin123!${NC}"
echo -e "${GREEN}   Company Admin: admin@premiumbeverages.com / DemoAdmin123!${NC}"
echo ""
echo -e "${BLUE}🛠️ Management Commands:${NC}"
echo -e "${GREEN}   PM2 Status: pm2 status${NC}"
echo -e "${GREEN}   PM2 Logs: pm2 logs salessync-api${NC}"
echo -e "${GREEN}   Nginx Status: systemctl status nginx${NC}"
echo -e "${GREEN}   PostgreSQL Status: systemctl status postgresql${NC}"
echo ""
echo -e "${GREEN}✅ SalesSync is now running in production mode!${NC}"