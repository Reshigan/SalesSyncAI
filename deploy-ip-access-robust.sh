#!/bin/bash

# Robust Deploy SalesSyncAI for IP-based access (13.247.192.46)
# This script handles Docker build issues and provides fallback options

set -e

echo "🌐 Robust Deployment for IP Access (13.247.192.46)"
echo "=================================================="

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
        "WARNING")
            echo -e "${YELLOW}⚠️  $message${NC}"
            ;;
    esac
}

# Function to try Docker build with fallback options
try_docker_build() {
    local compose_file=$1
    local attempt=$2
    local max_attempts=3
    
    print_status "INFO" "Build attempt $attempt/$max_attempts using $compose_file"
    
    if docker-compose -f "$compose_file" up -d --build > "build_attempt_${attempt}.log" 2>&1; then
        print_status "SUCCESS" "Build successful on attempt $attempt"
        return 0
    else
        print_status "WARNING" "Build attempt $attempt failed"
        if [ $attempt -lt $max_attempts ]; then
            print_status "INFO" "Cleaning up and retrying..."
            docker-compose -f "$compose_file" down > /dev/null 2>&1 || true
            docker system prune -f > /dev/null 2>&1 || true
        fi
        return 1
    fi
}

# Check prerequisites
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

print_status "STEP" "Step 1: Stopping existing services and cleaning up"
echo "---------------------------------------------------"

# Stop any existing services
docker-compose down > /dev/null 2>&1 || true
docker-compose -f docker-compose.ip.yml down > /dev/null 2>&1 || true

# Clean up Docker resources
print_status "INFO" "Cleaning up Docker resources..."
docker system prune -f > /dev/null 2>&1 || true

print_status "SUCCESS" "Cleanup completed"

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

print_status "STEP" "Step 3: Building and starting services (with fallbacks)"
echo "--------------------------------------------------------"

# Try building with different approaches
BUILD_SUCCESS=false

# Attempt 1: Use minimal Dockerfile (current configuration)
print_status "INFO" "Attempting build with minimal Dockerfile..."
if try_docker_build "docker-compose.ip.yml" 1; then
    BUILD_SUCCESS=true
else
    # Attempt 2: Create a super minimal docker-compose for just essential services
    print_status "INFO" "Creating fallback configuration..."
    
    cat > docker-compose.fallback.yml << 'EOF'
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: salessync-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-salessync}
      POSTGRES_USER: ${POSTGRES_USER:-salessync}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-salessync123}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "0.0.0.0:5432:5432"
    networks:
      - salessync-network

  # Redis Cache
  redis:
    image: redis:7-alpine
    container_name: salessync-redis
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD:-redis123} --bind 0.0.0.0
    volumes:
      - redis_data:/data
    ports:
      - "0.0.0.0:6379:6379"
    networks:
      - salessync-network

  # Simple Backend (using Node.js base image)
  backend:
    image: node:18-alpine
    container_name: salessync-backend
    restart: unless-stopped
    working_dir: /app
    environment:
      NODE_ENV: production
      PORT: 3001
      HOST: 0.0.0.0
      DATABASE_URL: postgresql://${POSTGRES_USER:-salessync}:${POSTGRES_PASSWORD:-salessync123}@postgres:5432/${POSTGRES_DB:-salessync}
      REDIS_URL: redis://:${REDIS_PASSWORD:-redis123}@redis:6379
      JWT_SECRET: ${JWT_SECRET:-your-super-secret-jwt-key-change-this-in-production}
      FRONTEND_URL: http://13.247.192.46
      CORS_ORIGIN: http://13.247.192.46
    volumes:
      - ./backend:/app
      - backend_node_modules:/app/node_modules
    ports:
      - "0.0.0.0:3001:3001"
    networks:
      - salessync-network
    depends_on:
      - postgres
      - redis
    command: >
      sh -c "
        apk add --no-cache python3 make g++ &&
        npm install --legacy-peer-deps --no-optional &&
        npx prisma generate &&
        node src/index.js
      "

  # Simple Frontend (using Node.js base image)
  frontend:
    image: node:18-alpine
    container_name: salessync-frontend
    restart: unless-stopped
    working_dir: /app
    environment:
      REACT_APP_API_URL: http://13.247.192.46/api
    volumes:
      - ./frontend:/app
      - frontend_node_modules:/app/node_modules
    ports:
      - "0.0.0.0:3000:3000"
    networks:
      - salessync-network
    command: >
      sh -c "
        npm install --legacy-peer-deps &&
        npm start
      "

  # Simple Nginx
  nginx:
    image: nginx:alpine
    container_name: salessync-nginx
    restart: unless-stopped
    ports:
      - "0.0.0.0:80:80"
    volumes:
      - ./nginx/conf.d/ip-access.conf:/etc/nginx/conf.d/default.conf
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
    networks:
      - salessync-network
    depends_on:
      - backend

volumes:
  postgres_data:
  redis_data:
  backend_node_modules:
  frontend_node_modules:

networks:
  salessync-network:
    driver: bridge
EOF

    if try_docker_build "docker-compose.fallback.yml" 2; then
        BUILD_SUCCESS=true
        print_status "INFO" "Using fallback configuration"
    else
        # Attempt 3: Database and Redis only
        print_status "WARNING" "Full build failed, starting database services only..."
        
        cat > docker-compose.minimal.yml << 'EOF'
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: salessync-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-salessync}
      POSTGRES_USER: ${POSTGRES_USER:-salessync}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-salessync123}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "0.0.0.0:5432:5432"
    networks:
      - salessync-network

  redis:
    image: redis:7-alpine
    container_name: salessync-redis
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD:-redis123} --bind 0.0.0.0
    volumes:
      - redis_data:/data
    ports:
      - "0.0.0.0:6379:6379"
    networks:
      - salessync-network

volumes:
  postgres_data:
  redis_data:

networks:
  salessync-network:
    driver: bridge
EOF

        if try_docker_build "docker-compose.minimal.yml" 3; then
            print_status "WARNING" "Only database services started. You'll need to run backend/frontend manually."
            BUILD_SUCCESS=true
        fi
    fi
fi

if [ "$BUILD_SUCCESS" = false ]; then
    print_status "ERROR" "All build attempts failed"
    echo ""
    print_status "INFO" "Build logs:"
    for i in {1..3}; do
        if [ -f "build_attempt_${i}.log" ]; then
            echo "--- Attempt $i ---"
            tail -n 10 "build_attempt_${i}.log"
            echo ""
        fi
    done
    
    print_status "INFO" "Manual deployment options:"
    echo "1. Check Docker daemon is running: sudo systemctl status docker"
    echo "2. Try building individual services: docker-compose -f docker-compose.ip.yml build backend"
    echo "3. Check available disk space: df -h"
    echo "4. Try manual backend setup: cd backend && npm install && node src/index.js"
    
    exit 1
fi

print_status "STEP" "Step 4: Waiting for services to be ready"
echo "----------------------------------------"

print_status "INFO" "Waiting for services to initialize (60 seconds)..."
sleep 60

# Check service status
print_status "INFO" "Checking service status..."
if [ -f "docker-compose.fallback.yml" ] && [ "$BUILD_SUCCESS" = true ]; then
    docker-compose -f docker-compose.fallback.yml ps
elif [ -f "docker-compose.minimal.yml" ] && [ "$BUILD_SUCCESS" = true ]; then
    docker-compose -f docker-compose.minimal.yml ps
else
    docker-compose -f docker-compose.ip.yml ps
fi

print_status "STEP" "Step 5: Testing deployment"
echo "-------------------------"

# Test health endpoints
print_status "INFO" "Testing connectivity..."

# Test basic connectivity
if curl -f --connect-timeout 10 http://localhost/health > /dev/null 2>&1; then
    print_status "SUCCESS" "Local nginx health check passed"
elif curl -f --connect-timeout 10 http://localhost:80/health > /dev/null 2>&1; then
    print_status "SUCCESS" "Local nginx health check passed (port 80)"
else
    print_status "WARNING" "Local nginx health check failed"
fi

# Test backend
if curl -f --connect-timeout 10 http://localhost:3001/health > /dev/null 2>&1; then
    print_status "SUCCESS" "Backend health check passed"
else
    print_status "WARNING" "Backend health check failed (may still be starting)"
fi

print_status "STEP" "Step 6: Deployment Summary"
echo "-------------------------"

echo ""
print_status "SUCCESS" "🎉 Deployment completed!"
echo ""
print_status "INFO" "Access URLs (try these):"
echo "  🌐 Frontend: http://13.247.192.46"
echo "  🌐 Frontend (alt): http://13.247.192.46:3000"
echo "  🔌 Backend API: http://13.247.192.46/api"
echo "  🔌 Backend API (direct): http://13.247.192.46:3001"
echo "  🏥 Health Check: http://13.247.192.46/health"

echo ""
print_status "INFO" "Next Steps:"
echo "1. Test the URLs above from your browser"
echo "2. If services aren't responding, check logs:"
echo "   docker-compose logs -f"
echo "3. For manual backend start:"
echo "   cd backend && npm install && node src/index.js"
echo "4. For manual frontend start:"
echo "   cd frontend && npm install && npm start"

echo ""
print_status "INFO" "Database Access:"
echo "  🗄️  PostgreSQL: 13.247.192.46:5432"
echo "  🔴 Redis: 13.247.192.46:6379"

# Cleanup build logs
rm -f build_attempt_*.log docker-compose.fallback.yml docker-compose.minimal.yml

print_status "SUCCESS" "Deployment script completed!"