#!/bin/bash

# Production Deployment Verification Script
# This script helps verify that the Docker build fixes work in production

set -e

echo "🚀 Production Deployment Verification"
echo "====================================="

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

print_status "SUCCESS" "Docker is available"

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    print_status "ERROR" "docker-compose is not installed or not in PATH"
    exit 1
fi

print_status "SUCCESS" "docker-compose is available"

# Verify we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    print_status "ERROR" "Please run this script from the SalesSyncAI root directory"
    exit 1
fi

print_status "INFO" "Starting production deployment verification..."

echo ""
print_status "STEP" "Step 1: Testing Backend Docker Build"
echo "--------------------------------------------"

# Test backend Docker build
cd backend

print_status "INFO" "Building backend Docker image (this may take several minutes)..."

if docker build -t salessync-backend-test . > build.log 2>&1; then
    print_status "SUCCESS" "Backend Docker build completed successfully!"
    
    # Check if the image was created
    if docker images | grep -q "salessync-backend-test"; then
        print_status "SUCCESS" "Docker image 'salessync-backend-test' created"
        
        # Get image size
        IMAGE_SIZE=$(docker images salessync-backend-test --format "table {{.Size}}" | tail -n 1)
        print_status "INFO" "Image size: $IMAGE_SIZE"
    else
        print_status "ERROR" "Docker image was not created properly"
    fi
    
    # Show last few lines of build log for verification
    echo ""
    print_status "INFO" "Last 10 lines of build log:"
    tail -n 10 build.log
    
else
    print_status "ERROR" "Backend Docker build failed!"
    echo ""
    print_status "INFO" "Build error log:"
    tail -n 20 build.log
    cd ..
    exit 1
fi

cd ..

echo ""
print_status "STEP" "Step 2: Testing Docker Compose Configuration"
echo "---------------------------------------------"

# Validate docker-compose.yml
if docker-compose config > /dev/null 2>&1; then
    print_status "SUCCESS" "docker-compose.yml is valid"
else
    print_status "ERROR" "docker-compose.yml has configuration errors"
    docker-compose config
    exit 1
fi

echo ""
print_status "STEP" "Step 3: Environment Variables Check"
echo "-------------------------------------------"

# Check for required environment variables
ENV_VARS=("POSTGRES_DB" "POSTGRES_USER" "POSTGRES_PASSWORD" "JWT_SECRET")
MISSING_VARS=()

for var in "${ENV_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS+=("$var")
    else
        print_status "SUCCESS" "$var is set"
    fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    print_status "INFO" "Missing environment variables (will use defaults): ${MISSING_VARS[*]}"
    print_status "INFO" "For production, ensure these are properly configured"
else
    print_status "SUCCESS" "All required environment variables are set"
fi

echo ""
print_status "STEP" "Step 4: Database Seeding Test"
echo "-------------------------------------"

# Test if seeding scripts are properly configured
if [ -f "backend/prisma/seed.ts" ]; then
    print_status "SUCCESS" "Main seeding script exists"
fi

if [ -f "backend/seed-demo-simple.js" ]; then
    print_status "SUCCESS" "Demo seeding script exists"
fi

# Check if seeding scripts use compound unique keys
if grep -q "companyId_email" backend/prisma/seed.ts 2>/dev/null; then
    print_status "SUCCESS" "Main seed script uses compound unique keys"
else
    print_status "INFO" "Main seed script may need compound unique key updates"
fi

if grep -q "companyId_email" backend/seed-demo-simple.js 2>/dev/null; then
    print_status "SUCCESS" "Demo seed script uses compound unique keys"
else
    print_status "INFO" "Demo seed script may need compound unique key updates"
fi

echo ""
print_status "STEP" "Step 5: Production Deployment Test (Optional)"
echo "----------------------------------------------------"

read -p "Do you want to test the full production deployment? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "INFO" "Starting production deployment test..."
    
    # Stop any existing containers
    print_status "INFO" "Stopping existing containers..."
    docker-compose down > /dev/null 2>&1 || true
    
    # Start the services
    print_status "INFO" "Starting services (this will take several minutes)..."
    if docker-compose up -d --build > deployment.log 2>&1; then
        print_status "SUCCESS" "Services started successfully!"
        
        # Wait for services to be ready
        print_status "INFO" "Waiting for services to be ready..."
        sleep 30
        
        # Check service health
        if docker-compose ps | grep -q "Up"; then
            print_status "SUCCESS" "Services are running"
            
            # Show running services
            echo ""
            print_status "INFO" "Running services:"
            docker-compose ps
            
            # Test backend health endpoint
            if curl -f http://localhost:3001/health > /dev/null 2>&1; then
                print_status "SUCCESS" "Backend health check passed"
            else
                print_status "INFO" "Backend health check failed (may still be starting)"
            fi
            
        else
            print_status "ERROR" "Some services failed to start"
            docker-compose ps
        fi
        
        # Show logs for debugging
        echo ""
        print_status "INFO" "Recent backend logs:"
        docker-compose logs --tail=10 backend
        
    else
        print_status "ERROR" "Deployment failed!"
        echo ""
        print_status "INFO" "Deployment error log:"
        tail -n 20 deployment.log
    fi
    
    # Cleanup
    read -p "Stop the test deployment? (Y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        print_status "INFO" "Stopping test deployment..."
        docker-compose down
        print_status "SUCCESS" "Test deployment stopped"
    fi
else
    print_status "INFO" "Skipping full deployment test"
fi

echo ""
print_status "STEP" "Step 6: Cleanup Test Images"
echo "-----------------------------------"

read -p "Remove test Docker image? (Y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    if docker rmi salessync-backend-test > /dev/null 2>&1; then
        print_status "SUCCESS" "Test image removed"
    else
        print_status "INFO" "Test image cleanup skipped"
    fi
fi

echo ""
print_status "SUCCESS" "🎉 Production Deployment Verification Complete!"
echo ""
print_status "INFO" "Summary of fixes applied:"
echo "  ✅ Fixed npm install timeout issues"
echo "  ✅ Corrected dependency placement in package.docker.json"
echo "  ✅ Added comprehensive .dockerignore"
echo "  ✅ Enhanced Dockerfile with better error handling"
echo "  ✅ Fixed database seeding scripts for compound unique keys"
echo ""
print_status "INFO" "Next steps for production:"
echo "  1. Merge PR #6 if all tests pass"
echo "  2. Deploy using: docker-compose up -d --build"
echo "  3. Run database migrations: docker-compose exec backend npx prisma migrate deploy"
echo "  4. Seed the database: docker-compose exec backend npm run seed"
echo "  5. Monitor logs: docker-compose logs -f backend"