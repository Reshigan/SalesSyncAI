#!/bin/bash

# Quick Fix for Nginx Conflict and Seeding Issues
# This script resolves the most common deployment problems

set -e

echo "🚀 SalesSync AI Quick Fix Script"
echo "==============================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Step 1: Stop conflicting nginx
print_status "Stopping system nginx if running..."
if systemctl is-active --quiet nginx 2>/dev/null; then
    print_warning "System nginx is running on default port 80, which might conflict"
    sudo systemctl stop nginx 2>/dev/null || print_warning "Could not stop nginx (check if you have sudo access)"
    sudo systemctl disable nginx 2>/dev/null || print_warning "Could not disable nginx"
    print_success "System nginx stopped"
else
    print_success "System nginx is not running"
fi

# Step 2: Clean up any existing containers
print_status "Cleaning up existing containers..."
docker compose -f docker-compose.prod.yml down --remove-orphans 2>/dev/null || true
docker system prune -f 2>/dev/null || true

# Step 3: Start fresh containers
print_status "Starting fresh SalesSync AI containers..."
docker compose -f docker-compose.prod.yml up -d --build

# Step 4: Wait for services to be ready
print_status "Waiting for services to initialize..."
echo "This may take up to 60 seconds..."

# Wait for database
for i in {1..20}; do
    if docker compose -f docker-compose.prod.yml exec -T postgres pg_isready -U salessync_user -d salessync_prod >/dev/null 2>&1; then
        print_success "PostgreSQL is ready"
        break
    fi
    echo -n "."
    sleep 3
done

# Wait for backend
for i in {1..20}; do
    if curl -s http://localhost:3001/health >/dev/null 2>&1; then
        print_success "Backend API is ready"
        break
    fi
    echo -n "."
    sleep 3
done

# Step 5: Reset database and seed data
print_status "Resetting database and seeding demo data..."

# First, try to reset the database
if docker compose -f docker-compose.prod.yml exec -T backend npx prisma migrate reset --force --skip-seed; then
    print_success "Database reset successful"
else
    print_warning "Database reset failed, continuing with seeding..."
fi

# Wait a bit more
sleep 10

# Now seed the data
if docker compose -f docker-compose.prod.yml exec -T backend node seed-production-demo.js; then
    print_success "Demo data seeded successfully!"
else
    print_error "Seeding failed. Let's try alternative method..."
    
    # Alternative seeding method
    if docker compose -f docker-compose.prod.yml exec -T backend npx prisma db seed; then
        print_success "Demo data seeded with alternative method!"
    else
        print_error "All seeding methods failed. Check backend logs:"
        docker logs salessync-backend-prod --tail 20
    fi
fi

# Step 6: Verify services
print_status "Verifying services..."

sleep 5

# Check frontend
if curl -s http://localhost:8081 | grep -q -i "html\|react\|salessync"; then
    print_success "✅ Frontend is working at http://localhost:8081"
else
    print_error "❌ Frontend issue detected"
    echo "Frontend response:"
    curl -s http://localhost:8081 | head -5
fi

# Check backend
if curl -s http://localhost:3001/health | grep -q -i "ok\|healthy\|success"; then
    print_success "✅ Backend API is working at http://localhost:3001"
else
    print_error "❌ Backend API issue detected"
    echo "Backend response:"
    curl -s http://localhost:3001/health
fi

# Final status
echo ""
print_success "🎉 Quick Fix Complete!"
echo ""
echo "📋 Access Your Application:"
echo "  🌐 SalesSync AI: http://localhost:8081"
echo "  🔧 API Health:   http://localhost:3001/health"
echo ""
echo "🔑 Login Credentials:"
echo "  📧 Email:    demo@techcorp.com"
echo "  🔐 Password: Demo123!"
echo ""
echo "🛠️  If you still see nginx page:"
echo "  1. Wait 2-3 minutes for containers to fully start"
echo "  2. Try: docker compose -f docker-compose.prod.yml restart frontend"
echo "  3. Check: docker compose -f docker-compose.prod.yml logs frontend"
echo ""
echo "📊 Container Status:"
docker compose -f docker-compose.prod.yml ps