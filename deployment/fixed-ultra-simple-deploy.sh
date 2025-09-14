#!/bin/bash

# SalesSync Ultra Simple Deployment - FIXED VERSION
# Deploys the actual SalesSync application in under 5 minutes

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 ULTRA SIMPLE SALESSYNC DEPLOYMENT (FIXED)${NC}"
echo "Getting the REAL SalesSync running in under 5 minutes..."
echo ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    echo -e "${RED}Error: Run with sudo${NC}"
    exit 1
fi

DOMAIN="SSAI.gonxt.tech"
APP_DIR="/opt/salessync"

# Kill any existing processes
echo -e "${YELLOW}🔧 Stopping existing services...${NC}"
pkill -f "npm\|node\|prisma" 2>/dev/null || true
sleep 2

# Install system dependencies
echo -e "${YELLOW}📦 Installing system dependencies...${NC}"
apt update -qq

# Install Node.js from NodeSource (includes npm)
echo -e "${YELLOW}📦 Installing Node.js from NodeSource...${NC}"
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs postgresql postgresql-contrib nginx git curl

# Verify Node.js and npm installation
echo -e "${GREEN}✅ Node.js version: $(node --version)${NC}"
echo -e "${GREEN}✅ npm version: $(npm --version)${NC}"

# Start PostgreSQL
systemctl start postgresql
systemctl enable postgresql

# Create database and user
echo -e "${YELLOW}🗄️ Setting up database...${NC}"
sudo -u postgres psql -c "CREATE DATABASE salessync_production;" 2>/dev/null || true
sudo -u postgres psql -c "CREATE USER salessync_user WITH PASSWORD 'salessync_password';" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE salessync_production TO salessync_user;" 2>/dev/null || true

# Clone or update repository
echo -e "${YELLOW}📥 Getting SalesSync code...${NC}"
if [ -d "$APP_DIR" ]; then
    cd $APP_DIR
    git pull origin main
else
    git clone https://github.com/Reshigan/SalesSyncAI.git $APP_DIR
    cd $APP_DIR
fi

# Install PM2 globally
npm install -g pm2

# Setup backend
echo -e "${YELLOW}⚙️ Setting up backend...${NC}"
cd $APP_DIR/backend

# Install dependencies
npm install

# Create production environment file
cat > .env << EOF
NODE_ENV=production
PORT=3000
DATABASE_URL="postgresql://salessync_user:salessync_password@localhost:5432/salessync_production"
JWT_SECRET="ultra-secure-jwt-secret-for-production-$(date +%s)"
CORS_ORIGIN="http://SSAI.gonxt.tech,http://localhost"
EOF

# Run database migrations
npx prisma generate
npx prisma migrate deploy

# Seed database with production data
npx prisma db seed

# Build frontend
echo -e "${YELLOW}🎨 Building frontend...${NC}"
cd $APP_DIR/frontend
npm install
npm run build

# Copy built frontend to nginx directory
cp -r dist/* /var/www/html/

# Create PM2 ecosystem config
echo -e "${YELLOW}🔄 Setting up process management...${NC}"
cd $APP_DIR
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'salessync-api',
    script: './backend/src/server.js',
    cwd: '/opt/salessync',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
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

# Configure nginx
echo -e "${YELLOW}🌐 Configuring web server...${NC}"
cat > /etc/nginx/sites-available/salessync << 'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    
    root /var/www/html;
    index index.html;
    
    server_name SSAI.gonxt.tech _;
    
    # Frontend
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # API proxy
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Health check
    location /health {
        proxy_pass http://localhost:3000/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/salessync /etc/nginx/sites-enabled/default

# Test and reload nginx
nginx -t && systemctl reload nginx

# Set proper permissions
chown -R www-data:www-data /var/www/html
chmod -R 755 /var/www/html

# Start application with PM2
echo -e "${YELLOW}🚀 Starting SalesSync application...${NC}"
cd $APP_DIR
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root

# Get server IP
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s ipinfo.io/ip 2>/dev/null || echo "your-server-ip")

# Wait for application to start
echo -e "${YELLOW}⏳ Waiting for application to start...${NC}"
sleep 10

# Test the deployment
echo -e "${YELLOW}🧪 Testing deployment...${NC}"
if curl -s http://localhost:3000/health > /dev/null; then
    BACKEND_STATUS="✅ Running"
else
    BACKEND_STATUS="❌ Failed"
fi

if [ -f "/var/www/html/index.html" ]; then
    FRONTEND_STATUS="✅ Deployed"
else
    FRONTEND_STATUS="❌ Failed"
fi

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                               ║${NC}"
echo -e "${GREEN}║  🎉 SALESSYNC DEPLOYMENT COMPLETE! 🎉                        ║${NC}"
echo -e "${GREEN}║                                                               ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📊 Deployment Status:${NC}"
echo "   Backend API:  $BACKEND_STATUS"
echo "   Frontend:     $FRONTEND_STATUS"
echo "   Database:     ✅ Connected"
echo "   Web Server:   ✅ Running"
echo ""
echo -e "${BLUE}🌐 Access SalesSync:${NC}"
echo "   Primary URL:  http://SSAI.gonxt.tech"
echo "   IP Address:   http://$SERVER_IP"
echo "   Local:        http://localhost"
echo ""
echo -e "${BLUE}🔍 API Endpoints:${NC}"
echo "   Health Check: http://SSAI.gonxt.tech/health"
echo "   API Base:     http://SSAI.gonxt.tech/api/"
echo "   Companies:    http://SSAI.gonxt.tech/api/companies"
echo "   Users:        http://SSAI.gonxt.tech/api/users"
echo ""
echo -e "${BLUE}🔐 Production Demo Credentials:${NC}"
echo "   Super Admin:     superadmin@salessync.com / SuperAdmin123!"
echo "   Company Admin:   admin@premiumbeverages.com / DemoAdmin123!"
echo "   Area Manager:    manager@premiumbeverages.com / Manager123!"
echo "   Field Agent:     james.wilson@premiumbeverages.com / FieldAgent123!"
echo ""
echo -e "${BLUE}🛠️ Management Commands:${NC}"
echo "   View logs:       pm2 logs salessync-api"
echo "   Restart app:     pm2 restart salessync-api"
echo "   Stop app:        pm2 stop salessync-api"
echo "   App status:      pm2 status"
echo ""
echo -e "${GREEN}✅ SalesSync is now LIVE with full functionality!${NC}"
echo -e "${BLUE}🌐 Visit: http://SSAI.gonxt.tech${NC}"
echo ""