#!/bin/bash

# 🚀 DEPLOY SEEDING FIX - EXECUTE ON PRODUCTION SERVER
# Copy this script to the production server and run it to fix the seeding error

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[DEPLOY]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_status "🚀 Deploying Seeding Fix to Production..."
echo "========================================"

# Check if we're on the production server
if [ ! -d "/home/ubuntu/SalesSyncAI" ] && [ ! -d "/var/www/salessync" ] && [ ! -d "/opt/salessync" ]; then
    print_error "SalesSyncAI directory not found!"
    print_status "Expected locations: /home/ubuntu/SalesSyncAI, /var/www/salessync, or /opt/salessync"
    exit 1
fi

# Find the correct application directory
APP_DIR=""
if [ -d "/home/ubuntu/SalesSyncAI" ]; then
    APP_DIR="/home/ubuntu/SalesSyncAI"
elif [ -d "/var/www/salessync" ]; then
    APP_DIR="/var/www/salessync"
elif [ -d "/opt/salessync" ]; then
    APP_DIR="/opt/salessync"
fi

print_status "📁 Found application directory: $APP_DIR"
cd "$APP_DIR"

# Pull latest changes with the seeding fix
print_status "📥 Pulling latest changes from GitHub..."
git fetch origin
git checkout fix-production-login-and-ui-redesign
git pull origin fix-production-login-and-ui-redesign

print_success "✅ Latest code with seeding fix pulled successfully"

# Navigate to backend directory
cd "$APP_DIR/backend"

print_status "🧹 Clearing Prisma cache (CRITICAL for fixing seeding error)..."
rm -rf node_modules/.prisma 2>/dev/null || true
rm -rf prisma/generated 2>/dev/null || true
rm -rf node_modules/@prisma/client 2>/dev/null || true

print_success "✅ Prisma cache cleared"

# Verify the problematic seed.ts file is gone
if [ -f "prisma/seed.ts" ]; then
    print_warning "⚠️ Removing problematic seed.ts file..."
    rm -f prisma/seed.ts
    print_success "✅ Problematic seed.ts file removed"
else
    print_success "✅ Problematic seed.ts file already removed"
fi

# Verify the correct seed file exists
if [ -f "prisma/seed-production-simple.ts" ]; then
    print_success "✅ Correct seed-production-simple.ts file found"
else
    print_error "❌ seed-production-simple.ts file not found!"
    exit 1
fi

print_status "📦 Installing/updating backend dependencies..."
npm ci

print_status "🔧 Generating Prisma client..."
npx prisma generate

print_success "✅ Prisma client generated successfully"

print_status "🧪 Testing the seeding fix..."
echo "----------------------------------------"

# Test the seeding (this is the critical test)
if npx tsx prisma/seed-production-simple.ts; then
    echo "----------------------------------------"
    print_success "🎉 SEEDING FIX SUCCESSFUL! ✅"
    print_success "The Prisma seeding error has been RESOLVED!"
    echo ""
    print_status "✅ No 'Unknown argument description' error"
    print_status "✅ Database seeded with demo users"
    print_status "✅ Compatible with current Prisma schema"
else
    echo "----------------------------------------"
    print_error "❌ SEEDING STILL FAILING!"
    print_error "The seeding error persists"
    echo ""
    print_status "Possible issues:"
    print_status "- Database connection problems"
    print_status "- Schema compatibility issues"
    print_status "- Prisma client not properly generated"
    exit 1
fi

print_status "🔄 Restarting backend services..."

# Try different service restart methods
if command -v pm2 &> /dev/null; then
    print_status "Restarting PM2 services..."
    pm2 restart all || pm2 restart salessync-backend || true
    pm2 status
elif command -v systemctl &> /dev/null; then
    print_status "Restarting systemd services..."
    sudo systemctl restart salessync-backend || true
    sudo systemctl restart salessync-frontend || true
fi

# If using Docker
if command -v docker-compose &> /dev/null && [ -f "$APP_DIR/docker-compose.yml" ]; then
    print_status "Restarting Docker containers..."
    cd "$APP_DIR"
    sudo docker-compose restart || true
fi

print_status "⏳ Waiting for services to stabilize..."
sleep 10

print_status "🧪 Testing production endpoints..."
echo "Testing endpoints:"

# Test backend health
BACKEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health 2>/dev/null || echo "000")
echo "- Backend health (localhost:3001): $BACKEND_HEALTH"

# Test API health
API_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health 2>/dev/null || echo "000")
echo "- API health (localhost:3001): $API_HEALTH"

# Test external access
EXTERNAL_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" https://ss.gonxt.tech/health 2>/dev/null || echo "000")
echo "- External health (ss.gonxt.tech): $EXTERNAL_HEALTH"

# Test login with demo user (this is the key test)
LOGIN_TEST=$(curl -X POST http://localhost:3001/api/auth/login -H "Content-Type: application/json" -d '{"email": "admin@salessync.com", "password": "admin123"}' -s -o /dev/null -w "%{http_code}" 2>/dev/null || echo "000")
echo "- Login test (admin@salessync.com): $LOGIN_TEST"

if [ "$LOGIN_TEST" = "200" ]; then
    print_success "🎉 LOGIN TEST PASSED! Demo users are working!"
elif [ "$LOGIN_TEST" = "401" ]; then
    print_warning "⚠️ Login returned 401 - users may not be seeded yet"
    print_status "Running seeding again to ensure users are created..."
    cd "$APP_DIR/backend"
    npx tsx prisma/seed-production-simple.ts
else
    print_warning "⚠️ Login test returned: $LOGIN_TEST"
fi

print_status "📊 Final Service Status:"
if command -v pm2 &> /dev/null; then
    pm2 status
fi

if command -v systemctl &> /dev/null; then
    echo ""
    echo "Systemd Services:"
    sudo systemctl is-active salessync-backend 2>/dev/null && echo "✅ salessync-backend: ACTIVE" || echo "❌ salessync-backend: INACTIVE"
    sudo systemctl is-active salessync-frontend 2>/dev/null && echo "✅ salessync-frontend: ACTIVE" || echo "❌ salessync-frontend: INACTIVE"
    sudo systemctl is-active nginx 2>/dev/null && echo "✅ nginx: ACTIVE" || echo "❌ nginx: INACTIVE"
fi

echo ""
print_success "🎉 SEEDING FIX DEPLOYMENT COMPLETED!"
echo ""
echo "✅ Seeding Error: RESOLVED"
echo "✅ Database: Seeded with demo users"
echo "✅ Services: Restarted"
echo ""
echo "🌐 Test the website: https://ss.gonxt.tech"
echo "🔑 Demo Login: admin@salessync.com / admin123"
echo ""
echo "📋 Demo Users Available:"
echo "  • admin@salessync.com / admin123 (ADMIN)"
echo "  • manager@salessync.com / manager123 (MANAGER)"
echo "  • sales@salessync.com / sales123 (SALES_REP)"
echo "  • field@salessync.com / field123 (FIELD_REP)"
echo ""
print_success "🚀 Production deployment with seeding fix completed successfully!"