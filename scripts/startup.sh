#!/bin/bash

# 🚀 SalesSync Application Startup Script
# This script ensures the application starts properly on server reboot

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[STARTUP]${NC} $1"
    logger -t salessync-startup "$1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    logger -t salessync-startup "SUCCESS: $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
    logger -t salessync-startup "WARNING: $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    logger -t salessync-startup "ERROR: $1"
}

print_status "Starting SalesSync application startup sequence..."

# Wait for PostgreSQL to be ready
print_status "Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
    if pg_isready -h localhost -p 5432 -U salessync; then
        print_success "PostgreSQL is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        print_error "PostgreSQL failed to start within 30 attempts"
        exit 1
    fi
    sleep 2
done

# Wait for Nginx to be ready
print_status "Checking Nginx status..."
if systemctl is-active --quiet nginx; then
    print_success "Nginx is running"
else
    print_warning "Nginx is not running, attempting to start..."
    sudo systemctl start nginx
    sleep 5
    if systemctl is-active --quiet nginx; then
        print_success "Nginx started successfully"
    else
        print_error "Failed to start Nginx"
        exit 1
    fi
fi

# Navigate to application directory
cd /home/ubuntu/SalesSyncAI

# Ensure correct schema and controller are in place
print_status "Ensuring correct configuration..."
if [ -f "backend/prisma/schema-simple.prisma" ]; then
    cp backend/prisma/schema-simple.prisma backend/prisma/schema.prisma
    print_success "Schema configuration updated"
fi

if [ -f "backend/src/api/auth/controller-simple.ts" ]; then
    cp backend/src/api/auth/controller-simple.ts backend/src/api/auth/controller.ts
    print_success "Auth controller configuration updated"
fi

# Generate Prisma client if needed
print_status "Ensuring Prisma client is generated..."
cd backend
if [ ! -d "node_modules/@prisma/client" ] || [ ! -f "node_modules/.prisma/client/index.js" ]; then
    print_status "Generating Prisma client..."
    npx prisma generate
    print_success "Prisma client generated"
fi

# Start PM2 processes
print_status "Starting PM2 processes..."
cd /home/ubuntu/SalesSyncAI

# Kill any existing PM2 processes
pm2 kill || true
sleep 2

# Start the application
pm2 start ecosystem.config.js
pm2 save

print_success "PM2 processes started"

# Wait for application to be ready
print_status "Waiting for application to be ready..."
sleep 10

# Health checks
print_status "Running health checks..."

# Check backend health
for i in {1..10}; do
    if curl -f -s http://localhost:3001/health > /dev/null; then
        print_success "Backend health check passed"
        break
    fi
    if [ $i -eq 10 ]; then
        print_error "Backend health check failed after 10 attempts"
        pm2 logs backend --lines 20
        exit 1
    fi
    sleep 3
done

# Check API health
if curl -f -s http://localhost:3001/api/health > /dev/null; then
    print_success "API health check passed"
else
    print_warning "API health check failed, but continuing..."
fi

# Check external access
if curl -f -s https://ss.gonxt.tech/health > /dev/null; then
    print_success "External health check passed"
else
    print_warning "External health check failed, but continuing..."
fi

# Display final status
print_status "Application startup completed!"
print_success "🌐 Website: https://ss.gonxt.tech"
print_success "🔧 Backend API: https://ss.gonxt.tech/api"

# Show service status
pm2 status
systemctl status nginx --no-pager -l | head -10

print_success "SalesSync application startup sequence completed successfully!"

exit 0