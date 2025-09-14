#!/bin/bash

# SalesSync Quick Fix Deployment Script
# Troubleshooting version for disk space and permission issues

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔧 SalesSync Quick Fix Deployment${NC}"
echo "Troubleshooting deployment issues..."
echo ""

# Check current directory and permissions
echo -e "${YELLOW}Current directory:${NC} $(pwd)"
echo -e "${YELLOW}User:${NC} $(whoami)"
echo -e "${YELLOW}Available disk space:${NC}"
df -h /

echo ""
echo -e "${BLUE}Checking system requirements...${NC}"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    echo -e "${RED}Error: This script must be run as root (use sudo)${NC}"
    exit 1
fi

# Check disk space (minimum 5GB for basic installation)
AVAILABLE_SPACE=$(df / | tail -1 | awk '{print $4}')
if [ "$AVAILABLE_SPACE" -lt 5242880 ]; then
    echo -e "${RED}Error: Insufficient disk space. At least 5GB required.${NC}"
    echo "Available: $(df -h / | tail -1 | awk '{print $4}')"
    exit 1
fi

# Try to create the script in /tmp first
echo -e "${BLUE}Downloading deployment script to /tmp...${NC}"
cd /tmp

# Clean up any existing files
rm -f clean-deploy.sh salessync-deploy.sh

# Try downloading with different methods
echo "Attempting download with curl..."
if curl -fsSL https://raw.githubusercontent.com/Reshigan/SalesSyncAI/main/deployment/clean-server-deploy.sh -o salessync-deploy.sh; then
    echo -e "${GREEN}✅ Download successful with curl${NC}"
elif wget -q https://raw.githubusercontent.com/Reshigan/SalesSyncAI/main/deployment/clean-server-deploy.sh -O salessync-deploy.sh; then
    echo -e "${GREEN}✅ Download successful with wget${NC}"
else
    echo -e "${RED}❌ Download failed with both curl and wget${NC}"
    echo "Trying alternative method..."
    
    # Create a minimal deployment script inline
    cat > salessync-deploy.sh << 'EOFSCRIPT'
#!/bin/bash

# SalesSync Minimal Deployment Script
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 SalesSync Minimal Deployment${NC}"

# Configuration
DOMAIN="SSAI.gonxt.tech"
INSTALL_DIR="/opt/salessync"
DB_NAME="salessync_production"
DB_USER="salessync_user"
DB_PASSWORD="SalesSync2024Production!"
REDIS_PASSWORD="Redis2024Production!"

# Update system
echo -e "${BLUE}Updating system...${NC}"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq

# Install essential packages
echo -e "${BLUE}Installing essential packages...${NC}"
apt-get install -y -qq curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release build-essential python3 python3-pip jq htop nano vim ufw fail2ban logrotate cron rsync zip openssl certbot python3-certbot-nginx

# Install Node.js 18
echo -e "${BLUE}Installing Node.js 18...${NC}"
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource.gpg.key | gpg --dearmor -o /usr/share/keyrings/nodesource-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/nodesource-keyring.gpg] https://deb.nodesource.com/node_18.x $(lsb_release -cs) main" > /etc/apt/sources.list.d/nodesource.list
apt-get update -qq
apt-get install -y nodejs
npm install -g pm2@latest

# Install PostgreSQL 15
echo -e "${BLUE}Installing PostgreSQL 15...${NC}"
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /usr/share/keyrings/postgresql-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/postgresql-keyring.gpg] http://apt.postgresql.org/pub/repos/apt/ $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list
apt-get update -qq
apt-get install -y postgresql-15 postgresql-client-15 postgresql-contrib-15

systemctl start postgresql
systemctl enable postgresql
sleep 5

# Create database
sudo -u postgres psql << EOF
CREATE DATABASE $DB_NAME;
CREATE USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
ALTER USER $DB_USER CREATEDB;
ALTER DATABASE $DB_NAME OWNER TO $DB_USER;
\q
EOF

# Install Redis
echo -e "${BLUE}Installing Redis...${NC}"
apt-get install -y redis-server
systemctl start redis-server
systemctl enable redis-server

# Configure Redis with password
sed -i "s/# requirepass foobared/requirepass $REDIS_PASSWORD/" /etc/redis/redis.conf
systemctl restart redis-server

# Install Nginx
echo -e "${BLUE}Installing Nginx...${NC}"
apt-get install -y nginx
systemctl start nginx
systemctl enable nginx

# Clone repository
echo -e "${BLUE}Cloning SalesSync repository...${NC}"
rm -rf "$INSTALL_DIR"
git clone https://github.com/Reshigan/SalesSyncAI.git "$INSTALL_DIR"
cd "$INSTALL_DIR"

# Setup backend
echo -e "${BLUE}Setting up backend...${NC}"
cd "$INSTALL_DIR/backend"
npm ci --production --silent

# Create environment file
cat > .env << EOF
DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME?schema=public"
REDIS_URL="redis://default:$REDIS_PASSWORD@localhost:6379"
JWT_SECRET="salessync-jwt-secret-production-$(date +%s)"
JWT_REFRESH_SECRET="salessync-refresh-secret-production-$(date +%s)"
NODE_ENV="production"
PORT="3000"
DOMAIN="$DOMAIN"
UPLOAD_DIR="$INSTALL_DIR/uploads"
MAX_FILE_SIZE="52428800"
BCRYPT_ROUNDS="12"
EOF

mkdir -p "$INSTALL_DIR/uploads" "$INSTALL_DIR/backups" "$INSTALL_DIR/logs"
chown -R www-data:www-data "$INSTALL_DIR/uploads" "$INSTALL_DIR/backups" "$INSTALL_DIR/logs"

# Generate Prisma client and run migrations
npx prisma generate
npx prisma db push --accept-data-loss
npx prisma db seed

# Build application
npm run build

# Setup frontend
echo -e "${BLUE}Setting up frontend...${NC}"
cd "$INSTALL_DIR/frontend-web"
npm ci --silent

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

# Configure Nginx
cat > /etc/nginx/sites-available/$DOMAIN << 'EOFNGINX'
upstream backend {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name SSAI.gonxt.tech www.SSAI.gonxt.tech;
    
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name SSAI.gonxt.tech www.SSAI.gonxt.tech;
    
    # SSL will be configured by certbot
    
    root /var/www/html;
    index index.html;
    
    location /api/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    location /health {
        proxy_pass http://backend;
        proxy_set_header Host $host;
    }
    
    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOFNGINX

ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# Get SSL certificate
echo -e "${BLUE}Setting up SSL certificate...${NC}"
certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos --email "admin@gonxt.tech" --redirect || echo "SSL setup failed, continuing..."

# Setup PM2
echo -e "${BLUE}Setting up PM2...${NC}"
cd "$INSTALL_DIR/backend"

cat > ecosystem.config.js << 'EOFPM2'
module.exports = {
  apps: [{
    name: 'salessync-backend',
    script: 'dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/opt/salessync/logs/salessync-error.log',
    out_file: '/opt/salessync/logs/salessync-out.log',
    log_file: '/opt/salessync/logs/salessync-combined.log',
    time: true,
    max_memory_restart: '1G',
    autorestart: true
  }]
};
EOFPM2

pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root

# Configure firewall
echo -e "${BLUE}Configuring firewall...${NC}"
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Wait for services
echo -e "${BLUE}Waiting for services to start...${NC}"
sleep 15

# Test installation
echo -e "${BLUE}Testing installation...${NC}"
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/health" 2>/dev/null || echo "000")

if [ "$HEALTH_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Backend health check passed${NC}"
else
    echo -e "${YELLOW}⚠️ Backend health check failed (HTTP $HEALTH_STATUS)${NC}"
fi

# Display completion message
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                               ║${NC}"
echo -e "${GREEN}║  🎉 SALESSYNC DEPLOYMENT COMPLETED! 🎉                       ║${NC}"
echo -e "${GREEN}║                                                               ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}🌐 Application URLs:${NC}"
echo "   Frontend:     https://$DOMAIN"
echo "   Backend API:  https://$DOMAIN/api"
echo "   Health Check: https://$DOMAIN/health"
echo ""
echo -e "${BLUE}🔐 Login Credentials:${NC}"
echo "   Super Admin:  superadmin@salessync.com / SuperAdmin123!"
echo "   Company Admin: admin@testcompany.com / Admin123!"
echo "   Manager:      manager@testcompany.com / Manager123!"
echo "   Field Agent:  agent@testcompany.com / Agent123!"
echo ""
echo -e "${GREEN}✅ SalesSync is ready for production use!${NC}"
echo ""

EOFSCRIPT

    echo -e "${YELLOW}Created minimal deployment script${NC}"
fi

# Make script executable
chmod +x salessync-deploy.sh

# Check file size
FILE_SIZE=$(stat -c%s salessync-deploy.sh)
echo -e "${BLUE}Script size: ${FILE_SIZE} bytes${NC}"

if [ "$FILE_SIZE" -lt 1000 ]; then
    echo -e "${RED}❌ Script file is too small, download may have failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Script ready for execution${NC}"
echo ""
echo -e "${YELLOW}Running deployment script...${NC}"
echo ""

# Execute the deployment script
./salessync-deploy.sh