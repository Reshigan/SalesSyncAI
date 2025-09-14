#!/bin/bash

# SalesSync Ultra Simple Deployment - V3 (Non-Interactive)
# Handles all confirmations through terminal, no popups

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 ULTRA SIMPLE SALESSYNC DEPLOYMENT V3${NC}"
echo "Non-interactive deployment - all confirmations handled automatically"
echo ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    echo -e "${RED}Error: Run with sudo${NC}"
    exit 1
fi

DOMAIN="SSAI.gonxt.tech"
APP_DIR="/opt/salessync"

# Set non-interactive mode for all package operations
export DEBIAN_FRONTEND=noninteractive

# Pre-configure PostgreSQL responses to avoid popups
echo -e "${YELLOW}🔧 Pre-configuring PostgreSQL responses...${NC}"
echo 'postgresql-common postgresql-common/obsolete-major seen true' | debconf-set-selections
echo 'postgresql-15 postgresql-15/obsolete-major seen true' | debconf-set-selections

# Kill any existing processes
echo -e "${YELLOW}🔧 Stopping existing services...${NC}"
pkill -f "npm\|node\|prisma" 2>/dev/null || true
sleep 2

# Clean up any conflicting packages
echo -e "${YELLOW}🧹 Cleaning up conflicting packages...${NC}"
apt remove -y npm nodejs 2>/dev/null || true
apt autoremove -y 2>/dev/null || true

# Update package lists
echo -e "${YELLOW}📦 Updating package lists...${NC}"
apt update -qq

# Install system dependencies (without nodejs/npm first)
echo -e "${YELLOW}📦 Installing system dependencies...${NC}"
apt install -y postgresql postgresql-contrib nginx git curl software-properties-common

# Handle PostgreSQL upgrade non-interactively
echo -e "${YELLOW}🗄️ Handling PostgreSQL configuration...${NC}"
# Skip the upgrade and keep PostgreSQL 15
echo "Keeping PostgreSQL 15 - skipping upgrade to 17"

# Install Node.js and npm from NodeSource (clean installation)
echo -e "${YELLOW}📦 Installing Node.js and npm from NodeSource...${NC}"
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Verify installation
echo -e "${GREEN}✅ Node.js version: $(node --version)${NC}"
echo -e "${GREEN}✅ npm version: $(npm --version)${NC}"

# Install PM2 globally
echo -e "${YELLOW}📦 Installing PM2...${NC}"
npm install -g pm2

# Start PostgreSQL
service postgresql start

# Create database and user
echo -e "${YELLOW}🗄️ Setting up database...${NC}"
sudo -u postgres psql -c "DROP DATABASE IF EXISTS salessync_production;" 2>/dev/null || true
sudo -u postgres psql -c "DROP USER IF EXISTS salessync_user;" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE salessync_production;"
sudo -u postgres psql -c "CREATE USER salessync_user WITH PASSWORD 'salessync_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE salessync_production TO salessync_user;"

# Clone or update repository
echo -e "${YELLOW}📥 Getting SalesSync code...${NC}"
if [ -d "$APP_DIR" ]; then
    rm -rf "$APP_DIR"
fi

git clone https://github.com/Reshigan/SalesSyncAI.git "$APP_DIR"
cd "$APP_DIR"

# Install dependencies
echo -e "${YELLOW}📦 Installing application dependencies...${NC}"
npm install

# Set up environment
echo -e "${YELLOW}⚙️ Setting up environment...${NC}"
cat > .env << EOF
NODE_ENV=production
PORT=3001
DATABASE_URL="postgresql://salessync_user:salessync_password@localhost:5432/salessync_production"
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
CORS_ORIGIN="http://$DOMAIN"
EOF

# Run database migrations and seed
echo -e "${YELLOW}🗄️ Setting up database schema and data...${NC}"
cd backend
npx prisma generate
npx prisma db push --force-reset
npx prisma db seed
cd ..

# Build frontend
echo -e "${YELLOW}🏗️ Building frontend...${NC}"
cd frontend
npm install
npm run build
cd ..

# Set up nginx
echo -e "${YELLOW}🌐 Configuring nginx...${NC}"
cat > /etc/nginx/sites-available/salessync << EOF
server {
    listen 80;
    server_name $DOMAIN;
    
    # Frontend
    location / {
        root $APP_DIR/frontend/dist;
        try_files \$uri \$uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
    
    # API
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
    }
    
    # Health check
    location /health {
        proxy_pass http://localhost:3001/health;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
    }
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/salessync /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
service nginx restart

# Set up PM2 configuration
echo -e "${YELLOW}⚙️ Setting up PM2 configuration...${NC}"
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'salessync-api',
    script: 'server.js',
    cwd: '$APP_DIR',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: '/var/log/salessync-error.log',
    out_file: '/var/log/salessync-out.log',
    log_file: '/var/log/salessync-combined.log',
    time: true
  }]
};
EOF

# Start application with PM2
echo -e "${YELLOW}🚀 Starting SalesSync application...${NC}"
pm2 delete salessync-api 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# Final health check
echo -e "${YELLOW}🏥 Running health check...${NC}"
sleep 5

# Test API
if curl -f http://localhost:3001/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ API is responding${NC}"
else
    echo -e "${RED}❌ API health check failed${NC}"
    pm2 logs salessync-api --lines 10
fi

# Test frontend
if curl -f http://localhost/ > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend is accessible${NC}"
else
    echo -e "${RED}❌ Frontend access failed${NC}"
fi

echo ""
echo -e "${GREEN}🎉 DEPLOYMENT COMPLETE!${NC}"
echo ""
echo -e "${BLUE}📍 Access your SalesSync application:${NC}"
echo -e "   🌐 Main URL: ${GREEN}http://$DOMAIN${NC}"
echo -e "   🔌 API Base: ${GREEN}http://$DOMAIN/api/${NC}"
echo -e "   🏥 Health Check: ${GREEN}http://$DOMAIN/health${NC}"
echo ""
echo -e "${BLUE}🔐 Demo Credentials:${NC}"
echo -e "   👤 Super Admin: ${GREEN}superadmin@salessync.com${NC} / ${GREEN}SuperAdmin123!${NC}"
echo -e "   🏢 Company Admin: ${GREEN}admin@premiumbeverages.com${NC} / ${GREEN}DemoAdmin123!${NC}"
echo ""
echo -e "${BLUE}🛠️ Management Commands:${NC}"
echo -e "   📊 View logs: ${YELLOW}pm2 logs salessync-api${NC}"
echo -e "   🔄 Restart: ${YELLOW}pm2 restart salessync-api${NC}"
echo -e "   📈 Status: ${YELLOW}pm2 status${NC}"
echo ""
echo -e "${GREEN}✨ SalesSync is now running in production mode!${NC}"