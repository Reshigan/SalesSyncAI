#!/bin/bash

# Test Docker Build Script
# Tests the backend Docker build to ensure npm issues are resolved

set -e

echo "🧪 Testing SalesSync AI Docker Build"
echo "====================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date '+%H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date '+%H:%M:%S')] ERROR: $1${NC}"
}

warning() {
    echo -e "${YELLOW}[$(date '+%H:%M:%S')] WARNING: $1${NC}"
}

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    error "Docker is not installed or not running"
    exit 1
fi

log "Docker is available"

# Test backend build
log "Testing backend Docker build..."
cd backend

if docker build -t salessync-backend-test . ; then
    log "✅ Backend Docker build successful!"
else
    error "❌ Backend Docker build failed!"
    exit 1
fi

# Test frontend build
log "Testing frontend Docker build..."
cd ../frontend

if docker build -t salessync-frontend-test . ; then
    log "✅ Frontend Docker build successful!"
else
    error "❌ Frontend Docker build failed!"
    exit 1
fi

# Clean up test images
log "Cleaning up test images..."
docker rmi salessync-backend-test salessync-frontend-test 2>/dev/null || true

log "🎉 All Docker builds completed successfully!"
echo
echo "✅ Backend build: PASSED"
echo "✅ Frontend build: PASSED"
echo
echo "Ready for production deployment!"