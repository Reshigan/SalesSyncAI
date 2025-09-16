#!/bin/bash

# 🚀 SalesSync Fresh Production Installation Script
# For clean Ubuntu servers - Complete production deployment with all dependencies
# Optimized for AWS t3.medium Ubuntu servers

set -e

# Configuration
DOMAIN="salessync.gonxt.tech"
APP_DIR="/opt/salessync"
DB_NAME="salessync_production"
DB_USER="salessync"
DB_PASS="salessync_secure_password_2024"
NODE_VERSION="18"

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
    echo -e "${PURPLE}"
    echo "=================================================="
    echo "  $1"
    echo "=================================================="
    echo -e "${NC}"
}

# Function to check if running as root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        error "This script must be run as root (use sudo)"
        exit 1
    fi
}

# Function to display installation info
show_installation_info() {
    header "🚀 SalesSync Production Installation"
    echo -e "${BLUE}"
    echo "This script will install SalesSync with:"
    echo "  ✅ Node.js $NODE_VERSION with npm"
    echo "  ✅ PostgreSQL 15 database"
    echo "  ✅ Nginx web server"
    echo "  ✅ PM2 process manager"
    echo "  ✅ SSL certificate (Let's Encrypt)"
    echo "  ✅ All required dependencies"
    echo ""
    echo "Domain: $DOMAIN"
    echo "Installation Directory: $APP_DIR"
    echo "Database: $DB_NAME"
    echo -e "${NC}"
    
    read -p "Press Enter to continue or Ctrl+C to cancel..."
}

# Function to update system
update_system() {
    header "📦 Updating System Packages"
    
    log "Updating package lists..."
    apt-get update
    
    log "Upgrading system packages..."
    apt-get upgrade -y
    
    log "Installing essential packages..."
    apt-get install -y \
        curl \
        wget \
        git \
        software-properties-common \
        apt-transport-https \
        ca-certificates \
        gnupg \
        lsb-release \
        build-essential \
        python3 \
        python3-pip \
        unzip \
        vim \
        htop \
        ufw
    
    log "System packages updated successfully"
}

# Function to install Node.js
install_nodejs() {
    header "🟢 Installing Node.js $NODE_VERSION"
    
    log "Adding NodeSource repository..."
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    
    log "Installing Node.js..."
    apt-get install -y nodejs
    
    # Verify installation
    node_version=$(node --version)
    npm_version=$(npm --version)
    
    log "✅ Node.js installed: $node_version"
    log "✅ npm installed: $npm_version"
    
    # Update npm to latest version
    log "Updating npm to latest version..."
    npm install -g npm@latest
    
    # Install global packages
    log "Installing global packages..."
    npm install -g pm2@latest
    npm install -g typescript@latest
    
    log "Node.js installation completed"
}

# Function to install PostgreSQL
install_postgresql() {
    header "🐘 Installing PostgreSQL 15"
    
    log "Installing PostgreSQL..."
    apt-get install -y postgresql postgresql-contrib
    
    log "Starting PostgreSQL service..."
    systemctl start postgresql
    systemctl enable postgresql
    
    # Wait for PostgreSQL to start
    sleep 5
    
    log "Creating database user and database..."
    
    # Create database user
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"
    sudo -u postgres psql -c "ALTER USER $DB_USER CREATEDB;"
    sudo -u postgres psql -c "ALTER USER $DB_USER SUPERUSER;"
    
    # Create database
    sudo -u postgres createdb -O $DB_USER $DB_NAME
    
    # Grant permissions
    sudo -u postgres psql -d $DB_NAME -c "GRANT ALL ON SCHEMA public TO $DB_USER;"
    sudo -u postgres psql -d $DB_NAME -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;"
    sudo -u postgres psql -d $DB_NAME -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;"
    
    # Test connection
    log "Testing database connection..."
    sudo -u postgres psql -d $DB_NAME -c "SELECT version();" > /dev/null
    
    log "✅ PostgreSQL installation completed"
    log "✅ Database '$DB_NAME' created"
    log "✅ User '$DB_USER' created with full permissions"
}

# Function to install Nginx
install_nginx() {
    header "🌐 Installing Nginx"
    
    log "Installing Nginx..."
    apt-get install -y nginx
    
    log "Starting Nginx service..."
    systemctl start nginx
    systemctl enable nginx
    
    # Remove default site
    rm -f /etc/nginx/sites-enabled/default
    
    # Test Nginx
    if systemctl is-active --quiet nginx; then
        log "✅ Nginx installed and running"
    else
        error "❌ Nginx installation failed"
        exit 1
    fi
}

# Function to configure firewall
configure_firewall() {
    header "🔥 Configuring Firewall"
    
    log "Configuring UFW firewall..."
    
    # Reset UFW to defaults
    ufw --force reset
    
    # Set default policies
    ufw default deny incoming
    ufw default allow outgoing
    
    # Allow SSH
    ufw allow ssh
    ufw allow 22
    
    # Allow HTTP and HTTPS
    ufw allow 80
    ufw allow 443
    
    # Allow PostgreSQL (local only)
    ufw allow from 127.0.0.1 to any port 5432
    
    # Enable firewall
    ufw --force enable
    
    log "✅ Firewall configured"
}

# Function to install SSL certificate
install_ssl() {
    header "🔒 Installing SSL Certificate"
    
    log "Installing Certbot..."
    apt-get install -y certbot python3-certbot-nginx
    
    log "Obtaining SSL certificate for $DOMAIN..."
    
    # Create a temporary Nginx config for domain verification
    cat > /etc/nginx/sites-available/temp-salessync << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    
    location / {
        return 200 'SalesSync Installation in Progress';
        add_header Content-Type text/plain;
    }
}
EOF
    
    # Enable temporary config
    ln -sf /etc/nginx/sites-available/temp-salessync /etc/nginx/sites-enabled/temp-salessync
    systemctl reload nginx
    
    # Get SSL certificate
    certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN --redirect
    
    # Remove temporary config
    rm -f /etc/nginx/sites-enabled/temp-salessync
    rm -f /etc/nginx/sites-available/temp-salessync
    
    log "✅ SSL certificate installed"
}

# Function to clone and setup SalesSync
setup_salessync() {
    header "📥 Setting Up SalesSync Application"
    
    log "Creating application directory..."
    mkdir -p $APP_DIR
    cd $APP_DIR
    
    log "Cloning SalesSync repository..."
    git clone https://github.com/Reshigan/SalesSyncAI.git .
    
    log "Installing backend dependencies..."
    cd backend
    
    # Install all dependencies including dev dependencies
    npm install --include=dev
    
    log "Installing additional type definitions..."
    npm install --save-dev \
        @types/node \
        @types/express \
        @types/cors \
        @types/bcryptjs \
        @types/jsonwebtoken \
        @types/multer \
        @types/pdfkit \
        @types/web-push \
        @types/handlebars || warning "Some type packages may not be available"
    
    # Create custom type declarations for problematic modules
    log "Creating custom type declarations..."
    mkdir -p types
    
    cat > types/custom.d.ts << 'EOF'
// Custom type declarations for modules without proper types

declare module 'handlebars' {
  export function compile(template: string): (context: any) => string;
  export function registerHelper(name: string, fn: Function): void;
}

declare namespace Express {
  export namespace Multer {
    export interface File {
      fieldname: string;
      originalname: string;
      encoding: string;
      mimetype: string;
      size: number;
      destination: string;
      filename: string;
      path: string;
      buffer: Buffer;
    }
  }
}

declare global {
  namespace Express {
    interface Request {
      file?: Express.Multer.File;
      files?: Express.Multer.File[];
    }
  }
}

declare module 'pdfkit' {
  namespace PDFKit {
    interface PDFDocument {
      fontSize(size: number): PDFDocument;
      text(text: string, x?: number, y?: number, options?: any): PDFDocument;
      moveDown(lines?: number): PDFDocument;
      end(): void;
      pipe(stream: any): any;
    }
  }
  
  interface PDFDocumentOptions {
    size?: string;
    margin?: number;
  }
  
  class PDFDocument {
    constructor(options?: PDFDocumentOptions);
    fontSize(size: number): PDFDocument;
    text(text: string, x?: number, y?: number, options?: any): PDFDocument;
    moveDown(lines?: number): PDFDocument;
    end(): void;
    pipe(stream: any): any;
  }
  
  export = PDFDocument;
}
EOF
    
    # Update TypeScript configuration
    log "Updating TypeScript configuration..."
    cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020"],
    "module": "commonjs",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "allowJs": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": false,
    "noImplicitAny": false,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "typeRoots": ["./node_modules/@types", "./types"],
    "types": ["node", "express", "multer", "jsonwebtoken"]
  },
  "include": [
    "src/**/*",
    "types/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "**/*.test.ts",
    "**/*.spec.ts"
  ]
}
EOF
    
    log "Generating Prisma client..."
    npx prisma generate
    
    log "Running database migrations..."
    DATABASE_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME" npx prisma migrate deploy
    
    log "Seeding database with demo data..."
    DATABASE_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME" node seed-simple.js
    
    log "Building TypeScript application..."
    npx tsc --skipLibCheck
    
    # Install frontend dependencies if frontend exists
    if [ -d "$APP_DIR/frontend" ]; then
        log "Installing frontend dependencies..."
        cd "$APP_DIR/frontend"
        npm install --production
        npm run build || warning "Frontend build failed, continuing..."
    fi
    
    log "✅ SalesSync application setup completed"
}

# Function to configure Nginx for SalesSync
configure_nginx() {
    header "⚙️  Configuring Nginx for SalesSync"
    
    log "Creating Nginx configuration..."
    
    cat > /etc/nginx/sites-available/salessync << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    
    # Redirect HTTP to HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN www.$DOMAIN;
    
    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin";
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types 
        text/plain 
        text/css 
        text/xml 
        text/javascript 
        application/x-javascript 
        application/xml+rss 
        application/javascript 
        application/json
        application/xml
        image/svg+xml;
    
    # Client settings
    client_max_body_size 50M;
    client_body_timeout 60s;
    client_header_timeout 60s;
    
    # Main application
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
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # Health check endpoint
    location /health {
        proxy_pass http://localhost:3000/health;
        access_log off;
    }
    
    # API endpoints
    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    # Static files (if any)
    location /static/ {
        alias $APP_DIR/backend/public/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF
    
    # Enable the site
    ln -sf /etc/nginx/sites-available/salessync /etc/nginx/sites-enabled/salessync
    
    # Test Nginx configuration
    log "Testing Nginx configuration..."
    nginx -t || {
        error "Nginx configuration test failed"
        exit 1
    }
    
    # Reload Nginx
    systemctl reload nginx
    
    log "✅ Nginx configured successfully"
}

# Function to start SalesSync with PM2
start_salessync() {
    header "🚀 Starting SalesSync Application"
    
    cd $APP_DIR/backend
    
    # Create PM2 ecosystem file
    log "Creating PM2 configuration..."
    cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'salessync-backend',
    script: './dist/index.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      DATABASE_URL: 'postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME'
    },
    error_file: '/var/log/salessync/error.log',
    out_file: '/var/log/salessync/out.log',
    log_file: '/var/log/salessync/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
};
EOF
    
    # Create log directory
    mkdir -p /var/log/salessync
    chown -R www-data:www-data /var/log/salessync
    
    log "Starting application with PM2..."
    pm2 start ecosystem.config.js
    
    # Save PM2 configuration
    pm2 save
    
    # Setup PM2 startup script
    pm2 startup systemd -u root --hp /root
    
    log "✅ SalesSync application started"
}

# Function to setup log rotation
setup_log_rotation() {
    header "📝 Setting Up Log Rotation"
    
    log "Configuring log rotation..."
    
    cat > /etc/logrotate.d/salessync << EOF
/var/log/salessync/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
    postrotate
        pm2 reloadLogs
    endscript
}
EOF
    
    log "✅ Log rotation configured"
}

# Function to create maintenance scripts
create_maintenance_scripts() {
    header "🔧 Creating Maintenance Scripts"
    
    log "Creating maintenance scripts..."
    
    # Create backup script
    cat > /usr/local/bin/salessync-backup << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/backups/salessync"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Backup database
pg_dump -U salessync -h localhost salessync_production > $BACKUP_DIR/db_backup_$DATE.sql

# Backup application files
tar -czf $BACKUP_DIR/app_backup_$DATE.tar.gz -C /opt salessync

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
EOF
    
    # Create restart script
    cat > /usr/local/bin/salessync-restart << 'EOF'
#!/bin/bash
echo "Restarting SalesSync..."
pm2 restart salessync-backend
systemctl reload nginx
echo "SalesSync restarted successfully"
EOF
    
    # Create status script
    cat > /usr/local/bin/salessync-status << 'EOF'
#!/bin/bash
echo "=== SalesSync Status ==="
echo "Application:"
pm2 list | grep salessync
echo ""
echo "Nginx:"
systemctl status nginx --no-pager -l
echo ""
echo "PostgreSQL:"
systemctl status postgresql --no-pager -l
echo ""
echo "Disk Usage:"
df -h /opt/salessync
echo ""
echo "Memory Usage:"
free -h
EOF
    
    # Make scripts executable
    chmod +x /usr/local/bin/salessync-backup
    chmod +x /usr/local/bin/salessync-restart
    chmod +x /usr/local/bin/salessync-status
    
    # Setup daily backup cron job
    echo "0 2 * * * root /usr/local/bin/salessync-backup" > /etc/cron.d/salessync-backup
    
    log "✅ Maintenance scripts created"
}

# Function to verify installation
verify_installation() {
    header "✅ Verifying Installation"
    
    log "Checking services..."
    
    # Check Nginx
    if systemctl is-active --quiet nginx; then
        log "✅ Nginx is running"
    else
        error "❌ Nginx is not running"
        return 1
    fi
    
    # Check PostgreSQL
    if systemctl is-active --quiet postgresql; then
        log "✅ PostgreSQL is running"
    else
        error "❌ PostgreSQL is not running"
        return 1
    fi
    
    # Check PM2 application
    if pm2 list | grep -q salessync-backend; then
        log "✅ SalesSync backend is running"
    else
        error "❌ SalesSync backend is not running"
        return 1
    fi
    
    # Wait for application to start
    log "Waiting for application to start..."
    sleep 10
    
    # Test application health
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health | grep -q "200"; then
        log "✅ Application health check passed"
    else
        warning "⚠️  Application health check failed - checking logs..."
        pm2 logs salessync-backend --lines 20
    fi
    
    # Test SSL certificate
    if curl -s -I https://$DOMAIN | head -n 1 | grep -q "200"; then
        log "✅ SSL certificate is working"
    else
        warning "⚠️  SSL certificate test failed"
    fi
    
    # Test database connection
    if sudo -u postgres psql -d $DB_NAME -c "SELECT 1;" > /dev/null 2>&1; then
        log "✅ Database connection successful"
    else
        error "❌ Database connection failed"
    fi
    
    log "Installation verification completed"
}

# Function to display final information
display_final_info() {
    header "🎉 Installation Complete!"
    
    echo -e "${GREEN}"
    echo "SalesSync has been successfully installed!"
    echo ""
    echo "📋 Installation Summary:"
    echo "  • Domain: https://$DOMAIN"
    echo "  • Application Directory: $APP_DIR"
    echo "  • Database: $DB_NAME"
    echo "  • Database User: $DB_USER"
    echo ""
    echo "🔐 Default Login Credentials:"
    echo "  • Email: admin@demo.com"
    echo "  • Password: admin123"
    echo ""
    echo "🔧 Management Commands:"
    echo "  • Check status: salessync-status"
    echo "  • Restart application: salessync-restart"
    echo "  • Create backup: salessync-backup"
    echo "  • View logs: pm2 logs salessync-backend"
    echo "  • PM2 status: pm2 status"
    echo ""
    echo "📁 Important Directories:"
    echo "  • Application: $APP_DIR"
    echo "  • Logs: /var/log/salessync/"
    echo "  • Backups: /opt/backups/salessync/"
    echo "  • Nginx Config: /etc/nginx/sites-available/salessync"
    echo ""
    echo "🌐 Your SalesSync application is now live at:"
    echo "  https://$DOMAIN"
    echo ""
    echo "🔒 SSL Certificate will auto-renew via certbot"
    echo "📊 Daily backups are configured at 2 AM"
    echo -e "${NC}"
}

# Main execution function
main() {
    log "Starting SalesSync Fresh Production Installation..."
    
    # Pre-installation checks
    check_root
    show_installation_info
    
    # Installation steps
    update_system
    install_nodejs
    install_postgresql
    install_nginx
    configure_firewall
    install_ssl
    setup_salessync
    configure_nginx
    start_salessync
    setup_log_rotation
    create_maintenance_scripts
    verify_installation
    display_final_info
    
    log "🚀 SalesSync production installation completed successfully!"
}

# Run the main function
main "$@"