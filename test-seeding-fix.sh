#!/bin/bash

# 🧪 Test Seeding Fix Script
# This script tests if the Prisma seeding error has been resolved

set -e

echo "🧪 Testing Seeding Fix..."
echo "========================="

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

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "backend/prisma/seed-production-simple.ts" ]; then
    print_error "seed-production-simple.ts not found!"
    print_status "Please run this script from the SalesSyncAI root directory"
    exit 1
fi

# Check if the problematic seed.ts file is gone
if [ -f "backend/prisma/seed.ts" ]; then
    print_warning "Problematic seed.ts file still exists!"
    print_status "This file should be deleted to prevent conflicts"
else
    print_success "Problematic seed.ts file has been removed ✅"
fi

# Navigate to backend directory
cd backend

print_status "Clearing Prisma cache..."
rm -rf node_modules/.prisma 2>/dev/null || true
rm -rf prisma/generated 2>/dev/null || true

print_status "Generating Prisma client..."
if npx prisma generate; then
    print_success "Prisma client generated successfully ✅"
else
    print_error "Failed to generate Prisma client ❌"
    exit 1
fi

print_status "Testing database seeding..."
echo "----------------------------------------"

# Test the seeding
if npx tsx prisma/seed-production-simple.ts; then
    echo "----------------------------------------"
    print_success "🎉 SEEDING TEST PASSED! ✅"
    print_success "The Prisma seeding error has been RESOLVED!"
    echo ""
    print_status "✅ No 'Unknown argument description' error"
    print_status "✅ seed-production-simple.ts works correctly"
    print_status "✅ Compatible with current Prisma schema"
else
    echo "----------------------------------------"
    print_error "❌ SEEDING TEST FAILED!"
    print_error "The seeding error still exists"
    echo ""
    print_status "Possible issues:"
    print_status "- Prisma client not properly generated"
    print_status "- Database connection issues"
    print_status "- Schema compatibility problems"
    exit 1
fi

echo ""
print_success "🚀 Ready for production deployment!"
print_status "You can now restart your services:"
print_status "  sudo systemctl restart salessync-backend"
print_status "  sudo systemctl restart salessync-frontend"
print_status "  sudo docker-compose restart (if using Docker)"