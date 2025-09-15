#!/bin/bash

# SalesSync AI - Production Deployment Script (Fixed Ports)
# This script deploys SalesSync AI with non-conflicting ports

set -e

echo "🚀 Starting SalesSync AI Production Deployment (Fixed Ports)..."

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

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker first."
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker compose > /dev/null 2>&1; then
    print_error "Docker Compose is not available. Please install Docker Compose."
    exit 1
fi

# Stop any existing containers
print_status "Stopping existing containers..."
docker compose -f docker-compose.prod.yml down --remove-orphans || true

# Clean up any dangling images
print_status "Cleaning up Docker resources..."
docker system prune -f || true

# Create necessary directories
print_status "Creating necessary directories..."
mkdir -p backend/logs
mkdir -p backend/uploads
mkdir -p nginx/logs

# Build and start services
print_status "Building and starting services..."
docker compose -f docker-compose.prod.yml up -d --build

# Wait for services to be healthy
print_status "Waiting for services to start..."
sleep 30

# Check service health
print_status "Checking service health..."

# Check PostgreSQL
if docker compose -f docker-compose.prod.yml exec -T postgres pg_isready -U salessync_user -d salessync_prod > /dev/null 2>&1; then
    print_success "PostgreSQL is healthy"
else
    print_warning "PostgreSQL might still be starting..."
fi

# Check Redis
if docker compose -f docker-compose.prod.yml exec -T redis redis-cli ping > /dev/null 2>&1; then
    print_success "Redis is healthy"
else
    print_warning "Redis might still be starting..."
fi

# Wait a bit more for backend to be ready
print_status "Waiting for backend to initialize..."
sleep 20

# Seed demo data
print_status "Seeding demo data..."
if docker compose -f docker-compose.prod.yml exec -T backend node seed-production-demo.js; then
    print_success "Demo data seeded successfully!"
else
    print_warning "Demo data seeding failed, but services are running. You can seed manually later."
fi

# Display service information
echo ""
print_success "🎉 SalesSync AI Production Deployment Complete!"
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
print_success "Ready for production use! 🚀"