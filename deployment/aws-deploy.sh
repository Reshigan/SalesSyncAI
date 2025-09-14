#!/bin/bash

# SalesSync AWS Production Deployment Script
# Target: Ubuntu 22.04 on AWS t4g.medium
# Domain: SSAI.gonxt.tech
# Server: 13.247.192.46

set -euo pipefail

# Configuration
DOMAIN="SSAI.gonxt.tech"
SERVER_IP="13.247.192.46"
APP_DIR="/opt/salessync"
NGINX_DIR="/etc/nginx"
SSL_DIR="/etc/letsencrypt"
LOG_FILE="/var/log/salessync-deploy.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Error handling
error_exit() {
    log_error "$1"
    exit 1
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error_exit "This script must be run as root (use sudo)"
    fi
}

# Update system packages
update_system() {
    log_info "Updating system packages..."
    apt-get update -y
    apt-get upgrade -y
    apt-get install -y curl wget git unzip software-properties-common
    log_success "System updated successfully"
}

# Install Node.js 18
install_nodejs() {
    log_info "Installing Node.js 18..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
    
    # Verify installation
    node_version=$(node --version)
    npm_version=$(npm --version)
    log_success "Node.js installed: $node_version, npm: $npm_version"
}

# Install PostgreSQL 15
install_postgresql() {
    log_info "Installing PostgreSQL 15..."
    
    # Add PostgreSQL official repository
    wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
    echo "deb http://apt.postgresql.org/pub/repos/apt/ $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list
    apt-get update -y
    apt-get install -y postgresql-15 postgresql-client-15 postgresql-contrib-15
    
    # Start and enable PostgreSQL
    systemctl start postgresql
    systemctl enable postgresql
    
    # Create database and user
    sudo -u postgres psql -c "CREATE DATABASE salessync_production;"
    sudo -u postgres psql -c "CREATE USER salessync_user WITH ENCRYPTED PASSWORD 'SalesSync2024!Prod';"
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE salessync_production TO salessync_user;"
    sudo -u postgres psql -c "ALTER USER salessync_user CREATEDB;"
    
    log_success "PostgreSQL 15 installed and configured"
}

# Install Redis 7
install_redis() {
    log_info "Installing Redis 7..."
    
    # Add Redis repository
    curl -fsSL https://packages.redis.io/gpg | gpg --dearmor -o /usr/share/keyrings/redis-archive-keyring.gpg
    echo "deb [signed-by=/usr/share/keyrings/redis-archive-keyring.gpg] https://packages.redis.io/deb $(lsb_release -cs) main" | tee /etc/apt/sources.list.d/redis.list
    apt-get update -y
    apt-get install -y redis
    
    # Configure Redis
    sed -i 's/# requirepass foobared/requirepass SalesSync2024!Redis/' /etc/redis/redis.conf
    sed -i 's/bind 127.0.0.1 ::1/bind 127.0.0.1/' /etc/redis/redis.conf
    
    # Start and enable Redis
    systemctl start redis-server
    systemctl enable redis-server
    
    log_success "Redis 7 installed and configured"
}

# Install Nginx
install_nginx() {
    log_info "Installing Nginx..."
    apt-get install -y nginx
    
    # Start and enable Nginx
    systemctl start nginx
    systemctl enable nginx
    
    # Remove default site
    rm -f /etc/nginx/sites-enabled/default
    
    log_success "Nginx installed"
}

# Install Certbot for SSL
install_certbot() {
    log_info "Installing Certbot for SSL certificates..."
    apt-get install -y certbot python3-certbot-nginx
    log_success "Certbot installed"
}

# Install PM2 for process management
install_pm2() {
    log_info "Installing PM2..."
    npm install -g pm2
    pm2 startup systemd -u root --hp /root
    log_success "PM2 installed"
}

# Install Docker and Docker Compose
install_docker() {
    log_info "Installing Docker and Docker Compose..."
    
    # Install Docker
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    
    # Install Docker Compose
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    
    # Start and enable Docker
    systemctl start docker
    systemctl enable docker
    
    log_success "Docker and Docker Compose installed"
}

# Create application directory structure
create_app_structure() {
    log_info "Creating application directory structure..."
    
    mkdir -p "$APP_DIR"
    mkdir -p "$APP_DIR/backend"
    mkdir -p "$APP_DIR/frontend"
    mkdir -p "$APP_DIR/logs"
    mkdir -p "$APP_DIR/uploads"
    mkdir -p "$APP_DIR/backups"
    mkdir -p "$APP_DIR/ssl"
    
    # Set permissions
    chown -R www-data:www-data "$APP_DIR"
    chmod -R 755 "$APP_DIR"
    
    log_success "Application directory structure created"
}

# Clone and setup application
setup_application() {
    log_info "Cloning and setting up SalesSync application..."
    
    cd "$APP_DIR"
    
    # Clone the repository
    git clone https://github.com/Reshigan/SalesSyncAI.git temp_repo
    
    # Move files to correct locations
    mv temp_repo/backend/* backend/
    mv temp_repo/frontend-web/* frontend/
    mv temp_repo/deployment/* ./
    
    # Cleanup
    rm -rf temp_repo
    
    log_success "Application cloned and setup"
}

# Setup backend environment
setup_backend() {
    log_info "Setting up backend environment..."
    
    cd "$APP_DIR/backend"
    
    # Install dependencies
    npm ci --production
    
    # Create production environment file
    cat > .env.production << EOF
# Production Environment Configuration
NODE_ENV=production
PORT=3000

# Database Configuration
DATABASE_URL=postgresql://salessync_user:SalesSync2024!Prod@localhost:5432/salessync_production

# Redis Configuration
REDIS_URL=redis://:SalesSync2024!Redis@localhost:6379

# JWT Configuration
JWT_SECRET=$(openssl rand -base64 32)
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Domain Configuration
DOMAIN=$DOMAIN
FRONTEND_URL=https://$DOMAIN
API_URL=https://$DOMAIN/api

# Email Configuration (Update with your SMTP settings)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@gonxt.tech
SMTP_PASS=your_smtp_password_here
FROM_EMAIL=noreply@$DOMAIN
FROM_NAME=SalesSync

# File Upload Configuration
UPLOAD_DEST=$APP_DIR/uploads
MAX_FILE_SIZE=50mb

# Security Configuration
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000

# Logging Configuration
LOG_LEVEL=info
LOG_DIR=$APP_DIR/logs

# Backup Configuration
BACKUP_PATH=$APP_DIR/backups
BACKUP_ENCRYPTION=true
BACKUP_ENCRYPTION_KEY=$(openssl rand -base64 32)
EOF

    # Run database migrations
    npx prisma generate
    npx prisma db push
    npx prisma db seed
    
    # Build the application
    npm run build
    
    log_success "Backend setup completed"
}

# Setup frontend
setup_frontend() {
    log_info "Setting up frontend..."
    
    cd "$APP_DIR/frontend"
    
    # Install dependencies
    npm ci
    
    # Create production environment file
    cat > .env.production << EOF
REACT_APP_API_URL=https://$DOMAIN/api
REACT_APP_WS_URL=wss://$DOMAIN
REACT_APP_DOMAIN=$DOMAIN
GENERATE_SOURCEMAP=false
EOF

    # Build the application
    npm run build
    
    # Move build files to nginx directory
    rm -rf /var/www/html/*
    cp -r build/* /var/www/html/
    
    # Set permissions
    chown -R www-data:www-data /var/www/html
    chmod -R 755 /var/www/html
    
    log_success "Frontend setup completed"
}

# Configure Nginx
configure_nginx() {
    log_info "Configuring Nginx..."
    
    # Create Nginx configuration
    cat > "$NGINX_DIR/sites-available/salessync" << 'EOF'
# SalesSync Production Nginx Configuration

# Rate limiting
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=login:10m rate=1r/s;
limit_conn_zone $binary_remote_addr zone=conn_limit_per_ip:10m;

# Upstream backend servers
upstream backend {
    server 127.0.0.1:3000;
    keepalive 32;
}

# HTTP to HTTPS redirect
server {
    listen 80;
    server_name SSAI.gonxt.tech www.SSAI.gonxt.tech;
    
    # Let's Encrypt challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    # Redirect all other traffic to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

# Main HTTPS server
server {
    listen 443 ssl http2;
    server_name SSAI.gonxt.tech www.SSAI.gonxt.tech;
    
    # SSL certificates (will be configured after Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/SSAI.gonxt.tech/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/SSAI.gonxt.tech/privkey.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Rate limiting
    limit_req zone=api burst=20 nodelay;
    limit_conn conn_limit_per_ip 20;
    
    # Root directory
    root /var/www/html;
    index index.html;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/atom+xml image/svg+xml;
    
    # API routes
    location /api/ {
        limit_req zone=api burst=50 nodelay;
        
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 5s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Authentication routes with stricter rate limiting
    location /api/auth/ {
        limit_req zone=login burst=5 nodelay;
        
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # WebSocket support
    location /socket.io/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket specific timeouts
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
    
    # Health check
    location /health {
        access_log off;
        proxy_pass http://backend;
        proxy_set_header Host $host;
    }
    
    # Static files with caching
    location /static/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri $uri/ =404;
    }
    
    # File uploads
    location /uploads/ {
        alias /opt/salessync/uploads/;
        expires 1d;
        add_header Cache-Control "public";
    }
    
    # Frontend routes (React Router)
    location / {
        try_files $uri $uri/ /index.html;
        expires 1h;
        add_header Cache-Control "public, must-revalidate";
    }
    
    # Error pages
    error_page 404 /404.html;
    error_page 500 502 503 504 /50x.html;
}
EOF

    # Enable the site
    ln -sf "$NGINX_DIR/sites-available/salessync" "$NGINX_DIR/sites-enabled/"
    
    # Test Nginx configuration
    nginx -t
    
    log_success "Nginx configured"
}

# Setup SSL certificates
setup_ssl() {
    log_info "Setting up SSL certificates..."
    
    # Create webroot directory for Let's Encrypt
    mkdir -p /var/www/certbot
    
    # Temporarily start Nginx without SSL for certificate generation
    cat > "$NGINX_DIR/sites-available/salessync-temp" << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        root /var/www/html;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

    # Enable temporary configuration
    rm -f "$NGINX_DIR/sites-enabled/salessync"
    ln -sf "$NGINX_DIR/sites-available/salessync-temp" "$NGINX_DIR/sites-enabled/"
    systemctl reload nginx
    
    # Generate SSL certificate
    certbot certonly --webroot --webroot-path=/var/www/certbot --email admin@gonxt.tech --agree-tos --no-eff-email -d "$DOMAIN" -d "www.$DOMAIN"
    
    # Switch back to SSL configuration
    rm -f "$NGINX_DIR/sites-enabled/salessync-temp"
    ln -sf "$NGINX_DIR/sites-available/salessync" "$NGINX_DIR/sites-enabled/"
    
    # Test and reload Nginx
    nginx -t
    systemctl reload nginx
    
    # Setup automatic certificate renewal
    echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -
    
    log_success "SSL certificates configured"
}

# Setup PM2 processes
setup_pm2() {
    log_info "Setting up PM2 processes..."
    
    cd "$APP_DIR/backend"
    
    # Create PM2 ecosystem file
    cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'salessync-backend',
    script: 'dist/index.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_file: '.env.production',
    log_file: '$APP_DIR/logs/backend.log',
    error_file: '$APP_DIR/logs/backend-error.log',
    out_file: '$APP_DIR/logs/backend-out.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024',
    watch: false,
    ignore_watch: ['node_modules', 'logs', 'uploads'],
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
EOF

    # Start the application
    pm2 start ecosystem.config.js
    pm2 save
    
    log_success "PM2 processes configured and started"
}

# Setup monitoring
setup_monitoring() {
    log_info "Setting up monitoring..."
    
    # Install monitoring tools
    npm install -g pm2-logrotate
    pm2 install pm2-logrotate
    
    # Configure log rotation
    pm2 set pm2-logrotate:max_size 10M
    pm2 set pm2-logrotate:retain 30
    pm2 set pm2-logrotate:compress true
    
    # Setup system monitoring script
    cat > /usr/local/bin/salessync-monitor.sh << 'EOF'
#!/bin/bash
# SalesSync System Monitoring Script

LOG_FILE="/var/log/salessync-monitor.log"
ALERT_EMAIL="admin@gonxt.tech"

# Check if backend is running
if ! pm2 list | grep -q "salessync-backend.*online"; then
    echo "$(date): Backend is down, restarting..." >> "$LOG_FILE"
    pm2 restart salessync-backend
fi

# Check if Nginx is running
if ! systemctl is-active --quiet nginx; then
    echo "$(date): Nginx is down, restarting..." >> "$LOG_FILE"
    systemctl restart nginx
fi

# Check if PostgreSQL is running
if ! systemctl is-active --quiet postgresql; then
    echo "$(date): PostgreSQL is down, restarting..." >> "$LOG_FILE"
    systemctl restart postgresql
fi

# Check if Redis is running
if ! systemctl is-active --quiet redis-server; then
    echo "$(date): Redis is down, restarting..." >> "$LOG_FILE"
    systemctl restart redis-server
fi

# Check disk space
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 80 ]; then
    echo "$(date): Disk usage is ${DISK_USAGE}%" >> "$LOG_FILE"
fi

# Check memory usage
MEMORY_USAGE=$(free | awk 'NR==2{printf "%.2f", $3*100/$2}')
if (( $(echo "$MEMORY_USAGE > 80" | bc -l) )); then
    echo "$(date): Memory usage is ${MEMORY_USAGE}%" >> "$LOG_FILE"
fi
EOF

    chmod +x /usr/local/bin/salessync-monitor.sh
    
    # Add to crontab
    echo "*/5 * * * * /usr/local/bin/salessync-monitor.sh" | crontab -
    
    log_success "Monitoring setup completed"
}

# Setup firewall
setup_firewall() {
    log_info "Setting up firewall..."
    
    # Install and configure UFW
    apt-get install -y ufw
    
    # Default policies
    ufw default deny incoming
    ufw default allow outgoing
    
    # Allow SSH
    ufw allow ssh
    
    # Allow HTTP and HTTPS
    ufw allow 80/tcp
    ufw allow 443/tcp
    
    # Allow PostgreSQL (local only)
    ufw allow from 127.0.0.1 to any port 5432
    
    # Allow Redis (local only)
    ufw allow from 127.0.0.1 to any port 6379
    
    # Enable firewall
    ufw --force enable
    
    log_success "Firewall configured"
}

# Create backup script
create_backup_script() {
    log_info "Creating backup script..."
    
    cat > /usr/local/bin/salessync-backup.sh << EOF
#!/bin/bash
# SalesSync Backup Script

BACKUP_DIR="$APP_DIR/backups"
DATE=\$(date +%Y%m%d_%H%M%S)
DB_BACKUP="\$BACKUP_DIR/database_\$DATE.sql"
FILES_BACKUP="\$BACKUP_DIR/files_\$DATE.tar.gz"

# Create backup directory
mkdir -p "\$BACKUP_DIR"

# Backup database
sudo -u postgres pg_dump salessync_production > "\$DB_BACKUP"
gzip "\$DB_BACKUP"

# Backup files
tar -czf "\$FILES_BACKUP" -C "$APP_DIR" uploads logs

# Remove backups older than 7 days
find "\$BACKUP_DIR" -name "*.gz" -mtime +7 -delete

echo "\$(date): Backup completed - \$DB_BACKUP.gz, \$FILES_BACKUP"
EOF

    chmod +x /usr/local/bin/salessync-backup.sh
    
    # Add to crontab (daily at 2 AM)
    echo "0 2 * * * /usr/local/bin/salessync-backup.sh" | crontab -
    
    log_success "Backup script created"
}

# Verify deployment
verify_deployment() {
    log_info "Verifying deployment..."
    
    # Check services
    services=("nginx" "postgresql" "redis-server")
    for service in "${services[@]}"; do
        if systemctl is-active --quiet "$service"; then
            log_success "$service is running"
        else
            log_error "$service is not running"
        fi
    done
    
    # Check PM2 processes
    if pm2 list | grep -q "salessync-backend.*online"; then
        log_success "Backend application is running"
    else
        log_error "Backend application is not running"
    fi
    
    # Check SSL certificate
    if [[ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]]; then
        log_success "SSL certificate is installed"
    else
        log_error "SSL certificate is not installed"
    fi
    
    # Test HTTP response
    if curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN/health" | grep -q "200"; then
        log_success "Application is responding correctly"
    else
        log_warning "Application health check failed"
    fi
    
    log_success "Deployment verification completed"
}

# Main deployment function
main() {
    log_info "Starting SalesSync AWS deployment..."
    
    # Record deployment start time
    deployment_start=$(date +%s)
    
    # Run deployment steps
    check_root
    update_system
    install_nodejs
    install_postgresql
    install_redis
    install_nginx
    install_certbot
    install_pm2
    install_docker
    create_app_structure
    setup_application
    setup_backend
    setup_frontend
    configure_nginx
    setup_ssl
    setup_pm2
    setup_monitoring
    setup_firewall
    create_backup_script
    verify_deployment
    
    # Calculate deployment time
    deployment_end=$(date +%s)
    deployment_time=$((deployment_end - deployment_start))
    
    log_success "Deployment completed successfully in ${deployment_time}s"
    
    # Display access information
    echo ""
    log_info "🎉 SalesSync is now live!"
    echo "  - Application URL: https://$DOMAIN"
    echo "  - API Health Check: https://$DOMAIN/health"
    echo "  - API Documentation: https://$DOMAIN/api/docs"
    echo ""
    log_info "Default Login Credentials:"
    echo "  - Super Admin: superadmin@salessync.com / SuperAdmin123!"
    echo "  - Company Admin: admin@testcompany.com / Admin123!"
    echo ""
    log_info "Server Management:"
    echo "  - View backend logs: pm2 logs salessync-backend"
    echo "  - Restart backend: pm2 restart salessync-backend"
    echo "  - View system status: pm2 status"
    echo "  - Nginx status: systemctl status nginx"
    echo ""
    log_info "Monitoring:"
    echo "  - System monitor: /usr/local/bin/salessync-monitor.sh"
    echo "  - Backup script: /usr/local/bin/salessync-backup.sh"
    echo "  - Log files: $APP_DIR/logs/"
    echo ""
}

# Handle script arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "verify")
        verify_deployment
        ;;
    "backup")
        /usr/local/bin/salessync-backup.sh
        ;;
    "monitor")
        /usr/local/bin/salessync-monitor.sh
        ;;
    *)
        echo "Usage: $0 {deploy|verify|backup|monitor}"
        exit 1
        ;;
esac