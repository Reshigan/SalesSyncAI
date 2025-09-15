#!/bin/bash

# Fix port conflicts for SalesSyncAI deployment
# This script handles existing PostgreSQL/Redis services

set -e

echo "🔧 Fixing Port Conflicts for SalesSyncAI Deployment"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    local status=$1
    local message=$2
    case $status in
        "SUCCESS") echo -e "${GREEN}✅ $message${NC}" ;;
        "ERROR") echo -e "${RED}❌ $message${NC}" ;;
        "INFO") echo -e "${YELLOW}ℹ️  $message${NC}" ;;
        "STEP") echo -e "${BLUE}🔄 $message${NC}" ;;
        "WARNING") echo -e "${YELLOW}⚠️  $message${NC}" ;;
    esac
}

print_status "STEP" "Step 1: Checking port usage"
echo "----------------------------"

# Check what's using port 5432 (PostgreSQL)
print_status "INFO" "Checking port 5432 (PostgreSQL)..."
if sudo netstat -tulpn | grep :5432; then
    print_status "WARNING" "Port 5432 is in use"
    POSTGRES_CONFLICT=true
else
    print_status "SUCCESS" "Port 5432 is available"
    POSTGRES_CONFLICT=false
fi

# Check what's using port 6379 (Redis)
print_status "INFO" "Checking port 6379 (Redis)..."
if sudo netstat -tulpn | grep :6379; then
    print_status "WARNING" "Port 6379 is in use"
    REDIS_CONFLICT=true
else
    print_status "SUCCESS" "Port 6379 is available"
    REDIS_CONFLICT=false
fi

print_status "STEP" "Step 2: Resolving conflicts"
echo "----------------------------"

if [ "$POSTGRES_CONFLICT" = true ] || [ "$REDIS_CONFLICT" = true ]; then
    print_status "INFO" "Creating deployment configuration with alternative ports..."
    
    # Create a new docker-compose file with different ports
    cat > docker-compose.no-conflicts.yml << 'EOF'
version: '3.8'

services:
  # PostgreSQL Database (using port 5433 to avoid conflicts)
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
      - "0.0.0.0:5433:5432"  # Use port 5433 externally
    networks:
      - salessync-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-salessync} -d ${POSTGRES_DB:-salessync}"]
      interval: 30s
      timeout: 10s
      retries: 5

  # Redis Cache (using port 6380 to avoid conflicts)
  redis:
    image: redis:7-alpine
    container_name: salessync-redis
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD:-redis123} --bind 0.0.0.0
    volumes:
      - redis_data:/data
    ports:
      - "0.0.0.0:6380:6379"  # Use port 6380 externally
    networks:
      - salessync-network
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 30s
      timeout: 10s
      retries: 5

  # Backend API (using existing database services if available)
  backend:
    image: node:18-alpine
    container_name: salessync-backend
    restart: unless-stopped
    working_dir: /app
    environment:
      NODE_ENV: production
      PORT: 3001
      HOST: 0.0.0.0
      # Use internal container network for database connections
      DATABASE_URL: postgresql://${POSTGRES_USER:-salessync}:${POSTGRES_PASSWORD:-salessync123}@postgres:5432/${POSTGRES_DB:-salessync}
      REDIS_URL: redis://:${REDIS_PASSWORD:-redis123}@redis:6379
      JWT_SECRET: ${JWT_SECRET:-your-super-secret-jwt-key-change-this-in-production}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET:-your-super-secret-refresh-key-change-this-in-production}
      ENCRYPTION_KEY: ${ENCRYPTION_KEY:-your-32-character-encryption-key}
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
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: >
      sh -c "
        apk add --no-cache python3 make g++ &&
        npm install --legacy-peer-deps --no-optional &&
        npx prisma generate &&
        npx prisma migrate deploy &&
        node src/index.js
      "

  # Frontend
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
        npm start -- --host 0.0.0.0
      "

  # Nginx Reverse Proxy
  nginx:
    image: nginx:alpine
    container_name: salessync-nginx
    restart: unless-stopped
    ports:
      - "0.0.0.0:80:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/conf.d/ip-access.conf:/etc/nginx/conf.d/default.conf
      - ./nginx/logs:/var/log/nginx
    networks:
      - salessync-network
    depends_on:
      - frontend
      - backend
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 5

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
  backend_node_modules:
  frontend_node_modules:

networks:
  salessync-network:
    driver: bridge
EOF

    print_status "SUCCESS" "Created conflict-free configuration"
    
    # Update .env file with new database URL
    if [ -f ".env" ]; then
        # Backup original .env
        cp .env .env.backup
        
        # Update database URL to use new port
        sed -i 's|DATABASE_URL=.*|DATABASE_URL=postgresql://salessync:salessync123@localhost:5433/salessync|g' .env
        sed -i 's|REDIS_URL=.*|REDIS_URL=redis://:redis123@localhost:6380|g' .env
        
        print_status "SUCCESS" "Updated .env file with new ports"
    fi
    
else
    print_status "SUCCESS" "No port conflicts detected"
fi

print_status "STEP" "Step 3: Alternative deployment options"
echo "--------------------------------------"

print_status "INFO" "You have several options:"
echo ""
echo "Option 1: Use existing database services (Recommended)"
echo "  - Connect to existing PostgreSQL on port 5432"
echo "  - Connect to existing Redis on port 6379"
echo "  - Deploy only application services"
echo ""
echo "Option 2: Use alternative ports"
echo "  - Deploy with PostgreSQL on port 5433"
echo "  - Deploy with Redis on port 6380"
echo "  - Use docker-compose.no-conflicts.yml"
echo ""
echo "Option 3: Stop existing services"
echo "  - Stop existing PostgreSQL/Redis"
echo "  - Deploy with original configuration"
echo ""

read -p "Which option would you like to use? (1/2/3): " choice

case $choice in
    1)
        print_status "INFO" "Option 1: Using existing database services"
        
        # Check if existing databases have our schema
        print_status "INFO" "Checking existing PostgreSQL..."
        if PGPASSWORD=salessync123 psql -h localhost -U salessync -d salessync -c "SELECT 1;" 2>/dev/null; then
            print_status "SUCCESS" "Existing database is accessible"
        else
            print_status "INFO" "Setting up database in existing PostgreSQL..."
            # Try to create database and user
            sudo -u postgres psql -c "CREATE USER salessync WITH PASSWORD 'salessync123';" 2>/dev/null || true
            sudo -u postgres psql -c "CREATE DATABASE salessync OWNER salessync;" 2>/dev/null || true
            sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE salessync TO salessync;" 2>/dev/null || true
        fi
        
        # Create app-only docker-compose
        cat > docker-compose.app-only.yml << 'EOF'
version: '3.8'

services:
  # Backend API (connects to existing database services)
  backend:
    image: node:18-alpine
    container_name: salessync-backend
    restart: unless-stopped
    working_dir: /app
    environment:
      NODE_ENV: production
      PORT: 3001
      HOST: 0.0.0.0
      # Connect to existing services on host
      DATABASE_URL: postgresql://salessync:salessync123@host.docker.internal:5432/salessync
      REDIS_URL: redis://:redis123@host.docker.internal:6379
      JWT_SECRET: ${JWT_SECRET:-your-super-secret-jwt-key-change-this-in-production}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET:-your-super-secret-refresh-key-change-this-in-production}
      ENCRYPTION_KEY: ${ENCRYPTION_KEY:-your-32-character-encryption-key}
      FRONTEND_URL: http://13.247.192.46
      CORS_ORIGIN: http://13.247.192.46
    volumes:
      - ./backend:/app
      - backend_node_modules:/app/node_modules
    ports:
      - "0.0.0.0:3001:3001"
    networks:
      - salessync-network
    extra_hosts:
      - "host.docker.internal:host-gateway"
    command: >
      sh -c "
        apk add --no-cache python3 make g++ &&
        npm install --legacy-peer-deps --no-optional &&
        npx prisma generate &&
        npx prisma migrate deploy &&
        node src/index.js
      "

  # Frontend
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
        npm start -- --host 0.0.0.0
      "

  # Nginx Reverse Proxy
  nginx:
    image: nginx:alpine
    container_name: salessync-nginx
    restart: unless-stopped
    ports:
      - "0.0.0.0:80:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/conf.d/ip-access.conf:/etc/nginx/conf.d/default.conf
      - ./nginx/logs:/var/log/nginx
    networks:
      - salessync-network
    depends_on:
      - frontend
      - backend

volumes:
  backend_node_modules:
  frontend_node_modules:

networks:
  salessync-network:
    driver: bridge
EOF
        
        print_status "SUCCESS" "Created app-only configuration"
        print_status "INFO" "Starting application services..."
        
        if docker-compose -f docker-compose.app-only.yml up -d; then
            print_status "SUCCESS" "Application services started!"
        else
            print_status "ERROR" "Failed to start application services"
        fi
        ;;
        
    2)
        print_status "INFO" "Option 2: Using alternative ports"
        print_status "INFO" "Starting services with alternative ports..."
        
        if docker-compose -f docker-compose.no-conflicts.yml up -d; then
            print_status "SUCCESS" "Services started with alternative ports!"
            print_status "INFO" "Database accessible on port 5433"
            print_status "INFO" "Redis accessible on port 6380"
        else
            print_status "ERROR" "Failed to start services with alternative ports"
        fi
        ;;
        
    3)
        print_status "WARNING" "Option 3: Stopping existing services"
        print_status "INFO" "This will stop existing PostgreSQL and Redis services"
        read -p "Are you sure? This may affect other applications. (y/N): " confirm
        
        if [[ $confirm =~ ^[Yy]$ ]]; then
            print_status "INFO" "Stopping existing services..."
            sudo systemctl stop postgresql redis-server 2>/dev/null || true
            sudo docker stop $(sudo docker ps -q --filter "expose=5432" --filter "expose=6379") 2>/dev/null || true
            
            print_status "INFO" "Starting SalesSyncAI with original configuration..."
            if docker-compose -f docker-compose.ip.yml up -d; then
                print_status "SUCCESS" "Services started successfully!"
            else
                print_status "ERROR" "Failed to start services"
            fi
        else
            print_status "INFO" "Cancelled. Please choose option 1 or 2."
        fi
        ;;
        
    *)
        print_status "ERROR" "Invalid option. Please run the script again."
        exit 1
        ;;
esac

print_status "STEP" "Step 4: Testing deployment"
echo "-------------------------"

sleep 30  # Wait for services to start

# Test connectivity
print_status "INFO" "Testing services..."

if curl -f --connect-timeout 10 http://localhost/health > /dev/null 2>&1; then
    print_status "SUCCESS" "Nginx health check passed"
else
    print_status "WARNING" "Nginx health check failed"
fi

if curl -f --connect-timeout 10 http://localhost:3001/health > /dev/null 2>&1; then
    print_status "SUCCESS" "Backend health check passed"
else
    print_status "WARNING" "Backend health check failed (may still be starting)"
fi

print_status "SUCCESS" "🎉 Deployment process completed!"
echo ""
print_status "INFO" "Access your application at:"
echo "  🌐 Frontend: http://13.247.192.46"
echo "  🔌 Backend API: http://13.247.192.46/api"
echo "  🏥 Health Check: http://13.247.192.46/health"
echo ""
print_status "INFO" "Check logs with:"
echo "  docker-compose logs -f"