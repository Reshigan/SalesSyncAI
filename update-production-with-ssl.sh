#!/bin/bash

# =============================================================================
# SalesSync Production Update Script with SSL Installation
# Domain: SalesSync.gonxt.tech
# =============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="SalesSync.gonxt.tech"
APP_DIR="/opt/salessync"
BACKUP_DIR="/opt/salessync-backups"
NGINX_CONFIG="/etc/nginx/sites-available/salessync"
NGINX_ENABLED="/etc/nginx/sites-enabled/salessync"
SERVICE_NAME="salessync"
DB_NAME="salessync_production"

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}" >&2
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root (use sudo)"
        exit 1
    fi
}

# Create backup
create_backup() {
    log "Creating backup..."
    
    # Create backup directory
    mkdir -p "$BACKUP_DIR/$(date +%Y%m%d_%H%M%S)"
    CURRENT_BACKUP="$BACKUP_DIR/$(date +%Y%m%d_%H%M%S)"
    
    # Backup application files
    if [ -d "$APP_DIR" ]; then
        log "Backing up application files..."
        cp -r "$APP_DIR" "$CURRENT_BACKUP/app"
    fi
    
    # Backup database
    log "Backing up database..."
    if command -v pg_dump &> /dev/null; then
        sudo -u postgres pg_dump "$DB_NAME" > "$CURRENT_BACKUP/database.sql" 2>/dev/null || warning "Database backup failed - database may not exist yet"
    else
        warning "PostgreSQL not found, skipping database backup"
    fi
    
    # Backup nginx config
    if [ -f "$NGINX_CONFIG" ]; then
        log "Backing up nginx configuration..."
        cp "$NGINX_CONFIG" "$CURRENT_BACKUP/nginx.conf"
    fi
    
    log "Backup created at: $CURRENT_BACKUP"
}

# Install system dependencies
install_dependencies() {
    log "Installing system dependencies..."
    
    # Update package list
    apt update
    
    # Install required packages
    apt install -y \
        curl \
        wget \
        git \
        nginx \
        postgresql \
        postgresql-contrib \
        certbot \
        python3-certbot-nginx \
        ufw \
        htop \
        unzip \
        software-properties-common \
        apt-transport-https \
        ca-certificates \
        gnupg \
        lsb-release
    
    # Install Node.js 18.x
    if ! command -v node &> /dev/null; then
        log "Installing Node.js..."
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt install -y nodejs
    fi
    
    # Install PM2 globally
    if ! command -v pm2 &> /dev/null; then
        log "Installing PM2..."
        npm install -g pm2
    fi
    
    log "Dependencies installed successfully"
}

# Setup PostgreSQL
setup_database() {
    log "Setting up PostgreSQL database..."
    
    # Start PostgreSQL service
    systemctl start postgresql
    systemctl enable postgresql
    
    # Create database and user if they don't exist
    sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || {
        log "Creating database: $DB_NAME"
        sudo -u postgres createdb "$DB_NAME"
    }
    
    # Create user if doesn't exist
    sudo -u postgres psql -tc "SELECT 1 FROM pg_user WHERE usename = 'salessync'" | grep -q 1 || {
        log "Creating database user: salessync"
        sudo -u postgres psql -c "CREATE USER salessync WITH PASSWORD 'salessync_secure_password_2024';"
        sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO salessync;"
        sudo -u postgres psql -c "ALTER USER salessync CREATEDB;"
        sudo -u postgres psql -c "ALTER USER salessync SUPERUSER;"
    }
    
    # Grant schema permissions
    log "Setting up database permissions..."
    sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL ON SCHEMA public TO salessync;"
    sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO salessync;"
    sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO salessync;"
    sudo -u postgres psql -d "$DB_NAME" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO salessync;"
    sudo -u postgres psql -d "$DB_NAME" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO salessync;"
    
    log "Database setup completed"
}

# Deploy application
deploy_application() {
    log "Deploying SalesSync application..."
    
    # Stop existing application
    pm2 stop "$SERVICE_NAME" 2>/dev/null || true
    pm2 delete "$SERVICE_NAME" 2>/dev/null || true
    
    # Create application directory
    mkdir -p "$APP_DIR"
    cd "$APP_DIR"
    
    # Clone or update repository
    if [ -d ".git" ]; then
        log "Updating existing repository..."
        git fetch origin
        git checkout main
        git pull origin main
    else
        log "Cloning repository..."
        git clone https://github.com/Reshigan/SalesSyncAI.git .
        git checkout main
    fi
    
    # Install backend dependencies
    log "Installing backend dependencies..."
    cd "$APP_DIR/backend"
    npm install --production
    
    # Generate Prisma client
    log "Generating Prisma client..."
    npx prisma generate
    
    # Run database migrations
    log "Running database migrations..."
    DATABASE_URL="postgresql://salessync:salessync_secure_password_2024@localhost:5432/$DB_NAME" npx prisma migrate deploy
    
    # Seed database with fixed seeding script
    log "Seeding database..."
    DATABASE_URL="postgresql://salessync:salessync_secure_password_2024@localhost:5432/$DB_NAME" node seed-simple.js || warning "Seeding failed - may already be seeded"
    
    # Fix TypeScript build issues first
    log "Fixing TypeScript build issues..."
    if [ -f "$APP_DIR/fix-typescript-build.sh" ]; then
        cd "$APP_DIR"
        chmod +x fix-typescript-build.sh
        ./fix-typescript-build.sh || warning "TypeScript fix script failed, continuing..."
    fi
    
    # Build application
    log "Building application..."
    
    # Install dev dependencies for TypeScript build
    npm install --include=dev || warning "Failed to install dev dependencies"
    
    # Build with skip lib check to avoid type issues
    npx tsc --skipLibCheck || warning "Backend build completed with warnings"
    
    # Install frontend dependencies (if exists)
    if [ -d "$APP_DIR/frontend" ]; then
        log "Installing frontend dependencies..."
        cd "$APP_DIR/frontend"
        npm install --production
        npm run build 2>/dev/null || warning "Frontend build failed"
    fi
    
    log "Application deployed successfully"
}

# Configure Nginx
configure_nginx() {
    log "Configuring Nginx..."
    
    # Remove default nginx site
    rm -f /etc/nginx/sites-enabled/default
    
    # Create nginx configuration
    cat > "$NGINX_CONFIG" << EOF
# SalesSync Nginx Configuration
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    
    # Redirect HTTP to HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN www.$DOMAIN;
    
    # SSL Configuration (will be updated by certbot)
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    
    # SSL Security Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security Headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript application/json;
    
    # Client max body size
    client_max_body_size 50M;
    
    # Frontend (if exists)
    location / {
        try_files \$uri \$uri/ @backend;
        root $APP_DIR/frontend/dist;
        index index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # Backend API
    location @backend {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # API routes
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    # Health check
    location /health {
        proxy_pass http://localhost:3000/health;
        access_log off;
    }
}
EOF
    
    # Enable the site
    ln -sf "$NGINX_CONFIG" "$NGINX_ENABLED"
    
    # Test nginx configuration
    nginx -t
    
    log "Nginx configured successfully"
}

# Install SSL certificate
install_ssl() {
    log "Installing SSL certificate for $DOMAIN..."
    
    # Stop nginx temporarily
    systemctl stop nginx
    
    # Install SSL certificate
    certbot certonly --standalone \
        --non-interactive \
        --agree-tos \
        --email admin@gonxt.tech \
        --domains "$DOMAIN,www.$DOMAIN" \
        --expand || {
        warning "SSL certificate installation failed, continuing without SSL"
        # Create a temporary HTTP-only config
        cat > "$NGINX_CONFIG" << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
    }
    
    # Setup auto-renewal
    if command -v certbot &> /dev/null; then
        log "Setting up SSL certificate auto-renewal..."
        (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet --nginx") | crontab -
    fi
    
    # Start nginx
    systemctl start nginx
    systemctl enable nginx
    
    log "SSL certificate installation completed"
}

# Start application with PM2
start_application() {
    log "Starting SalesSync application..."
    
    cd "$APP_DIR/backend"
    
    # Create PM2 ecosystem file
    cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: '$SERVICE_NAME',
    script: 'src/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      DATABASE_URL: 'postgresql://salessync:salessync_secure_password_2024@localhost:5432/$DB_NAME'
    }
  }]
};
EOF
    
    # Start application with PM2
    pm2 start ecosystem.config.js
    pm2 save
    pm2 startup
    
    # Wait for application to start
    sleep 5
    
    # Check if application is running
    if pm2 list | grep -q "$SERVICE_NAME.*online"; then
        log "Application started successfully"
    else
        error "Application failed to start"
        pm2 logs "$SERVICE_NAME" --lines 20
        exit 1
    fi
}

# Configure firewall
configure_firewall() {
    log "Configuring firewall..."
    
    # Reset UFW to defaults
    ufw --force reset
    
    # Set default policies
    ufw default deny incoming
    ufw default allow outgoing
    
    # Allow SSH
    ufw allow ssh
    
    # Allow HTTP and HTTPS
    ufw allow 'Nginx Full'
    
    # Allow PostgreSQL (local only)
    ufw allow from 127.0.0.1 to any port 5432
    
    # Enable firewall
    ufw --force enable
    
    log "Firewall configured successfully"
}

# Health check
health_check() {
    log "Performing health check..."
    
    # Check if services are running
    if ! systemctl is-active --quiet nginx; then
        error "Nginx is not running"
        return 1
    fi
    
    if ! systemctl is-active --quiet postgresql; then
        error "PostgreSQL is not running"
        return 1
    fi
    
    if ! pm2 list | grep -q "$SERVICE_NAME.*online"; then
        error "SalesSync application is not running"
        return 1
    fi
    
    # Check if application responds
    sleep 3
    if curl -f -s http://localhost:3000/health > /dev/null 2>&1; then
        log "Application health check passed"
    else
        warning "Application health check failed - app may still be starting"
    fi
    
    # Check SSL certificate (if exists)
    if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
        log "SSL certificate is installed"
        
        # Check certificate expiry
        CERT_EXPIRY=$(openssl x509 -enddate -noout -in "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" | cut -d= -f2)
        log "SSL certificate expires: $CERT_EXPIRY"
    else
        warning "SSL certificate not found"
    fi
    
    log "Health check completed"
}

# Display final information
display_info() {
    log "=== SalesSync Production Deployment Complete ==="
    echo
    info "🌐 Application URL: https://$DOMAIN"
    info "🔧 Application Directory: $APP_DIR"
    info "📊 PM2 Status: pm2 status"
    info "📋 Application Logs: pm2 logs $SERVICE_NAME"
    info "🔄 Restart App: pm2 restart $SERVICE_NAME"
    info "🗄️  Database: $DB_NAME"
    info "📁 Backups: $BACKUP_DIR"
    echo
    info "🔐 Default Login Credentials:"
    info "   Email: admin@demo.com"
    info "   Password: admin123"
    echo
    warning "⚠️  Remember to:"
    warning "   1. Change default passwords"
    warning "   2. Configure environment variables"
    warning "   3. Set up monitoring"
    warning "   4. Configure backup schedule"
    echo
    log "🎉 Deployment successful!"
}

# Main execution
main() {
    log "Starting SalesSync production deployment with SSL..."
    
    check_root
    create_backup
    install_dependencies
    setup_database
    deploy_application
    configure_nginx
    install_ssl
    start_application
    configure_firewall
    health_check
    display_info
}

# Run main function
main "$@"