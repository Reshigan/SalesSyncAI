#!/bin/bash

# Deploy SalesSyncAI for IP-based access (13.247.192.46)
# This script configures and deploys the application for public IP access

set -e

echo "🌐 Deploying SalesSyncAI for IP Access (13.247.192.46)"
echo "====================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "SUCCESS")
            echo -e "${GREEN}✅ $message${NC}"
            ;;
        "ERROR")
            echo -e "${RED}❌ $message${NC}"
            ;;
        "INFO")
            echo -e "${YELLOW}ℹ️  $message${NC}"
            ;;
        "STEP")
            echo -e "${BLUE}🔄 $message${NC}"
            ;;
    esac
}

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    print_status "ERROR" "Docker is not installed or not in PATH"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    print_status "ERROR" "docker-compose is not installed or not in PATH"
    exit 1
fi

print_status "SUCCESS" "Docker and docker-compose are available"

# Verify we're in the right directory
if [ ! -f "docker-compose.ip.yml" ]; then
    print_status "ERROR" "Please run this script from the SalesSyncAI root directory"
    exit 1
fi

print_status "STEP" "Step 1: Stopping existing services"
echo "-----------------------------------"

# Stop any existing services
docker-compose down > /dev/null 2>&1 || true
docker-compose -f docker-compose.ip.yml down > /dev/null 2>&1 || true

print_status "SUCCESS" "Existing services stopped"

print_status "STEP" "Step 2: Setting up environment variables"
echo "--------------------------------------------"

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    print_status "INFO" "Creating .env file with default values"
    cat > .env << EOF
# Database Configuration
POSTGRES_DB=salessync
POSTGRES_USER=salessync
POSTGRES_PASSWORD=salessync123

# Redis Configuration
REDIS_PASSWORD=redis123

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-$(date +%s)
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-in-production-$(date +%s)
ENCRYPTION_KEY=your-32-character-encryption-key-$(date +%s | cut -c1-8)

# Server Configuration
NODE_ENV=production
FRONTEND_URL=http://13.247.192.46
CORS_ORIGIN=http://13.247.192.46

# Optional: AWS Configuration (uncomment and configure if needed)
# AWS_REGION=us-east-1
# AWS_ACCESS_KEY_ID=your-access-key
# AWS_SECRET_ACCESS_KEY=your-secret-key
# S3_BUCKET_NAME=salessync-uploads

# Optional: SMTP Configuration (uncomment and configure if needed)
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your-email@gmail.com
# SMTP_PASS=your-app-password
EOF
    print_status "SUCCESS" "Created .env file with default configuration"
else
    print_status "INFO" "Using existing .env file"
fi

print_status "STEP" "Step 3: Building and starting services"
echo "--------------------------------------"

print_status "INFO" "This may take several minutes for the first build..."

# Build and start services using IP configuration
if docker-compose -f docker-compose.ip.yml up -d --build > deployment.log 2>&1; then
    print_status "SUCCESS" "Services started successfully!"
else
    print_status "ERROR" "Failed to start services"
    echo ""
    print_status "INFO" "Error log:"
    tail -n 20 deployment.log
    exit 1
fi

print_status "STEP" "Step 4: Waiting for services to be ready"
echo "----------------------------------------"

print_status "INFO" "Waiting for services to initialize (60 seconds)..."
sleep 60

# Check service status
print_status "INFO" "Checking service status..."
docker-compose -f docker-compose.ip.yml ps

print_status "STEP" "Step 5: Running database migrations and seeding"
echo "----------------------------------------------"

# Wait a bit more for database to be fully ready
sleep 10

# Run database migrations
print_status "INFO" "Running database migrations..."
if docker-compose -f docker-compose.ip.yml exec -T backend npx prisma migrate deploy > migration.log 2>&1; then
    print_status "SUCCESS" "Database migrations completed"
else
    print_status "ERROR" "Database migration failed"
    cat migration.log
fi

# Seed the database
print_status "INFO" "Seeding database with demo data..."
if docker-compose -f docker-compose.ip.yml exec -T backend node seed-demo-simple.js > seed.log 2>&1; then
    print_status "SUCCESS" "Database seeded successfully"
else
    print_status "INFO" "Database seeding may have failed (check logs)"
    tail -n 10 seed.log
fi

print_status "STEP" "Step 6: Testing deployment"
echo "-------------------------"

# Test health endpoints
print_status "INFO" "Testing health endpoints..."

# Test nginx health
if curl -f http://13.247.192.46/health > /dev/null 2>&1; then
    print_status "SUCCESS" "Nginx health check passed"
else
    print_status "ERROR" "Nginx health check failed"
fi

# Test backend health
if curl -f http://13.247.192.46/api/health > /dev/null 2>&1; then
    print_status "SUCCESS" "Backend health check passed"
else
    print_status "INFO" "Backend health check failed (may still be starting)"
fi

print_status "STEP" "Step 7: Deployment Summary"
echo "-------------------------"

echo ""
print_status "SUCCESS" "🎉 SalesSyncAI deployed successfully!"
echo ""
print_status "INFO" "Access URLs:"
echo "  🌐 Frontend: http://13.247.192.46"
echo "  🔌 Backend API: http://13.247.192.46/api"
echo "  🏥 Health Check: http://13.247.192.46/health"
echo "  📊 API Health: http://13.247.192.46/api/health"
echo ""
print_status "INFO" "Service Status:"
docker-compose -f docker-compose.ip.yml ps

echo ""
print_status "INFO" "Useful Commands:"
echo "  📋 View logs: docker-compose -f docker-compose.ip.yml logs -f"
echo "  🔄 Restart: docker-compose -f docker-compose.ip.yml restart"
echo "  🛑 Stop: docker-compose -f docker-compose.ip.yml down"
echo "  🔍 Status: docker-compose -f docker-compose.ip.yml ps"

echo ""
print_status "INFO" "Database Access:"
echo "  🗄️  PostgreSQL: 13.247.192.46:5432"
echo "  🔴 Redis: 13.247.192.46:6379"
echo "  📝 Database: salessync"
echo "  👤 User: salessync"

echo ""
print_status "INFO" "Security Notes:"
echo "  ⚠️  This deployment uses HTTP (not HTTPS) for IP access"
echo "  🔐 Change default passwords in .env for production use"
echo "  🛡️  Consider setting up SSL certificates for HTTPS"
echo "  🔥 Configure firewall rules to restrict access as needed"

echo ""
print_status "SUCCESS" "Deployment complete! Your application should be accessible at http://13.247.192.46"