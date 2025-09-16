#!/bin/bash

# 🧹 SalesSync Advanced Clean Server Installation Script
# This script provides options for different levels of server cleanup and fresh installation
# ⚠️  WARNING: This will remove existing installations and data based on selected options!

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
PURPLE='\033[0;35m'
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

header() {
    echo -e "${PURPLE}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

# Function to display menu
show_menu() {
    echo -e "${BLUE}"
    echo "🧹 SalesSync Server Cleanup & Installation Options"
    echo "=================================================="
    echo ""
    echo "Choose your cleanup level:"
    echo ""
    echo "1) 🔥 NUCLEAR RESET - Remove everything and start fresh"
    echo "   • Stops all services (PM2, Nginx, PostgreSQL, Docker)"
    echo "   • Removes ALL packages and configurations"
    echo "   • Deletes ALL data and databases"
    echo "   • Performs complete fresh installation"
    echo ""
    echo "2) 🧽 DEEP CLEAN - Remove SalesSync and conflicting services"
    echo "   • Stops SalesSync-related services"
    echo "   • Removes SalesSync installations and databases"
    echo "   • Keeps system packages but updates them"
    echo "   • Performs fresh SalesSync installation"
    echo ""
    echo "3) 🔄 SOFT RESET - Update and reinstall SalesSync only"
    echo "   • Stops SalesSync services"
    echo "   • Removes SalesSync application only"
    echo "   • Keeps databases and system packages"
    echo "   • Updates and reinstalls SalesSync"
    echo ""
    echo "4) 🐳 DOCKER CLEANUP - Clean Docker conflicts and install fresh"
    echo "   • Stops and removes all Docker containers/images"
    echo "   • Removes Docker completely"
    echo "   • Installs SalesSync with native services"
    echo ""
    echo "5) 🚪 EXIT - Cancel operation"
    echo -e "${NC}"
}

# Function to confirm action
confirm_action() {
    local action_type="$1"
    local confirmation_word="$2"
    
    echo -e "${RED}"
    case $action_type in
        "nuclear")
            echo "⚠️  NUCLEAR RESET SELECTED ⚠️"
            echo "This will PERMANENTLY DELETE:"
            echo "  • ALL applications and data"
            echo "  • ALL databases and users"
            echo "  • ALL configurations"
            echo "  • ALL Docker containers and images"
            ;;
        "deep")
            echo "⚠️  DEEP CLEAN SELECTED ⚠️"
            echo "This will DELETE:"
            echo "  • SalesSync applications and data"
            echo "  • SalesSync databases"
            echo "  • Related configurations"
            ;;
        "soft")
            echo "⚠️  SOFT RESET SELECTED ⚠️"
            echo "This will:"
            echo "  • Remove SalesSync application files"
            echo "  • Keep databases and configurations"
            echo "  • Reinstall fresh application"
            ;;
        "docker")
            echo "⚠️  DOCKER CLEANUP SELECTED ⚠️"
            echo "This will:"
            echo "  • Stop and remove ALL Docker containers"
            echo "  • Remove ALL Docker images"
            echo "  • Uninstall Docker completely"
            ;;
    esac
    echo -e "${NC}"
    
    read -p "Type '$confirmation_word' to confirm: " confirm
    if [ "$confirm" != "$confirmation_word" ]; then
        error "Operation cancelled by user"
        exit 1
    fi
}

# Function to clean Docker completely
clean_docker() {
    header "Cleaning Docker installation..."
    
    # Stop all containers
    if command -v docker &> /dev/null; then
        log "Stopping all Docker containers..."
        docker stop $(docker ps -aq) 2>/dev/null || true
        
        log "Removing all Docker containers..."
        docker rm $(docker ps -aq) 2>/dev/null || true
        
        log "Removing all Docker images..."
        docker rmi $(docker images -q) --force 2>/dev/null || true
        
        log "Removing all Docker volumes..."
        docker volume rm $(docker volume ls -q) 2>/dev/null || true
        
        log "Removing all Docker networks..."
        docker network rm $(docker network ls -q) 2>/dev/null || true
    fi
    
    # Stop Docker service
    systemctl stop docker 2>/dev/null || true
    systemctl disable docker 2>/dev/null || true
    
    # Remove Docker packages
    apt-get remove --purge -y docker* containerd* runc 2>/dev/null || true
    
    # Remove Docker directories
    rm -rf /var/lib/docker 2>/dev/null || true
    rm -rf /etc/docker 2>/dev/null || true
    rm -rf /var/run/docker* 2>/dev/null || true
    
    # Clean up any remaining processes
    pkill -f docker 2>/dev/null || true
    
    log "Docker completely removed"
}

# Function for nuclear reset
nuclear_reset() {
    header "Performing NUCLEAR RESET..."
    
    # Stop all services
    log "Stopping all services..."
    pm2 kill 2>/dev/null || true
    pkill -f pm2 2>/dev/null || true
    systemctl stop nginx 2>/dev/null || true
    systemctl stop postgresql 2>/dev/null || true
    clean_docker
    pkill -f node 2>/dev/null || true
    
    # Remove all installations
    log "Removing all installations..."
    rm -rf /opt/* 2>/dev/null || true
    rm -rf /var/www/* 2>/dev/null || true
    rm -rf /home/*/.pm2 2>/dev/null || true
    rm -rf /root/.pm2 2>/dev/null || true
    
    # Remove packages
    log "Removing packages..."
    apt-get remove --purge -y nodejs npm node postgresql* nginx* certbot python3-certbot-nginx 2>/dev/null || true
    
    # Clean configurations
    log "Cleaning configurations..."
    rm -rf /etc/nginx 2>/dev/null || true
    rm -rf /etc/postgresql 2>/dev/null || true
    rm -rf /var/lib/postgresql 2>/dev/null || true
    rm -rf /etc/letsencrypt 2>/dev/null || true
    
    # Clean and update system
    apt-get autoremove -y
    apt-get autoclean
    apt-get update
    apt-get upgrade -y
    
    log "Nuclear reset completed"
}

# Function for deep clean
deep_clean() {
    header "Performing DEEP CLEAN..."
    
    # Stop SalesSync services
    log "Stopping SalesSync services..."
    pm2 delete salessync-backend 2>/dev/null || true
    pm2 kill 2>/dev/null || true
    
    # Remove SalesSync installations
    log "Removing SalesSync installations..."
    rm -rf /opt/salessync* 2>/dev/null || true
    rm -rf /var/www/salessync* 2>/dev/null || true
    
    # Remove SalesSync database
    log "Removing SalesSync database..."
    sudo -u postgres dropdb $DB_NAME 2>/dev/null || true
    sudo -u postgres dropuser $DB_USER 2>/dev/null || true
    
    # Update system
    apt-get update
    apt-get upgrade -y
    
    log "Deep clean completed"
}

# Function for soft reset
soft_reset() {
    header "Performing SOFT RESET..."
    
    # Stop SalesSync application
    log "Stopping SalesSync application..."
    pm2 delete salessync-backend 2>/dev/null || true
    
    # Remove application files only
    log "Removing application files..."
    rm -rf $APP_DIR 2>/dev/null || true
    
    log "Soft reset completed"
}

# Function to install dependencies
install_dependencies() {
    header "Installing dependencies..."
    
    # Install essential packages
    apt-get install -y curl wget git software-properties-common apt-transport-https ca-certificates gnupg lsb-release
    
    # Install Node.js 18
    if ! command -v node &> /dev/null; then
        log "Installing Node.js 18..."
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt-get install -y nodejs
    fi
    
    # Install PM2
    if ! command -v pm2 &> /dev/null; then
        log "Installing PM2..."
        npm install -g pm2@latest
    fi
    
    # Install PostgreSQL
    if ! command -v psql &> /dev/null; then
        log "Installing PostgreSQL..."
        apt-get install -y postgresql postgresql-contrib
        systemctl start postgresql
        systemctl enable postgresql
    fi
    
    # Install Nginx
    if ! command -v nginx &> /dev/null; then
        log "Installing Nginx..."
        apt-get install -y nginx
        systemctl start nginx
        systemctl enable nginx
    fi
    
    # Install Certbot
    if ! command -v certbot &> /dev/null; then
        log "Installing Certbot..."
        apt-get install -y certbot python3-certbot-nginx
    fi
    
    log "Dependencies installed"
}

# Function to setup database
setup_database() {
    header "Setting up database..."
    
    # Create database user and database
    sudo -u postgres psql -c "DROP USER IF EXISTS $DB_USER;" 2>/dev/null || true
    sudo -u postgres psql -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null || true
    
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"
    sudo -u postgres psql -c "ALTER USER $DB_USER CREATEDB;"
    sudo -u postgres psql -c "ALTER USER $DB_USER SUPERUSER;"
    sudo -u postgres createdb -O $DB_USER $DB_NAME
    
    # Grant permissions
    sudo -u postgres psql -d $DB_NAME -c "GRANT ALL ON SCHEMA public TO $DB_USER;"
    sudo -u postgres psql -d $DB_NAME -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;"
    sudo -u postgres psql -d $DB_NAME -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;"
    
    log "Database setup completed"
}

# Function to install SalesSync
install_salessync() {
    header "Installing SalesSync..."
    
    # Create application directory
    mkdir -p $APP_DIR
    cd $APP_DIR
    
    # Clone repository
    log "Cloning SalesSync repository..."
    git clone https://github.com/Reshigan/SalesSyncAI.git .
    
    # Install backend dependencies
    log "Installing backend dependencies..."
    cd backend
    npm install --include=dev
    
    # Generate Prisma client
    log "Generating Prisma client..."
    npx prisma generate
    
    # Run database migrations
    log "Running database migrations..."
    DATABASE_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME" npx prisma migrate deploy
    
    # Seed database
    log "Seeding database..."
    DATABASE_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME" node seed-simple.js
    
    # Build application
    log "Building application..."
    npx tsc --skipLibCheck
    
    log "SalesSync installation completed"
}

# Function to configure services
configure_services() {
    header "Configuring services..."
    
    # Configure Nginx
    log "Configuring Nginx..."
    cat > /etc/nginx/sites-available/salessync << EOF
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
    
    # Enable site
    ln -sf /etc/nginx/sites-available/salessync /etc/nginx/sites-enabled/salessync
    rm -f /etc/nginx/sites-enabled/default
    
    # Test and reload Nginx
    nginx -t && systemctl reload nginx
    
    # Start SalesSync with PM2
    log "Starting SalesSync with PM2..."
    cd $APP_DIR/backend
    pm2 start dist/index.js --name salessync-backend
    pm2 save
    pm2 startup
    
    log "Services configured and started"
}

# Function to setup SSL (optional)
setup_ssl() {
    header "Setting up SSL certificate..."
    
    read -p "Do you want to setup SSL certificate for $DOMAIN? (y/n): " setup_ssl_choice
    if [[ $setup_ssl_choice =~ ^[Yy]$ ]]; then
        log "Setting up SSL certificate..."
        certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN --redirect || {
            warning "SSL setup failed, continuing without SSL"
        }
    else
        log "Skipping SSL setup"
    fi
}

# Function to verify installation
verify_installation() {
    header "Verifying installation..."
    
    sleep 5
    
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
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health | grep -q "200"; then
        log "✅ Application health check passed"
    else
        warning "⚠️  Application health check failed"
    fi
    
    log "Installation verification completed"
}

# Function to display final information
display_final_info() {
    echo -e "${GREEN}"
    echo "🎉 SalesSync Installation Completed!"
    echo ""
    echo "📋 Installation Summary:"
    echo "  • Domain: http://$DOMAIN (or https:// if SSL was setup)"
    echo "  • Application Directory: $APP_DIR"
    echo "  • Database: $DB_NAME"
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
    echo -e "${NC}"
}

# Main execution function
main() {
    log "Starting SalesSync Advanced Clean Installation..."
    
    # Check if running as root
    if [ "$EUID" -ne 0 ]; then
        error "This script must be run as root (use sudo)"
        exit 1
    fi
    
    # Show menu and get user choice
    show_menu
    read -p "Enter your choice (1-5): " choice
    
    case $choice in
        1)
            confirm_action "nuclear" "NUCLEAR"
            nuclear_reset
            install_dependencies
            setup_database
            install_salessync
            configure_services
            setup_ssl
            ;;
        2)
            confirm_action "deep" "DEEP"
            deep_clean
            install_dependencies
            setup_database
            install_salessync
            configure_services
            setup_ssl
            ;;
        3)
            confirm_action "soft" "SOFT"
            soft_reset
            install_salessync
            configure_services
            ;;
        4)
            confirm_action "docker" "DOCKER"
            clean_docker
            install_dependencies
            setup_database
            install_salessync
            configure_services
            setup_ssl
            ;;
        5)
            log "Operation cancelled by user"
            exit 0
            ;;
        *)
            error "Invalid choice. Exiting."
            exit 1
            ;;
    esac
    
    verify_installation
    display_final_info
    
    log "🚀 Installation completed successfully!"
}

# Run main function
main "$@"