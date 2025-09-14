#!/bin/bash

# Simple deployment script for SalesSync AI
# This script fixes the Docker build issues and deploys the application

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

main() {
    log_info "🚀 Starting SalesSync AI deployment with fixed Docker configuration"
    echo ""
    
    # Check if we're in the right directory
    if [[ ! -f "docker-compose.yml" ]]; then
        log_error "docker-compose.yml not found. Please run this script from the SalesSyncAI directory."
        exit 1
    fi
    
    # Pull latest changes
    log_info "📥 Pulling latest changes from GitHub..."
    git pull origin main
    
    # Copy production environment
    log_info "⚙️  Setting up production environment..."
    cp .env.production .env
    
    # Stop any running services
    log_info "🛑 Stopping any running services..."
    docker-compose down --remove-orphans 2>/dev/null || true
    
    # Remove old images to force rebuild
    log_info "🧹 Cleaning up old Docker images..."
    docker-compose down --rmi all --volumes --remove-orphans 2>/dev/null || true
    
    # Check Docker installation
    log_info "🐳 Checking Docker installation..."
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Installing Docker..."
        curl -fsSL https://get.docker.com -o get-docker.sh
        sudo sh get-docker.sh
        sudo usermod -aG docker $USER
        log_warning "Please log out and log back in, then run this script again."
        exit 0
    fi
    
    if ! docker info &> /dev/null; then
        log_warning "Docker daemon is not running. Starting Docker..."
        sudo systemctl start docker
        sudo systemctl enable docker
        sleep 5
    fi
    
    # Build and start services with no cache
    log_info "🔨 Building and starting services (this may take a few minutes)..."
    docker-compose build --no-cache
    docker-compose up -d
    
    # Wait for services to start
    log_info "⏳ Waiting for services to start (90 seconds)..."
    sleep 90
    
    # Check service status
    log_info "📊 Checking service status..."
    docker-compose ps
    
    # Check if services are healthy
    log_info "🏥 Checking service health..."
    
    # Check backend
    if docker-compose ps backend | grep -q "Up"; then
        log_success "✅ Backend service is running"
        # Test backend health
        if docker-compose exec -T backend curl -f http://localhost:3001/health 2>/dev/null; then
            log_success "✅ Backend health check passed"
        else
            log_warning "⚠️  Backend health check failed"
        fi
    else
        log_error "❌ Backend service is not running"
        log_info "Backend logs:"
        docker-compose logs --tail=20 backend
    fi
    
    # Check frontend
    if docker-compose ps frontend | grep -q "Up"; then
        log_success "✅ Frontend service is running"
    else
        log_error "❌ Frontend service is not running"
        log_info "Frontend logs:"
        docker-compose logs --tail=20 frontend
    fi
    
    # Check nginx
    if docker-compose ps nginx | grep -q "Up"; then
        log_success "✅ Nginx service is running"
    else
        log_error "❌ Nginx service is not running"
        log_info "Nginx logs:"
        docker-compose logs --tail=20 nginx
    fi
    
    # Check database
    if docker-compose ps postgres | grep -q "Up"; then
        log_success "✅ Database service is running"
    else
        log_error "❌ Database service is not running"
        log_info "Database logs:"
        docker-compose logs --tail=20 postgres
    fi
    
    # Test the application
    log_info "🧪 Testing application endpoints..."
    
    # Wait a bit more for nginx to be ready
    sleep 30
    
    # Test HTTP (should redirect to HTTPS)
    if curl -s -o /dev/null -w "%{http_code}" http://ssai.gonxt.tech 2>/dev/null | grep -q "301\|302\|200"; then
        log_success "✅ HTTP endpoint is responding"
    else
        log_warning "⚠️  HTTP endpoint is not responding yet"
    fi
    
    # Test HTTPS (may fail if SSL not set up yet)
    if curl -k -s -o /dev/null -w "%{http_code}" https://ssai.gonxt.tech 2>/dev/null | grep -q "200"; then
        log_success "✅ HTTPS frontend is responding"
    else
        log_warning "⚠️  HTTPS frontend is not responding (SSL may not be configured yet)"
    fi
    
    echo ""
    log_success "🎉 Deployment completed!"
    echo ""
    echo "🌐 Your application should be available at:"
    echo "   • http://ssai.gonxt.tech (will redirect to HTTPS once SSL is configured)"
    echo "   • https://ssai.gonxt.tech (once SSL certificates are installed)"
    echo ""
    echo "📊 Management commands:"
    echo "   • Check status: docker-compose ps"
    echo "   • View logs: docker-compose logs -f [service]"
    echo "   • Restart: docker-compose restart"
    echo "   • Stop: docker-compose down"
    echo ""
    echo "🔒 To set up SSL certificates, run:"
    echo "   sudo certbot --nginx -d ssai.gonxt.tech"
    echo ""
    
    # Show final status
    if curl -s http://ssai.gonxt.tech > /dev/null 2>&1; then
        log_success "✅ Application is responding! Visit http://ssai.gonxt.tech"
    else
        log_warning "⚠️  Application may still be starting. Wait 2-3 minutes and try again."
        echo ""
        echo "🔍 If you still see issues:"
        echo "   1. Check logs: docker-compose logs -f"
        echo "   2. Restart services: docker-compose restart"
        echo "   3. Check if domain DNS points to this server"
        echo "   4. Verify firewall allows ports 80 and 443"
    fi
}

main "$@"