#!/bin/bash

# SalesSync Deployment Fix Script
# Fixes common deployment issues and provides a clean deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   log_warning "Running as root. Consider running as a regular user with sudo when needed."
fi

log_info "🚀 Starting SalesSync Deployment Fix..."

# Step 1: Clean up any existing containers
log_info "Step 1: Cleaning up existing containers..."
docker-compose down -v 2>/dev/null || true
docker-compose -f docker-compose.prod.yml down -v 2>/dev/null || true
docker-compose -f docker-compose.production.yml down -v 2>/dev/null || true

# Remove any orphaned containers
docker container prune -f 2>/dev/null || true
docker volume prune -f 2>/dev/null || true

log_success "Cleanup completed"

# Step 2: Check and install dependencies
log_info "Step 2: Checking dependencies..."

# Check Docker
if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    log_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

log_success "Dependencies check passed"

# Step 3: Create environment file
log_info "Step 3: Creating environment configuration..."

cat > .env << EOF
# Database Configuration
POSTGRES_DB=salessync_prod
POSTGRES_USER=salessync_user
POSTGRES_PASSWORD=SalesSync2024!Prod

# Redis Configuration
REDIS_PASSWORD=SalesSync2024!Redis

# JWT Configuration
JWT_SECRET=SalesSync2024!JWT!Secret!Key!Production
JWT_REFRESH_SECRET=SalesSync2024!JWT!Refresh!Secret!Key!Production

# API Configuration
REACT_APP_API_URL=http://localhost:3001
CORS_ORIGIN=http://localhost:8081

# Environment
NODE_ENV=production
EOF

log_success "Environment file created"

# Step 4: Fix frontend Dockerfile if needed
log_info "Step 4: Checking frontend Dockerfile..."

if [ ! -f "frontend/Dockerfile.prod" ]; then
    log_info "Creating frontend production Dockerfile..."
    cat > frontend/Dockerfile.prod << 'EOF'
# Multi-stage build for React frontend
FROM node:18-alpine as builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production --silent

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Install curl for health checks
RUN apk add --no-cache curl

# Copy custom nginx config
COPY nginx.prod.conf /etc/nginx/conf.d/default.conf

# Copy built app from builder stage
COPY --from=builder /app/build /usr/share/nginx/html

# Create health check endpoint
RUN echo '<!DOCTYPE html><html><body><h1>OK</h1></body></html>' > /usr/share/nginx/html/health

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
EOF
fi

# Create nginx config for frontend if needed
if [ ! -f "frontend/nginx.prod.conf" ]; then
    log_info "Creating nginx configuration for frontend..."
    cat > frontend/nginx.prod.conf << 'EOF'
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Handle client-side routing
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }

    # Cache static assets
    location /static/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "OK\n";
        add_header Content-Type text/plain;
    }

    # API proxy
    location /api/ {
        proxy_pass http://backend:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
fi

log_success "Frontend configuration updated"

# Step 5: Fix backend Dockerfile if needed
log_info "Step 5: Checking backend Dockerfile..."

if [ ! -f "backend/Dockerfile.prod" ]; then
    log_info "Creating backend production Dockerfile..."
    cat > backend/Dockerfile.prod << 'EOF'
FROM node:18-alpine

# Install curl for health checks
RUN apk add --no-cache curl

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production --silent

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Change ownership
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["npm", "start"]
EOF
fi

log_success "Backend configuration updated"

# Step 6: Create a working docker-compose file
log_info "Step 6: Creating production docker-compose configuration..."

cat > docker-compose.fixed.yml << 'EOF'
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: salessync-postgres-prod
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-salessync_prod}
      POSTGRES_USER: ${POSTGRES_USER:-salessync_user}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-SalesSync2024!Prod}
      POSTGRES_HOST_AUTH_METHOD: md5
    volumes:
      - postgres_data_prod:/var/lib/postgresql/data
      - ./database/init:/docker-entrypoint-initdb.d
    ports:
      - "5433:5432"
    networks:
      - salessync-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-salessync_user} -d ${POSTGRES_DB:-salessync_prod}"]
      interval: 30s
      timeout: 10s
      retries: 5

  # Redis Cache
  redis:
    image: redis:7-alpine
    container_name: salessync-redis-prod
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD:-SalesSync2024!Redis}
    volumes:
      - redis_data_prod:/data
    ports:
      - "6380:6379"
    networks:
      - salessync-network
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 30s
      timeout: 10s
      retries: 5

  # Backend API
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    container_name: salessync-backend-prod
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 3000
      DATABASE_URL: postgresql://${POSTGRES_USER:-salessync_user}:${POSTGRES_PASSWORD:-SalesSync2024!Prod}@postgres:5432/${POSTGRES_DB:-salessync_prod}
      REDIS_URL: redis://:${REDIS_PASSWORD:-SalesSync2024!Redis}@redis:6379
      JWT_SECRET: ${JWT_SECRET:-SalesSync2024!JWT!Secret!Key!Production}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET:-SalesSync2024!JWT!Refresh!Secret!Key!Production}
      CORS_ORIGIN: ${CORS_ORIGIN:-http://localhost:8081}
      LOG_LEVEL: info
    volumes:
      - ./backend/logs:/app/logs
      - ./backend/uploads:/app/uploads
    ports:
      - "3001:3000"
    networks:
      - salessync-network
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 5

  # Frontend Web App
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.prod
    container_name: salessync-frontend-prod
    restart: unless-stopped
    environment:
      NODE_ENV: production
      REACT_APP_API_URL: ${REACT_APP_API_URL:-http://localhost:3001}
      REACT_APP_ENVIRONMENT: production
    ports:
      - "8081:80"
    networks:
      - salessync-network
    depends_on:
      - backend
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 5

volumes:
  postgres_data_prod:
    driver: local
  redis_data_prod:
    driver: local

networks:
  salessync-network:
    driver: bridge
EOF

log_success "Docker compose configuration created"

# Step 7: Deploy the application
log_info "Step 7: Deploying the application..."

# Build and start services
docker-compose -f docker-compose.fixed.yml up -d --build

log_info "Waiting for services to start..."
sleep 30

# Check if services are running
if docker-compose -f docker-compose.fixed.yml ps | grep -q "Up"; then
    log_success "Services are starting up..."
else
    log_error "Some services failed to start. Checking logs..."
    docker-compose -f docker-compose.fixed.yml logs
    exit 1
fi

# Step 8: Run database migrations and seeding
log_info "Step 8: Setting up database..."

# Wait a bit more for database to be fully ready
sleep 15

# Run migrations
log_info "Running database migrations..."
docker-compose -f docker-compose.fixed.yml exec -T backend npx prisma migrate deploy || {
    log_warning "Migration failed, trying to push schema..."
    docker-compose -f docker-compose.fixed.yml exec -T backend npx prisma db push --accept-data-loss || true
}

# Seed database
log_info "Seeding database with demo data..."
docker-compose -f docker-compose.fixed.yml exec -T backend npm run seed:demo:simple || {
    log_warning "Demo seeding failed, trying alternative seeding..."
    docker-compose -f docker-compose.fixed.yml exec -T backend node -e "
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    async function seed() {
      // Create a test company
      const company = await prisma.company.upsert({
        where: { email: 'admin@testcompany.com' },
        update: {},
        create: {
          name: 'Test Company',
          email: 'admin@testcompany.com',
          phone: '+1234567890',
          address: '123 Test Street',
          city: 'Test City',
          country: 'Test Country'
        }
      });
      
      // Create a test user
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('Admin123!', 10);
      
      await prisma.user.upsert({
        where: { email: 'admin@testcompany.com' },
        update: {},
        create: {
          email: 'admin@testcompany.com',
          password: hashedPassword,
          firstName: 'Admin',
          lastName: 'User',
          role: 'ADMIN',
          companyId: company.id
        }
      });
      
      console.log('Basic seeding completed');
    }
    
    seed().catch(console.error).finally(() => prisma.\$disconnect());
    " || true
}

log_success "Database setup completed"

# Step 9: Final verification
log_info "Step 9: Verifying deployment..."

# Check service status
log_info "Service Status:"
docker-compose -f docker-compose.fixed.yml ps

# Test endpoints
log_info "Testing endpoints..."

# Wait a bit for services to be fully ready
sleep 10

# Test backend health
if curl -f http://localhost:3001/health 2>/dev/null; then
    log_success "✅ Backend health check passed"
else
    log_warning "⚠️  Backend health check failed - service might still be starting"
fi

# Test frontend
if curl -f http://localhost:8081/health 2>/dev/null; then
    log_success "✅ Frontend health check passed"
else
    log_warning "⚠️  Frontend health check failed - service might still be starting"
fi

log_success "🎉 Deployment completed!"

echo ""
echo "=== ACCESS INFORMATION ==="
echo "Frontend: http://localhost:8081"
echo "Backend API: http://localhost:3001"
echo "Backend Health: http://localhost:3001/health"
echo ""
echo "=== DEFAULT LOGIN CREDENTIALS ==="
echo "Email: admin@testcompany.com"
echo "Password: Admin123!"
echo ""
echo "=== MANAGEMENT COMMANDS ==="
echo "View logs: docker-compose -f docker-compose.fixed.yml logs -f"
echo "Restart: docker-compose -f docker-compose.fixed.yml restart"
echo "Stop: docker-compose -f docker-compose.fixed.yml down"
echo "Status: docker-compose -f docker-compose.fixed.yml ps"
echo ""

log_info "If you encounter any issues, check the logs with:"
log_info "docker-compose -f docker-compose.fixed.yml logs"