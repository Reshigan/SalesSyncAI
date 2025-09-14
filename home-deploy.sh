#!/bin/bash

# SalesSyncAI Home Directory Deployment Script
# This script cleans up old installations in /root and /opt and deploys to home directory

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
HOME_DEPLOY_DIR="$HOME/salessync-production"
COMPOSE_FILE="docker-compose.simple.yml"
ENV_FILE=".env"
DOMAIN=${DOMAIN:-$(curl -s ifconfig.me 2>/dev/null || echo "localhost")}

# Logging functions
log_info() {
    echo -e "${CYAN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

log_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] ✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️ $1${NC}"
}

log_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ❌ $1${NC}"
}

# Function to check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        log_warning "Running as root. This script is designed to deploy to user home directory."
        log_info "Consider running as a regular user for better security."
    fi
}

# Function to clean up old installations
cleanup_old_installations() {
    log_info "🧹 Cleaning up old installations..."
    
    # Stop any running Docker containers from previous deployments
    log_info "Stopping any existing SalesSyncAI containers..."
    docker ps -a --filter "name=salessync" --format "{{.Names}}" | while read container; do
        if [ ! -z "$container" ]; then
            log_info "Stopping container: $container"
            docker stop "$container" 2>/dev/null || true
            docker rm "$container" 2>/dev/null || true
        fi
    done
    
    # Clean up Docker images
    log_info "Cleaning up old Docker images..."
    docker images --filter "reference=salessync*" --format "{{.Repository}}:{{.Tag}}" | while read image; do
        if [ ! -z "$image" ]; then
            log_info "Removing image: $image"
            docker rmi "$image" 2>/dev/null || true
        fi
    done
    
    # Clean up potential installation directories
    CLEANUP_DIRS=(
        "/opt/salessync"
        "/opt/SalesSyncAI"
        "/root/salessync"
        "/root/SalesSyncAI"
        "/var/www/salessync"
        "/usr/local/salessync"
    )
    
    for dir in "${CLEANUP_DIRS[@]}"; do
        if [ -d "$dir" ]; then
            log_warning "Found old installation at $dir"
            read -p "Remove $dir? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                log_info "Removing $dir..."
                sudo rm -rf "$dir" 2>/dev/null || rm -rf "$dir" 2>/dev/null || log_warning "Could not remove $dir"
            fi
        fi
    done
    
    # Clean up systemd services
    SYSTEMD_SERVICES=(
        "salessync"
        "salessync-api"
        "salessync-frontend"
        "salessync-backend"
    )
    
    for service in "${SYSTEMD_SERVICES[@]}"; do
        if systemctl list-unit-files | grep -q "$service"; then
            log_info "Found systemd service: $service"
            sudo systemctl stop "$service" 2>/dev/null || true
            sudo systemctl disable "$service" 2>/dev/null || true
            sudo rm -f "/etc/systemd/system/$service.service" 2>/dev/null || true
        fi
    done
    
    # Reload systemd if we removed any services
    sudo systemctl daemon-reload 2>/dev/null || true
    
    log_success "Cleanup completed!"
}

# Function to setup home directory deployment
setup_home_deployment() {
    log_info "🏠 Setting up home directory deployment..."
    
    # Create deployment directory
    if [ -d "$HOME_DEPLOY_DIR" ]; then
        log_warning "Deployment directory already exists: $HOME_DEPLOY_DIR"
        read -p "Remove existing deployment? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm -rf "$HOME_DEPLOY_DIR"
        else
            log_error "Deployment cancelled."
            exit 1
        fi
    fi
    
    mkdir -p "$HOME_DEPLOY_DIR"
    log_success "Created deployment directory: $HOME_DEPLOY_DIR"
    
    # Copy application files
    log_info "Copying application files..."
    cp -r . "$HOME_DEPLOY_DIR/"
    
    # Set proper permissions
    chmod +x "$HOME_DEPLOY_DIR/docker-deploy.sh"
    chmod +x "$HOME_DEPLOY_DIR/home-deploy.sh"
    
    log_success "Application files copied to $HOME_DEPLOY_DIR"
}

# Function to generate secure passwords
generate_passwords() {
    log_info "🔐 Generating secure passwords..."
    
    # Generate random hex passwords (no special characters to avoid shell issues)
    POSTGRES_PASSWORD=$(openssl rand -hex 16)
    REDIS_PASSWORD=$(openssl rand -hex 16)
    JWT_SECRET=$(openssl rand -hex 32)
    JWT_REFRESH_SECRET=$(openssl rand -hex 32)
    
    log_success "Secure passwords generated"
}

# Function to create environment file
create_environment_file() {
    log_info "📝 Creating environment file..."
    
    cat > "$HOME_DEPLOY_DIR/$ENV_FILE" << EOF
# SalesSyncAI Production Environment Configuration
# Generated on $(date)

# Database Configuration
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
DATABASE_URL=postgresql://salessync_user:$POSTGRES_PASSWORD@postgres:5432/salessync_prod

# Redis Configuration
REDIS_PASSWORD=$REDIS_PASSWORD
REDIS_URL=redis://:$REDIS_PASSWORD@redis:6379

# JWT Configuration
JWT_SECRET=$JWT_SECRET
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET

# Application Configuration
NODE_ENV=production
CORS_ORIGIN=*
LOG_LEVEL=info
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Frontend Configuration
REACT_APP_API_URL=http://$DOMAIN:3000/api

# Domain Configuration
DOMAIN=$DOMAIN
EOF
    
    log_success "Environment file created: $HOME_DEPLOY_DIR/$ENV_FILE"
}

# Function to deploy with Docker
deploy_with_docker() {
    log_info "🚀 Deploying SalesSyncAI with Docker..."
    
    cd "$HOME_DEPLOY_DIR"
    
    # Check if Docker is available
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    # Check if Docker Compose is available
    if docker compose version &> /dev/null; then
        DOCKER_COMPOSE_CMD="docker compose"
    elif docker-compose --version &> /dev/null; then
        DOCKER_COMPOSE_CMD="docker-compose"
    else
        log_error "Docker Compose is not available. Please install Docker Compose."
        exit 1
    fi
    
    log_success "Using: $DOCKER_COMPOSE_CMD"
    
    # Deploy with Docker Compose
    log_info "📦 Building and starting containers..."
    $DOCKER_COMPOSE_CMD -f "$COMPOSE_FILE" up -d --build
    
    # Wait for services to be healthy
    log_info "⏳ Waiting for services to be healthy..."
    sleep 30
    
    # Check service health
    log_info "🔍 Checking service health..."
    $DOCKER_COMPOSE_CMD -f "$COMPOSE_FILE" ps
    
    # Run database migrations
    log_info "🗄️ Running database migrations..."
    $DOCKER_COMPOSE_CMD -f "$COMPOSE_FILE" exec -T backend npx prisma migrate deploy || log_warning "Migration may have failed"
    
    # Try to seed the database
    log_info "🌱 Seeding database..."
    $DOCKER_COMPOSE_CMD -f "$COMPOSE_FILE" exec -T backend npx prisma db seed || log_warning "Seeding may have failed"
}

# Function to create management scripts
create_management_scripts() {
    log_info "📋 Creating management scripts..."
    
    # Create start script
    cat > "$HOME_DEPLOY_DIR/start.sh" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
docker compose -f docker-compose.simple.yml up -d
echo "SalesSyncAI started!"
EOF
    
    # Create stop script
    cat > "$HOME_DEPLOY_DIR/stop.sh" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
docker compose -f docker-compose.simple.yml down
echo "SalesSyncAI stopped!"
EOF
    
    # Create status script
    cat > "$HOME_DEPLOY_DIR/status.sh" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
echo "=== SalesSyncAI Status ==="
docker compose -f docker-compose.simple.yml ps
echo ""
echo "=== Service Logs (last 20 lines) ==="
docker compose -f docker-compose.simple.yml logs --tail=20
EOF
    
    # Create logs script
    cat > "$HOME_DEPLOY_DIR/logs.sh" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
if [ -z "$1" ]; then
    echo "Usage: $0 [service_name]"
    echo "Available services: backend, frontend, postgres, redis"
    echo "Or use 'all' to see all logs"
    exit 1
fi

if [ "$1" = "all" ]; then
    docker compose -f docker-compose.simple.yml logs -f
else
    docker compose -f docker-compose.simple.yml logs -f "$1"
fi
EOF
    
    # Create update script
    cat > "$HOME_DEPLOY_DIR/update.sh" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
echo "Updating SalesSyncAI..."
docker compose -f docker-compose.simple.yml down
docker compose -f docker-compose.simple.yml pull
docker compose -f docker-compose.simple.yml up -d --build
echo "SalesSyncAI updated!"
EOF
    
    # Make scripts executable
    chmod +x "$HOME_DEPLOY_DIR"/*.sh
    
    log_success "Management scripts created in $HOME_DEPLOY_DIR"
}

# Function to display deployment summary
display_summary() {
    echo ""
    echo "========================================"
    echo -e "${GREEN}✅ DEPLOYMENT COMPLETED!${NC}"
    echo "========================================"
    echo ""
    log_success "SalesSyncAI has been successfully deployed to your home directory!"
    echo ""
    log_info "📍 Deployment Location: $HOME_DEPLOY_DIR"
    log_info "🌐 Application: http://$DOMAIN"
    log_info "🔗 API: http://$DOMAIN:3000/api"
    log_info "❤️ Health Check: http://$DOMAIN/health.html"
    echo ""
    log_info "🔧 Management Commands:"
    log_info "  📊 Status: cd $HOME_DEPLOY_DIR && ./status.sh"
    log_info "  📋 Logs: cd $HOME_DEPLOY_DIR && ./logs.sh [service]"
    log_info "  🔄 Start: cd $HOME_DEPLOY_DIR && ./start.sh"
    log_info "  🛑 Stop: cd $HOME_DEPLOY_DIR && ./stop.sh"
    log_info "  🔄 Update: cd $HOME_DEPLOY_DIR && ./update.sh"
    echo ""
    log_info "🔐 Credentials saved in: $HOME_DEPLOY_DIR/$ENV_FILE"
    echo ""
    log_info "🎯 Deployment complete! Visit http://$DOMAIN to access your application."
}

# Main execution
main() {
    echo "========================================"
    echo -e "${BLUE}🏠 SALESSYNC HOME DEPLOYMENT${NC}"
    echo "========================================"
    log_info "This script will clean up old installations and deploy SalesSyncAI to your home directory"
    echo ""
    log_info "📍 Domain/IP: $DOMAIN"
    log_info "📁 Deployment Directory: $HOME_DEPLOY_DIR"
    log_info "📝 Environment File: $ENV_FILE"
    echo ""
    
    read -p "Continue with deployment? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Deployment cancelled."
        exit 0
    fi
    
    check_root
    cleanup_old_installations
    setup_home_deployment
    generate_passwords
    create_environment_file
    deploy_with_docker
    create_management_scripts
    display_summary
}

# Run main function
main "$@"