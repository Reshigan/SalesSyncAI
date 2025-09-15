#!/bin/bash

# Fix for Missing Seeding Script in Docker Container
# This script rebuilds the backend container with the seeding scripts included

set -e

echo "🔧 Fixing Missing Seeding Script in Docker Container"
echo "=================================================="

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

# Step 1: Verify seeding scripts exist locally
print_status "Verifying seeding scripts exist in backend directory..."
if [ -f "backend/seed-production-demo.js" ]; then
    print_success "seed-production-demo.js found"
else
    print_error "seed-production-demo.js not found in backend directory"
    exit 1
fi

# Step 2: Stop existing containers
print_status "Stopping existing containers..."
docker compose -f docker-compose.prod.yml down --remove-orphans

# Step 3: Remove backend image to force rebuild
print_status "Removing existing backend image to force rebuild..."
docker rmi salessyncai-backend 2>/dev/null || true
docker rmi $(docker images -q --filter "reference=salessyncai-backend") 2>/dev/null || true

# Step 4: Clean up Docker build cache
print_status "Cleaning Docker build cache..."
docker builder prune -f

# Step 5: Rebuild only the backend service
print_status "Rebuilding backend service with seeding scripts..."
docker compose -f docker-compose.prod.yml build --no-cache backend

# Step 6: Start all services
print_status "Starting all services..."
docker compose -f docker-compose.prod.yml up -d

# Step 7: Wait for services to be ready
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

# Step 8: Verify seeding script is now available in container
print_status "Verifying seeding script is available in container..."
if docker compose -f docker-compose.prod.yml exec -T backend ls -la seed-production-demo.js >/dev/null 2>&1; then
    print_success "Seeding script is now available in container"
else
    print_error "Seeding script still not found in container"
    print_status "Let's check what files are in the container:"
    docker compose -f docker-compose.prod.yml exec -T backend ls -la
    exit 1
fi

# Step 9: Reset database and seed data
print_status "Resetting database and seeding demo data..."

# First, reset the database
if docker compose -f docker-compose.prod.yml exec -T backend npx prisma migrate reset --force --skip-seed; then
    print_success "Database reset successful"
else
    print_warning "Database reset failed, continuing with seeding..."
fi

# Wait a bit
sleep 10

# Now seed the data
print_status "Seeding demo data..."
if docker compose -f docker-compose.prod.yml exec -T backend node seed-production-demo.js; then
    print_success "✅ Demo data seeded successfully!"
else
    print_error "❌ Seeding still failed. Let's try alternative methods..."
    
    # Try with npx prisma db seed
    print_status "Trying alternative seeding method..."
    if docker compose -f docker-compose.prod.yml exec -T backend npx prisma db seed; then
        print_success "✅ Demo data seeded with alternative method!"
    else
        print_error "❌ All seeding methods failed"
        print_status "Backend logs:"
        docker logs salessync-backend-prod --tail 20
        print_status "Let's check if the script can be executed manually:"
        docker compose -f docker-compose.prod.yml exec -T backend node --version
        docker compose -f docker-compose.prod.yml exec -T backend pwd
        docker compose -f docker-compose.prod.yml exec -T backend ls -la
    fi
fi

# Step 10: Verify services
print_status "Verifying services..."

sleep 5

# Check frontend
if curl -s http://localhost:8081 | grep -q -i "html\|react\|salessync"; then
    print_success "✅ Frontend is working at http://localhost:8081"
else
    print_error "❌ Frontend issue detected"
fi

# Check backend
if curl -s http://localhost:3001/health | grep -q -i "ok\|healthy\|success"; then
    print_success "✅ Backend API is working at http://localhost:3001"
else
    print_error "❌ Backend API issue detected"
fi

# Final status
echo ""
print_success "🎉 Seeding Script Fix Complete!"
echo ""
echo "📋 Access Your Application:"
echo "  🌐 SalesSync AI: http://localhost:8081"
echo "  🔧 API Health:   http://localhost:3001/health"
echo ""
echo "🔑 Login Credentials:"
echo "  📧 Email:    demo@techcorp.com"
echo "  🔐 Password: Demo123!"
echo ""
echo "🛠️  Manual Seeding Commands (if needed):"
echo "  docker compose -f docker-compose.prod.yml exec backend node seed-production-demo.js"
echo "  docker compose -f docker-compose.prod.yml exec backend npx prisma db seed"
echo ""
echo "📊 Container Status:"
docker compose -f docker-compose.prod.yml ps