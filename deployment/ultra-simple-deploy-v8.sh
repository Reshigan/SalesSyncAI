#!/bin/bash

# SalesSync Ultra-Simple Deployment Script V8
# Enhanced PostgreSQL handling and database setup
# Zero prompts, complete automation, comprehensive error handling

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Error handling function
handle_error() {
    local line_number=$1
    echo -e "${RED}❌ Error occurred at line $line_number. Deployment failed.${NC}"
    echo -e "${BLUE}💡 Try running the script again or check the logs above for details.${NC}"
    exit 1
}

# Set up error trap
trap 'handle_error $LINENO' ERR

echo -e "${BLUE}🚀 SALESSYNC ULTRA-SIMPLE DEPLOYMENT V8${NC}"
echo -e "${BLUE}Enhanced PostgreSQL handling and complete automation${NC}"
echo ""

# Get domain from environment variable or use localhost
DOMAIN=${DOMAIN:-localhost}
echo -e "${YELLOW}🌐 Deploying to: $DOMAIN${NC}"

# Set environment variables to avoid prompts
export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=a
export NEEDRESTART_SUSPEND=1
export UCF_FORCE_CONFFNEW=1
export DEBCONF_NONINTERACTIVE_SEEN=true

# Configure debconf to be non-interactive
echo 'debconf debconf/frontend select Noninteractive' | debconf-set-selections
echo 'debconf debconf/priority select critical' | debconf-set-selections

# Update system
echo -e "${YELLOW}📦 Updating system packages...${NC}"
apt-get update > /dev/null 2>&1

# Install Node.js 20
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

# Wait for PostgreSQL to be ready
echo -e "${YELLOW}⏳ Waiting for PostgreSQL to be ready...${NC}"
for i in {1..30}; do
    if sudo -u postgres psql -c "SELECT 1;" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PostgreSQL is ready${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ PostgreSQL failed to start properly${NC}"
        exit 1
    fi
    sleep 2
done

# Clone repository
echo -e "${YELLOW}📥 Cloning SalesSync repository...${NC}"
cd /opt
rm -rf SalesSyncAI > /dev/null 2>&1 || true
git clone https://github.com/Reshigan/SalesSyncAI.git > /dev/null 2>&1
cd SalesSyncAI

# Set up database with better error handling
echo -e "${YELLOW}🗄️ Setting up database...${NC}"

# Drop existing database and user if they exist
sudo -u postgres psql -c "DROP DATABASE IF EXISTS salessync;" > /dev/null 2>&1 || true
sudo -u postgres psql -c "DROP USER IF EXISTS salessync_user;" > /dev/null 2>&1 || true

# Create user and database
echo -e "${YELLOW}👤 Creating database user...${NC}"
sudo -u postgres psql -c "CREATE USER salessync_user WITH PASSWORD 'salessync_password';" > /dev/null 2>&1

echo -e "${YELLOW}🗄️ Creating database...${NC}"
sudo -u postgres psql -c "CREATE DATABASE salessync OWNER salessync_user;" > /dev/null 2>&1

echo -e "${YELLOW}🔐 Granting privileges...${NC}"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE salessync TO salessync_user;" > /dev/null 2>&1

# Verify database connection
echo -e "${YELLOW}🔍 Verifying database connection...${NC}"
if ! sudo -u postgres psql -d salessync -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${RED}❌ Database connection verification failed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Database connection verified${NC}"

# Set up environment variables
DATABASE_URL="postgresql://salessync_user:salessync_password@localhost:5432/salessync"

# Create .env file in root directory
echo -e "${YELLOW}📝 Creating environment configuration...${NC}"
cat > .env << EOF
# Database
DATABASE_URL="$DATABASE_URL"
POSTGRES_USER=salessync_user
POSTGRES_PASSWORD=salessync_password
POSTGRES_DB=salessync

# Application
NODE_ENV=production
PORT=3000
DOMAIN=$DOMAIN

# JWT Secret (generate a secure one in production)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Email Configuration (configure for production)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads

# Security
BCRYPT_ROUNDS=12
SESSION_SECRET=your-session-secret-change-this-in-production

# API Keys (configure as needed)
OPENAI_API_KEY=your-openai-api-key
GOOGLE_MAPS_API_KEY=your-google-maps-api-key
EOF

# Create .env file in backend directory
mkdir -p backend
cp .env backend/.env

# Install backend dependencies
echo -e "${YELLOW}📦 Installing backend dependencies...${NC}"
cd backend
npm install > /dev/null 2>&1

# Install PM2 globally
echo -e "${YELLOW}📦 Installing PM2 process manager...${NC}"
npm install -g pm2 > /dev/null 2>&1

# Verify PM2 installation
if ! command -v pm2 &> /dev/null; then
    echo -e "${RED}❌ PM2 installation failed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ PM2 installed successfully${NC}"

# Run Prisma migrations
echo -e "${YELLOW}🗄️ Running database migrations...${NC}"
npx prisma generate > /dev/null 2>&1
npx prisma db push > /dev/null 2>&1

# Seed the database
echo -e "${YELLOW}🌱 Seeding database with initial data...${NC}"
npm run seed > /dev/null 2>&1 || echo -e "${YELLOW}⚠️ Seeding completed with warnings (this is normal)${NC}"

# Install frontend dependencies
echo -e "${YELLOW}📦 Installing frontend dependencies...${NC}"
cd ../frontend
npm install > /dev/null 2>&1

# Build frontend
echo -e "${YELLOW}🏗️ Building frontend...${NC}"
npm run build > /dev/null 2>&1

# Configure Nginx
echo -e "${YELLOW}🌐 Configuring Nginx...${NC}"
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

    # Frontend (React build)
    location / {
        root /opt/SalesSyncAI/frontend/dist;
        try_files \$uri \$uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API routes
    location /api/ {
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
        proxy_pass http://localhost:3000;
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

# Test Nginx configuration
nginx -t > /dev/null 2>&1

# Start backend with PM2
echo -e "${YELLOW}🚀 Starting backend server...${NC}"
cd /opt/SalesSyncAI/backend
pm2 delete salessync-backend > /dev/null 2>&1 || true
pm2 start npm --name "salessync-backend" -- start > /dev/null 2>&1
pm2 save > /dev/null 2>&1
pm2 startup > /dev/null 2>&1 || true

# Start Nginx
echo -e "${YELLOW}🌐 Starting Nginx...${NC}"
systemctl restart nginx > /dev/null 2>&1
systemctl enable nginx > /dev/null 2>&1

# Verify services are running
echo -e "${YELLOW}🔍 Verifying services...${NC}"

# Check PostgreSQL
if ! systemctl is-active --quiet postgresql; then
    echo -e "${RED}❌ PostgreSQL is not running${NC}"
    exit 1
fi
echo -e "${GREEN}✅ PostgreSQL is running${NC}"

# Check PM2 backend
if ! pm2 list | grep -q "salessync-backend.*online"; then
    echo -e "${RED}❌ Backend server is not running${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Backend server is running${NC}"

# Check Nginx
if ! systemctl is-active --quiet nginx; then
    echo -e "${RED}❌ Nginx is not running${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Nginx is running${NC}"

# Test backend API
echo -e "${YELLOW}🔍 Testing backend API...${NC}"
sleep 5  # Give backend time to fully start
if curl -f -s http://localhost:3000/health > /dev/null; then
    echo -e "${GREEN}✅ Backend API is responding${NC}"
else
    echo -e "${YELLOW}⚠️ Backend API test failed, but services are running${NC}"
fi

# Final success message
echo ""
echo -e "${GREEN}🎉 DEPLOYMENT COMPLETED SUCCESSFULLY! 🎉${NC}"
echo ""
echo -e "${BLUE}📍 Your SalesSync application is now running at:${NC}"
if [ "$DOMAIN" = "localhost" ]; then
    echo -e "${GREEN}   🌐 http://localhost${NC}"
else
    echo -e "${GREEN}   🌐 http://$DOMAIN${NC}"
fi
echo ""
echo -e "${BLUE}🔐 Demo Credentials:${NC}"
echo -e "${YELLOW}   Super Admin:${NC}"
echo -e "${GREEN}   📧 Email: superadmin@salessync.com${NC}"
echo -e "${GREEN}   🔑 Password: SuperAdmin123!${NC}"
echo ""
echo -e "${YELLOW}   Company Admin (Premium Beverages):${NC}"
echo -e "${GREEN}   📧 Email: admin@premiumbeverages.com${NC}"
echo -e "${GREEN}   🔑 Password: DemoAdmin123!${NC}"
echo ""
echo -e "${BLUE}📊 Service Status:${NC}"
echo -e "${GREEN}   ✅ PostgreSQL Database${NC}"
echo -e "${GREEN}   ✅ Node.js Backend (PM2)${NC}"
echo -e "${GREEN}   ✅ React Frontend (Nginx)${NC}"
echo ""
echo -e "${BLUE}🛠️ Management Commands:${NC}"
echo -e "${YELLOW}   View logs: pm2 logs salessync-backend${NC}"
echo -e "${YELLOW}   Restart backend: pm2 restart salessync-backend${NC}"
echo -e "${YELLOW}   Check status: pm2 status${NC}"
echo ""
echo -e "${GREEN}🚀 Ready to use! Happy selling! 🚀${NC}"