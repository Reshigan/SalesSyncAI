#!/bin/bash

# ============================================================================
# SalesSyncAI Docker Production Deployment Script
# Optimized for AWS t4g.medium Ubuntu 22.04
# ============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Configuration
PROJECT_NAME="SalesSyncAI"
REPO_URL="https://github.com/Reshigan/SalesSyncAI.git"
DEPLOY_DIR="/opt/salessync"
LOG_FILE="/var/log/salessync-deploy.log"

# Environment variables with defaults
export POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-"SalesSync2024!Prod"}
export REDIS_PASSWORD=${REDIS_PASSWORD:-"SalesSync2024!Redis"}
export JWT_SECRET=${JWT_SECRET:-"SalesSync2024!JWT!Secret!Key!Production"}
export JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET:-"SalesSync2024!JWT!Refresh!Secret!Key!Production"}
export CORS_ORIGIN=${CORS_ORIGIN:-"*"}

# ============================================================================
# SYSTEM PREPARATION
# ============================================================================

prepare_system() {
    log "🚀 Starting SalesSyncAI Docker Production Deployment"
    log "📋 System: AWS t4g.medium Ubuntu 22.04"
    
    # Create log file
    sudo mkdir -p $(dirname $LOG_FILE)
    sudo touch $LOG_FILE
    sudo chmod 666 $LOG_FILE
    
    # Update system
    log "📦 Updating system packages..."
    sudo apt-get update -y >> $LOG_FILE 2>&1
    sudo apt-get upgrade -y >> $LOG_FILE 2>&1
    
    # Install essential packages
    log "🔧 Installing essential packages..."
    sudo apt-get install -y \
        curl \
        wget \
        git \
        unzip \
        software-properties-common \
        apt-transport-https \
        ca-certificates \
        gnupg \
        lsb-release >> $LOG_FILE 2>&1
}

# ============================================================================
# DOCKER INSTALLATION
# ============================================================================

install_docker() {
    if command -v docker &> /dev/null; then
        log "✅ Docker already installed"
        return
    fi
    
    log "🐳 Installing Docker..."
    
    # Add Docker's official GPG key
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    
    # Add Docker repository
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Install Docker
    sudo apt-get update -y >> $LOG_FILE 2>&1
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin >> $LOG_FILE 2>&1
    
    # Add current user to docker group
    sudo usermod -aG docker $USER
    
    # Start and enable Docker
    sudo systemctl start docker
    sudo systemctl enable docker
    
    log "✅ Docker installed successfully"
}

# ============================================================================
# PROJECT DEPLOYMENT
# ============================================================================

deploy_project() {
    log "📁 Preparing deployment directory..."
    
    # Create deployment directory
    sudo mkdir -p $DEPLOY_DIR
    sudo chown $USER:$USER $DEPLOY_DIR
    
    # Clone or update repository
    if [ -d "$DEPLOY_DIR/.git" ]; then
        log "🔄 Updating existing repository..."
        cd $DEPLOY_DIR
        git fetch origin
        git reset --hard origin/main
    else
        log "📥 Cloning repository..."
        git clone $REPO_URL $DEPLOY_DIR
        cd $DEPLOY_DIR
    fi
    
    # Checkout the fixed branch with all our improvements
    log "🔀 Checking out fixed deployment branch..."
    git checkout fix-prisma-schema-deployment || git checkout main
}

# ============================================================================
# ENVIRONMENT CONFIGURATION
# ============================================================================

setup_environment() {
    log "⚙️ Setting up environment configuration..."
    
    cd $DEPLOY_DIR
    
    # Get public IP for API URL
    PUBLIC_IP=$(curl -s ifconfig.me)
    
    # Create production environment file
    cat > .env << EOF
# Production Environment Configuration
NODE_ENV=production

# Database Configuration
POSTGRES_DB=salessync_prod
POSTGRES_USER=salessync_user
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}

# Redis Configuration
REDIS_PASSWORD=${REDIS_PASSWORD}

# JWT Configuration
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}

# CORS Configuration
CORS_ORIGIN=${CORS_ORIGIN}

# API Configuration
REACT_APP_API_URL=http://${PUBLIC_IP}/api

# Logging
LOG_LEVEL=info

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
EOF

    # Set proper permissions
    chmod 600 .env
    
    log "✅ Environment configuration created"
}

# ============================================================================
# DOCKER COMPOSE DEPLOYMENT
# ============================================================================

deploy_with_docker() {
    log "🐳 Deploying with Docker Compose..."
    
    cd $DEPLOY_DIR
    
    # Stop existing containers
    log "🛑 Stopping existing containers..."
    docker compose -f docker-compose.production.yml down --remove-orphans 2>/dev/null || true
    
    # Remove old images to ensure fresh build
    log "🧹 Cleaning up old images..."
    docker system prune -f >> $LOG_FILE 2>&1
    
    # Build and start services
    log "🔨 Building and starting services..."
    docker compose -f docker-compose.production.yml up -d --build
    
    # Wait for services to be healthy
    log "⏳ Waiting for services to be healthy..."
    
    # Wait for database
    for i in {1..30}; do
        if docker compose -f docker-compose.production.yml exec -T postgres pg_isready -U salessync_user -d salessync_prod > /dev/null 2>&1; then
            log "✅ Database is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            error "❌ Database failed to start after 30 attempts"
        fi
        sleep 2
    done
    
    # Wait for Redis
    for i in {1..30}; do
        if docker compose -f docker-compose.production.yml exec -T redis redis-cli -a $REDIS_PASSWORD ping > /dev/null 2>&1; then
            log "✅ Redis is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            error "❌ Redis failed to start after 30 attempts"
        fi
        sleep 2
    done
    
    # Run database migrations
    log "🗄️ Running database migrations..."
    docker compose -f docker-compose.production.yml exec -T backend npx prisma migrate deploy
    
    # Seed database
    log "🌱 Seeding database..."
    docker compose -f docker-compose.production.yml exec -T backend node seed-production-demo.js || warn "Database seeding failed - continuing anyway"
    
    # Wait for backend
    for i in {1..60}; do
        if docker compose -f docker-compose.production.yml exec -T backend curl -f http://localhost:3000/health > /dev/null 2>&1; then
            log "✅ Backend is ready"
            break
        fi
        if [ $i -eq 60 ]; then
            error "❌ Backend failed to start after 60 attempts"
        fi
        sleep 2
    done
    
    # Wait for frontend
    for i in {1..30}; do
        if curl -f http://localhost/ > /dev/null 2>&1; then
            log "✅ Frontend is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            error "❌ Frontend failed to start after 30 attempts"
        fi
        sleep 2
    done
    
    log "✅ All services deployed successfully"
}

# ============================================================================
# FIREWALL CONFIGURATION
# ============================================================================

setup_firewall() {
    log "🔥 Configuring firewall..."
    
    # Enable UFW
    sudo ufw --force enable
    
    # Allow SSH
    sudo ufw allow ssh
    
    # Allow HTTP and HTTPS
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    
    # Show status
    sudo ufw status
    
    log "✅ Firewall configured successfully"
}

# ============================================================================
# MONITORING SETUP
# ============================================================================

setup_monitoring() {
    log "📊 Setting up monitoring..."
    
    # Create monitoring script
    sudo tee /usr/local/bin/salessync-docker-monitor.sh << 'EOF'
#!/bin/bash

LOG_FILE="/var/log/salessync-monitor.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')
DEPLOY_DIR="/opt/salessync"

# Function to log with timestamp
log_monitor() {
    echo "[$DATE] $1" >> $LOG_FILE
}

cd $DEPLOY_DIR

# Check Docker containers
CONTAINERS=$(docker compose -f docker-compose.production.yml ps --services)
for container in $CONTAINERS; do
    if docker compose -f docker-compose.production.yml ps $container | grep -q "Up"; then
        log_monitor "✅ $container is running"
    else
        log_monitor "❌ $container is down - attempting restart"
        docker compose -f docker-compose.production.yml restart $container
    fi
done

# Check disk space
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    log_monitor "⚠️ Disk usage is ${DISK_USAGE}% - cleanup recommended"
    docker system prune -f
fi

# Check Docker system
DOCKER_DISK=$(docker system df --format "table {{.Type}}\t{{.TotalCount}}\t{{.Size}}\t{{.Reclaimable}}" | tail -n +2)
log_monitor "Docker system usage: $DOCKER_DISK"
EOF

    sudo chmod +x /usr/local/bin/salessync-docker-monitor.sh
    
    # Create cron job for monitoring
    (crontab -l 2>/dev/null; echo "*/5 * * * * /usr/local/bin/salessync-docker-monitor.sh") | crontab -
    
    log "✅ Monitoring configured successfully"
}

# ============================================================================
# HEALTH CHECKS
# ============================================================================

run_health_checks() {
    log "🏥 Running health checks..."
    
    cd $DEPLOY_DIR
    
    # Check container status
    log "📊 Container Status:"
    docker compose -f docker-compose.production.yml ps
    
    # Check logs for errors
    log "📋 Recent logs:"
    docker compose -f docker-compose.production.yml logs --tail=10
    
    # Check endpoints
    PUBLIC_IP=$(curl -s ifconfig.me)
    
    # Check frontend
    if curl -f http://localhost/ > /dev/null 2>&1; then
        log "✅ Frontend is healthy"
    else
        error "❌ Frontend health check failed"
    fi
    
    # Check backend health endpoint
    if curl -f http://localhost/api/health > /dev/null 2>&1; then
        log "✅ Backend API is healthy"
    else
        error "❌ Backend API health check failed"
    fi
    
    log "✅ All health checks passed!"
}

# ============================================================================
# BACKUP SETUP
# ============================================================================

setup_backup() {
    log "💾 Setting up backup system..."
    
    # Create backup script
    sudo tee /usr/local/bin/salessync-backup.sh << 'EOF'
#!/bin/bash

BACKUP_DIR="/opt/salessync-backups"
DATE=$(date +%Y%m%d_%H%M%S)
DEPLOY_DIR="/opt/salessync"

# Create backup directory
mkdir -p $BACKUP_DIR

cd $DEPLOY_DIR

# Backup database
docker compose -f docker-compose.production.yml exec -T postgres pg_dump -U salessync_user salessync_prod > $BACKUP_DIR/database_$DATE.sql

# Backup application files
tar -czf $BACKUP_DIR/app_$DATE.tar.gz -C $DEPLOY_DIR .

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
EOF

    sudo chmod +x /usr/local/bin/salessync-backup.sh
    
    # Create daily backup cron job
    (crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/salessync-backup.sh") | crontab -
    
    log "✅ Backup system configured successfully"
}

# ============================================================================
# MAIN DEPLOYMENT FUNCTION
# ============================================================================

main() {
    log "🚀 Starting SalesSyncAI Docker Production Deployment"
    log "📋 Target: AWS t4g.medium Ubuntu 22.04"
    
    # Check if running as root
    if [ "$EUID" -eq 0 ]; then
        error "Please do not run this script as root. Use a regular user with sudo privileges."
    fi
    
    # Run deployment steps
    prepare_system
    install_docker
    deploy_project
    setup_environment
    deploy_with_docker
    setup_firewall
    setup_monitoring
    setup_backup
    run_health_checks
    
    # Final information
    PUBLIC_IP=$(curl -s ifconfig.me)
    
    log "🎉 SalesSyncAI deployed successfully with Docker!"
    echo ""
    echo "============================================================================"
    echo "🌐 DOCKER DEPLOYMENT COMPLETE"
    echo "============================================================================"
    echo "📍 Public IP: $PUBLIC_IP"
    echo "🌐 Frontend URL: http://$PUBLIC_IP"
    echo "🔗 API URL: http://$PUBLIC_IP/api"
    echo "🏥 Health Check: http://$PUBLIC_IP/api/health"
    echo ""
    echo "🐳 Docker Management Commands:"
    echo "  • View status: docker compose -f docker-compose.production.yml ps"
    echo "  • View logs: docker compose -f docker-compose.production.yml logs -f"
    echo "  • Restart services: docker compose -f docker-compose.production.yml restart"
    echo "  • Stop services: docker compose -f docker-compose.production.yml down"
    echo "  • Update deployment: docker compose -f docker-compose.production.yml up -d --build"
    echo ""
    echo "📊 Monitoring Commands:"
    echo "  • Container stats: docker stats"
    echo "  • System usage: docker system df"
    echo "  • Clean up: docker system prune -f"
    echo ""
    echo "💾 Backup Commands:"
    echo "  • Manual backup: /usr/local/bin/salessync-backup.sh"
    echo "  • Restore database: docker compose -f docker-compose.production.yml exec -T postgres psql -U salessync_user -d salessync_prod < backup.sql"
    echo ""
    echo "📁 Important Paths:"
    echo "  • Application: $DEPLOY_DIR"
    echo "  • Logs: /var/log/salessync-*.log"
    echo "  • Backups: /opt/salessync-backups"
    echo "  • Environment: $DEPLOY_DIR/.env"
    echo ""
    echo "🔐 Default Credentials (CHANGE THESE!):"
    echo "  • Database Password: $POSTGRES_PASSWORD"
    echo "  • Redis Password: $REDIS_PASSWORD"
    echo ""
    echo "✅ Docker deployment completed successfully!"
    echo "============================================================================"
}

# ============================================================================
# SCRIPT EXECUTION
# ============================================================================

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "SalesSyncAI Docker Production Deployment Script"
        echo ""
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --check        Run health checks only"
        echo "  --logs         Show container logs"
        echo "  --status       Show container status"
        echo "  --restart      Restart all services"
        echo "  --backup       Run manual backup"
        echo ""
        echo "Environment Variables:"
        echo "  POSTGRES_PASSWORD    Database password (default: SalesSync2024!Prod)"
        echo "  REDIS_PASSWORD       Redis password (default: SalesSync2024!Redis)"
        echo "  JWT_SECRET           JWT secret key"
        echo "  CORS_ORIGIN          CORS origin (default: *)"
        echo ""
        exit 0
        ;;
    --check)
        cd $DEPLOY_DIR
        run_health_checks
        exit 0
        ;;
    --logs)
        cd $DEPLOY_DIR
        docker compose -f docker-compose.production.yml logs -f
        exit 0
        ;;
    --status)
        cd $DEPLOY_DIR
        docker compose -f docker-compose.production.yml ps
        exit 0
        ;;
    --restart)
        cd $DEPLOY_DIR
        docker compose -f docker-compose.production.yml restart
        exit 0
        ;;
    --backup)
        /usr/local/bin/salessync-backup.sh
        exit 0
        ;;
    "")
        main
        ;;
    *)
        error "Unknown option: $1. Use --help for usage information."
        ;;
esac