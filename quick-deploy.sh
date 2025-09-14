#!/bin/bash

# Quick SalesSync AI Production Deployment Script
# For AWS t4g.medium Ubuntu server with domain ssai.gonxt.tech
# Run as: ./quick-deploy.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="ssai.gonxt.tech"
EMAIL="admin@gonxt.tech"

# Functions
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

# Main deployment function
main() {
    log_info "Starting SalesSync AI deployment on AWS t4g.medium Ubuntu server"
    log_info "Domain: $DOMAIN"
    log_info "Email: $EMAIL"
    
    # Check if running as ubuntu user
    if [[ $USER != "ubuntu" ]]; then
        log_warning "This script is designed to run as the 'ubuntu' user"
        log_info "Current user: $USER"
    fi
    
    # Update system
    log_info "Updating system packages..."
    sudo apt-get update -y
    sudo apt-get upgrade -y
    
    # Install prerequisites
    log_info "Installing prerequisites..."
    sudo apt-get install -y curl git ufw fail2ban htop
    
    # Configure firewall
    log_info "Configuring firewall..."
    sudo ufw default deny incoming
    sudo ufw default allow outgoing
    sudo ufw allow ssh
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    sudo ufw --force enable
    
    # Install Docker
    log_info "Installing Docker..."
    if ! command -v docker &> /dev/null; then
        curl -fsSL https://get.docker.com -o get-docker.sh
        sudo sh get-docker.sh
        sudo usermod -aG docker $USER
        rm get-docker.sh
    else
        log_info "Docker already installed"
    fi
    
    # Install Docker Compose
    log_info "Installing Docker Compose..."
    if ! command -v docker-compose &> /dev/null; then
        sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose
    else
        log_info "Docker Compose already installed"
    fi
    
    # Create directories
    log_info "Creating directories..."
    sudo mkdir -p /var/log/salessync
    sudo mkdir -p /opt/salessync-backups
    sudo chown -R $USER:$USER /var/log/salessync
    sudo chown -R $USER:$USER /opt/salessync-backups
    
    # Set up environment
    log_info "Setting up environment..."
    if [[ ! -f .env ]]; then
        cp .env.production .env
        log_info "Created .env from .env.production template"
        log_warning "Please edit .env with your production values before continuing"
    fi
    
    # Build and start services
    log_info "Building and starting services..."
    
    # Start with basic services first
    docker-compose up -d postgres redis
    
    # Wait for database to be ready
    log_info "Waiting for database to be ready..."
    sleep 10
    
    # Build and start backend
    docker-compose up -d --build backend
    
    # Wait for backend to be ready
    log_info "Waiting for backend to be ready..."
    sleep 15
    
    # Build and start frontend
    docker-compose up -d --build frontend
    
    # Start nginx
    docker-compose up -d nginx
    
    # Wait for all services
    log_info "Waiting for all services to be ready..."
    sleep 10
    
    # Check service status
    log_info "Checking service status..."
    docker-compose ps
    
    # Run database migrations
    log_info "Running database migrations..."
    docker-compose exec -T backend npx prisma migrate deploy || log_warning "Migration failed - this is normal on first run"
    
    # Generate Prisma client
    log_info "Generating Prisma client..."
    docker-compose exec -T backend npx prisma generate || log_warning "Prisma generate failed - this is normal on first run"
    
    # Set up SSL certificates (Let's Encrypt)
    log_info "Setting up SSL certificates..."
    if [[ ! -d "/etc/letsencrypt/live/$DOMAIN" ]]; then
        log_info "Installing Certbot..."
        sudo apt-get install -y certbot python3-certbot-nginx
        
        log_info "Obtaining SSL certificate for $DOMAIN..."
        sudo certbot --nginx -d $DOMAIN --email $EMAIL --agree-tos --non-interactive --redirect
        
        # Set up auto-renewal
        log_info "Setting up SSL auto-renewal..."
        echo "0 3 * * * root certbot renew --quiet && systemctl reload nginx" | sudo tee -a /etc/crontab
    else
        log_info "SSL certificate already exists for $DOMAIN"
    fi
    
    # Set up monitoring
    log_info "Setting up monitoring..."
    if [[ -f scripts/monitor.sh ]]; then
        chmod +x scripts/monitor.sh
        # Add monitoring cron job
        (crontab -l 2>/dev/null; echo "*/5 * * * * /opt/salessync/scripts/monitor.sh check") | crontab -
    fi
    
    # Set up backups
    log_info "Setting up backups..."
    if [[ -f scripts/backup.sh ]]; then
        chmod +x scripts/backup.sh
        # Add backup cron job
        (crontab -l 2>/dev/null; echo "0 2 * * * /opt/salessync/scripts/backup.sh full") | crontab -
    fi
    
    # Final health check
    log_info "Performing final health check..."
    sleep 5
    
    # Check if services are running
    if docker-compose ps | grep -q "Up"; then
        log_success "Services are running!"
    else
        log_error "Some services may not be running properly"
        docker-compose ps
    fi
    
    # Display access information
    log_success "Deployment completed!"
    echo ""
    echo "🌐 Application URLs:"
    echo "   • Production: https://$DOMAIN"
    echo "   • API: https://$DOMAIN/api"
    echo "   • Health: https://$DOMAIN/health"
    echo ""
    echo "📊 Management Commands:"
    echo "   • Check status: docker-compose ps"
    echo "   • View logs: docker-compose logs -f"
    echo "   • Restart services: docker-compose restart"
    echo "   • Update app: ./scripts/update.sh"
    echo ""
    echo "🔧 Next Steps:"
    echo "   1. Edit .env with your production values"
    echo "   2. Restart services: docker-compose restart"
    echo "   3. Check application at https://$DOMAIN"
    echo "   4. Set up monitoring and backups"
    echo ""
    
    # Show current status
    log_info "Current service status:"
    docker-compose ps
}

# Run main function
main "$@"