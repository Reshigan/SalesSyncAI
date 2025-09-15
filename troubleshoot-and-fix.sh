#!/bin/bash

# SalesSync AI - Troubleshooting and Fix Script
# This script diagnoses and fixes common deployment issues

set -e

echo "🔍 SalesSync AI Troubleshooting and Fix Script"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

print_status "Step 1: Checking current port usage..."
echo "Ports that should be free for SalesSync AI:"
netstat -tlnp 2>/dev/null | grep -E ':(3001|5433|6380|8081)' || echo "No conflicts found on SalesSync ports"

echo ""
print_status "Step 2: Checking what's running on port 8081..."
if netstat -tlnp 2>/dev/null | grep ':8081'; then
    print_warning "Something is already running on port 8081"
    echo "Let's see what process is using it:"
    lsof -i :8081 2>/dev/null || echo "Could not determine process"
else
    print_success "Port 8081 is free"
fi

echo ""
print_status "Step 3: Checking Docker containers status..."
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
print_status "Step 4: Checking SalesSync AI containers specifically..."
if docker ps | grep -q salessync; then
    print_success "SalesSync containers are running"
    docker ps --filter "name=salessync" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
else
    print_error "No SalesSync containers found running"
fi

echo ""
print_status "Step 5: Checking container logs for errors..."
if docker ps -q --filter "name=salessync-frontend-prod" | grep -q .; then
    echo "Frontend logs (last 10 lines):"
    docker logs --tail 10 salessync-frontend-prod 2>&1 || echo "Could not get frontend logs"
else
    print_error "Frontend container not found"
fi

if docker ps -q --filter "name=salessync-backend-prod" | grep -q .; then
    echo ""
    echo "Backend logs (last 10 lines):"
    docker logs --tail 10 salessync-backend-prod 2>&1 || echo "Could not get backend logs"
else
    print_error "Backend container not found"
fi

echo ""
print_status "Step 6: Testing service connectivity..."

# Test if frontend is responding
if curl -s -o /dev/null -w "%{http_code}" http://localhost:8081 | grep -q "200"; then
    print_success "Frontend is responding on port 8081"
else
    print_error "Frontend is not responding properly on port 8081"
fi

# Test if backend is responding
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health | grep -q "200"; then
    print_success "Backend API is responding on port 3001"
else
    print_error "Backend API is not responding on port 3001"
fi

echo ""
print_status "Step 7: Checking for nginx conflicts..."
if systemctl is-active --quiet nginx 2>/dev/null; then
    print_warning "System nginx is running - this might conflict with port 8081"
    echo "System nginx status:"
    systemctl status nginx --no-pager -l || true
    echo ""
    print_status "Checking nginx configuration..."
    if nginx -t 2>/dev/null; then
        print_success "System nginx configuration is valid"
    else
        print_warning "System nginx configuration has issues"
    fi
else
    print_success "System nginx is not running"
fi

echo ""
print_status "Step 8: Proposed fixes..."
echo ""
echo "🔧 FIXES TO APPLY:"
echo ""
echo "1. Stop system nginx if it's conflicting:"
echo "   sudo systemctl stop nginx"
echo "   sudo systemctl disable nginx"
echo ""
echo "2. Restart SalesSync AI containers:"
echo "   docker compose -f docker-compose.prod.yml down"
echo "   docker compose -f docker-compose.prod.yml up -d --build"
echo ""
echo "3. Wait for services to start and then seed data:"
echo "   sleep 30"
echo "   docker compose -f docker-compose.prod.yml exec backend node seed-production-demo.js"
echo ""
echo "4. If seeding fails, try manual database reset:"
echo "   docker compose -f docker-compose.prod.yml exec backend npx prisma migrate reset --force"
echo "   docker compose -f docker-compose.prod.yml exec backend npx prisma db seed"
echo ""

read -p "Would you like me to apply these fixes automatically? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    print_status "Applying fixes..."
    
    # Stop system nginx if running
    if systemctl is-active --quiet nginx 2>/dev/null; then
        print_status "Stopping system nginx..."
        sudo systemctl stop nginx || print_warning "Could not stop nginx (might need sudo)"
        sudo systemctl disable nginx || print_warning "Could not disable nginx"
    fi
    
    # Restart SalesSync containers
    print_status "Restarting SalesSync AI containers..."
    docker compose -f docker-compose.prod.yml down --remove-orphans
    sleep 5
    docker compose -f docker-compose.prod.yml up -d --build
    
    # Wait for services
    print_status "Waiting for services to start..."
    sleep 45
    
    # Try seeding
    print_status "Attempting to seed demo data..."
    if docker compose -f docker-compose.prod.yml exec -T backend node seed-production-demo.js; then
        print_success "Demo data seeded successfully!"
    else
        print_warning "Seeding failed, trying database reset..."
        docker compose -f docker-compose.prod.yml exec -T backend npx prisma migrate reset --force --skip-seed
        sleep 10
        if docker compose -f docker-compose.prod.yml exec -T backend node seed-production-demo.js; then
            print_success "Demo data seeded after reset!"
        else
            print_error "Seeding still failed. Check backend logs for details."
        fi
    fi
    
    echo ""
    print_success "Fixes applied! Testing services..."
    sleep 10
    
    # Test services
    if curl -s http://localhost:8081 | grep -q "SalesSync\|React"; then
        print_success "✅ Frontend is now working at http://localhost:8081"
    else
        print_error "❌ Frontend still not working properly"
    fi
    
    if curl -s http://localhost:3001/health | grep -q "ok\|healthy"; then
        print_success "✅ Backend API is working at http://localhost:3001"
    else
        print_error "❌ Backend API still not working properly"
    fi
    
else
    print_status "Manual fixes not applied. Please run the commands above manually."
fi

echo ""
print_status "Troubleshooting complete!"
echo ""
echo "📋 Final Service Information:"
echo "  🌐 Frontend:    http://localhost:8081"
echo "  🔧 Backend API: http://localhost:3001/health"
echo "  🗄️  PostgreSQL: localhost:5433"
echo "  🔴 Redis:       localhost:6380"
echo ""
echo "🔑 Demo Credentials:"
echo "  👤 Admin:       demo@techcorp.com / Demo123!"
echo "  👨‍💼 Manager:     manager@techcorp.com / Manager123!"
echo "  🚶 Field Agent: agent1@techcorp.com / Agent123!"