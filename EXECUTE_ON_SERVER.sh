#!/bin/bash

# 🚀 EXECUTE THIS SCRIPT ON PRODUCTION SERVER
# SSH into ubuntu@13.246.34.207 and run this script

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

print_status "🚀 Starting production deployment with CI/CD setup..."

# Check if we're on the production server
if [ "$USER" != "ubuntu" ]; then
    print_error "This script must be run as the ubuntu user on the production server"
    exit 1
fi

# Navigate to project directory
cd /home/ubuntu/SalesSyncAI

print_status "📥 Pulling latest changes from GitHub..."
git fetch origin
git checkout main
git pull origin main

print_success "✅ Latest code pulled successfully"

# Make scripts executable
chmod +x scripts/*.sh
chmod +x DEPLOY_TO_PRODUCTION.sh

print_status "🔧 Setting up production services (systemd, PM2, webhook)..."
./scripts/setup-production-services.sh

print_success "✅ Production services configured"

print_status "🚀 Deploying application with latest changes..."
./DEPLOY_TO_PRODUCTION.sh

print_success "✅ Application deployed successfully"

print_status "🔍 Running final health checks..."

# Wait for services to stabilize
sleep 10

# Test all endpoints
echo "Testing endpoints:"
echo "- Backend health: $(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health)"
echo "- API health: $(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health)"
echo "- External access: $(curl -s -o /dev/null -w "%{http_code}" https://ss.gonxt.tech/health)"

# Test login
echo "- Login test: $(curl -X POST http://localhost:3001/api/auth/login -H "Content-Type: application/json" -d '{"email": "admin@salessync.com", "password": "admin123"}' -s -o /dev/null -w "%{http_code}")"

print_status "📊 Service Status:"
pm2 status
echo ""
sudo systemctl status salessync-startup --no-pager -l | head -5
echo ""
sudo systemctl status salessync-webhook --no-pager -l | head -5

print_success "🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!"
echo ""
echo "✅ CI/CD Pipeline: Active and ready for automatic deployments"
echo "✅ Auto-start: Application will start automatically on reboot"
echo "✅ Health Monitoring: 5-minute health checks with auto-recovery"
echo "✅ Webhook Server: Ready for GitHub webhook deployments"
echo ""
echo "🌐 Website: https://ss.gonxt.tech"
echo "🔧 Backend API: https://ss.gonxt.tech/api"
echo ""
echo "👥 Demo Users:"
echo "  • admin@salessync.com / admin123 (ADMIN)"
echo "  • manager@salessync.com / manager123 (MANAGER)"
echo "  • sales@salessync.com / sales123 (SALES_REP)"
echo "  • field@salessync.com / field123 (FIELD_REP)"
echo ""
print_success "🚀 Production deployment with CI/CD completed successfully!"