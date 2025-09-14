#!/bin/bash

# SalesSync AI - Production Deployment Script (TypeScript Fixed)
# This script deploys the complete SalesSync AI application with TypeScript build fixes

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
}

success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] SUCCESS:${NC} $1"
}

warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

# Configuration
DOMAIN="ssai.gonxt.tech"
EMAIL="admin@gonxt.tech"
PROJECT_DIR="$(pwd)"
COMPOSE_FILE="docker-compose.yml"

log "🚀 Starting SalesSync AI Production Deployment"
log "Domain: $DOMAIN"
log "Project Directory: $PROJECT_DIR"

# Verify we're in the right directory
if [[ ! -f "package.json" ]] || [[ ! -d "frontend" ]] || [[ ! -d "backend" ]]; then
    error "Not in SalesSync AI project directory!"
    error "Please run this script from the project root directory."
    exit 1
fi

# Check required directories and files
log "🔍 Verifying project structure..."

REQUIRED_DIRS=("frontend" "backend" "frontend/public")
REQUIRED_FILES=("docker-compose.yml" "frontend/package.json" "backend/package.json" "frontend/public/index.html")

for dir in "${REQUIRED_DIRS[@]}"; do
    if [[ ! -d "$dir" ]]; then
        error "Required directory $dir not found!"
        exit 1
    fi
done

for file in "${REQUIRED_FILES[@]}"; do
    if [[ ! -f "$file" ]]; then
        error "Required file $file not found!"
        exit 1
    fi
done

success "✅ Project structure verified"

# Check if Docker is installed and running
log "🐳 Checking Docker installation..."
if ! command -v docker &> /dev/null; then
    error "Docker is not installed!"
    log "Installing Docker..."
    
    # Update package index
    sudo apt-get update
    
    # Install prerequisites
    sudo apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release
    
    # Add Docker's official GPG key
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    
    # Add Docker repository
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Install Docker
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io
    
    # Add current user to docker group
    sudo usermod -aG docker $USER
    
    success "✅ Docker installed successfully"
    warning "⚠️  Please log out and log back in for Docker group changes to take effect"
    warning "⚠️  Or run: newgrp docker"
fi

# Check if Docker Compose is installed
log "🐳 Checking Docker Compose installation..."
if ! command -v docker-compose &> /dev/null; then
    error "Docker Compose is not installed!"
    log "Installing Docker Compose..."
    
    # Download Docker Compose
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    
    # Make it executable
    sudo chmod +x /usr/local/bin/docker-compose
    
    success "✅ Docker Compose installed successfully"
fi

# Start Docker service if not running
if ! sudo systemctl is-active --quiet docker; then
    log "🐳 Starting Docker service..."
    sudo systemctl start docker
    sudo systemctl enable docker
fi

success "✅ Docker is ready"

# Stop existing containers
log "🛑 Stopping existing containers..."
docker-compose down --remove-orphans || true

# Remove old images to force rebuild
log "🗑️  Removing old images..."
docker image prune -f || true
docker-compose down --rmi all --volumes --remove-orphans || true

# Create necessary directories
log "📁 Creating necessary directories..."
sudo mkdir -p /var/log/salessync
sudo mkdir -p /var/lib/salessync/uploads
sudo mkdir -p /var/lib/salessync/backups
sudo mkdir -p /etc/letsencrypt
sudo mkdir -p /var/lib/postgresql/data
sudo mkdir -p /var/lib/redis

# Set proper permissions
sudo chown -R $USER:$USER /var/log/salessync
sudo chown -R $USER:$USER /var/lib/salessync
sudo chmod -R 755 /var/log/salessync
sudo chmod -R 755 /var/lib/salessync

# Build and start services
log "🏗️  Building and starting services..."

# Build backend with TypeScript support
log "🔧 Building backend (with TypeScript)..."
if ! docker-compose build backend; then
    error "Backend build failed!"
    log "Backend Dockerfile content:"
    cat backend/Dockerfile
    exit 1
fi

success "✅ Backend built successfully"

# Build frontend
log "🎨 Building frontend..."
if ! docker-compose build frontend; then
    error "Frontend build failed!"
    log "Frontend Dockerfile content:"
    cat frontend/Dockerfile.prod
    exit 1
fi

success "✅ Frontend built successfully"

# Build other services
log "🔧 Building remaining services..."
docker-compose build

# Start all services
log "🚀 Starting all services..."
docker-compose up -d

# Wait for services to be ready
log "⏳ Waiting for services to start..."
sleep 30

# Check service health
log "🏥 Checking service health..."

# Check if containers are running
SERVICES=("backend" "frontend" "postgres" "redis" "nginx")
for service in "${SERVICES[@]}"; do
    if docker-compose ps | grep -q "${service}.*Up"; then
        success "✅ $service is running"
    else
        error "❌ $service is not running"
        log "Container logs for $service:"
        docker-compose logs $service
    fi
done

# Test backend health
log "🔍 Testing backend health..."
if curl -f http://localhost:3001/health &> /dev/null; then
    success "✅ Backend health check passed"
else
    warning "⚠️  Backend health check failed, checking logs..."
    docker-compose logs backend
fi

# Test frontend
log "🔍 Testing frontend..."
if curl -f http://localhost:3000 &> /dev/null; then
    success "✅ Frontend is accessible"
else
    warning "⚠️  Frontend not accessible, checking logs..."
    docker-compose logs frontend
fi

# Test nginx
log "🔍 Testing nginx..."
if curl -f http://localhost &> /dev/null; then
    success "✅ Nginx is running"
else
    warning "⚠️  Nginx not accessible, checking logs..."
    docker-compose logs nginx
fi

# Display service status
log "📊 Service Status:"
docker-compose ps

# Display useful information
log "🎉 Deployment Summary:"
echo "=================================="
echo "🌐 Application URL: https://$DOMAIN"
echo "🔧 Backend API: https://$DOMAIN/api"
echo "📊 Health Check: https://$DOMAIN/api/health"
echo "🐳 Docker Status: docker-compose ps"
echo "📋 View Logs: docker-compose logs [service]"
echo "🔄 Restart: docker-compose restart [service]"
echo "🛑 Stop All: docker-compose down"
echo "=================================="

# SSL Certificate setup reminder
warning "🔒 SSL Certificate Setup:"
echo "1. Ensure DNS points $DOMAIN to this server"
echo "2. Run: sudo certbot --nginx -d $DOMAIN"
echo "3. Test renewal: sudo certbot renew --dry-run"

success "🎉 SalesSync AI deployment completed!"
log "📝 Check logs with: docker-compose logs -f"
log "🔍 Monitor with: watch docker-compose ps"

# Final health check
log "🏥 Final health check in 10 seconds..."
sleep 10

if curl -f http://localhost:3001/health &> /dev/null; then
    success "🎉 All systems operational!"
else
    warning "⚠️  Some services may still be starting. Check logs: docker-compose logs"
fi