#!/bin/bash

# SalesSync AI Production Deployment Script
# For AWS t4g.medium Ubuntu server with domain ssai.gonxt.tech

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
PROJECT_DIR="/opt/salessync"
BACKUP_DIR="/opt/salessync-backups"

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

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        log_error "This script should not be run as root for security reasons"
        log_info "Please run as a regular user with sudo privileges"
        exit 1
    fi
}

# Install Docker and Docker Compose
install_docker() {
    log_info "Installing Docker and Docker Compose..."
    
    # Update package index
    sudo apt-get update
    
    # Install prerequisites
    sudo apt-get install -y \
        apt-transport-https \
        ca-certificates \
        curl \
        gnupg \
        lsb-release
    
    # Add Docker's official GPG key
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    
    # Set up the stable repository
    echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
        $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Install Docker Engine
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    
    # Add current user to docker group
    sudo usermod -aG docker $USER
    
    # Install Docker Compose (standalone)
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    
    log_success "Docker and Docker Compose installed successfully"
}

# Setup firewall
setup_firewall() {
    log_info "Setting up UFW firewall..."
    
    sudo ufw --force reset
    sudo ufw default deny incoming
    sudo ufw default allow outgoing
    
    # Allow SSH
    sudo ufw allow ssh
    
    # Allow HTTP and HTTPS
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    
    # Enable firewall
    sudo ufw --force enable
    
    log_success "Firewall configured successfully"
}

# Create project directory and set permissions
setup_directories() {
    log_info "Setting up project directories..."
    
    sudo mkdir -p $PROJECT_DIR
    sudo mkdir -p $BACKUP_DIR
    sudo mkdir -p /var/log/salessync
    
    # Set ownership
    sudo chown -R $USER:$USER $PROJECT_DIR
    sudo chown -R $USER:$USER $BACKUP_DIR
    sudo chown -R $USER:$USER /var/log/salessync
    
    log_success "Directories created successfully"
}

# Clone or update repository
setup_repository() {
    log_info "Setting up repository..."
    
    if [ -d "$PROJECT_DIR/.git" ]; then
        log_info "Repository exists, pulling latest changes..."
        cd $PROJECT_DIR
        git pull origin main
    else
        log_info "Cloning repository..."
        git clone https://github.com/Reshigan/SalesSyncAI.git $PROJECT_DIR
        cd $PROJECT_DIR
    fi
    
    log_success "Repository setup completed"
}

# Setup environment file
setup_environment() {
    log_info "Setting up environment configuration..."
    
    if [ ! -f "$PROJECT_DIR/.env" ]; then
        cp $PROJECT_DIR/.env.production $PROJECT_DIR/.env
        log_warning "Environment file created from template"
        log_warning "Please edit $PROJECT_DIR/.env with your actual configuration values"
        log_warning "Pay special attention to:"
        log_warning "  - Database passwords"
        log_warning "  - JWT secrets"
        log_warning "  - AWS credentials"
        log_warning "  - SMTP configuration"
    else
        log_info "Environment file already exists"
    fi
}

# Generate SSL certificates
setup_ssl() {
    log_info "Setting up SSL certificates..."
    
    cd $PROJECT_DIR
    
    # Create webroot directory for Let's Encrypt
    mkdir -p nginx/webroot
    
    # Start nginx temporarily for certificate generation
    docker-compose up -d nginx
    sleep 10
    
    # Generate SSL certificate
    docker-compose run --rm certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email $EMAIL \
        --agree-tos \
        --no-eff-email \
        -d $DOMAIN
    
    # Stop temporary nginx
    docker-compose down
    
    log_success "SSL certificates generated successfully"
}

# Deploy application
deploy_application() {
    log_info "Deploying SalesSync AI application..."
    
    cd $PROJECT_DIR
    
    # Build and start services
    docker-compose build --no-cache
    docker-compose up -d
    
    # Wait for services to be ready
    log_info "Waiting for services to start..."
    sleep 30
    
    # Run database migrations
    log_info "Running database migrations..."
    docker-compose exec backend npx prisma migrate deploy
    
    # Generate Prisma client
    docker-compose exec backend npx prisma generate
    
    log_success "Application deployed successfully"
}

# Setup monitoring
setup_monitoring() {
    log_info "Setting up monitoring and logging..."
    
    # Create log rotation configuration
    sudo tee /etc/logrotate.d/salessync > /dev/null <<EOF
/var/log/salessync/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 $USER $USER
    postrotate
        docker-compose -f $PROJECT_DIR/docker-compose.yml restart nginx
    endscript
}
EOF
    
    # Setup health check script
    tee $PROJECT_DIR/scripts/health-check.sh > /dev/null <<'EOF'
#!/bin/bash
curl -f http://localhost/health > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "$(date): Health check passed"
else
    echo "$(date): Health check failed"
    # Restart services if health check fails
    cd /opt/salessync
    docker-compose restart
fi
EOF
    
    chmod +x $PROJECT_DIR/scripts/health-check.sh
    
    # Add health check to crontab
    (crontab -l 2>/dev/null; echo "*/5 * * * * $PROJECT_DIR/scripts/health-check.sh >> /var/log/salessync/health.log 2>&1") | crontab -
    
    log_success "Monitoring setup completed"
}

# Setup backup
setup_backup() {
    log_info "Setting up backup system..."
    
    # Create backup script
    tee $PROJECT_DIR/scripts/backup.sh > /dev/null <<'EOF'
#!/bin/bash
BACKUP_DIR="/opt/salessync-backups"
DATE=$(date +%Y%m%d_%H%M%S)
PROJECT_DIR="/opt/salessync"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
docker-compose -f $PROJECT_DIR/docker-compose.yml exec -T postgres pg_dump -U salessync salessync > $BACKUP_DIR/database_$DATE.sql

# Backup uploaded files
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz -C $PROJECT_DIR/backend uploads/

# Remove backups older than 30 days
find $BACKUP_DIR -name "*.sql" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete

echo "$(date): Backup completed - database_$DATE.sql, uploads_$DATE.tar.gz"
EOF
    
    chmod +x $PROJECT_DIR/scripts/backup.sh
    
    # Add backup to crontab (daily at 2 AM)
    (crontab -l 2>/dev/null; echo "0 2 * * * $PROJECT_DIR/scripts/backup.sh >> /var/log/salessync/backup.log 2>&1") | crontab -
    
    log_success "Backup system setup completed"
}

# Main deployment function
main() {
    log_info "Starting SalesSync AI deployment on AWS t4g.medium Ubuntu server"
    log_info "Domain: $DOMAIN"
    log_info "Email: $EMAIL"
    
    check_root
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        install_docker
        log_warning "Docker installed. Please log out and log back in, then run this script again."
        exit 0
    fi
    
    setup_firewall
    setup_directories
    setup_repository
    setup_environment
    
    # Check if SSL certificates exist
    if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
        setup_ssl
    else
        log_info "SSL certificates already exist"
    fi
    
    deploy_application
    setup_monitoring
    setup_backup
    
    log_success "SalesSync AI deployment completed successfully!"
    log_info "Application is available at: https://$DOMAIN"
    log_info "Please check the logs: docker-compose logs -f"
    log_info "To update the application, run: ./scripts/update.sh"
}

# Run main function
main "$@"