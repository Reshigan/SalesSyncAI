#!/bin/bash

# SalesSync AI Update Script
# Updates the application with zero downtime

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_DIR="/opt/salessync"

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

# Check if running from correct directory
check_directory() {
    if [ ! -f "docker-compose.yml" ]; then
        log_error "docker-compose.yml not found. Please run from project directory."
        exit 1
    fi
}

# Backup before update
backup_before_update() {
    log_info "Creating backup before update..."
    
    DATE=$(date +%Y%m%d_%H%M%S)
    BACKUP_DIR="/opt/salessync-backups/pre-update-$DATE"
    
    mkdir -p $BACKUP_DIR
    
    # Backup database
    docker-compose exec -T postgres pg_dump -U salessync salessync > $BACKUP_DIR/database.sql
    
    # Backup uploaded files
    tar -czf $BACKUP_DIR/uploads.tar.gz -C backend uploads/ 2>/dev/null || true
    
    # Backup environment file
    cp .env $BACKUP_DIR/.env
    
    log_success "Backup created at $BACKUP_DIR"
}

# Update application
update_application() {
    log_info "Updating SalesSync AI application..."
    
    # Pull latest changes
    git fetch origin
    git pull origin main
    
    # Build new images
    log_info "Building new Docker images..."
    docker-compose build --no-cache
    
    # Update services with rolling update
    log_info "Updating services..."
    
    # Update backend first
    docker-compose up -d --no-deps backend
    sleep 10
    
    # Run database migrations if needed
    log_info "Running database migrations..."
    docker-compose exec backend npx prisma migrate deploy
    
    # Update frontend
    docker-compose up -d --no-deps frontend
    sleep 5
    
    # Update nginx
    docker-compose up -d --no-deps nginx
    
    log_success "Application updated successfully"
}

# Health check after update
health_check() {
    log_info "Performing health check..."
    
    # Wait for services to be ready
    sleep 15
    
    # Check if services are running
    if ! docker-compose ps | grep -q "Up"; then
        log_error "Some services are not running"
        docker-compose ps
        exit 1
    fi
    
    # Check application health
    for i in {1..10}; do
        if curl -f http://localhost/health > /dev/null 2>&1; then
            log_success "Health check passed"
            return 0
        fi
        log_info "Waiting for application to be ready... ($i/10)"
        sleep 5
    done
    
    log_error "Health check failed"
    exit 1
}

# Cleanup old images
cleanup() {
    log_info "Cleaning up old Docker images..."
    
    # Remove unused images
    docker image prune -f
    
    # Remove old backups (keep last 10)
    find /opt/salessync-backups -name "pre-update-*" -type d | sort -r | tail -n +11 | xargs rm -rf 2>/dev/null || true
    
    log_success "Cleanup completed"
}

# Main update function
main() {
    log_info "Starting SalesSync AI update process..."
    
    cd $PROJECT_DIR
    check_directory
    backup_before_update
    update_application
    health_check
    cleanup
    
    log_success "SalesSync AI update completed successfully!"
    log_info "Application is running at: https://assai.gonxt.tech"
}

# Run main function
main "$@"