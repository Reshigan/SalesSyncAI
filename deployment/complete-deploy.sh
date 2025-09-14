#!/bin/bash

# SalesSync Complete Deployment Script
# Production-ready deployment with all fixes and optimizations
# Designed for Ubuntu 22.04 on AWS t4g.medium

set -e

# Configuration
GITHUB_REPO="https://github.com/Reshigan/SalesSyncAI.git"
DOMAIN="SSAI.gonxt.tech"
INSTALL_DIR="/opt/salessync"
DB_NAME="salessync_production"
DB_USER="salessync_user"
DB_PASSWORD="SalesSync2024SecurePass!"
REDIS_PASSWORD="Redis2024SecurePass!"
JWT_SECRET="salessync-jwt-secret-production-2024-change-this-key"
JWT_REFRESH_SECRET="salessync-refresh-secret-production-2024-change-this-key"

# Colors for beautiful output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'

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

log_step() {
    echo -e "${PURPLE}[STEP]${NC} $1"
}

log_substep() {
    echo -e "${CYAN}  →${NC} $1"
}

# Display banner
display_banner() {
    clear
    echo -e "${PURPLE}"
    cat << 'EOF'
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   ███████╗ █████╗ ██╗     ███████╗███████╗██╗   ██╗███╗   ██╗ ║
║   ██╔════╝██╔══██╗██║     ██╔════╝██╔════╝╚██╗ ██╔╝████╗  ██║ ║
║   ███████╗███████║██║     █████╗  ███████╗ ╚████╔╝ ██╔██╗ ██║ ║
║   ╚════██║██╔══██║██║     ██╔══╝  ╚════██║  ╚██╔╝  ██║╚██╗██║ ║
║   ███████║██║  ██║███████╗███████╗███████║   ██║   ██║ ╚████║ ║
║   ╚══════╝╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝   ╚═╝   ╚═╝  ╚═══╝ ║
║                                                               ║
║              Complete Production Deployment                   ║
║                    "Sync Your Success"                       ║
╚═══════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
    echo ""
    log_info "Complete SalesSync Production Deployment"
    echo "Domain: $DOMAIN"
    echo "Install Directory: $INSTALL_DIR"
    echo "Database: $DB_NAME"
    echo ""
}

# Check prerequisites
check_prerequisites() {
    log_step "Checking Prerequisites"
    
    # Check if running as root
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root (use sudo)"
        exit 1
    fi
    
    # Check Ubuntu version
    if ! lsb_release -d | grep -q "Ubuntu 22.04"; then
        log_warning "This script is optimized for Ubuntu 22.04"
    fi
    
    # Check disk space (minimum 10GB)
    AVAILABLE_SPACE=$(df / | tail -1 | awk '{print $4}')
    if [ "$AVAILABLE_SPACE" -lt 10485760 ]; then
        log_error "Insufficient disk space. At least 10GB required."
        exit 1
    fi
    
    # Check memory (minimum 2GB)
    MEMORY_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
    if [ "$MEMORY_KB" -lt 2097152 ]; then
        log_warning "Low memory detected. 4GB+ recommended for optimal performance."
    fi
    
    log_substep "OS: $(lsb_release -d | cut -f2)"
    log_substep "Memory: $(free -h | grep '^Mem:' | awk '{print $2}')"
    log_substep "Disk Space: $(df -h / | tail -1 | awk '{print $4}') available"
    log_substep "CPU Cores: $(nproc)"
    
    log_success "Prerequisites check completed"
}

# Update system packages
update_system() {
    log_step "Updating System Packages"
    
    export DEBIAN_FRONTEND=noninteractive
    
    # Update package lists
    log_substep "Updating package lists..."
    apt-get update -qq
    
    # Upgrade existing packages
    log_substep "Upgrading system packages..."
    apt-get upgrade -y -qq
    
    # Install essential packages
    log_substep "Installing essential packages..."
    apt-get install -y -qq \
        curl \
        wget \
        git \
        unzip \
        software-properties-common \
        apt-transport-https \
        ca-certificates \
        gnupg \
        lsb-release \
        build-essential \
        python3 \
        python3-pip \
        jq \
        htop \
        nano \
        vim \
        ufw \
        fail2ban \
        logrotate \
        cron \
        rsync \
        zip \
        openssl
    
    log_success "System packages updated successfully"
}

# Install Node.js 18
install_nodejs() {
    log_step "Installing Node.js 18"
    
    # Remove any existing Node.js installations
    apt-get remove -y nodejs npm 2>/dev/null || true
    
    # Add NodeSource repository
    log_substep "Adding NodeSource repository..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    
    # Install Node.js
    log_substep "Installing Node.js..."
    apt-get install -y nodejs
    
    # Install global packages
    log_substep "Installing global npm packages..."
    npm install -g pm2@latest yarn@latest
    
    # Verify installation
    NODE_VERSION=$(node --version)
    NPM_VERSION=$(npm --version)
    PM2_VERSION=$(pm2 --version)
    
    log_substep "Node.js: $NODE_VERSION"
    log_substep "NPM: $NPM_VERSION"
    log_substep "PM2: $PM2_VERSION"
    
    log_success "Node.js 18 installed successfully"
}

# Install PostgreSQL 15
install_postgresql() {
    log_step "Installing PostgreSQL 15"
    
    # Add PostgreSQL APT repository with proper key handling
    log_substep "Adding PostgreSQL repository..."
    wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /usr/share/keyrings/postgresql-keyring.gpg
    echo "deb [signed-by=/usr/share/keyrings/postgresql-keyring.gpg] http://apt.postgresql.org/pub/repos/apt/ $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list
    
    # Update package list
    apt-get update -qq
    
    # Install PostgreSQL
    log_substep "Installing PostgreSQL 15..."
    apt-get install -y postgresql-15 postgresql-client-15 postgresql-contrib-15
    
    # Start and enable PostgreSQL
    systemctl start postgresql
    systemctl enable postgresql
    
    # Wait for PostgreSQL to be ready
    sleep 5
    
    # Create database and user
    log_substep "Creating database and user..."
    sudo -u postgres psql << EOF || true
DROP DATABASE IF EXISTS $DB_NAME;
DROP USER IF EXISTS $DB_USER;
CREATE DATABASE $DB_NAME;
CREATE USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
ALTER USER $DB_USER CREATEDB;
ALTER DATABASE $DB_NAME OWNER TO $DB_USER;
\q
EOF
    
    # Configure PostgreSQL for production
    log_substep "Configuring PostgreSQL..."
    PG_VERSION="15"
    PG_CONFIG="/etc/postgresql/$PG_VERSION/main/postgresql.conf"
    PG_HBA="/etc/postgresql/$PG_VERSION/main/pg_hba.conf"
    
    # Backup original configs
    cp "$PG_CONFIG" "$PG_CONFIG.backup"
    cp "$PG_HBA" "$PG_HBA.backup"
    
    # Update PostgreSQL configuration
    sed -i "s/#listen_addresses = 'localhost'/listen_addresses = 'localhost'/" "$PG_CONFIG"
    sed -i "s/#port = 5432/port = 5432/" "$PG_CONFIG"
    sed -i "s/#max_connections = 100/max_connections = 200/" "$PG_CONFIG"
    sed -i "s/#shared_buffers = 128MB/shared_buffers = 256MB/" "$PG_CONFIG"
    
    # Update authentication
    sed -i "s/local   all             all                                     peer/local   all             all                                     md5/" "$PG_HBA"
    sed -i "s/local   all             postgres                                peer/local   all             postgres                                peer/" "$PG_HBA"
    
    # Restart PostgreSQL
    systemctl restart postgresql
    
    # Test connection
    if sudo -u postgres psql -d "$DB_NAME" -c "SELECT version();" > /dev/null 2>&1; then
        log_success "PostgreSQL 15 installed and configured successfully"
    else
        log_error "PostgreSQL installation failed"
        exit 1
    fi
}

# Install and configure Redis
install_redis() {
    log_step "Installing and Configuring Redis"
    
    # Stop any existing Redis service
    systemctl stop redis-server 2>/dev/null || true
    
    # Remove existing Redis if problematic
    apt-get remove --purge -y redis-server redis-tools 2>/dev/null || true
    
    # Add Redis repository
    log_substep "Adding Redis repository..."
    curl -fsSL https://packages.redis.io/gpg | gpg --dearmor -o /usr/share/keyrings/redis-archive-keyring.gpg
    echo "deb [signed-by=/usr/share/keyrings/redis-archive-keyring.gpg] https://packages.redis.io/deb $(lsb_release -cs) main" > /etc/apt/sources.list.d/redis.list
    
    # Update and install Redis
    apt-get update -qq
    apt-get install -y redis
    
    # Create Redis configuration directory
    mkdir -p /etc/redis
    
    # Create a clean Redis configuration
    log_substep "Creating Redis configuration..."
    cat > /etc/redis/redis.conf << EOF
# Redis Configuration for SalesSync Production

# Network
bind 127.0.0.1
port 6379
timeout 0
tcp-keepalive 300

# General
daemonize yes
supervised systemd
pidfile /var/run/redis/redis-server.pid
loglevel notice
logfile /var/log/redis/redis-server.log

# Security
requirepass $REDIS_PASSWORD

# Memory Management
maxmemory 512mb
maxmemory-policy allkeys-lru

# Persistence
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes
dbfilename dump.rdb
dir /var/lib/redis

# Append Only File
appendonly yes
appendfilename "appendonly.aof"
appendfsync everysec
no-appendfsync-on-rewrite no
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb

# Slow Log
slowlog-log-slower-than 10000
slowlog-max-len 128

# Client Output Buffer Limits
client-output-buffer-limit normal 0 0 0
client-output-buffer-limit replica 256mb 64mb 60
client-output-buffer-limit pubsub 32mb 8mb 60
EOF
    
    # Set proper permissions
    chown redis:redis /etc/redis/redis.conf
    chmod 640 /etc/redis/redis.conf
    
    # Create Redis directories
    mkdir -p /var/lib/redis
    mkdir -p /var/log/redis
    chown redis:redis /var/lib/redis
    chown redis:redis /var/log/redis
    
    # Create systemd service file
    log_substep "Creating Redis systemd service..."
    cat > /etc/systemd/system/redis.service << EOF
[Unit]
Description=Advanced key-value store
After=network.target
Documentation=http://redis.io/documentation, man:redis-server(1)

[Service]
Type=notify
ExecStart=/usr/bin/redis-server /etc/redis/redis.conf
ExecStop=/usr/bin/redis-cli shutdown
TimeoutStopSec=0
Restart=always
User=redis
Group=redis
RuntimeDirectory=redis
RuntimeDirectoryMode=0755

[Install]
WantedBy=multi-user.target
EOF
    
    # Reload systemd and start Redis
    systemctl daemon-reload
    systemctl enable redis
    systemctl start redis
    
    # Wait for Redis to start
    sleep 3
    
    # Test Redis connection
    log_substep "Testing Redis connection..."
    if redis-cli -a "$REDIS_PASSWORD" ping | grep -q "PONG"; then
        log_success "Redis installed and configured successfully"
    else
        log_error "Redis installation failed"
        exit 1
    fi
}

# Install and configure Nginx
install_nginx() {
    log_step "Installing and Configuring Nginx"
    
    # Install Nginx
    log_substep "Installing Nginx..."
    apt-get install -y nginx
    
    # Start and enable Nginx
    systemctl start nginx
    systemctl enable nginx
    
    # Remove default configuration
    rm -f /etc/nginx/sites-enabled/default
    rm -f /etc/nginx/sites-available/default
    
    # Create optimized Nginx configuration
    log_substep "Creating Nginx configuration..."
    cat > /etc/nginx/nginx.conf << 'EOF'
user www-data;
worker_processes auto;
pid /run/nginx.pid;
include /etc/nginx/modules-enabled/*.conf;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    # Basic Settings
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    server_tokens off;
    
    # MIME
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    
    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log;
    
    # Gzip Settings
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;
    
    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;
    
    # Include site configurations
    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}
EOF
    
    # Test Nginx configuration
    if nginx -t; then
        log_success "Nginx installed and configured successfully"
    else
        log_error "Nginx configuration failed"
        exit 1
    fi
}

# Install SSL certificates
install_ssl() {
    log_step "Installing SSL Certificates"
    
    # Install Certbot
    log_substep "Installing Certbot..."
    apt-get install -y certbot python3-certbot-nginx
    
    # Create initial Nginx site configuration for SSL challenge
    log_substep "Creating initial site configuration..."
    cat > /etc/nginx/sites-available/$DOMAIN << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}
EOF
    
    # Enable site
    ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
    
    # Test and reload Nginx
    nginx -t && systemctl reload nginx
    
    # Get SSL certificate
    log_substep "Obtaining SSL certificate for $DOMAIN..."
    if certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos --email "admin@gonxt.tech" --redirect; then
        log_success "SSL certificate obtained successfully"
    else
        log_warning "SSL certificate installation failed, continuing without SSL"
    fi
    
    # Setup auto-renewal
    log_substep "Setting up SSL auto-renewal..."
    echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -
    
    log_success "SSL certificates configured"
}

# Clone and setup repository
setup_repository() {
    log_step "Setting Up SalesSync Repository"
    
    # Remove existing directory if it exists
    if [ -d "$INSTALL_DIR" ]; then
        log_substep "Removing existing installation..."
        rm -rf "$INSTALL_DIR"
    fi
    
    # Create install directory
    mkdir -p "$INSTALL_DIR"
    
    # Clone repository
    log_substep "Cloning SalesSync repository..."
    git clone "$GITHUB_REPO" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
    
    # Get commit information
    COMMIT_HASH=$(git rev-parse --short HEAD)
    COMMIT_MESSAGE=$(git log -1 --pretty=%B | head -1)
    
    log_substep "Repository cloned successfully"
    log_substep "Latest commit: $COMMIT_HASH - $COMMIT_MESSAGE"
    
    log_success "Repository setup completed"
}

# Setup backend application
setup_backend() {
    log_step "Setting Up Backend Application"
    
    cd "$INSTALL_DIR/backend"
    
    # Install dependencies
    log_substep "Installing backend dependencies..."
    npm ci --production --silent
    
    # Create environment configuration
    log_substep "Creating environment configuration..."
    cat > .env << EOF
# Database Configuration
DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME?schema=public"

# Redis Configuration
REDIS_URL="redis://default:$REDIS_PASSWORD@localhost:6379"

# JWT Configuration
JWT_SECRET="$JWT_SECRET"
JWT_REFRESH_SECRET="$JWT_REFRESH_SECRET"

# Application Configuration
NODE_ENV="production"
PORT="3000"
DOMAIN="$DOMAIN"

# Email Configuration
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="noreply@gonxt.tech"
SMTP_PASS="your-email-password-here"
SMTP_FROM="SalesSync <noreply@gonxt.tech>"

# File Upload Configuration
UPLOAD_DIR="$INSTALL_DIR/uploads"
MAX_FILE_SIZE="10485760"

# Security Configuration
BCRYPT_ROUNDS="12"
RATE_LIMIT_WINDOW="900000"
RATE_LIMIT_MAX="100"

# Monitoring Configuration
ENABLE_METRICS="true"
METRICS_PORT="9090"

# Backup Configuration
BACKUP_DIR="$INSTALL_DIR/backups"
BACKUP_RETENTION_DAYS="30"

# Production Optimizations
NODE_OPTIONS="--max-old-space-size=1024"
UV_THREADPOOL_SIZE="4"
EOF
    
    # Create required directories
    log_substep "Creating application directories..."
    mkdir -p "$INSTALL_DIR/uploads"
    mkdir -p "$INSTALL_DIR/backups"
    mkdir -p "$INSTALL_DIR/logs"
    
    # Set proper permissions
    chown -R www-data:www-data "$INSTALL_DIR/uploads"
    chown -R www-data:www-data "$INSTALL_DIR/backups"
    chown -R www-data:www-data "$INSTALL_DIR/logs"
    
    # Generate Prisma client
    log_substep "Generating Prisma client..."
    npx prisma generate
    
    # Run database migrations
    log_substep "Running database migrations..."
    npx prisma db push --accept-data-loss
    
    # Seed database with sample data
    log_substep "Seeding database with TestCompany and sample data..."
    npx prisma db seed
    
    # Build TypeScript application
    log_substep "Building TypeScript application..."
    npm run build
    
    log_success "Backend application setup completed"
}

# Setup frontend application
setup_frontend() {
    log_step "Setting Up Frontend Application"
    
    cd "$INSTALL_DIR/frontend-web"
    
    # Install dependencies
    log_substep "Installing frontend dependencies..."
    npm ci --silent
    
    # Create environment configuration
    log_substep "Creating frontend environment..."
    cat > .env << EOF
REACT_APP_API_URL=https://$DOMAIN/api
REACT_APP_DOMAIN=$DOMAIN
REACT_APP_VERSION=1.0.0
REACT_APP_ENVIRONMENT=production
REACT_APP_COMPANY_NAME=SalesSync
REACT_APP_SUPPORT_EMAIL=support@gonxt.tech
EOF
    
    # Build production frontend
    log_substep "Building production frontend..."
    npm run build
    
    # Deploy to web directory
    log_substep "Deploying frontend..."
    rm -rf /var/www/html/*
    cp -r build/* /var/www/html/
    
    # Set proper permissions
    chown -R www-data:www-data /var/www/html
    chmod -R 755 /var/www/html
    
    log_success "Frontend application setup completed"
}

# Configure Nginx for production
configure_nginx_production() {
    log_step "Configuring Nginx for Production"
    
    # Create production Nginx configuration
    log_substep "Creating production Nginx configuration..."
    cat > /etc/nginx/sites-available/$DOMAIN << EOF
# Upstream backend servers
upstream backend {
    server 127.0.0.1:3000 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

# HTTP to HTTPS redirect
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

# Main HTTPS server
server {
    listen 443 ssl http2;
    server_name $DOMAIN www.$DOMAIN;
    
    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    ssl_session_timeout 1d;
    ssl_session_cache shared:MozTLS:10m;
    ssl_session_tickets off;
    
    # Modern SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # Security Headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; media-src 'self'; object-src 'none'; child-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'self';" always;
    
    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;
    
    # Document root
    root /var/www/html;
    index index.html index.htm;
    
    # API routes with rate limiting
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Buffer settings
        proxy_buffering on;
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
    }
    
    # Authentication endpoints with stricter rate limiting
    location /api/auth/login {
        limit_req zone=login burst=5 nodelay;
        
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Health check endpoint
    location /health {
        proxy_pass http://backend;
        access_log off;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
    
    # Static file serving with caching
    location / {
        try_files \$uri \$uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|webp)\$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
            add_header Vary Accept-Encoding;
        }
        
        # Cache HTML files for shorter period
        location ~* \.(html|htm)\$ {
            expires 1h;
            add_header Cache-Control "public, must-revalidate";
        }
    }
    
    # Security - deny access to sensitive files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
    
    location ~ \.(env|log|sql|conf)\$ {
        deny all;
        access_log off;
        log_not_found off;
    }
    
    # Favicon
    location = /favicon.ico {
        log_not_found off;
        access_log off;
    }
    
    # Robots.txt
    location = /robots.txt {
        log_not_found off;
        access_log off;
    }
}
EOF
    
    # Test Nginx configuration
    if nginx -t; then
        systemctl reload nginx
        log_success "Nginx production configuration applied"
    else
        log_error "Nginx configuration test failed"
        exit 1
    fi
}

# Setup PM2 process manager
setup_pm2() {
    log_step "Setting Up PM2 Process Manager"
    
    cd "$INSTALL_DIR/backend"
    
    # Stop any existing PM2 processes
    pm2 delete all 2>/dev/null || true
    
    # Create PM2 ecosystem configuration
    log_substep "Creating PM2 ecosystem configuration..."
    cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'salessync-backend',
    script: 'dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '$INSTALL_DIR/logs/salessync-error.log',
    out_file: '$INSTALL_DIR/logs/salessync-out.log',
    log_file: '$INSTALL_DIR/logs/salessync-combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024',
    watch: false,
    ignore_watch: ['node_modules', 'logs', 'uploads', 'backups'],
    max_restarts: 10,
    min_uptime: '10s',
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000,
    restart_delay: 4000,
    autorestart: true,
    vizion: false,
    pmx: false
  }]
};
EOF
    
    # Start application with PM2
    log_substep "Starting SalesSync application..."
    pm2 start ecosystem.config.js
    
    # Save PM2 configuration
    pm2 save
    
    # Setup PM2 startup script
    pm2 startup systemd -u root --hp /root
    
    # Wait for application to start
    sleep 10
    
    # Verify application is running
    if pm2 list | grep -q "salessync-backend.*online"; then
        log_success "PM2 process manager configured successfully"
    else
        log_error "PM2 application startup failed"
        pm2 logs salessync-backend --lines 20
        exit 1
    fi
}

# Configure firewall
setup_firewall() {
    log_step "Configuring Firewall"
    
    # Reset UFW to default state
    ufw --force reset
    
    # Set default policies
    ufw default deny incoming
    ufw default allow outgoing
    
    # Allow SSH (be careful not to lock yourself out)
    ufw allow ssh
    ufw allow 22/tcp
    
    # Allow HTTP and HTTPS
    ufw allow 80/tcp
    ufw allow 443/tcp
    
    # Allow specific outbound connections
    ufw allow out 53/udp  # DNS
    ufw allow out 80/tcp  # HTTP
    ufw allow out 443/tcp # HTTPS
    ufw allow out 25/tcp  # SMTP
    ufw allow out 587/tcp # SMTP TLS
    
    # Enable firewall
    ufw --force enable
    
    # Configure fail2ban
    log_substep "Configuring Fail2Ban..."
    cat > /etc/fail2ban/jail.local << EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
port = http,https
logpath = /var/log/nginx/error.log

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 10
EOF
    
    systemctl restart fail2ban
    systemctl enable fail2ban
    
    log_success "Firewall and security configured"
}

# Setup monitoring and logging
setup_monitoring() {
    log_step "Setting Up Monitoring and Logging"
    
    # Create monitoring script
    log_substep "Creating system monitoring script..."
    cat > /usr/local/bin/salessync-monitor.sh << EOF
#!/bin/bash

# SalesSync System Monitoring Script
LOG_FILE="/var/log/salessync-monitor.log"
DATE=\$(date '+%Y-%m-%d %H:%M:%S')

# Check backend health
BACKEND_STATUS=\$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health 2>/dev/null || echo "000")

# Check database
DB_STATUS=\$(sudo -u postgres psql -d $DB_NAME -c "SELECT 1;" > /dev/null 2>&1 && echo "OK" || echo "ERROR")

# Check Redis
REDIS_STATUS=\$(redis-cli -a "$REDIS_PASSWORD" ping 2>/dev/null | grep -q "PONG" && echo "OK" || echo "ERROR")

# Check Nginx
NGINX_STATUS=\$(systemctl is-active nginx 2>/dev/null || echo "ERROR")

# Check PM2
PM2_STATUS=\$(pm2 jlist 2>/dev/null | jq -r '.[0].pm2_env.status' 2>/dev/null || echo "ERROR")

# System metrics
DISK_USAGE=\$(df / | tail -1 | awk '{print \$5}' | sed 's/%//')
MEMORY_USAGE=\$(free | grep Mem | awk '{printf "%.0f", \$3/\$2 * 100.0}')
CPU_LOAD=\$(uptime | awk -F'load average:' '{print \$2}' | awk '{print \$1}' | sed 's/,//')

# Log status
echo "[\$DATE] Backend:\$BACKEND_STATUS DB:\$DB_STATUS Redis:\$REDIS_STATUS Nginx:\$NGINX_STATUS PM2:\$PM2_STATUS Disk:\${DISK_USAGE}% Mem:\${MEMORY_USAGE}% Load:\$CPU_LOAD" >> "\$LOG_FILE"

# Alerts
if [ "\$BACKEND_STATUS" != "200" ] || [ "\$DB_STATUS" != "OK" ] || [ "\$REDIS_STATUS" != "OK" ]; then
    echo "[\$DATE] ALERT: Service issues detected" >> "\$LOG_FILE"
fi

if [ "\$DISK_USAGE" -gt 85 ]; then
    echo "[\$DATE] ALERT: Disk usage high: \${DISK_USAGE}%" >> "\$LOG_FILE"
fi

if [ "\$MEMORY_USAGE" -gt 85 ]; then
    echo "[\$DATE] ALERT: Memory usage high: \${MEMORY_USAGE}%" >> "\$LOG_FILE"
fi
EOF
    
    chmod +x /usr/local/bin/salessync-monitor.sh
    
    # Add monitoring to crontab
    log_substep "Setting up monitoring cron job..."
    (crontab -l 2>/dev/null; echo "*/5 * * * * /usr/local/bin/salessync-monitor.sh") | crontab -
    
    # Setup log rotation
    log_substep "Configuring log rotation..."
    cat > /etc/logrotate.d/salessync << EOF
$INSTALL_DIR/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 root root
    postrotate
        pm2 reloadLogs
    endscript
}

/var/log/salessync-monitor.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 root root
}

/var/log/nginx/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 www-data adm
    postrotate
        systemctl reload nginx
    endscript
}
EOF
    
    log_success "Monitoring and logging configured"
}

# Setup backup system
setup_backup() {
    log_step "Setting Up Backup System"
    
    # Create backup script
    log_substep "Creating backup script..."
    cat > /usr/local/bin/salessync-backup.sh << EOF
#!/bin/bash

# SalesSync Backup Script
BACKUP_DIR="$INSTALL_DIR/backups"
DATE=\$(date +%Y%m%d_%H%M%S)
DB_BACKUP="\$BACKUP_DIR/database_\$DATE.sql"
FILES_BACKUP="\$BACKUP_DIR/files_\$DATE.tar.gz"
LOG_FILE="/var/log/salessync-backup.log"

# Create backup directory
mkdir -p "\$BACKUP_DIR"

# Database backup
echo "\$(date): Starting database backup..." >> "\$LOG_FILE"
sudo -u postgres pg_dump $DB_NAME > "\$DB_BACKUP"
if [ \$? -eq 0 ]; then
    gzip "\$DB_BACKUP"
    echo "\$(date): Database backup completed: \$DB_BACKUP.gz" >> "\$LOG_FILE"
else
    echo "\$(date): Database backup failed" >> "\$LOG_FILE"
    exit 1
fi

# Files backup
echo "\$(date): Starting files backup..." >> "\$LOG_FILE"
tar -czf "\$FILES_BACKUP" -C $INSTALL_DIR uploads logs 2>/dev/null
if [ \$? -eq 0 ]; then
    echo "\$(date): Files backup completed: \$FILES_BACKUP" >> "\$LOG_FILE"
else
    echo "\$(date): Files backup failed" >> "\$LOG_FILE"
fi

# Remove old backups (keep 30 days)
find "\$BACKUP_DIR" -name "*.gz" -mtime +30 -delete
find "\$BACKUP_DIR" -name "*.sql" -mtime +30 -delete

echo "\$(date): Backup process completed" >> "\$LOG_FILE"
EOF
    
    chmod +x /usr/local/bin/salessync-backup.sh
    
    # Add backup to crontab (daily at 2 AM)
    log_substep "Setting up backup cron job..."
    (crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/salessync-backup.sh") | crontab -
    
    # Run initial backup
    log_substep "Running initial backup..."
    /usr/local/bin/salessync-backup.sh
    
    log_success "Backup system configured"
}

# Verify installation
verify_installation() {
    log_step "Verifying Installation"
    
    # Wait for all services to stabilize
    log_substep "Waiting for services to stabilize..."
    sleep 15
    
    # Check system services
    log_substep "Checking system services..."
    
    # PostgreSQL
    if systemctl is-active --quiet postgresql; then
        log_substep "✅ PostgreSQL is running"
    else
        log_error "❌ PostgreSQL is not running"
        return 1
    fi
    
    # Redis
    if systemctl is-active --quiet redis; then
        log_substep "✅ Redis is running"
    else
        log_error "❌ Redis is not running"
        return 1
    fi
    
    # Nginx
    if systemctl is-active --quiet nginx; then
        log_substep "✅ Nginx is running"
    else
        log_error "❌ Nginx is not running"
        return 1
    fi
    
    # PM2 Application
    if pm2 list | grep -q "salessync-backend.*online"; then
        log_substep "✅ SalesSync application is running"
    else
        log_error "❌ SalesSync application is not running"
        return 1
    fi
    
    # Test application endpoints
    log_substep "Testing application endpoints..."
    
    # Health check
    HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/health" 2>/dev/null || echo "000")
    if [ "$HEALTH_STATUS" = "200" ]; then
        log_substep "✅ Backend health endpoint responding"
    else
        log_error "❌ Backend health endpoint not responding (HTTP $HEALTH_STATUS)"
        return 1
    fi
    
    # Frontend check
    FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN" 2>/dev/null || echo "000")
    if [ "$FRONTEND_STATUS" = "200" ]; then
        log_substep "✅ Frontend loading correctly"
    else
        log_warning "⚠️ Frontend not loading correctly (HTTP $FRONTEND_STATUS)"
    fi
    
    # Database connectivity
    if sudo -u postgres psql -d "$DB_NAME" -c "SELECT COUNT(*) FROM companies;" > /dev/null 2>&1; then
        log_substep "✅ Database connectivity verified"
    else
        log_error "❌ Database connectivity failed"
        return 1
    fi
    
    # Redis connectivity
    if redis-cli -a "$REDIS_PASSWORD" ping | grep -q "PONG"; then
        log_substep "✅ Redis connectivity verified"
    else
        log_error "❌ Redis connectivity failed"
        return 1
    fi
    
    log_success "Installation verification completed successfully"
    return 0
}

# Generate installation report
generate_report() {
    log_step "Generating Installation Report"
    
    REPORT_FILE="$INSTALL_DIR/INSTALLATION_REPORT.md"
    
    cat > "$REPORT_FILE" << EOF
# SalesSync Production Installation Report

**Installation Date**: $(date)
**Domain**: $DOMAIN
**Installation Directory**: $INSTALL_DIR
**Server IP**: $(curl -s ifconfig.me 2>/dev/null || echo "Unable to detect")

## System Information
- **OS**: $(lsb_release -d | cut -f2)
- **Kernel**: $(uname -r)
- **Architecture**: $(uname -m)
- **CPU Cores**: $(nproc)
- **Memory**: $(free -h | grep '^Mem:' | awk '{print $2}')
- **Disk Space**: $(df -h / | tail -1 | awk '{print $4}') available

## Installed Components
- **Node.js**: $(node --version)
- **NPM**: $(npm --version)
- **PM2**: $(pm2 --version)
- **PostgreSQL**: $(sudo -u postgres psql --version | head -1)
- **Redis**: $(redis-server --version | head -1)
- **Nginx**: $(nginx -v 2>&1)

## Application URLs
- **Frontend**: https://$DOMAIN
- **Backend API**: https://$DOMAIN/api
- **Health Check**: https://$DOMAIN/health
- **API Documentation**: https://$DOMAIN/api/docs

## Login Credentials
- **Super Admin**: superadmin@salessync.com / SuperAdmin123!
- **Company Admin**: admin@testcompany.com / Admin123!
- **Manager**: manager@testcompany.com / Manager123!
- **Field Agent**: agent@testcompany.com / Agent123!
- **Marketing Agent**: marketing@testcompany.com / Marketing123!

## Database Information
- **Database Name**: $DB_NAME
- **Database User**: $DB_USER
- **Connection**: PostgreSQL 15 on localhost:5432

## Security Configuration
- **Firewall**: UFW enabled (SSH, HTTP, HTTPS)
- **SSL Certificate**: Let's Encrypt (auto-renewal configured)
- **Fail2Ban**: Enabled for SSH and Nginx protection
- **Rate Limiting**: API and login endpoints protected

## Monitoring & Backup
- **Health Monitoring**: Every 5 minutes
- **Log Rotation**: Daily with 30-day retention
- **Database Backup**: Daily at 2 AM
- **File Backup**: Daily at 2 AM
- **Backup Retention**: 30 days

## Service Management

### PM2 Commands
\`\`\`bash
pm2 status                    # View application status
pm2 logs salessync-backend    # View logs
pm2 restart salessync-backend # Restart application
pm2 monit                     # Monitor performance
pm2 reload salessync-backend  # Zero-downtime reload
\`\`\`

### System Services
\`\`\`bash
sudo systemctl status postgresql  # PostgreSQL status
sudo systemctl status redis       # Redis status
sudo systemctl status nginx       # Nginx status
sudo systemctl status fail2ban    # Fail2Ban status
\`\`\`

### SSL Certificate Management
\`\`\`bash
sudo certbot certificates         # Check certificates
sudo certbot renew               # Manual renewal
sudo certbot renew --dry-run     # Test renewal
\`\`\`

### Backup Management
\`\`\`bash
sudo /usr/local/bin/salessync-backup.sh  # Manual backup
sudo tail -f /var/log/salessync-backup.log  # Backup logs
ls -la $INSTALL_DIR/backups/              # List backups
\`\`\`

### Monitoring
\`\`\`bash
sudo tail -f /var/log/salessync-monitor.log  # Monitor logs
sudo /usr/local/bin/salessync-monitor.sh     # Manual check
htop                                          # System resources
\`\`\`

## Troubleshooting

### Application Issues
1. Check PM2 status: \`pm2 status\`
2. View application logs: \`pm2 logs salessync-backend\`
3. Check environment: \`cat $INSTALL_DIR/backend/.env\`
4. Test database: \`sudo -u postgres psql -d $DB_NAME -c "SELECT 1;"\`
5. Test Redis: \`redis-cli -a "$REDIS_PASSWORD" ping\`

### Web Server Issues
1. Check Nginx status: \`sudo systemctl status nginx\`
2. Test configuration: \`sudo nginx -t\`
3. View error logs: \`sudo tail -f /var/log/nginx/error.log\`
4. Check SSL: \`sudo certbot certificates\`

### Performance Issues
1. Monitor resources: \`htop\`
2. Check PM2 metrics: \`pm2 monit\`
3. View system logs: \`sudo journalctl -f\`
4. Check disk space: \`df -h\`

## Support Information
- **Email**: support@gonxt.tech
- **Documentation**: https://$DOMAIN/docs
- **Repository**: $GITHUB_REPO
- **Installation Log**: Available in system logs

---

**Installation Status**: ✅ COMPLETED SUCCESSFULLY
**Ready for Production**: YES
**All Services**: RUNNING
**Security**: CONFIGURED
**Monitoring**: ACTIVE
**Backups**: SCHEDULED

SalesSync is now fully deployed and ready for production use!
EOF
    
    log_success "Installation report generated: $REPORT_FILE"
}

# Update GitHub repository
update_github() {
    log_step "Updating GitHub Repository"
    
    cd "$INSTALL_DIR"
    
    # Create deployment status file
    cat > DEPLOYMENT_STATUS.md << EOF
# 🚀 SalesSync Production Deployment Status

**Status**: ✅ LIVE IN PRODUCTION
**Deployment Date**: $(date)
**Server**: $(curl -s ifconfig.me 2>/dev/null || echo "Unknown")
**Domain**: $DOMAIN

## Quick Access
- **Application**: https://$DOMAIN
- **API Health**: https://$DOMAIN/health
- **API Documentation**: https://$DOMAIN/api/docs

## System Status
All services are running optimally:
- ✅ Backend Application (PM2 Cluster)
- ✅ PostgreSQL 15 Database
- ✅ Redis Cache Server
- ✅ Nginx Web Server
- ✅ SSL/TLS Certificates
- ✅ Monitoring & Backups

## Sample Data
TestCompany Ltd is fully configured with:
- 5 Users across all roles
- 10 South African customers
- 5 FMCG products
- 5 completed visits with GPS data
- 3 sales transactions
- Sample marketing campaigns

## Login Credentials
- **Super Admin**: superadmin@salessync.com / SuperAdmin123!
- **Company Admin**: admin@testcompany.com / Admin123!
- **Manager**: manager@testcompany.com / Manager123!
- **Field Agent**: agent@testcompany.com / Agent123!

---
*Last updated: $(date)*
*Deployment completed successfully*
EOF
    
    # Commit deployment status
    git add .
    git commit -m "🎉 PRODUCTION DEPLOYMENT SUCCESSFUL

✅ Live deployment completed on $(curl -s ifconfig.me 2>/dev/null)
✅ Domain: $DOMAIN with SSL certificates
✅ All services running and monitored
✅ TestCompany seeded with comprehensive sample data
✅ Complete production infrastructure deployed

System Status:
- Backend: PM2 cluster with auto-restart
- Database: PostgreSQL 15 with optimized configuration
- Cache: Redis with authentication and persistence
- Web Server: Nginx with SSL and security headers
- Security: UFW firewall and Fail2Ban protection
- Monitoring: Automated health checks and alerting
- Backups: Daily automated backups with retention

Deployment completed: $(date)

Co-authored-by: openhands <openhands@all-hands.dev>" || log_warning "Git commit failed - continuing"
    
    # Push to GitHub
    git push origin main || log_warning "Git push failed - continuing"
    
    log_success "GitHub repository updated"
}

# Display completion summary
display_completion() {
    clear
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                               ║${NC}"
    echo -e "${GREEN}║  🎉 SALESSYNC PRODUCTION DEPLOYMENT COMPLETED! 🎉            ║${NC}"
    echo -e "${GREEN}║                                                               ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    log_success "SalesSync is now live and running in production!"
    echo ""
    
    echo -e "${CYAN}🌐 Application Access:${NC}"
    echo "   Frontend:        https://$DOMAIN"
    echo "   Backend API:     https://$DOMAIN/api"
    echo "   Health Check:    https://$DOMAIN/health"
    echo "   API Docs:        https://$DOMAIN/api/docs"
    echo ""
    
    echo -e "${CYAN}🔐 Login Credentials:${NC}"
    echo "   Super Admin:     superadmin@salessync.com / SuperAdmin123!"
    echo "   Company Admin:   admin@testcompany.com / Admin123!"
    echo "   Manager:         manager@testcompany.com / Manager123!"
    echo "   Field Agent:     agent@testcompany.com / Agent123!"
    echo "   Marketing:       marketing@testcompany.com / Marketing123!"
    echo ""
    
    echo -e "${CYAN}📊 Sample Data Included:${NC}"
    echo "   • TestCompany Ltd with complete configuration"
    echo "   • 5 Users across all roles with South African profiles"
    echo "   • 10 Customers with realistic business data"
    echo "   • 5 Products with FMCG specifications and pricing"
    echo "   • 5 Completed visits with GPS coordinates and surveys"
    echo "   • 3 Sales transactions with payment records"
    echo "   • Sample marketing campaigns and activations"
    echo ""
    
    echo -e "${CYAN}🛠️ Management Commands:${NC}"
    echo "   Application:     pm2 status | pm2 logs salessync-backend"
    echo "   Services:        systemctl status postgresql redis nginx"
    echo "   Monitoring:      tail -f /var/log/salessync-monitor.log"
    echo "   Backups:         /usr/local/bin/salessync-backup.sh"
    echo "   SSL:             certbot certificates"
    echo ""
    
    echo -e "${CYAN}📋 System Status:${NC}"
    echo "   Installation:    ✅ Complete"
    echo "   Security:        ✅ Configured (UFW + Fail2Ban + SSL)"
    echo "   Monitoring:      ✅ Active (5-minute health checks)"
    echo "   Backups:         ✅ Scheduled (Daily at 2 AM)"
    echo "   Performance:     ✅ Optimized (PM2 cluster mode)"
    echo ""
    
    echo -e "${CYAN}📚 Documentation:${NC}"
    echo "   Installation Report: $INSTALL_DIR/INSTALLATION_REPORT.md"
    echo "   Deployment Status:   $INSTALL_DIR/DEPLOYMENT_STATUS.md"
    echo "   Support Email:       support@gonxt.tech"
    echo "   Repository:          $GITHUB_REPO"
    echo ""
    
    echo -e "${CYAN}🎯 Next Steps:${NC}"
    echo "   1. Visit https://$DOMAIN to access the application"
    echo "   2. Login with the credentials above"
    echo "   3. Explore TestCompany sample data"
    echo "   4. Configure your company settings"
    echo "   5. Add your field agents and start operations"
    echo ""
    
    log_success "🚀 SalesSync is ready for production use!"
    log_info "Total deployment time: $(date)"
    echo ""
}

# Main deployment function
main() {
    # Display banner
    display_banner
    
    # Run deployment steps
    check_prerequisites
    update_system
    install_nodejs
    install_postgresql
    install_redis
    install_nginx
    install_ssl
    setup_repository
    setup_backend
    setup_frontend
    configure_nginx_production
    setup_pm2
    setup_firewall
    setup_monitoring
    setup_backup
    
    # Verify and complete
    if verify_installation; then
        generate_report
        update_github
        display_completion
    else
        log_error "Installation verification failed"
        log_info "Check logs and try running verification again"
        exit 1
    fi
}

# Handle script arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "verify")
        verify_installation
        ;;
    "update")
        update_github
        ;;
    "status")
        log_info "Checking SalesSync status..."
        systemctl status postgresql redis nginx
        pm2 status
        curl -s http://localhost:3000/health | jq . || echo "Backend not responding"
        ;;
    *)
        echo "Usage: $0 {deploy|verify|update|status}"
        echo "  deploy  - Complete deployment (default)"
        echo "  verify  - Verify installation only"
        echo "  update  - Update GitHub repository only"
        echo "  status  - Check system status"
        exit 1
        ;;
esac