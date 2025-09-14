#!/bin/bash

# SalesSync Ultra-Simple Deployment Script V6
# Completely non-interactive deployment with environment variable support
# Usage: DOMAIN=yourdomain.com curl -fsSL https://raw.githubusercontent.com/Reshigan/SalesSyncAI/main/deployment/ultra-simple-deploy-v6.sh | sudo -E bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Error handling
set -e
trap 'echo -e "${RED}❌ Deployment failed at line $LINENO${NC}"; exit 1' ERR

echo -e "${BLUE}🚀 ULTRA SIMPLE SALESSYNC DEPLOYMENT V6${NC}"
echo -e "${GREEN}Completely non-interactive deployment with environment variable support${NC}"
echo ""

# Get domain from environment variable or use default
DOMAIN=${DOMAIN:-localhost}

echo -e "${YELLOW}🔧 Starting services for domain: ${DOMAIN}${NC}"

# Set all environment variables to non-interactive mode
export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=a
export NEEDRESTART_SUSPEND=1
export UCF_FORCE_CONFFNEW=1
export DEBIAN_PRIORITY=critical
export APT_LISTCHANGES_FRONTEND=none

# Disable interactive services
echo 'debconf debconf/frontend select Noninteractive' | debconf-set-selections
echo 'libc6 libraries/restart-without-asking boolean true' | debconf-set-selections

echo -e "${YELLOW}📦 Updating system packages...${NC}"
apt-get update -qq

echo -e "${YELLOW}📦 Installing Node.js 20...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

echo -e "${YELLOW}🗄️ Installing PostgreSQL 15...${NC}"
apt-get install -y postgresql-15 postgresql-client-15 postgresql-contrib-15

echo -e "${YELLOW}📦 Installing additional packages...${NC}"
apt-get install -y git nginx curl wget unzip

# Start and enable PostgreSQL
systemctl start postgresql
systemctl enable postgresql

echo -e "${YELLOW}🔧 Configuring PostgreSQL...${NC}"
sudo -u postgres psql -c "CREATE USER salessync WITH PASSWORD 'salessync123';" || true
sudo -u postgres psql -c "CREATE DATABASE salessync OWNER salessync;" || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE salessync TO salessync;" || true

echo -e "${YELLOW}📥 Cloning SalesSync repository...${NC}"
cd /opt
rm -rf SalesSyncAI
git clone https://github.com/Reshigan/SalesSyncAI.git
cd SalesSyncAI

echo -e "${YELLOW}🔧 Setting up environment variables...${NC}"
# Create environment variables
export DATABASE_URL="postgresql://salessync:salessync123@localhost:5432/salessync"
export JWT_SECRET="your-super-secret-jwt-key-change-in-production-$(openssl rand -hex 32)"
export NODE_ENV="production"
export PORT="3001"
export CORS_ORIGIN="http://$DOMAIN"

# Create .env file in root directory
cat > .env << EOF
DATABASE_URL="postgresql://salessync:salessync123@localhost:5432/salessync"
JWT_SECRET="$JWT_SECRET"
NODE_ENV="production"
PORT="3001"
CORS_ORIGIN="http://$DOMAIN"
EOF

# Create .env file in backend directory
cat > backend/.env << EOF
DATABASE_URL="postgresql://salessync:salessync123@localhost:5432/salessync"
JWT_SECRET="$JWT_SECRET"
NODE_ENV="production"
PORT="3001"
CORS_ORIGIN="http://$DOMAIN"
EOF

echo -e "${YELLOW}📦 Installing backend dependencies...${NC}"
cd backend
npm install --production

echo -e "${YELLOW}🗄️ Setting up database...${NC}"
# Export environment variables before running Prisma
export DATABASE_URL="postgresql://salessync:salessync123@localhost:5432/salessync"
export JWT_SECRET="$JWT_SECRET"
export NODE_ENV="production"
export PORT="3001"
export CORS_ORIGIN="http://$DOMAIN"

# Run Prisma commands from backend directory
npx prisma generate
npx prisma db push --force-reset
npx prisma db seed

echo -e "${YELLOW}📦 Installing frontend dependencies...${NC}"
cd ../frontend
npm install

echo -e "${YELLOW}🏗️ Building frontend...${NC}"
npm run build

echo -e "${YELLOW}🔧 Configuring Nginx...${NC}"
cat > /etc/nginx/sites-available/salessync << EOF
server {
    listen 80;
    server_name $DOMAIN;

    # Frontend
    location / {
        root /opt/SalesSyncAI/frontend/dist;
        try_files \$uri \$uri/ /index.html;
        
        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header X-Content-Type-Options "nosniff" always;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:3001/;
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
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Enable the site
ln -sf /etc/nginx/sites-available/salessync /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
nginx -t

echo -e "${YELLOW}🚀 Starting services...${NC}"
# Start backend with PM2
cd /opt/SalesSyncAI/backend

# Create PM2 ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'salessync-backend',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
      DATABASE_URL: 'postgresql://salessync:salessync123@localhost:5432/salessync',
      JWT_SECRET: '$JWT_SECRET',
      CORS_ORIGIN: 'http://$DOMAIN'
    }
  }]
};
EOF

# Install PM2 globally and start the application
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# Restart nginx
systemctl restart nginx
systemctl enable nginx

echo ""
echo -e "${GREEN}✅ SalesSync deployment completed successfully!${NC}"
echo ""
echo -e "${BLUE}🌐 Access your application:${NC}"
echo -e "${GREEN}   Main App: http://$DOMAIN${NC}"
echo -e "${GREEN}   API: http://$DOMAIN/api/${NC}"
echo -e "${GREEN}   Health: http://$DOMAIN/health${NC}"
echo ""
echo -e "${BLUE}🔐 Demo Credentials:${NC}"
echo -e "${GREEN}   Super Admin: superadmin@salessync.com / SuperAdmin123!${NC}"
echo -e "${GREEN}   Company Admin: admin@premiumbeverages.com / DemoAdmin123!${NC}"
echo ""
echo -e "${YELLOW}📊 Service Status:${NC}"
pm2 status
systemctl status nginx --no-pager -l
echo ""
echo -e "${GREEN}🎉 Deployment completed! Your SalesSync platform is ready to use.${NC}"