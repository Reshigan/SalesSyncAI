#!/bin/bash

# Fixed SalesSync AI Production Deployment Script
# For AWS t4g.medium Ubuntu server with domain ssai.gonxt.tech
# Run as: ./deploy-fixed.sh

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

# Check and install Docker
install_docker() {
    log_info "Checking Docker installation..."
    
    if command -v docker &> /dev/null; then
        log_info "Docker is already installed"
        
        # Check if Docker daemon is running
        if ! sudo docker info &> /dev/null; then
            log_info "Starting Docker daemon..."
            sudo systemctl start docker
            sudo systemctl enable docker
        fi
    else
        log_info "Installing Docker..."
        
        # Remove any old Docker installations
        sudo apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
        
        # Update package index
        sudo apt-get update
        
        # Install prerequisites
        sudo apt-get install -y \
            ca-certificates \
            curl \
            gnupg \
            lsb-release
        
        # Add Docker's official GPG key
        sudo mkdir -p /etc/apt/keyrings
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
        
        # Set up the repository
        echo \
          "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
          $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
        
        # Install Docker Engine
        sudo apt-get update
        sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
        
        # Add user to docker group
        sudo usermod -aG docker $USER
        
        # Start and enable Docker
        sudo systemctl start docker
        sudo systemctl enable docker
    fi
    
    # Install Docker Compose standalone if not available
    if ! command -v docker-compose &> /dev/null; then
        log_info "Installing Docker Compose..."
        sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose
    fi
    
    # Test Docker installation
    log_info "Testing Docker installation..."
    if sudo docker run --rm hello-world &> /dev/null; then
        log_success "Docker is working correctly"
    else
        log_error "Docker installation failed"
        exit 1
    fi
}

# Main deployment function
main() {
    log_info "Starting SalesSync AI deployment on AWS t4g.medium Ubuntu server"
    log_info "Domain: $DOMAIN"
    log_info "Email: $EMAIL"
    
    # Clean up any previous failed installations
    log_info "Cleaning up previous installations..."
    sudo apt autoremove -y
    
    # Install Docker
    install_docker
    
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
    fi
    
    # Stop any existing containers
    log_info "Stopping any existing containers..."
    docker-compose down --remove-orphans 2>/dev/null || true
    
    # Build and start services in stages
    log_info "Building and starting services..."
    
    # Start database and cache first
    log_info "Starting database and Redis..."
    docker-compose up -d postgres redis
    
    # Wait for database to be ready
    log_info "Waiting for database to be ready..."
    sleep 15
    
    # Build and start backend
    log_info "Building and starting backend..."
    docker-compose up -d --build backend
    
    # Wait for backend to be ready
    log_info "Waiting for backend to be ready..."
    sleep 20
    
    # Build and start frontend
    log_info "Building and starting frontend..."
    docker-compose up -d --build frontend
    
    # Start nginx
    log_info "Starting Nginx..."
    docker-compose up -d nginx
    
    # Wait for all services
    log_info "Waiting for all services to be ready..."
    sleep 10
    
    # Check service status
    log_info "Checking service status..."
    docker-compose ps
    
    # Run database setup
    log_info "Setting up database..."
    docker-compose exec -T backend npx prisma migrate deploy 2>/dev/null || log_warning "Migration skipped - database may already be set up"
    docker-compose exec -T backend npx prisma generate 2>/dev/null || log_warning "Prisma generate skipped"
    
    # Set up SSL certificates
    log_info "Setting up SSL certificates..."
    if [[ ! -d "/etc/letsencrypt/live/$DOMAIN" ]]; then
        log_info "Installing Certbot..."
        sudo apt-get install -y certbot python3-certbot-nginx
        
        # Stop nginx temporarily for certificate generation
        docker-compose stop nginx
        
        log_info "Obtaining SSL certificate for $DOMAIN..."
        sudo certbot certonly --standalone -d $DOMAIN --email $EMAIL --agree-tos --non-interactive
        
        # Restart nginx
        docker-compose start nginx
        
        # Set up auto-renewal
        log_info "Setting up SSL auto-renewal..."
        echo "0 3 * * * root certbot renew --quiet && docker-compose restart nginx" | sudo tee -a /etc/crontab
    else
        log_info "SSL certificate already exists for $DOMAIN"
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
        log_info "Checking logs..."
        docker-compose logs --tail=20
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
    echo ""
    echo "🔧 Troubleshooting:"
    echo "   • If services fail to start, check logs: docker-compose logs"
    echo "   • To rebuild: docker-compose down && docker-compose up -d --build"
    echo "   • To reset database: docker-compose down -v && docker-compose up -d"
    echo ""
    
    # Show current status
    log_info "Current service status:"
    docker-compose ps
    
    # Test application
    log_info "Testing application..."
    if curl -k -s https://$DOMAIN/health > /dev/null 2>&1; then
        log_success "Application is responding!"
    else
        log_warning "Application may not be fully ready yet. Please wait a few minutes and check https://$DOMAIN"
    fi
}

# Run main function
main "$@"