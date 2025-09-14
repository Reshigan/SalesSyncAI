#!/bin/bash

# SalesSync Production Deployment Script
# Comprehensive deployment automation with health checks and rollback capabilities

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEPLOYMENT_ENV="${DEPLOYMENT_ENV:-production}"
DOMAIN_NAME="${DOMAIN_NAME:-salessync.com}"
BACKUP_BEFORE_DEPLOY="${BACKUP_BEFORE_DEPLOY:-true}"
HEALTH_CHECK_TIMEOUT="${HEALTH_CHECK_TIMEOUT:-300}"
ROLLBACK_ON_FAILURE="${ROLLBACK_ON_FAILURE:-true}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
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

# Error handling
error_exit() {
    log_error "$1"
    if [[ "$ROLLBACK_ON_FAILURE" == "true" ]]; then
        log_warning "Initiating rollback..."
        rollback_deployment
    fi
    exit 1
}

# Trap errors
trap 'error_exit "Deployment failed at line $LINENO"' ERR

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if Docker is installed and running
    if ! command -v docker &> /dev/null; then
        error_exit "Docker is not installed"
    fi
    
    if ! docker info &> /dev/null; then
        error_exit "Docker daemon is not running"
    fi
    
    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null; then
        error_exit "Docker Compose is not installed"
    fi
    
    # Check if required environment files exist
    if [[ ! -f "$SCRIPT_DIR/.env.production" ]]; then
        error_exit "Production environment file not found: $SCRIPT_DIR/.env.production"
    fi
    
    # Check if SSL certificates exist or can be generated
    if [[ ! -d "$SCRIPT_DIR/nginx/ssl/live/$DOMAIN_NAME" ]]; then
        log_warning "SSL certificates not found. Will attempt to generate them."
    fi
    
    log_success "Prerequisites check passed"
}

# Load environment variables
load_environment() {
    log_info "Loading environment variables..."
    
    if [[ -f "$SCRIPT_DIR/.env.production" ]]; then
        set -a
        source "$SCRIPT_DIR/.env.production"
        set +a
        log_success "Environment variables loaded"
    else
        error_exit "Environment file not found"
    fi
}

# Create backup before deployment
create_backup() {
    if [[ "$BACKUP_BEFORE_DEPLOY" == "true" ]]; then
        log_info "Creating backup before deployment..."
        
        # Create backup directory with timestamp
        BACKUP_DIR="$SCRIPT_DIR/backups/$(date +%Y%m%d_%H%M%S)"
        mkdir -p "$BACKUP_DIR"
        
        # Backup database
        if docker-compose -f docker-compose.production.yml ps postgres | grep -q "Up"; then
            log_info "Backing up database..."
            docker-compose -f docker-compose.production.yml exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" > "$BACKUP_DIR/database.sql"
            log_success "Database backup created"
        fi
        
        # Backup volumes
        log_info "Backing up volumes..."
        docker run --rm -v salessync_backend-uploads:/data -v "$BACKUP_DIR":/backup alpine tar czf /backup/uploads.tar.gz -C /data .
        docker run --rm -v salessync_postgres-data:/data -v "$BACKUP_DIR":/backup alpine tar czf /backup/postgres-data.tar.gz -C /data .
        
        # Save current docker-compose configuration
        cp docker-compose.production.yml "$BACKUP_DIR/"
        
        echo "$BACKUP_DIR" > "$SCRIPT_DIR/.last_backup"
        log_success "Backup created at $BACKUP_DIR"
    fi
}

# Generate SSL certificates
generate_ssl_certificates() {
    log_info "Checking SSL certificates..."
    
    if [[ ! -d "$SCRIPT_DIR/nginx/ssl/live/$DOMAIN_NAME" ]]; then
        log_info "Generating SSL certificates with Let's Encrypt..."
        
        # Create webroot directory
        mkdir -p "$SCRIPT_DIR/nginx/webroot"
        
        # Start temporary nginx for certificate generation
        docker run -d --name temp-nginx -p 80:80 -v "$SCRIPT_DIR/nginx/webroot:/var/www/certbot" nginx:alpine
        
        # Generate certificates
        docker run --rm -v "$SCRIPT_DIR/nginx/ssl:/etc/letsencrypt" -v "$SCRIPT_DIR/nginx/webroot:/var/www/certbot" \
            certbot/certbot certonly --webroot --webroot-path=/var/www/certbot \
            --email "$SSL_EMAIL" --agree-tos --no-eff-email -d "$DOMAIN_NAME"
        
        # Stop temporary nginx
        docker stop temp-nginx && docker rm temp-nginx
        
        log_success "SSL certificates generated"
    else
        log_success "SSL certificates already exist"
    fi
}

# Build and deploy services
deploy_services() {
    log_info "Building and deploying services..."
    
    cd "$SCRIPT_DIR"
    
    # Pull latest images
    log_info "Pulling latest base images..."
    docker-compose -f docker-compose.production.yml pull
    
    # Build custom images
    log_info "Building application images..."
    docker-compose -f docker-compose.production.yml build --no-cache
    
    # Start services
    log_info "Starting services..."
    docker-compose -f docker-compose.production.yml up -d
    
    log_success "Services deployed"
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."
    
    # Wait for database to be ready
    log_info "Waiting for database to be ready..."
    timeout 60 bash -c 'until docker-compose -f docker-compose.production.yml exec -T postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"; do sleep 2; done'
    
    # Run migrations
    docker-compose -f docker-compose.production.yml exec -T backend-1 npm run migrate:deploy
    
    log_success "Database migrations completed"
}

# Health checks
perform_health_checks() {
    log_info "Performing health checks..."
    
    local start_time=$(date +%s)
    local timeout=$HEALTH_CHECK_TIMEOUT
    
    # Check backend services
    log_info "Checking backend services..."
    while true; do
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))
        
        if [[ $elapsed -gt $timeout ]]; then
            error_exit "Health check timeout after ${timeout}s"
        fi
        
        # Check backend-1
        if curl -f -s "http://localhost/api/health" > /dev/null; then
            log_success "Backend services are healthy"
            break
        fi
        
        log_info "Waiting for services to be ready... (${elapsed}s/${timeout}s)"
        sleep 5
    done
    
    # Check database connectivity
    log_info "Checking database connectivity..."
    if ! docker-compose -f docker-compose.production.yml exec -T backend-1 node -e "
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        prisma.\$connect().then(() => {
            console.log('Database connected');
            process.exit(0);
        }).catch((error) => {
            console.error('Database connection failed:', error);
            process.exit(1);
        });
    "; then
        error_exit "Database connectivity check failed"
    fi
    
    # Check Redis connectivity
    log_info "Checking Redis connectivity..."
    if ! docker-compose -f docker-compose.production.yml exec -T redis redis-cli ping | grep -q "PONG"; then
        error_exit "Redis connectivity check failed"
    fi
    
    # Check frontend accessibility
    log_info "Checking frontend accessibility..."
    if ! curl -f -s "http://localhost/" > /dev/null; then
        error_exit "Frontend accessibility check failed"
    fi
    
    log_success "All health checks passed"
}

# Setup monitoring
setup_monitoring() {
    log_info "Setting up monitoring..."
    
    # Start monitoring services
    docker-compose -f docker-compose.production.yml up -d prometheus grafana elasticsearch kibana logstash
    
    # Wait for services to be ready
    sleep 30
    
    # Import Grafana dashboards
    if [[ -d "$SCRIPT_DIR/monitoring/grafana/dashboards" ]]; then
        log_info "Importing Grafana dashboards..."
        # Dashboard import logic would go here
    fi
    
    log_success "Monitoring setup completed"
}

# Configure log rotation
setup_log_rotation() {
    log_info "Setting up log rotation..."
    
    # Create logrotate configuration
    cat > /tmp/salessync-logrotate << EOF
/var/lib/docker/containers/*/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0644 root root
    postrotate
        docker kill --signal=USR1 \$(docker ps -q) 2>/dev/null || true
    endscript
}
EOF
    
    # Install logrotate configuration
    sudo cp /tmp/salessync-logrotate /etc/logrotate.d/salessync
    
    log_success "Log rotation configured"
}

# Setup automated backups
setup_automated_backups() {
    log_info "Setting up automated backups..."
    
    # Create backup cron job
    cat > /tmp/salessync-backup-cron << EOF
# SalesSync automated backups
0 2 * * * cd $SCRIPT_DIR && docker-compose -f docker-compose.production.yml exec -T backup npm run backup:full
0 6 * * 0 cd $SCRIPT_DIR && docker-compose -f docker-compose.production.yml exec -T backup npm run backup:cleanup
EOF
    
    # Install cron job
    crontab -l 2>/dev/null | cat - /tmp/salessync-backup-cron | crontab -
    
    log_success "Automated backups configured"
}

# Rollback deployment
rollback_deployment() {
    log_warning "Rolling back deployment..."
    
    if [[ -f "$SCRIPT_DIR/.last_backup" ]]; then
        local backup_dir=$(cat "$SCRIPT_DIR/.last_backup")
        
        if [[ -d "$backup_dir" ]]; then
            log_info "Restoring from backup: $backup_dir"
            
            # Stop current services
            docker-compose -f docker-compose.production.yml down
            
            # Restore database
            if [[ -f "$backup_dir/database.sql" ]]; then
                log_info "Restoring database..."
                docker-compose -f docker-compose.production.yml up -d postgres
                sleep 10
                docker-compose -f docker-compose.production.yml exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$backup_dir/database.sql"
            fi
            
            # Restore volumes
            if [[ -f "$backup_dir/uploads.tar.gz" ]]; then
                log_info "Restoring uploads..."
                docker run --rm -v salessync_backend-uploads:/data -v "$backup_dir":/backup alpine tar xzf /backup/uploads.tar.gz -C /data
            fi
            
            # Restore configuration
            if [[ -f "$backup_dir/docker-compose.production.yml" ]]; then
                cp "$backup_dir/docker-compose.production.yml" ./
            fi
            
            # Restart services
            docker-compose -f docker-compose.production.yml up -d
            
            log_success "Rollback completed"
        else
            log_error "Backup directory not found: $backup_dir"
        fi
    else
        log_error "No backup information found for rollback"
    fi
}

# Cleanup old deployments
cleanup_old_deployments() {
    log_info "Cleaning up old deployments..."
    
    # Remove unused Docker images
    docker image prune -f
    
    # Remove old backups (keep last 7 days)
    find "$SCRIPT_DIR/backups" -type d -mtime +7 -exec rm -rf {} + 2>/dev/null || true
    
    log_success "Cleanup completed"
}

# Send deployment notification
send_notification() {
    local status=$1
    local message=$2
    
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"SalesSync Deployment $status: $message\"}" \
            "$SLACK_WEBHOOK_URL" || true
    fi
    
    if [[ -n "${EMAIL_NOTIFICATION:-}" ]]; then
        echo "$message" | mail -s "SalesSync Deployment $status" "$EMAIL_NOTIFICATION" || true
    fi
}

# Main deployment function
main() {
    log_info "Starting SalesSync production deployment..."
    
    # Record deployment start time
    local deployment_start=$(date +%s)
    
    # Run deployment steps
    check_prerequisites
    load_environment
    create_backup
    generate_ssl_certificates
    deploy_services
    run_migrations
    perform_health_checks
    setup_monitoring
    setup_log_rotation
    setup_automated_backups
    cleanup_old_deployments
    
    # Calculate deployment time
    local deployment_end=$(date +%s)
    local deployment_time=$((deployment_end - deployment_start))
    
    log_success "Deployment completed successfully in ${deployment_time}s"
    
    # Send success notification
    send_notification "SUCCESS" "Deployment completed successfully in ${deployment_time}s"
    
    # Display service URLs
    echo ""
    log_info "Service URLs:"
    echo "  - Application: https://$DOMAIN_NAME"
    echo "  - Grafana: https://$DOMAIN_NAME:3001"
    echo "  - Kibana: https://$DOMAIN_NAME:5601"
    echo "  - Prometheus: https://$DOMAIN_NAME:9090"
    echo ""
    
    log_info "Deployment logs are available in the container logs"
    log_info "Use 'docker-compose -f docker-compose.production.yml logs -f' to follow logs"
}

# Handle script arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "rollback")
        rollback_deployment
        ;;
    "health-check")
        perform_health_checks
        ;;
    "backup")
        create_backup
        ;;
    "cleanup")
        cleanup_old_deployments
        ;;
    *)
        echo "Usage: $0 {deploy|rollback|health-check|backup|cleanup}"
        exit 1
        ;;
esac