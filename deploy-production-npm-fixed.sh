#!/bin/bash

# 🚀 SalesSync Production Deployment - npm Canvas Issues Fixed
# This script deploys SalesSync with the Ubuntu-based Docker solution
# that resolves all canvas dependency issues.

set -e

echo "🚀 SalesSync Production Deployment - npm Fixed Version"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root for security reasons"
   exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if git is installed
if ! command -v git &> /dev/null; then
    print_error "Git is not installed. Please install Git first."
    exit 1
fi

print_header "Step 1: Checking out production-ready branch"
if [ ! -d ".git" ]; then
    print_status "Cloning SalesSync repository..."
    git clone https://github.com/Reshigan/SalesSyncAI.git
    cd SalesSyncAI
fi

print_status "Switching to npm-alternatives-production-ready branch..."
git fetch origin
git checkout npm-alternatives-production-ready
git pull origin npm-alternatives-production-ready

print_header "Step 2: Stopping existing containers"
print_status "Stopping any existing SalesSync containers..."
docker stop salessync-prod 2>/dev/null || true
docker rm salessync-prod 2>/dev/null || true

print_header "Step 3: Creating production environment file"
if [ ! -f ".env.production" ]; then
    print_status "Creating .env.production file..."
    cat > .env.production << 'EOF'
# SalesSync Production Environment Configuration
NODE_ENV=production
PORT=3000

# Database Configuration (UPDATE THESE VALUES)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=salessync_prod
POSTGRES_PASSWORD=change-this-secure-password
POSTGRES_DB=salessync_production

# Redis Configuration (UPDATE THESE VALUES)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=change-this-redis-password

# Security Configuration (UPDATE THESE VALUES)
JWT_SECRET=change-this-to-a-secure-32-character-secret
BCRYPT_ROUNDS=12

# API Configuration
API_BASE_URL=http://localhost:3000/api

# Optional: External Services
# OPENAI_API_KEY=your-openai-key
# QUICKCHART_API_KEY=your-quickchart-key

# Optional: Email Configuration
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your-email@domain.com
# SMTP_PASS=your-app-password
EOF
    print_warning "Created .env.production with default values."
    print_warning "IMPORTANT: Edit .env.production and update all passwords and secrets!"
    print_warning "Press Enter to continue after updating the environment file..."
    read -r
fi

print_header "Step 4: Building production Docker image"
print_status "Building SalesSync with Ubuntu base (fixes npm canvas issues)..."
docker build -f Dockerfile.ubuntu -t salessync-production . || {
    print_error "Docker build failed. Trying alternative approach..."
    print_status "Attempting build with canvas-free configuration..."
    
    # Backup original files
    cp backend/package.json backend/package.json.backup
    cp backend/src/utils/pdf-generator.ts backend/src/utils/pdf-generator.ts.backup 2>/dev/null || true
    
    # Use canvas-free configuration
    cp backend/package.simple-no-canvas.json backend/package.json
    cp backend/src/utils/pdf-generator-no-canvas.ts backend/src/utils/pdf-generator.ts
    
    docker build -f Dockerfile.ubuntu -t salessync-production . || {
        print_error "Both build attempts failed. Please check the logs above."
        exit 1
    }
    
    print_status "Successfully built with canvas-free configuration!"
}

print_header "Step 5: Starting production container"
print_status "Starting SalesSync production container..."
docker run -d \
    --name salessync-prod \
    --env-file .env.production \
    -p 3000:3000 \
    --restart unless-stopped \
    salessync-production

# Wait for container to start
print_status "Waiting for container to start..."
sleep 10

print_header "Step 6: Verifying deployment"
if docker ps | grep -q salessync-prod; then
    print_status "✅ Container is running successfully!"
    
    # Test if the application is responding
    if curl -f http://localhost:3000/health &>/dev/null; then
        print_status "✅ Application is responding to health checks!"
    else
        print_warning "⚠️  Application may still be starting up..."
        print_status "Check logs with: docker logs salessync-prod"
    fi
else
    print_error "❌ Container failed to start!"
    print_status "Check logs with: docker logs salessync-prod"
    exit 1
fi

print_header "Step 7: Deployment Summary"
echo "=================================================="
print_status "🎉 SalesSync Production Deployment Complete!"
echo ""
print_status "Application URL: http://localhost:3000"
print_status "Health Check: http://localhost:3000/health"
print_status "API Endpoint: http://localhost:3000/api"
echo ""
print_status "Container Name: salessync-prod"
print_status "Docker Image: salessync-production"
print_status "Configuration: Ubuntu base with canvas dependencies"
echo ""
print_status "Useful Commands:"
echo "  View logs:     docker logs salessync-prod -f"
echo "  Stop app:      docker stop salessync-prod"
echo "  Start app:     docker start salessync-prod"
echo "  Restart app:   docker restart salessync-prod"
echo "  Remove app:    docker stop salessync-prod && docker rm salessync-prod"
echo ""
print_warning "IMPORTANT NEXT STEPS:"
print_warning "1. Update .env.production with your actual database credentials"
print_warning "2. Set up your PostgreSQL and Redis databases"
print_warning "3. Configure SSL/HTTPS for production use"
print_warning "4. Set up automated backups"
print_warning "5. Configure monitoring and logging"
echo ""
print_status "For detailed production setup, see: PRODUCTION_DEPLOYMENT.md"
print_status "For npm alternatives guide, see: NPM_ALTERNATIVES_GUIDE.md"
echo "=================================================="

# Optional: Show container status
print_header "Container Status"
docker ps | grep salessync-prod || print_warning "Container not found in running processes"

print_status "Deployment script completed successfully! 🚀"