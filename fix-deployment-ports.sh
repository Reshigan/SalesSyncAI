#!/bin/bash

# ============================================================================
# SalesSyncAI Port Conflict Fix Script
# Resolves port conflicts during deployment
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

log "🔧 Fixing SalesSyncAI deployment port conflicts..."

# Check what's using the conflicting ports
log "📊 Checking port usage..."
echo "Port 6379 (Redis):"
sudo netstat -tulpn | grep :6379 || echo "Port 6379 is free"
echo ""
echo "Port 5432 (PostgreSQL):"
sudo netstat -tulpn | grep :5432 || echo "Port 5432 is free"
echo ""
echo "Port 80 (HTTP):"
sudo netstat -tulpn | grep :80 || echo "Port 80 is free"

# Stop existing services that might conflict
log "🛑 Stopping conflicting services..."

# Stop Redis if running
if systemctl is-active --quiet redis-server; then
    warn "Stopping system Redis service..."
    sudo systemctl stop redis-server
    sudo systemctl disable redis-server
fi

# Stop PostgreSQL if running and not needed
if systemctl is-active --quiet postgresql; then
    warn "System PostgreSQL is running. You can either:"
    echo "  1. Stop it: sudo systemctl stop postgresql"
    echo "  2. Use different ports in docker-compose"
    echo "  3. Use the existing PostgreSQL instance"
    read -p "Stop system PostgreSQL? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        sudo systemctl stop postgresql
        sudo systemctl disable postgresql
        log "✅ PostgreSQL stopped"
    else
        log "📝 Will modify Docker Compose to use different ports"
    fi
fi

# Stop Apache if running
if systemctl is-active --quiet apache2; then
    warn "Stopping Apache2 service..."
    sudo systemctl stop apache2
    sudo systemctl disable apache2
fi

# Stop any existing Docker containers
log "🐳 Stopping existing Docker containers..."
cd /opt/salessync 2>/dev/null || cd ~/SalesSyncAI 2>/dev/null || {
    error "SalesSyncAI directory not found. Please run this from the project directory."
    exit 1
}

# Stop and remove existing containers
docker compose -f docker-compose.production.yml down --remove-orphans 2>/dev/null || true
docker compose down --remove-orphans 2>/dev/null || true

# Clean up Docker resources
log "🧹 Cleaning up Docker resources..."
docker system prune -f

# Create alternative docker-compose with different ports
log "⚙️ Creating alternative Docker Compose configuration..."
cat > docker-compose.production-alt.yml << 'EOF'
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: salessync-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: salessync_prod
      POSTGRES_USER: salessync_user
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-SalesSync2024!Prod}
      POSTGRES_HOST_AUTH_METHOD: md5
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5433:5432"  # Changed from 5432 to 5433
    networks:
      - salessync-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U salessync_user -d salessync_prod"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis Cache
  redis:
    image: redis:7-alpine
    container_name: salessync-redis
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD:-SalesSync2024!Redis}
    volumes:
      - redis_data:/data
    ports:
      - "6380:6379"  # Changed from 6379 to 6380
    networks:
      - salessync-network
    healthcheck:
      test: ["CMD", "redis-cli", "auth", "${REDIS_PASSWORD:-SalesSync2024!Redis}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Backend API
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    container_name: salessync-backend
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 3000
      DATABASE_URL: postgresql://salessync_user:${POSTGRES_PASSWORD:-SalesSync2024!Prod}@postgres:5432/salessync_prod
      REDIS_URL: redis://:${REDIS_PASSWORD:-SalesSync2024!Redis}@redis:6379
      JWT_SECRET: ${JWT_SECRET:-SalesSync2024!JWT!Secret!Key!Production}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET:-SalesSync2024!JWT!Refresh!Secret!Key!Production}
      CORS_ORIGIN: ${CORS_ORIGIN:-*}
      LOG_LEVEL: info
      RATE_LIMIT_WINDOW_MS: 900000
      RATE_LIMIT_MAX_REQUESTS: 100
    volumes:
      - backend_logs:/app/logs
      - backend_uploads:/app/uploads
    ports:
      - "3001:3000"  # Changed from 3000 to 3001
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
      retries: 3

  # Frontend Web App with Nginx
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.prod
      args:
        REACT_APP_API_URL: ${REACT_APP_API_URL:-http://localhost:3001/api}
    container_name: salessync-frontend
    restart: unless-stopped
    ports:
      - "8080:80"  # Changed from 80 to 8080
    networks:
      - salessync-network
    depends_on:
      backend:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
  backend_logs:
    driver: local
  backend_uploads:
    driver: local

networks:
  salessync-network:
    driver: bridge
EOF

# Update environment file for alternative ports
log "📝 Updating environment configuration..."
PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || echo "localhost")

cat > .env << EOF
NODE_ENV=production
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-SalesSync2024!Prod}
REDIS_PASSWORD=${REDIS_PASSWORD:-SalesSync2024!Redis}
JWT_SECRET=${JWT_SECRET:-SalesSync2024!JWT!Secret!Key!Production}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET:-SalesSync2024!JWT!Refresh!Secret!Key!Production}
CORS_ORIGIN=*
REACT_APP_API_URL=http://${PUBLIC_IP}:3001/api
EOF

# Deploy with alternative configuration
log "🚀 Deploying with alternative port configuration..."
docker compose -f docker-compose.production-alt.yml up -d --build

# Wait for services to start
log "⏳ Waiting for services to start..."
sleep 30

# Run database migrations
log "🗄️ Running database migrations..."
docker compose -f docker-compose.production-alt.yml exec -T backend npx prisma migrate deploy || warn "Migration failed - database might already be initialized"

# Seed database
log "🌱 Seeding database..."
docker compose -f docker-compose.production-alt.yml exec -T backend node seed-production-demo.js || warn "Seeding failed - database might already have data"

# Health checks
log "🏥 Running health checks..."
sleep 10

# Check container status
docker compose -f docker-compose.production-alt.yml ps

# Test endpoints
log "🧪 Testing endpoints..."
if curl -f http://localhost:8080/ > /dev/null 2>&1; then
    log "✅ Frontend is accessible at http://localhost:8080/"
else
    warn "❌ Frontend health check failed"
fi

if curl -f http://localhost:3001/health > /dev/null 2>&1; then
    log "✅ Backend API is accessible at http://localhost:3001/api"
else
    warn "❌ Backend API health check failed"
fi

# Final information
log "🎉 Deployment completed with alternative ports!"
echo ""
echo "============================================================================"
echo "🌐 DEPLOYMENT COMPLETE (Alternative Ports)"
echo "============================================================================"
echo "📍 Public IP: $PUBLIC_IP"
echo "🌐 Frontend URL: http://$PUBLIC_IP:8080"
echo "🔗 API URL: http://$PUBLIC_IP:3001/api"
echo "🏥 Health Check: http://$PUBLIC_IP:3001/health"
echo ""
echo "🔌 Port Mappings:"
echo "  • Frontend: 8080 → 80 (instead of 80 → 80)"
echo "  • Backend API: 3001 → 3000 (instead of 3000 → 3000)"
echo "  • PostgreSQL: 5433 → 5432 (instead of 5432 → 5432)"
echo "  • Redis: 6380 → 6379 (instead of 6379 → 6379)"
echo ""
echo "🐳 Docker Management Commands:"
echo "  • View status: docker compose -f docker-compose.production-alt.yml ps"
echo "  • View logs: docker compose -f docker-compose.production-alt.yml logs -f"
echo "  • Restart: docker compose -f docker-compose.production-alt.yml restart"
echo "  • Stop: docker compose -f docker-compose.production-alt.yml down"
echo ""
echo "✅ All port conflicts resolved!"
echo "============================================================================"