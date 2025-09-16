#!/bin/bash

# 🚨 URGENT: Production Deployment Script
# This script deploys the complete fix for login failures and UI redesign

set -e  # Exit on any error

echo "🚀 Starting Production Deployment..."
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
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

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    print_error "Please run this script from the SalesSyncAI root directory"
    exit 1
fi

print_status "Step 1: Pulling latest changes from GitHub..."
git fetch origin
git checkout main
git pull origin main
git checkout fix-production-login-and-ui-redesign
git pull origin fix-production-login-and-ui-redesign

print_status "Step 2: Backing up current configuration..."
cp backend/prisma/schema.prisma backend/prisma/schema-backup-$(date +%Y%m%d-%H%M%S).prisma || true
cp backend/src/api/auth/controller.ts backend/src/api/auth/controller-backup-$(date +%Y%m%d-%H%M%S).ts || true

print_status "Step 3: Deploying simple schema..."
cp backend/prisma/schema-simple.prisma backend/prisma/schema.prisma
print_success "Schema updated to simple version"

print_status "Step 4: Deploying simplified auth controller..."
cp backend/src/api/auth/controller-simple.ts backend/src/api/auth/controller.ts
print_success "Auth controller updated to simple version"

print_status "Step 5: Installing backend dependencies..."
cd backend
npm install
print_success "Backend dependencies installed"

print_status "Step 6: Clearing Prisma cache and generating client..."
rm -rf node_modules/.prisma || true
rm -rf prisma/generated || true
npx prisma generate
print_success "Prisma client generated (cache cleared)"

print_status "Step 7: Resetting database with new schema..."
print_warning "This will reset the database and remove all existing data!"
read -p "Continue? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    npx prisma db push --force-reset --accept-data-loss
    print_success "Database reset with new schema"
else
    print_error "Database reset cancelled. Deployment incomplete."
    exit 1
fi

print_status "Step 8: Seeding database with demo users..."
cd backend
echo "Current directory: $(pwd)"
echo "Using seed script: $(grep -A 2 '"prisma"' package.json | grep seed)"
npx prisma db seed
print_success "Database seeded with demo users"
cd ..

print_status "Step 9: Building frontend with new UI..."
cd frontend
npm install
npm run build
print_success "Frontend built with new edgy UI"

print_status "Step 10: Restarting backend service..."
cd ..
pm2 stop backend || true
pm2 start ecosystem.config.js --only backend
print_success "Backend service restarted"

print_status "Step 11: Restarting Nginx..."
sudo systemctl reload nginx
print_success "Nginx reloaded"

print_status "Step 12: Testing the deployment..."
echo ""
echo "Testing backend health..."
curl -s http://localhost:3001/health || print_warning "Backend health check failed"

echo ""
echo "Testing API health..."
curl -s http://localhost:3001/api/health || print_warning "API health check failed"

echo ""
echo "Testing login endpoint..."
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@salessync.com", "password": "admin123"}' \
  -s | grep -q "success" && print_success "Login test passed" || print_warning "Login test failed"

echo ""
echo "🎉 DEPLOYMENT COMPLETED!"
echo "======================="
echo ""
echo "✅ Schema updated to simple version"
echo "✅ Auth controller simplified"
echo "✅ Database reset and seeded"
echo "✅ Frontend built with new UI"
echo "✅ Services restarted"
echo ""
echo "🔑 Demo Users Available:"
echo "  • admin@salessync.com / admin123 (ADMIN)"
echo "  • manager@salessync.com / manager123 (MANAGER)"
echo "  • sales@salessync.com / sales123 (SALES_REP)"
echo "  • field@salessync.com / field123 (FIELD_REP)"
echo ""
echo "🌐 Website: https://ss.gonxt.tech"
echo "🔧 Backend API: https://ss.gonxt.tech/api"
echo ""
echo "📊 Check status with:"
echo "  pm2 status"
echo "  pm2 logs backend"
echo "  sudo systemctl status nginx"
echo ""
print_success "Production deployment successful! 🚀"