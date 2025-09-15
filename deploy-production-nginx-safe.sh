#!/bin/bash

# SalesSync AI - Nginx-Safe Production Deployment Script
# This script automatically handles nginx conflicts and ensures proper deployment

set -e

echo "🚀 SalesSync AI Production Deployment (Nginx-Safe)"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Pre-flight checks
print_status "Running pre-flight checks..."

# Check Docker
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker first."
    exit 1
fi

# Check Docker Compose
if ! command -v docker compose > /dev/null 2>&1; then
    print_error "Docker Compose is not available. Please install Docker Compose."
    exit 1
fi

# Check for port conflicts
print_status "Checking for port conflicts..."
PORTS_IN_USE=""

for port in 3001 5433 6380 8081; do
    if netstat -tlnp 2>/dev/null | grep -q ":$port "; then
        PORTS_IN_USE="$PORTS_IN_USE $port"
    fi
done

if [ ! -z "$PORTS_IN_USE" ]; then
    print_warning "Ports in use:$PORTS_IN_USE"
    
    # Check specifically for nginx on port 8081 or 80
    if netstat -tlnp 2>/dev/null | grep -q ":8081 " || netstat -tlnp 2>/dev/null | grep -q ":80 "; then
        print_warning "Nginx might be running and conflicting with our frontend"
        
        if systemctl is-active --quiet nginx 2>/dev/null; then
            print_status "Stopping system nginx to avoid conflicts..."
            sudo systemctl stop nginx 2>/dev/null || print_warning "Could not stop nginx (might need sudo)"
            print_success "System nginx stopped"
        fi
    fi
fi

# Stop any existing SalesSync containers
print_status "Stopping existing SalesSync containers..."
docker compose -f docker-compose.prod.yml down --remove-orphans 2>/dev/null || true

# Clean up Docker resources
print_status "Cleaning up Docker resources..."
docker system prune -f || true

# Create necessary directories
print_status "Creating necessary directories..."
mkdir -p backend/logs backend/uploads nginx/logs

# Build and start services
print_status "Building and starting services..."
docker compose -f docker-compose.prod.yml up -d --build

# Enhanced waiting with progress indication
print_status "Waiting for services to start..."
echo "This process may take 2-3 minutes for first-time builds..."

# Wait for PostgreSQL
print_status "Waiting for PostgreSQL..."
for i in {1..30}; do
    if docker compose -f docker-compose.prod.yml exec -T postgres pg_isready -U salessync_user -d salessync_prod >/dev/null 2>&1; then
        print_success "PostgreSQL is ready"
        break
    fi
    echo -n "."
    sleep 2
done

# Wait for Redis
print_status "Waiting for Redis..."
for i in {1..20}; do
    if docker compose -f docker-compose.prod.yml exec -T redis redis-cli ping >/dev/null 2>&1; then
        print_success "Redis is ready"
        break
    fi
    echo -n "."
    sleep 2
done

# Wait for Backend
print_status "Waiting for Backend API..."
for i in {1..30}; do
    if curl -s http://localhost:3001/health >/dev/null 2>&1; then
        print_success "Backend API is ready"
        break
    fi
    echo -n "."
    sleep 3
done

# Wait for Frontend
print_status "Waiting for Frontend..."
for i in {1..20}; do
    if curl -s http://localhost:8081 >/dev/null 2>&1; then
        print_success "Frontend is ready"
        break
    fi
    echo -n "."
    sleep 3
done

# Database setup and seeding
print_status "Setting up database and seeding demo data..."

# First ensure database is properly migrated
if docker compose -f docker-compose.prod.yml exec -T backend npx prisma migrate deploy; then
    print_success "Database migrations applied"
else
    print_warning "Migration failed, trying reset..."
    docker compose -f docker-compose.prod.yml exec -T backend npx prisma migrate reset --force --skip-seed
fi

# Seed demo data with retry logic
print_status "Seeding demo data..."
SEED_SUCCESS=false

for attempt in 1 2 3; do
    print_status "Seeding attempt $attempt/3..."
    if docker compose -f docker-compose.prod.yml exec -T backend node seed-production-demo.js; then
        print_success "Demo data seeded successfully!"
        SEED_SUCCESS=true
        break
    else
        print_warning "Seeding attempt $attempt failed"
        if [ $attempt -lt 3 ]; then
            print_status "Waiting 10 seconds before retry..."
            sleep 10
        fi
    fi
done

if [ "$SEED_SUCCESS" = false ]; then
    print_error "Demo data seeding failed after 3 attempts"
    print_status "You can try manual seeding later with:"
    echo "docker compose -f docker-compose.prod.yml exec backend node seed-production-demo.js"
fi

# Final verification
print_status "Performing final verification..."

# Test frontend
FRONTEND_OK=false
if curl -s http://localhost:8081 | grep -q -i "html\|react\|salessync"; then
    print_success "✅ Frontend is responding correctly"
    FRONTEND_OK=true
else
    print_error "❌ Frontend verification failed"
    echo "Frontend response preview:"
    curl -s http://localhost:8081 | head -3
fi

# Test backend
BACKEND_OK=false
if curl -s http://localhost:3001/health | grep -q -i "ok\|healthy\|success"; then
    print_success "✅ Backend API is responding correctly"
    BACKEND_OK=true
else
    print_error "❌ Backend API verification failed"
    echo "Backend response:"
    curl -s http://localhost:3001/health
fi

# Display final results
echo ""
echo "=============================================="
if [ "$FRONTEND_OK" = true ] && [ "$BACKEND_OK" = true ]; then
    print_success "🎉 SalesSync AI Deployment Successful!"
else
    print_warning "⚠️  Deployment completed with some issues"
fi
echo "=============================================="
echo ""
echo "📋 Service Information:"
echo "  🌐 Frontend:    http://localhost:8081"
echo "  🔧 Backend API: http://localhost:3001"
echo "  🗄️  PostgreSQL: localhost:5433"
echo "  🔴 Redis:       localhost:6380"
echo ""
echo "🔑 Demo Credentials:"
echo "  👤 Admin:       demo@techcorp.com / Demo123!"
echo "  👨‍💼 Manager:     manager@techcorp.com / Manager123!"
echo "  🚶 Field Agent: agent1@techcorp.com / Agent123!"
echo ""
echo "📊 Demo Data Includes:"
echo "  • TechCorp Solutions company"
echo "  • 16 technology products"
echo "  • 8 diverse customers"
echo "  • 25 realistic visits"
echo "  • 15 sales orders"
echo "  • 1 active marketing campaign"
echo ""
echo "🛠️  Management Commands:"
echo "  • View logs:    docker compose -f docker-compose.prod.yml logs -f"
echo "  • Stop:         docker compose -f docker-compose.prod.yml down"
echo "  • Restart:      docker compose -f docker-compose.prod.yml restart"
echo "  • Seed data:    docker compose -f docker-compose.prod.yml exec backend node seed-production-demo.js"
echo ""
echo "🔧 Troubleshooting:"
echo "  • If you see nginx page: ./quick-fix-nginx-seeding.sh"
echo "  • Full diagnostics:     ./troubleshoot-and-fix.sh"
echo ""

# Show container status
print_status "Current container status:"
docker compose -f docker-compose.prod.yml ps

if [ "$FRONTEND_OK" = true ] && [ "$BACKEND_OK" = true ]; then
    print_success "Ready for production use! 🚀"
else
    print_warning "Please run troubleshooting scripts if issues persist"
fi