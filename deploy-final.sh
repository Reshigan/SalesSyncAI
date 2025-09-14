#!/bin/bash

# SalesSync AI - Final Production Deployment Script
# This script handles all Docker build issues and deploys the complete application

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
    error "This script should not be run as root for security reasons"
    error "Please run as a regular user with sudo access"
    exit 1
fi

# Check if Docker is installed and running
if ! command -v docker &> /dev/null; then
    error "Docker is not installed. Please install Docker first."
    exit 1
fi

if ! docker info &> /dev/null; then
    error "Docker is not running or you don't have permission to access it."
    error "Please start Docker or add your user to the docker group:"
    error "sudo usermod -aG docker \$USER"
    error "Then log out and log back in."
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Use docker compose or docker-compose based on availability
DOCKER_COMPOSE="docker compose"
if ! docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
fi

log "Starting SalesSync AI Production Deployment"
log "Using: $DOCKER_COMPOSE"

# Create necessary directories
log "Creating necessary directories..."
mkdir -p nginx/logs nginx/ssl nginx/conf.d database/data database/logs redis/data backend/logs

# Set proper permissions
log "Setting proper permissions..."
chmod -R 755 nginx database redis backend
find . -name "*.sh" -exec chmod +x {} \;

# Stop any existing containers
log "Stopping existing containers..."
$DOCKER_COMPOSE down --remove-orphans || true

# Remove old images to force rebuild
log "Removing old images to force clean rebuild..."
docker rmi salessyncai-backend:latest 2>/dev/null || true
docker rmi salessyncai-frontend:latest 2>/dev/null || true

# Clean up Docker system
log "Cleaning up Docker system..."
docker system prune -f

# Build and start services
log "Building and starting services..."
log "This may take several minutes for the first build..."

# Build with no cache to ensure fresh build
$DOCKER_COMPOSE build --no-cache --parallel

# Start services
log "Starting services..."
$DOCKER_COMPOSE up -d

# Wait for services to be ready
log "Waiting for services to start..."
sleep 30

# Check service health
log "Checking service health..."

# Function to check if a service is healthy
check_service_health() {
    local service=$1
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if $DOCKER_COMPOSE ps $service | grep -q "healthy\|Up"; then
            log "$service is healthy"
            return 0
        fi
        
        info "Waiting for $service to be healthy (attempt $attempt/$max_attempts)..."
        sleep 10
        ((attempt++))
    done
    
    warn "$service is not healthy after $max_attempts attempts"
    return 1
}

# Check each service
services=("postgres" "redis" "backend" "frontend")
for service in "${services[@]}"; do
    check_service_health $service
done

# Show service status
log "Service Status:"
$DOCKER_COMPOSE ps

# Show logs for any failed services
log "Checking for any service issues..."
for service in "${services[@]}"; do
    if ! $DOCKER_COMPOSE ps $service | grep -q "Up"; then
        error "$service is not running properly. Showing logs:"
        $DOCKER_COMPOSE logs --tail=50 $service
    fi
done

# Test API endpoint
log "Testing API endpoint..."
sleep 10
if curl -f -s http://localhost:3001/health > /dev/null; then
    log "✅ Backend API is responding"
else
    warn "❌ Backend API is not responding"
    info "Backend logs:"
    $DOCKER_COMPOSE logs --tail=20 backend
fi

# Test frontend
log "Testing frontend..."
if curl -f -s http://localhost:3000 > /dev/null; then
    log "✅ Frontend is responding"
else
    warn "❌ Frontend is not responding"
    info "Frontend logs:"
    $DOCKER_COMPOSE logs --tail=20 frontend
fi

# Display deployment information
log "🎉 SalesSync AI Deployment Complete!"
echo
log "📊 Service URLs:"
log "  • Frontend: http://localhost:3000"
log "  • Backend API: http://localhost:3001"
log "  • API Health: http://localhost:3001/health"
log "  • API Docs: http://localhost:3001/api-docs"
echo
log "🌐 Production URLs (after DNS/SSL setup):"
log "  • Application: https://ssai.gonxt.tech"
log "  • API: https://ssai.gonxt.tech/api"
echo
log "🔧 Management Commands:"
log "  • View logs: $DOCKER_COMPOSE logs -f [service]"
log "  • Restart: $DOCKER_COMPOSE restart [service]"
log "  • Stop: $DOCKER_COMPOSE down"
log "  • Update: git pull && $DOCKER_COMPOSE up -d --build"
echo
log "📁 Important directories:"
log "  • Database data: ./database/data"
log "  • Application logs: ./backend/logs"
log "  • Nginx logs: ./nginx/logs"
echo

# Check if all services are running
all_healthy=true
for service in "${services[@]}"; do
    if ! $DOCKER_COMPOSE ps $service | grep -q "Up"; then
        all_healthy=false
        break
    fi
done

if $all_healthy; then
    log "🎯 All services are running successfully!"
    log "🚀 Your SalesSync AI application is ready for production!"
else
    warn "⚠️  Some services may have issues. Please check the logs above."
    warn "💡 You can run '$DOCKER_COMPOSE logs [service-name]' for detailed logs"
fi

echo
log "📋 Next Steps:"
log "1. Configure your domain DNS to point to this server"
log "2. Set up SSL certificates (Let's Encrypt recommended)"
log "3. Configure firewall rules for ports 80 and 443"
log "4. Set up monitoring and backups"
echo
log "🔍 For troubleshooting, check:"
log "  • Service logs: $DOCKER_COMPOSE logs [service]"
log "  • Service status: $DOCKER_COMPOSE ps"
log "  • System resources: docker stats"