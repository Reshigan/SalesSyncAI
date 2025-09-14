#!/bin/bash

# Fix SalesSync AI deployment for ssai.gonxt.tech
# Run this script on your server to get the application working

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
    log_info "🚀 Fixing SalesSync AI deployment for ssai.gonxt.tech"
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
    docker-compose down 2>/dev/null || true
    
    # Check Docker installation
    log_info "🐳 Checking Docker installation..."
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        log_warning "Docker daemon is not running. Starting Docker..."
        sudo systemctl start docker
        sudo systemctl enable docker
        sleep 5
    fi
    
    # Add user to docker group if needed
    if ! groups $USER | grep -q docker; then
        log_info "👤 Adding user to docker group..."
        sudo usermod -aG docker $USER
        log_warning "Please log out and log back in, then run this script again."
        exit 0
    fi
    
    # Build and start services
    log_info "🔨 Building and starting services..."
    docker-compose up -d --build
    
    # Wait for services to start
    log_info "⏳ Waiting for services to start (60 seconds)..."
    sleep 60
    
    # Check service status
    log_info "📊 Checking service status..."
    docker-compose ps
    
    # Check if services are healthy
    log_info "🏥 Checking service health..."
    
    # Check backend
    if docker-compose ps backend | grep -q "Up"; then
        log_success "✅ Backend service is running"
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
    
    # Test HTTP (should redirect to HTTPS)
    if curl -s -o /dev/null -w "%{http_code}" http://ssai.gonxt.tech | grep -q "301\|302"; then
        log_success "✅ HTTP redirect is working"
    else
        log_warning "⚠️  HTTP redirect may not be working"
    fi
    
    # Test HTTPS
    if curl -k -s -o /dev/null -w "%{http_code}" https://ssai.gonxt.tech | grep -q "200"; then
        log_success "✅ HTTPS frontend is responding"
    else
        log_warning "⚠️  HTTPS frontend is not responding yet"
    fi
    
    # Test API
    if curl -k -s -o /dev/null -w "%{http_code}" https://ssai.gonxt.tech/api/health | grep -q "200"; then
        log_success "✅ API is responding"
    else
        log_warning "⚠️  API is not responding yet"
    fi
    
    echo ""
    log_success "🎉 Deployment fix completed!"
    echo ""
    echo "🌐 Your application should be available at:"
    echo "   • https://ssai.gonxt.tech"
    echo "   • https://ssai.gonxt.tech/api"
    echo ""
    echo "📊 Management commands:"
    echo "   • Check status: docker-compose ps"
    echo "   • View logs: docker-compose logs -f [service]"
    echo "   • Restart: docker-compose restart"
    echo "   • Stop: docker-compose down"
    echo ""
    
    if curl -k -s https://ssai.gonxt.tech > /dev/null 2>&1; then
        log_success "✅ Application is responding! Visit https://ssai.gonxt.tech"
    else
        log_warning "⚠️  Application may still be starting. Wait 2-3 minutes and try again."
        echo ""
        echo "🔍 If you still see a blank page:"
        echo "   1. Check logs: docker-compose logs -f"
        echo "   2. Restart services: docker-compose restart"
        echo "   3. Check SSL certificate: sudo certbot certificates"
        echo "   4. Verify domain DNS points to this server"
    fi
}

main "$@"