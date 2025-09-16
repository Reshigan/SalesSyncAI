#!/bin/bash

# 🧹 SalesSync Clean Server Installation Script
# This script completely resets the server and performs a fresh SalesSync installation
# ⚠️  WARNING: This will remove ALL existing installations and data!

set -e

# Configuration
DOMAIN="salessync.gonxt.tech"
APP_DIR="/opt/salessync"
DB_NAME="salessync_production"
DB_USER="salessync"
DB_PASS="salessync_secure_password_2024"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}" >&2
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" >&2
}

info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Function to confirm destructive action
confirm_reset() {
    echo -e "${RED}"
    echo "⚠️  DANGER: COMPLETE SERVER RESET ⚠️"
    echo "This script will:"
    echo "  • Stop all running services (PM2, Nginx, PostgreSQL, Docker)"
    echo "  • Remove ALL existing SalesSync installations"
    echo "  • Delete ALL databases and database users"
    echo "  • Remove ALL Node.js, npm, and related packages"
    echo "  • Clean ALL configuration files"
    echo "  • Remove Docker containers and images"
    echo "  • Perform a complete fresh installation"
    echo ""
    echo "🚨 ALL DATA WILL BE PERMANENTLY LOST! 🚨"
    echo -e "${NC}"
    
    read -p "Are you absolutely sure you want to proceed? Type 'RESET' to continue: " confirm
    if [ "$confirm" != "RESET" ]; then
        error "Operation cancelled by user"
        exit 1
    fi
    
    log "User confirmed server reset. Proceeding..."
}

# Function to stop all services
stop_all_services() {
    log "Stopping all services..."
    
    # Stop PM2 processes
    pm2 kill 2>/dev/null || true
    pkill -f pm2 2>/dev/null || true
    
    # Stop Nginx
    systemctl stop nginx 2>/dev/null || true
    systemctl disable nginx 2>/dev/null || true
    
    # Stop PostgreSQL
    systemctl stop postgresql 2>/dev/null || true
    systemctl disable postgresql 2>/dev/null || true
    
    # Stop Docker and containers
    if command -v docker &> /dev/null; then
        docker stop $(docker ps -aq) 2>/dev/null || true
        docker rm $(docker ps -aq) 2>/dev/null || true
        systemctl stop docker 2>/dev/null || true
        systemctl disable docker 2>/dev/null || true
    fi
    
    # Kill any remaining Node.js processes
    pkill -f node 2>/dev/null || true
    pkill -f npm 2>/dev/null || true
    
    log "All services stopped"
}

# Function to remove all installations
remove_installations() {
    log "Removing all existing installations..."
    
    # Remove application directories
    rm -rf /opt/salessync* 2>/dev/null || true
    rm -rf /var/www/salessync* 2>/dev/null || true
    rm -rf /home/*/salessync* 2>/dev/null || true
    rm -rf /root/salessync* 2>/dev/null || true
    
    # Remove PM2 directories
    rm -rf /root/.pm2 2>/dev/null || true
    rm -rf /home/*/.pm2 2>/dev/null || true
    
    # Remove Node.js global modules
    rm -rf /usr/local/lib/node_modules 2>/dev/null || true
    rm -rf /usr/lib/node_modules 2>/dev/null || true
    
    log "Installations removed"
}

# Function to remove packages
remove_packages() {
    log "Removing packages..."
    
    # Remove Node.js and npm
    apt-get remove --purge -y nodejs npm node 2>/dev/null || true
    apt-get remove --purge -y nodejs-legacy 2>/dev/null || true
    
    # Remove PostgreSQL
    apt-get remove --purge -y postgresql* 2>/dev/null || true
    
    # Remove Nginx
    apt-get remove --purge -y nginx* 2>/dev/null || true
    
    # Remove Docker
    apt-get remove --purge -y docker* containerd* runc 2>/dev/null || true
    
    # Remove PM2 globally
    npm uninstall -g pm2 2>/dev/null || true
    
    # Remove other related packages
    apt-get remove --purge -y certbot python3-certbot-nginx 2>/dev/null || true
    
    # Clean package cache
    apt-get autoremove -y 2>/dev/null || true
    apt-get autoclean 2>/dev/null || true
    
    log "Packages removed"
}

# Function to clean configuration files
clean_configurations() {
    log "Cleaning configuration files..."
    
    # Remove Nginx configurations
    rm -rf /etc/nginx 2>/dev/null || true
    rm -rf /var/log/nginx 2>/dev/null || true
    
    # Remove PostgreSQL data and configurations
    rm -rf /etc/postgresql 2>/dev/null || true
    rm -rf /var/lib/postgresql 2>/dev/null || true
    rm -rf /var/log/postgresql 2>/dev/null || true
    
    # Remove SSL certificates
    rm -rf /etc/letsencrypt 2>/dev/null || true
    
    # Remove Docker configurations
    rm -rf /etc/docker 2>/dev/null || true
    rm -rf /var/lib/docker 2>/dev/null || true
    
    # Remove systemd service files
    rm -f /etc/systemd/system/salessync* 2>/dev/null || true
    systemctl daemon-reload
    
    log "Configuration files cleaned"
}

# Function to clean users and groups
clean_users() {
    log "Cleaning database users..."
    
    # Remove database users (if PostgreSQL is still running)
    sudo -u postgres dropuser $DB_USER 2>/dev/null || true
    sudo -u postgres dropdb $DB_NAME 2>/dev/null || true
    
    log "Database users cleaned"
}

# Function to update system
update_system() {
    log "Updating system packages..."
    
    # Update package lists
    apt-get update
    
    # Upgrade system packages
    apt-get upgrade -y
    
    # Install essential packages
    apt-get install -y curl wget git software-properties-common apt-transport-https ca-certificates gnupg lsb-release
    
    log "System updated"
}

# Function to install Node.js
install_nodejs() {
    log "Installing Node.js 18..."
    
    # Add NodeSource repository
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    
    # Install Node.js
    apt-get install -y nodejs
    
    # Verify installation
    node_version=$(node --version)
    npm_version=$(npm --version)
    
    log "Node.js installed: $node_version, npm: $npm_version"
    
    # Install global packages
    npm install -g pm2@latest
    
    log "PM2 installed globally"
}

# Function to install PostgreSQL
install_postgresql() {
    log "Installing PostgreSQL 15..."
    
    # Install PostgreSQL
    apt-get install -y postgresql postgresql-contrib
    
    # Start and enable PostgreSQL
    systemctl start postgresql
    systemctl enable postgresql
    
    # Wait for PostgreSQL to start
    sleep 5
    
    # Create database and user
    log "Creating database and user..."
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"
    sudo -u postgres psql -c "ALTER USER $DB_USER CREATEDB;"
    sudo -u postgres psql -c "ALTER USER $DB_USER SUPERUSER;"
    sudo -u postgres createdb -O $DB_USER $DB_NAME
    
    # Grant permissions
    sudo -u postgres psql -d $DB_NAME -c "GRANT ALL ON SCHEMA public TO $DB_USER;"
    sudo -u postgres psql -d $DB_NAME -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;"
    sudo -u postgres psql -d $DB_NAME -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;"
    
    log "PostgreSQL installed and configured"
}

# Function to install Nginx
install_nginx() {
    log "Installing Nginx..."
    
    # Install Nginx
    apt-get install -y nginx
    
    # Start and enable Nginx
    systemctl start nginx
    systemctl enable nginx
    
    # Remove default site
    rm -f /etc/nginx/sites-enabled/default
    
    log "Nginx installed"
}

# Function to install SSL certificates
install_ssl() {
    log "Installing SSL certificates..."
    
    # Install Certbot
    apt-get install -y certbot python3-certbot-nginx
    
    # Get SSL certificate
    certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN --redirect
    
    log "SSL certificates installed"
}

# Function to clone and setup SalesSync
setup_salessync() {
    log "Setting up SalesSync..."
    
    # Create application directory
    mkdir -p $APP_DIR
    cd $APP_DIR
    
    # Clone repository
    git clone https://github.com/Reshigan/SalesSyncAI.git .
    
    # Install backend dependencies
    cd backend
    npm install --include=dev
    
    # Generate Prisma client
    npx prisma generate
    
    # Run database migrations
    DATABASE_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME" npx prisma migrate deploy
    
    # Seed database
    DATABASE_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME" node seed-simple.js
    
    # Build application
    npx tsc --skipLibCheck
    
    log "SalesSync setup completed"
}

# Function to configure Nginx for SalesSync
configure_nginx() {
    log "Configuring Nginx for SalesSync..."
    
    cat > /etc/nginx/sites-available/salessync << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN www.$DOMAIN;
    
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript application/json;
    
    client_max_body_size 50M;
    
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
    
    location /health {
        proxy_pass http://localhost:3000/health;
        access_log off;
    }
}
EOF
    
    # Enable site
    ln -sf /etc/nginx/sites-available/salessync /etc/nginx/sites-enabled/salessync
    
    # Test configuration
    nginx -t
    
    # Reload Nginx
    systemctl reload nginx
    
    log "Nginx configured"
}

# Function to start SalesSync
start_salessync() {
    log "Starting SalesSync..."
    
    cd $APP_DIR/backend
    
    # Start with PM2
    pm2 start dist/index.js --name salessync-backend
    pm2 save
    pm2 startup
    
    log "SalesSync started"
}

# Function to verify installation
verify_installation() {
    log "Verifying installation..."
    
    # Check services
    if systemctl is-active --quiet nginx; then
        log "✅ Nginx is running"
    else
        error "❌ Nginx is not running"
    fi
    
    if systemctl is-active --quiet postgresql; then
        log "✅ PostgreSQL is running"
    else
        error "❌ PostgreSQL is not running"
    fi
    
    if pm2 list | grep -q salessync-backend; then
        log "✅ SalesSync backend is running"
    else
        error "❌ SalesSync backend is not running"
    fi
    
    # Test application
    sleep 5
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health | grep -q "200"; then
        log "✅ Application health check passed"
    else
        warning "⚠️  Application health check failed"
    fi
    
    # Test SSL
    if curl -s -I https://$DOMAIN | grep -q "200 OK"; then
        log "✅ SSL certificate is working"
    else
        warning "⚠️  SSL certificate test failed"
    fi
    
    log "Installation verification completed"
}

# Function to display final information
display_final_info() {
    echo -e "${GREEN}"
    echo "🎉 SalesSync Clean Installation Completed!"
    echo ""
    echo "📋 Installation Summary:"
    echo "  • Domain: https://$DOMAIN"
    echo "  • Application Directory: $APP_DIR"
    echo "  • Database: $DB_NAME"
    echo "  • Database User: $DB_USER"
    echo ""
    echo "🔐 Default Login:"
    echo "  • Email: admin@demo.com"
    echo "  • Password: admin123"
    echo ""
    echo "🔧 Management Commands:"
    echo "  • Check status: pm2 status"
    echo "  • View logs: pm2 logs salessync-backend"
    echo "  • Restart app: pm2 restart salessync-backend"
    echo "  • Restart nginx: systemctl restart nginx"
    echo ""
    echo "🌐 Your site is now available at: https://$DOMAIN"
    echo -e "${NC}"
}

# Main execution function
main() {
    log "Starting SalesSync Clean Server Installation..."
    
    # Check if running as root
    if [ "$EUID" -ne 0 ]; then
        error "This script must be run as root (use sudo)"
        exit 1
    fi
    
    # Confirm destructive action
    confirm_reset
    
    # Execute installation steps
    stop_all_services
    remove_installations
    remove_packages
    clean_configurations
    clean_users
    update_system
    install_nodejs
    install_postgresql
    install_nginx
    install_ssl
    setup_salessync
    configure_nginx
    start_salessync
    verify_installation
    display_final_info
    
    log "🚀 Clean installation completed successfully!"
}

# Run main function
main "$@"