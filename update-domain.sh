#!/bin/bash

# Update domain configuration to ssai.gonxt.tech
# Run this on your server after pulling the latest changes

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
    log_info "Updating SalesSync AI to use domain: ssai.gonxt.tech"
    
    # Pull latest changes
    log_info "Pulling latest changes from GitHub..."
    git pull origin main
    
    # Stop current services
    log_info "Stopping current services..."
    docker-compose down
    
    # Update environment file
    log_info "Updating environment configuration..."
    cp .env.production .env
    
    # Rebuild and restart services
    log_info "Rebuilding and restarting services..."
    docker-compose up -d --build
    
    # Wait for services to start
    log_info "Waiting for services to start..."
    sleep 30
    
    # Check service status
    log_info "Checking service status..."
    docker-compose ps
    
    # Test the application
    log_info "Testing application..."
    if curl -k -s https://ssai.gonxt.tech/health > /dev/null 2>&1; then
        log_success "Application is responding at https://ssai.gonxt.tech"
    else
        log_warning "Application may not be ready yet. Please wait a few minutes."
        log_info "You can check logs with: docker-compose logs -f"
    fi
    
    # Update SSL certificate if needed
    log_info "Checking SSL certificate..."
    if [[ ! -d "/etc/letsencrypt/live/ssai.gonxt.tech" ]]; then
        log_warning "SSL certificate for ssai.gonxt.tech not found"
        log_info "To set up SSL certificate, run:"
        echo "sudo certbot --nginx -d ssai.gonxt.tech --email admin@gonxt.tech --agree-tos --non-interactive"
    else
        log_success "SSL certificate exists for ssai.gonxt.tech"
    fi
    
    log_success "Domain update completed!"
    echo ""
    echo "🌐 Your application is now available at:"
    echo "   • https://ssai.gonxt.tech"
    echo "   • https://ssai.gonxt.tech/api"
    echo ""
    echo "📊 Management commands:"
    echo "   • Check status: docker-compose ps"
    echo "   • View logs: docker-compose logs -f"
    echo "   • Restart: docker-compose restart"
    echo ""
}

main "$@"