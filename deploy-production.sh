#!/bin/bash

# SalesSync Complete Production Deployment Script
# Installs all dependencies and deploys the complete application

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="${SCRIPT_DIR}/deployment.log"
DOCKER_COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.full.yml"
ENV_FILE="${SCRIPT_DIR}/.env.production"

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

log_step() {
    echo -e "${PURPLE}[STEP]${NC} $1" | tee -a "$LOG_FILE"
}

log_header() {
    echo -e "${CYAN}================================${NC}" | tee -a "$LOG_FILE"
    echo -e "${WHITE}$1${NC}" | tee -a "$LOG_FILE"
    echo -e "${CYAN}================================${NC}" | tee -a "$LOG_FILE"
}

# Error handling
handle_error() {
    log_error "Deployment failed at line $1"
    log_error "Check the log file: $LOG_FILE"
    exit 1
}

trap 'handle_error $LINENO' ERR

# Check system requirements
check_system_requirements() {
    log_step "Checking system requirements..."
    
    # Check OS
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        log_info "✅ Linux detected"
        DISTRO=$(lsb_release -si 2>/dev/null || echo "Unknown")
        VERSION=$(lsb_release -sr 2>/dev/null || echo "Unknown")
        log_info "Distribution: $DISTRO $VERSION"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        log_info "✅ macOS detected"
    else
        log_warning "⚠️  Unsupported OS: $OSTYPE"
    fi
    
    # Check architecture
    ARCH=$(uname -m)
    log_info "Architecture: $ARCH"
    
    # Check available memory
    if command -v free &> /dev/null; then
        MEMORY_GB=$(free -g | awk '/^Mem:/{print $2}')
        if [ "$MEMORY_GB" -lt 4 ]; then
            log_warning "⚠️  Low memory detected: ${MEMORY_GB}GB (recommended: 4GB+)"
        else
            log_info "✅ Memory: ${MEMORY_GB}GB"
        fi
    fi
    
    # Check disk space
    DISK_SPACE=$(df -BG . | awk 'NR==2 {print $4}' | sed 's/G//')
    if [ "$DISK_SPACE" -lt 10 ]; then
        log_warning "⚠️  Low disk space: ${DISK_SPACE}GB (recommended: 10GB+)"
    else
        log_info "✅ Disk space: ${DISK_SPACE}GB available"
    fi
    
    log_success "System requirements check completed"
}

# Install Docker
install_docker() {
    log_step "Installing Docker..."
    
    if command -v docker &> /dev/null; then
        DOCKER_VERSION=$(docker --version | cut -d' ' -f3 | cut -d',' -f1)
        log_info "✅ Docker already installed: $DOCKER_VERSION"
        return 0
    fi
    
    log_info "Installing Docker..."
    
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Install Docker on Linux
        curl -fsSL https://get.docker.com -o get-docker.sh
        sudo sh get-docker.sh
        rm get-docker.sh
        
        # Add current user to docker group
        sudo usermod -aG docker $USER
        
        # Start Docker service
        sudo systemctl enable docker
        sudo systemctl start docker
        
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        log_error "Please install Docker Desktop for Mac manually from https://docker.com/products/docker-desktop"
        exit 1
    else
        log_error "Unsupported OS for automatic Docker installation"
        exit 1
    fi
    
    log_success "Docker installed successfully"
}

# Install Docker Compose
install_docker_compose() {
    log_step "Installing Docker Compose..."
    
    if command -v docker-compose &> /dev/null; then
        COMPOSE_VERSION=$(docker-compose --version | cut -d' ' -f3 | cut -d',' -f1)
        log_info "✅ Docker Compose already installed: $COMPOSE_VERSION"
        return 0
    fi
    
    log_info "Installing Docker Compose..."
    
    # Get latest version
    COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d\" -f4)
    
    # Download and install
    sudo curl -L "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    
    # Create symlink if needed
    if [ ! -f /usr/bin/docker-compose ]; then
        sudo ln -s /usr/local/bin/docker-compose /usr/bin/docker-compose
    fi
    
    log_success "Docker Compose installed successfully"
}

# Install Node.js (for local development)
install_nodejs() {
    log_step "Checking Node.js installation..."
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        log_info "✅ Node.js already installed: $NODE_VERSION"
        
        # Check if version is 18+
        NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
        if [ "$NODE_MAJOR" -lt 18 ]; then
            log_warning "⚠️  Node.js version $NODE_VERSION is below recommended 18.x"
        fi
        return 0
    fi
    
    log_info "Installing Node.js..."
    
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Install Node.js via NodeSource repository
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        if command -v brew &> /dev/null; then
            brew install node@18
        else
            log_error "Please install Node.js manually from https://nodejs.org"
            exit 1
        fi
    fi
    
    log_success "Node.js installed successfully"
}

# Create production environment file
create_production_env() {
    log_step "Creating production environment configuration..."
    
    # Generate secure passwords and secrets
    POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    JWT_SECRET=$(openssl rand -base64 64 | tr -d "=+/")
    JWT_REFRESH_SECRET=$(openssl rand -base64 64 | tr -d "=+/")
    SESSION_SECRET=$(openssl rand -base64 64 | tr -d "=+/")
    
    cat > "$ENV_FILE" << EOF
# SalesSync Production Environment Configuration
# Generated on $(date)

# Application Configuration
NODE_ENV=production
APP_VERSION=1.0.0
TZ=UTC

# Database Configuration
POSTGRES_DB=salessync_production
POSTGRES_USER=salessync_user
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_PORT=5432

# Redis Configuration
REDIS_PASSWORD=$REDIS_PASSWORD
REDIS_PORT=6379

# JWT Configuration
JWT_SECRET=$JWT_SECRET
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Security Configuration
BCRYPT_ROUNDS=12
SESSION_SECRET=$SESSION_SECRET

# API Configuration
API_BASE_URL=http://localhost
CORS_ORIGIN=http://localhost,https://localhost
ALLOWED_ORIGINS=http://localhost,https://localhost,http://127.0.0.1,https://127.0.0.1

# Port Configuration
APP_PORT=80
API_PORT=3000

# File Upload Configuration
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads

# Logging Configuration
LOG_LEVEL=info
LOG_FORMAT=combined

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Database Seeding
SEED_DATABASE=true

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090

# Email Configuration (Optional - Configure for production)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@salessync.com

# Backup Configuration
BACKUP_SCHEDULE=0 2 * * *
DATA_PATH=./data
BACKUP_PATH=./backups
EOF

    # Set secure permissions
    chmod 600 "$ENV_FILE"
    
    log_success "Production environment file created: $ENV_FILE"
    log_warning "🔐 Secure passwords generated. Keep this file safe!"
}

# Create necessary directories
create_directories() {
    log_step "Creating application directories..."
    
    DIRS=(
        "data/postgres"
        "backups/postgres"
        "uploads"
        "logs"
        "monitoring"
        "database/init"
        "scripts"
    )
    
    for dir in "${DIRS[@]}"; do
        mkdir -p "$dir"
        log_info "Created directory: $dir"
    done
    
    # Set proper permissions
    chmod 755 data backups uploads logs
    chmod 700 data/postgres backups/postgres
    
    log_success "Application directories created"
}

# Create database initialization script
create_database_init() {
    log_step "Creating database initialization script..."
    
    cat > database/init/01-init.sql << 'EOF'
-- SalesSync Database Initialization
-- This script runs when the PostgreSQL container starts for the first time

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Set timezone
SET timezone = 'UTC';

-- Create additional schemas if needed
-- CREATE SCHEMA IF NOT EXISTS analytics;
-- CREATE SCHEMA IF NOT EXISTS reporting;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE salessync_production TO salessync_user;

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'SalesSync database initialized successfully at %', NOW();
END $$;
EOF
    
    log_success "Database initialization script created"
}

# Create backup script
create_backup_script() {
    log_step "Creating backup script..."
    
    cat > scripts/backup.sh << 'EOF'
#!/bin/bash

# SalesSync Database Backup Script

set -e

# Configuration
BACKUP_DIR="/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="salessync_backup_${TIMESTAMP}.sql"
RETENTION_DAYS=7

# Create backup
echo "Creating database backup: $BACKUP_FILE"
pg_dump -h postgres -U $POSTGRES_USER -d $POSTGRES_DB > "${BACKUP_DIR}/${BACKUP_FILE}"

# Compress backup
gzip "${BACKUP_DIR}/${BACKUP_FILE}"

# Remove old backups
find $BACKUP_DIR -name "salessync_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: ${BACKUP_FILE}.gz"
EOF
    
    chmod +x scripts/backup.sh
    log_success "Backup script created"
}

# Start Docker daemon if needed
start_docker() {
    log_step "Starting Docker daemon..."
    
    if ! docker info &> /dev/null; then
        log_info "Starting Docker daemon..."
        
        if [[ "$OSTYPE" == "linux-gnu"* ]]; then
            sudo systemctl start docker
            sleep 5
        else
            log_error "Please start Docker Desktop manually"
            exit 1
        fi
    fi
    
    # Test Docker
    if docker info &> /dev/null; then
        log_success "✅ Docker is running"
    else
        log_error "❌ Docker failed to start"
        exit 1
    fi
}

# Clean previous deployment
clean_previous_deployment() {
    log_step "Cleaning previous deployment..."
    
    # Stop and remove containers
    docker-compose -f "$DOCKER_COMPOSE_FILE" down -v 2>/dev/null || true
    
    # Remove orphaned containers
    docker container prune -f 2>/dev/null || true
    
    # Remove unused images (optional)
    if [ "${CLEAN_IMAGES:-false}" = "true" ]; then
        docker image prune -a -f 2>/dev/null || true
    fi
    
    log_success "Previous deployment cleaned"
}

# Build and deploy application
deploy_application() {
    log_step "Building and deploying SalesSync application..."
    
    # Copy environment file
    cp "$ENV_FILE" .env
    
    # Build and start services
    log_info "Building Docker images..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" build --no-cache
    
    log_info "Starting services..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d
    
    log_success "Application deployment started"
}

# Wait for services to be ready
wait_for_services() {
    log_step "Waiting for services to be ready..."
    
    # Wait for PostgreSQL
    log_info "Waiting for PostgreSQL..."
    timeout=120
    while ! docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T postgres pg_isready -U salessync_user -d salessync_production &>/dev/null; do
        timeout=$((timeout - 1))
        if [ $timeout -eq 0 ]; then
            log_error "PostgreSQL startup timeout"
            exit 1
        fi
        sleep 1
    done
    log_success "✅ PostgreSQL is ready"
    
    # Wait for application
    log_info "Waiting for application..."
    timeout=120
    while ! curl -f -s http://localhost/health &>/dev/null; do
        timeout=$((timeout - 1))
        if [ $timeout -eq 0 ]; then
            log_error "Application startup timeout"
            exit 1
        fi
        sleep 1
    done
    log_success "✅ Application is ready"
    
    # Wait for API
    log_info "Waiting for API..."
    timeout=60
    while ! curl -f -s http://localhost/api/health &>/dev/null; do
        timeout=$((timeout - 1))
        if [ $timeout -eq 0 ]; then
            log_warning "⚠️  API health check timeout (may still be starting)"
            break
        fi
        sleep 1
    done
    
    if curl -f -s http://localhost/api/health &>/dev/null; then
        log_success "✅ API is ready"
    else
        log_warning "⚠️  API may still be starting"
    fi
}

# Verify deployment
verify_deployment() {
    log_step "Verifying deployment..."
    
    # Check container status
    log_info "Container Status:"
    docker-compose -f "$DOCKER_COMPOSE_FILE" ps | tee -a "$LOG_FILE"
    
    # Test endpoints
    log_info "Testing endpoints..."
    
    # Test frontend
    if curl -f -s http://localhost/health &>/dev/null; then
        log_success "✅ Frontend health check passed"
    else
        log_error "❌ Frontend health check failed"
    fi
    
    # Test API
    if curl -f -s http://localhost/api/health &>/dev/null; then
        log_success "✅ API health check passed"
    else
        log_warning "⚠️  API health check failed - may still be starting"
    fi
    
    # Check database connection
    if docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T postgres pg_isready -U salessync_user -d salessync_production &>/dev/null; then
        log_success "✅ Database connection verified"
    else
        log_error "❌ Database connection failed"
    fi
    
    log_success "Deployment verification completed"
}

# Display deployment information
show_deployment_info() {
    log_header "🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!"
    
    echo ""
    echo "=== ACCESS INFORMATION ===" | tee -a "$LOG_FILE"
    echo "Frontend URL: http://localhost" | tee -a "$LOG_FILE"
    echo "API URL: http://localhost/api" | tee -a "$LOG_FILE"
    echo "Health Check: http://localhost/health" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"
    
    echo "=== DEFAULT LOGIN CREDENTIALS ===" | tee -a "$LOG_FILE"
    echo "Email: admin@salessync.com" | tee -a "$LOG_FILE"
    echo "Password: Admin123!" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"
    
    echo "=== MANAGEMENT COMMANDS ===" | tee -a "$LOG_FILE"
    echo "View logs: docker-compose -f $DOCKER_COMPOSE_FILE logs -f" | tee -a "$LOG_FILE"
    echo "Restart: docker-compose -f $DOCKER_COMPOSE_FILE restart" | tee -a "$LOG_FILE"
    echo "Stop: docker-compose -f $DOCKER_COMPOSE_FILE down" | tee -a "$LOG_FILE"
    echo "Status: docker-compose -f $DOCKER_COMPOSE_FILE ps" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"
    
    echo "=== IMPORTANT FILES ===" | tee -a "$LOG_FILE"
    echo "Environment: $ENV_FILE" | tee -a "$LOG_FILE"
    echo "Docker Compose: $DOCKER_COMPOSE_FILE" | tee -a "$LOG_FILE"
    echo "Deployment Log: $LOG_FILE" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"
    
    log_warning "🔐 Keep your environment file secure!"
    log_info "📋 Deployment log saved to: $LOG_FILE"
}

# Main deployment function
main() {
    log_header "SalesSync Complete Production Deployment"
    
    echo "This script will:" | tee -a "$LOG_FILE"
    echo "• Install Docker and Docker Compose" | tee -a "$LOG_FILE"
    echo "• Create production environment configuration" | tee -a "$LOG_FILE"
    echo "• Build and deploy the complete SalesSync application" | tee -a "$LOG_FILE"
    echo "• Set up database with demo data" | tee -a "$LOG_FILE"
    echo "• Configure monitoring and backups" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"
    
    read -p "Do you want to proceed with the deployment? (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Deployment cancelled by user"
        exit 0
    fi
    
    # Start deployment
    log_info "Starting deployment at $(date)" | tee -a "$LOG_FILE"
    
    # System checks and installation
    check_system_requirements
    install_docker
    install_docker_compose
    install_nodejs
    
    # Prepare deployment
    create_production_env
    create_directories
    create_database_init
    create_backup_script
    
    # Deploy application
    start_docker
    clean_previous_deployment
    deploy_application
    wait_for_services
    verify_deployment
    
    # Show results
    show_deployment_info
    
    log_success "🎉 SalesSync deployment completed successfully!"
}

# Run main function
main "$@"