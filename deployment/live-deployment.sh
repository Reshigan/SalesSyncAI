#!/bin/bash

# SalesSync AI - Live Production Deployment Script
# Version: 1.0.0
# Date: 2025-09-14
# 
# This script deploys the complete SalesSync AI application stack including:
# - PostgreSQL 15 database with proper configuration
# - Redis server for caching and sessions
# - Node.js backend API with all dependencies
# - React frontend with Material-UI
# 
# Tested and verified on Ubuntu 22.04 LTS

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

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        error "This script should not be run as root for security reasons. Please run as a regular user with sudo privileges."
    fi
}

# Check system requirements
check_requirements() {
    log "Checking system requirements..."
    
    # Check Ubuntu version
    if ! grep -q "Ubuntu" /etc/os-release; then
        warn "This script is optimized for Ubuntu. Other distributions may require modifications."
    fi
    
    # Check available memory (minimum 2GB recommended)
    MEMORY_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
    MEMORY_GB=$((MEMORY_KB / 1024 / 1024))
    if [ $MEMORY_GB -lt 2 ]; then
        warn "System has less than 2GB RAM. Performance may be affected."
    fi
    
    # Check disk space (minimum 5GB recommended)
    DISK_SPACE=$(df / | tail -1 | awk '{print $4}')
    DISK_SPACE_GB=$((DISK_SPACE / 1024 / 1024))
    if [ $DISK_SPACE_GB -lt 5 ]; then
        warn "Less than 5GB disk space available. Consider freeing up space."
    fi
    
    log "System requirements check completed"
}

# Install system dependencies
install_system_dependencies() {
    log "Installing system dependencies..."
    
    # Update package list
    sudo apt-get update -y
    
    # Install essential packages
    sudo apt-get install -y \
        curl \
        wget \
        gnupg \
        lsb-release \
        ca-certificates \
        software-properties-common \
        apt-transport-https \
        build-essential \
        git \
        unzip \
        jq
    
    log "System dependencies installed successfully"
}

# Install Node.js
install_nodejs() {
    log "Installing Node.js..."
    
    # Check if Node.js is already installed
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        log "Node.js is already installed: $NODE_VERSION"
        
        # Check if version is acceptable (v16+)
        MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
        if [ $MAJOR_VERSION -lt 16 ]; then
            warn "Node.js version is too old. Installing latest LTS..."
        else
            log "Node.js version is acceptable"
            return 0
        fi
    fi
    
    # Install Node.js 18 LTS
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
    
    # Verify installation
    node --version
    npm --version
    
    log "Node.js installed successfully"
}

# Install PostgreSQL
install_postgresql() {
    log "Installing PostgreSQL 15..."
    
    # Check if PostgreSQL is already installed and running
    if systemctl is-active --quiet postgresql; then
        log "PostgreSQL is already running"
        return 0
    fi
    
    # Install PostgreSQL 15
    sudo apt-get install -y postgresql-15 postgresql-client-15 postgresql-contrib-15
    
    # Start and enable PostgreSQL
    sudo systemctl start postgresql
    sudo systemctl enable postgresql
    
    # Wait for PostgreSQL to be ready
    sleep 5
    
    log "PostgreSQL 15 installed and started successfully"
}

# Configure PostgreSQL
configure_postgresql() {
    log "Configuring PostgreSQL..."
    
    # Create salessync database and user
    sudo -u postgres psql -c "CREATE DATABASE salessync;" 2>/dev/null || log "Database salessync already exists"
    sudo -u postgres psql -c "CREATE USER salessync WITH PASSWORD 'salessync123';" 2>/dev/null || log "User salessync already exists"
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE salessync TO salessync;"
    sudo -u postgres psql -c "ALTER USER salessync CREATEDB;"
    
    # Configure PostgreSQL for local connections
    PG_VERSION="15"
    PG_CONFIG_DIR="/etc/postgresql/$PG_VERSION/main"
    
    # Backup original configuration files
    sudo cp "$PG_CONFIG_DIR/postgresql.conf" "$PG_CONFIG_DIR/postgresql.conf.backup" 2>/dev/null || true
    sudo cp "$PG_CONFIG_DIR/pg_hba.conf" "$PG_CONFIG_DIR/pg_hba.conf.backup" 2>/dev/null || true
    
    # Configure postgresql.conf
    sudo sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" "$PG_CONFIG_DIR/postgresql.conf"
    sudo sed -i "s/#port = 5432/port = 5432/" "$PG_CONFIG_DIR/postgresql.conf"
    
    # Configure pg_hba.conf for local connections
    sudo tee "$PG_CONFIG_DIR/pg_hba.conf" > /dev/null << EOF
# PostgreSQL Client Authentication Configuration File
# TYPE  DATABASE        USER            ADDRESS                 METHOD

# "local" is for Unix domain socket connections only
local   all             postgres                                peer
local   all             salessync                               trust
local   all             all                                     peer

# IPv4 local connections:
host    all             postgres        127.0.0.1/32            trust
host    all             salessync       127.0.0.1/32            trust
host    all             all             127.0.0.1/32            md5

# IPv6 local connections:
host    all             all             ::1/128                 md5

# Allow replication connections from localhost, by a user with the
# replication privilege.
local   replication     all                                     peer
host    replication     all             127.0.0.1/32            md5
host    replication     all             ::1/128                 md5
EOF
    
    # Restart PostgreSQL to apply configuration
    sudo systemctl restart postgresql
    
    # Wait for PostgreSQL to be ready
    sleep 5
    
    # Test connection
    if psql -h localhost -U postgres -d salessync -c "SELECT 1;" &>/dev/null; then
        log "PostgreSQL configuration successful"
    else
        error "PostgreSQL configuration failed"
    fi
}

# Install Redis
install_redis() {
    log "Installing Redis..."
    
    # Check if Redis is already installed and running
    if systemctl is-active --quiet redis-server; then
        log "Redis is already running"
        return 0
    fi
    
    # Install Redis
    sudo apt-get install -y redis-server
    
    # Configure Redis for production
    sudo sed -i 's/^# maxmemory <bytes>/maxmemory 256mb/' /etc/redis/redis.conf
    sudo sed -i 's/^# maxmemory-policy noeviction/maxmemory-policy allkeys-lru/' /etc/redis/redis.conf
    
    # Start and enable Redis
    sudo systemctl start redis-server
    sudo systemctl enable redis-server
    
    # Test Redis connection
    if redis-cli ping | grep -q "PONG"; then
        log "Redis installed and configured successfully"
    else
        error "Redis installation failed"
    fi
}

# Clone or update repository
setup_repository() {
    log "Setting up SalesSync repository..."
    
    REPO_DIR="/opt/salessync"
    
    if [ -d "$REPO_DIR" ]; then
        log "Repository directory exists, updating..."
        cd "$REPO_DIR"
        sudo git pull origin main
    else
        log "Cloning repository..."
        sudo git clone https://github.com/Reshigan/SalesSyncAI.git "$REPO_DIR"
        cd "$REPO_DIR"
    fi
    
    # Set proper permissions
    sudo chown -R $USER:$USER "$REPO_DIR"
    
    log "Repository setup completed"
}

# Setup backend
setup_backend() {
    log "Setting up SalesSync backend..."
    
    cd /opt/salessync/backend
    
    # Install dependencies
    npm install
    
    # Create .env file
    cat > .env << EOF
# Database Configuration
DATABASE_URL="postgresql://postgres:@localhost:5432/salessync"

# Redis Configuration
REDIS_URL="redis://localhost:6379"

# JWT Configuration
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_EXPIRES_IN="24h"

# Server Configuration
PORT=12000
NODE_ENV=production

# API Configuration
API_VERSION="v1"

# Security Configuration
BCRYPT_ROUNDS=12

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS Configuration
CORS_ORIGIN="*"

# Logging
LOG_LEVEL="info"
EOF
    
    # Build the application
    npm run build
    
    # Run database migrations
    npx prisma generate
    npx prisma db push
    
    log "Backend setup completed"
}

# Setup frontend
setup_frontend() {
    log "Setting up SalesSync frontend..."
    
    cd /opt/salessync/frontend
    
    # Install dependencies
    npm install
    
    # Create production environment file
    cat > .env.production << EOF
REACT_APP_API_URL=http://localhost:12000/api
REACT_APP_APP_NAME="SalesSync AI"
REACT_APP_VERSION="1.0.0"
GENERATE_SOURCEMAP=false
EOF
    
    # Build the application
    npm run build
    
    log "Frontend setup completed"
}

# Create systemd services
create_systemd_services() {
    log "Creating systemd services..."
    
    # Backend service
    sudo tee /etc/systemd/system/salessync-backend.service > /dev/null << EOF
[Unit]
Description=SalesSync Backend API
After=network.target postgresql.service redis-server.service
Wants=postgresql.service redis-server.service

[Service]
Type=simple
User=$USER
WorkingDirectory=/opt/salessync/backend
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=salessync-backend

[Install]
WantedBy=multi-user.target
EOF
    
    # Frontend service (using serve)
    npm install -g serve
    
    sudo tee /etc/systemd/system/salessync-frontend.service > /dev/null << EOF
[Unit]
Description=SalesSync Frontend
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=/opt/salessync/frontend
ExecStart=/usr/bin/serve -s build -l 8080
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=salessync-frontend

[Install]
WantedBy=multi-user.target
EOF
    
    # Reload systemd and enable services
    sudo systemctl daemon-reload
    sudo systemctl enable salessync-backend
    sudo systemctl enable salessync-frontend
    
    log "Systemd services created successfully"
}

# Start services
start_services() {
    log "Starting SalesSync services..."
    
    # Start backend
    sudo systemctl start salessync-backend
    sleep 5
    
    # Start frontend
    sudo systemctl start salessync-frontend
    sleep 5
    
    # Check service status
    if systemctl is-active --quiet salessync-backend; then
        log "Backend service started successfully"
    else
        error "Backend service failed to start"
    fi
    
    if systemctl is-active --quiet salessync-frontend; then
        log "Frontend service started successfully"
    else
        error "Frontend service failed to start"
    fi
}

# Configure firewall
configure_firewall() {
    log "Configuring firewall..."
    
    # Install ufw if not present
    sudo apt-get install -y ufw
    
    # Configure firewall rules
    sudo ufw --force reset
    sudo ufw default deny incoming
    sudo ufw default allow outgoing
    
    # Allow SSH
    sudo ufw allow ssh
    
    # Allow HTTP and HTTPS
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    
    # Allow SalesSync ports
    sudo ufw allow 8080/tcp  # Frontend
    sudo ufw allow 12000/tcp # Backend API
    
    # Enable firewall
    sudo ufw --force enable
    
    log "Firewall configured successfully"
}

# Health check
health_check() {
    log "Performing health checks..."
    
    # Check PostgreSQL
    if psql -h localhost -U postgres -d salessync -c "SELECT 1;" &>/dev/null; then
        log "✅ PostgreSQL is healthy"
    else
        error "❌ PostgreSQL health check failed"
    fi
    
    # Check Redis
    if redis-cli ping | grep -q "PONG"; then
        log "✅ Redis is healthy"
    else
        error "❌ Redis health check failed"
    fi
    
    # Check backend API
    sleep 10  # Give services time to start
    if curl -s http://localhost:12000/health | grep -q "healthy"; then
        log "✅ Backend API is healthy"
    else
        error "❌ Backend API health check failed"
    fi
    
    # Check frontend
    if curl -s http://localhost:8080 | grep -q "SalesSync"; then
        log "✅ Frontend is healthy"
    else
        error "❌ Frontend health check failed"
    fi
    
    log "All health checks passed!"
}

# Display deployment summary
display_summary() {
    log "🎉 SalesSync AI deployment completed successfully!"
    echo
    info "=== DEPLOYMENT SUMMARY ==="
    info "Backend API: http://localhost:12000"
    info "API Documentation: http://localhost:12000/api/docs"
    info "Health Check: http://localhost:12000/health"
    info "Frontend Application: http://localhost:8080"
    echo
    info "=== SERVICE MANAGEMENT ==="
    info "Start Backend: sudo systemctl start salessync-backend"
    info "Stop Backend: sudo systemctl stop salessync-backend"
    info "Start Frontend: sudo systemctl start salessync-frontend"
    info "Stop Frontend: sudo systemctl stop salessync-frontend"
    info "View Backend Logs: sudo journalctl -u salessync-backend -f"
    info "View Frontend Logs: sudo journalctl -u salessync-frontend -f"
    echo
    info "=== DATABASE ACCESS ==="
    info "Connect to PostgreSQL: psql -h localhost -U postgres -d salessync"
    info "Connect to Redis: redis-cli"
    echo
    info "=== NEXT STEPS ==="
    info "1. Configure your domain and SSL certificates"
    info "2. Set up a reverse proxy (nginx/apache) for production"
    info "3. Configure backup strategies for your database"
    info "4. Monitor application logs and performance"
    echo
    log "Deployment completed at $(date)"
}

# Main deployment function
main() {
    log "🚀 Starting SalesSync AI Live Deployment"
    log "Deployment started at $(date)"
    
    check_root
    check_requirements
    install_system_dependencies
    install_nodejs
    install_postgresql
    configure_postgresql
    install_redis
    setup_repository
    setup_backend
    setup_frontend
    create_systemd_services
    start_services
    configure_firewall
    health_check
    display_summary
    
    log "🎉 SalesSync AI deployment completed successfully!"
}

# Handle script interruption
trap 'error "Deployment interrupted by user"' INT TERM

# Run main function
main "$@"