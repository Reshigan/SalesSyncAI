#!/bin/bash

# SalesSyncAI Docker Production Deployment Script
# This script deploys SalesSyncAI using Docker Compose

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.simple.yml"
ENV_FILE=".env"
DOMAIN=${DOMAIN:-$(curl -s ifconfig.me 2>/dev/null || echo "localhost")}

# Logging functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

section() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}========================================${NC}"
}

# Check if Docker is installed and running
check_docker() {
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install Docker first."
    fi
    
    if ! docker info &> /dev/null; then
        error "Docker is not running. Please start Docker first."
    fi
    
    # Check for docker compose (new syntax) or docker-compose (legacy)
    if docker compose version &> /dev/null; then
        DOCKER_COMPOSE="docker compose"
    elif command -v docker-compose &> /dev/null; then
        DOCKER_COMPOSE="docker-compose"
    else
        error "Docker Compose is not available. Please install Docker Compose first."
    fi
    
    log "✅ Using: $DOCKER_COMPOSE"
}

# Generate secure passwords
generate_passwords() {
    log "🔐 Generating secure passwords..."
    
    POSTGRES_PASSWORD=$(openssl rand -hex 16 2>/dev/null || echo "SalesSync2024Prod$(date +%s)")
    REDIS_PASSWORD=$(openssl rand -hex 16 2>/dev/null || echo "SalesSync2024Redis$(date +%s)")
    JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || echo "SalesSync2024JWTSecret$(date +%s)")
    JWT_REFRESH_SECRET=$(openssl rand -hex 32 2>/dev/null || echo "SalesSync2024JWTRefreshSecret$(date +%s)")
}

# Create environment file
create_env_file() {
    log "📝 Creating environment file..."
    
    cat > "$ENV_FILE" << EOF
# SalesSyncAI Production Environment - Generated $(date)

# Database Configuration
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
DATABASE_URL=postgresql://salessync_user:$POSTGRES_PASSWORD@postgres:5432/salessync_prod

# Redis Configuration
REDIS_PASSWORD=$REDIS_PASSWORD
REDIS_URL=redis://:$REDIS_PASSWORD@redis:6379

# JWT Configuration
JWT_SECRET=$JWT_SECRET
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET

# CORS Configuration
CORS_ORIGIN=http://$DOMAIN,https://$DOMAIN

# Frontend Configuration
REACT_APP_API_URL=http://$DOMAIN/api
EOF

    chmod 600 "$ENV_FILE"
    log "✅ Environment file created: $ENV_FILE"
}

# Deploy with Docker Compose
deploy_application() {
    log "🚀 Deploying SalesSyncAI with Docker Compose..."
    
    # Stop any existing containers
    if $DOCKER_COMPOSE -f "$COMPOSE_FILE" ps -q 2>/dev/null | grep -q .; then
        log "🛑 Stopping existing containers..."
        $DOCKER_COMPOSE -f "$COMPOSE_FILE" down
    fi
    
    # Pull latest images and build
    log "📦 Building and starting containers..."
    $DOCKER_COMPOSE -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build
    
    # Wait for services to be healthy
    log "⏳ Waiting for services to be healthy..."
    sleep 30
    
    # Check service health
    check_services_health
}

# Check if services are healthy
check_services_health() {
    log "🔍 Checking service health..."
    
    services=("postgres" "redis" "backend" "frontend")
    for service in "${services[@]}"; do
        if $DOCKER_COMPOSE -f "$COMPOSE_FILE" ps "$service" | grep -q "Up (healthy)"; then
            log "✅ $service is healthy"
        else
            warning "❌ $service may not be healthy"
            $DOCKER_COMPOSE -f "$COMPOSE_FILE" logs "$service" | tail -10
        fi
    done
}

# Run database migrations
run_migrations() {
    log "🗄️ Running database migrations..."
    
    # Wait for backend to be ready
    sleep 10
    
    # Run Prisma migrations
    $DOCKER_COMPOSE -f "$COMPOSE_FILE" exec -T backend npx prisma migrate deploy || warning "Migration may have failed"
    
    # Run database seeding
    $DOCKER_COMPOSE -f "$COMPOSE_FILE" exec -T backend npx prisma db seed || warning "Seeding may have failed"
}

# Display deployment information
show_deployment_info() {
    section "✅ DEPLOYMENT COMPLETED!"
    
    log ""
    log "🎉 SalesSyncAI has been successfully deployed with Docker!"
    log ""
    log "📍 Access Information:"
    log "  🌐 Application: http://$DOMAIN"
    log "  🔗 API: http://$DOMAIN/api"
    log "  ❤️ Health Check: http://$DOMAIN/health.html"
    log ""
    log "🔧 Management Commands:"
    log "  📊 Status: $DOCKER_COMPOSE -f $COMPOSE_FILE ps"
    log "  📋 Logs: $DOCKER_COMPOSE -f $COMPOSE_FILE logs -f [service]"
    log "  🔄 Restart: $DOCKER_COMPOSE -f $COMPOSE_FILE restart [service]"
    log "  🛑 Stop: $DOCKER_COMPOSE -f $COMPOSE_FILE down"
    log ""
    log "🔐 Credentials saved in: $ENV_FILE"
    log ""
    
    # Show running containers
    log "🐳 Running Containers:"
    $DOCKER_COMPOSE -f "$COMPOSE_FILE" ps
}

# Main deployment function
main() {
    section "🚀 SALESSYNC DOCKER DEPLOYMENT"
    
    log "This script will deploy SalesSyncAI using Docker Compose"
    log ""
    log "📍 Domain/IP: $DOMAIN"
    log "📁 Compose File: $COMPOSE_FILE"
    log "📝 Environment File: $ENV_FILE"
    log ""
    log "🚀 Starting deployment in 3 seconds..."
    sleep 3
    
    # Run deployment steps
    check_docker
    generate_passwords
    create_env_file
    deploy_application
    run_migrations
    show_deployment_info
    
    log ""
    log "🎯 Deployment complete! Visit http://$DOMAIN to access your application."
}

# Run main function
main "$@"