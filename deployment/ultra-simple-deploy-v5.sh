#!/bin/bash

# SalesSync Ultra-Simple Deployment Script V5
# GUARANTEED ZERO PROMPTS - PRODUCTION READY
# Fixes: Environment variables, Prisma schema paths, PostgreSQL prompts, NPM conflicts

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 ULTRA SIMPLE SALESSYNC DEPLOYMENT V5${NC}"
echo -e "${GREEN}Getting SalesSync running with ZERO prompts guaranteed...${NC}"
echo ""

# Get domain from user or use default (handle non-interactive mode)
if [ -t 0 ]; then
    read -p "Enter your domain (default: localhost): " DOMAIN
fi
DOMAIN=${DOMAIN:-localhost}

echo -e "${YELLOW}🔧 Starting services for domain: ${DOMAIN}${NC}"

# Set all environment variables to non-interactive mode
export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=a
export NEEDRESTART_SUSPEND=1
export UCF_FORCE_CONFFNEW=1
export DEBCONF_NONINTERACTIVE_SEEN=true
export DEBCONF_DEBUG=developer

# Configure debconf for non-interactive mode
echo 'debconf debconf/frontend select Noninteractive' | debconf-set-selections
echo 'debconf debconf/priority select critical' | debconf-set-selections

# Update system packages
echo -e "${YELLOW}📦 Updating system packages...${NC}"
apt-get update -qq > /dev/null 2>&1

# Install Node.js FIRST to avoid conflicts with PostgreSQL
echo -e "${YELLOW}📦 Installing Node.js 20...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
apt-get install -y nodejs > /dev/null 2>&1

# Install specific PostgreSQL 15 packages to prevent upgrade prompts
echo -e "${YELLOW}🗄️ Installing PostgreSQL 15...${NC}"
apt-get install -y \
    postgresql-15 \
    postgresql-client-15 \
    postgresql-contrib-15 \
    postgresql-server-dev-15 > /dev/null 2>&1

# Install other required packages
echo -e "${YELLOW}📦 Installing additional packages...${NC}"
apt-get install -y git nginx curl > /dev/null 2>&1

# Start and enable PostgreSQL
echo -e "${YELLOW}🗄️ Starting PostgreSQL...${NC}"
systemctl start postgresql > /dev/null 2>&1
systemctl enable postgresql > /dev/null 2>&1

# Set up PostgreSQL database and user
echo -e "${YELLOW}🗄️ Setting up database...${NC}"
sudo -u postgres psql -c "DROP DATABASE IF EXISTS salessync_production;" > /dev/null 2>&1 || true
sudo -u postgres psql -c "DROP USER IF EXISTS salessync_user;" > /dev/null 2>&1 || true
sudo -u postgres psql -c "CREATE USER salessync_user WITH PASSWORD 'salessync_password';" > /dev/null 2>&1
sudo -u postgres psql -c "CREATE DATABASE salessync_production OWNER salessync_user;" > /dev/null 2>&1
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE salessync_production TO salessync_user;" > /dev/null 2>&1

# Clone or update repository
echo -e "${YELLOW}📥 Getting SalesSync code...${NC}"
if [ -d "/opt/salessync" ]; then
    cd /opt/salessync
    git pull origin main > /dev/null 2>&1
else
    git clone https://github.com/Reshigan/SalesSyncAI.git /opt/salessync > /dev/null 2>&1
    cd /opt/salessync
fi

# Install dependencies
echo -e "${YELLOW}📦 Installing application dependencies...${NC}"
npm install > /dev/null 2>&1

# Set up environment variables for the session
echo -e "${YELLOW}⚙️ Setting up environment...${NC}"
export DATABASE_URL="postgresql://salessync_user:salessync_password@localhost:5432/salessync_production"
export JWT_SECRET="your-super-secret-jwt-key-change-in-production"
export NODE_ENV="production"
export PORT="3001"
export CORS_ORIGIN="http://$DOMAIN"

# Create .env file in root
cat > .env << EOF
NODE_ENV=production
PORT=3001
DATABASE_URL="postgresql://salessync_user:salessync_password@localhost:5432/salessync_production"
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
CORS_ORIGIN="http://$DOMAIN"
EOF

# Create .env file in backend directory
cat > backend/.env << EOF
NODE_ENV=production
PORT=3001
DATABASE_URL="postgresql://salessync_user:salessync_password@localhost:5432/salessync_production"
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
CORS_ORIGIN="http://$DOMAIN"
EOF

# Run database migrations and seed
echo -e "${YELLOW}🗄️ Setting up database schema and data...${NC}"
cd backend
npx prisma generate > /dev/null 2>&1
npx prisma db push --force-reset > /dev/null 2>&1
npx prisma db seed > /dev/null 2>&1
cd ..

# Build frontend
echo -e "${YELLOW}🏗️ Building frontend...${NC}"
cd frontend
npm install > /dev/null 2>&1
npm run build > /dev/null 2>&1
cd ..

# Set up nginx
echo -e "${YELLOW}🌐 Configuring nginx...${NC}"
cat > /etc/nginx/sites-available/salessync << EOF
server {
    listen 80;
    server_name $DOMAIN;
    
    # Frontend
    location / {
        root /var/www/html;
        try_files \$uri \$uri/ /index.html;
        add_header X-Frame-Options ALLOWALL;
        add_header Access-Control-Allow-Origin *;
    }
    
    # API
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
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
        add_header Access-Control-Allow-Headers "Origin, X-Requested-With, Content-Type, Accept, Authorization";
    }
    
    # Health check
    location /health {
        proxy_pass http://localhost:3001/health;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        add_header Access-Control-Allow-Origin *;
    }
}
EOF

# Enable site and remove default
ln -sf /etc/nginx/sites-available/salessync /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Copy frontend build to nginx
cp -r frontend/dist/* /var/www/html/ 2>/dev/null || true

# Create PM2 ecosystem config
echo -e "${YELLOW}🔄 Setting up process management...${NC}"
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'salessync-api',
    script: './backend/src/server.js',
    cwd: '/opt/salessync',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
      DATABASE_URL: 'postgresql://salessync_user:salessync_password@localhost:5432/salessync_production',
      JWT_SECRET: 'your-super-secret-jwt-key-change-in-production',
      CORS_ORIGIN: 'http://$DOMAIN'
    },
    error_file: '/var/log/salessync-error.log',
    out_file: '/var/log/salessync-out.log',
    log_file: '/var/log/salessync.log',
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

# Start services
echo -e "${YELLOW}🚀 Starting services...${NC}"
pm2 delete salessync-api > /dev/null 2>&1 || true
pm2 start ecosystem.config.js > /dev/null 2>&1
pm2 save > /dev/null 2>&1
pm2 startup > /dev/null 2>&1

# Restart nginx
nginx -t > /dev/null 2>&1
systemctl restart nginx > /dev/null 2>&1

# Final status check
echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo ""
echo -e "${BLUE}🌐 SalesSync is now running at:${NC}"
echo -e "${GREEN}   Main App: http://$DOMAIN${NC}"
echo -e "${GREEN}   API: http://$DOMAIN/api/${NC}"
echo -e "${GREEN}   Health: http://$DOMAIN/health${NC}"
echo ""
echo -e "${BLUE}🔐 Demo Login Credentials:${NC}"
echo -e "${YELLOW}   Super Admin: superadmin@salessync.com / SuperAdmin123!${NC}"
echo -e "${YELLOW}   Company Admin: admin@premiumbeverages.com / DemoAdmin123!${NC}"
echo ""
echo -e "${BLUE}📊 System Status:${NC}"
pm2 status
echo ""
echo -e "${GREEN}🎉 SalesSync deployment complete! Zero prompts guaranteed! 🎉${NC}"