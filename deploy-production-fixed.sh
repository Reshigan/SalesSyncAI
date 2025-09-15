#!/bin/bash

# ============================================================================
# SalesSyncAI Production Deployment Script
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
BACKUP_DIR="/opt/salessync-backup"
LOG_FILE="/var/log/salessync-deploy.log"

# Environment variables with defaults
export NODE_ENV=production
export POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-"SalesSync2024!Prod"}
export REDIS_PASSWORD=${REDIS_PASSWORD:-"SalesSync2024!Redis"}
export JWT_SECRET=${JWT_SECRET:-"SalesSync2024!JWT!Secret!Key!Production"}
export JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET:-"SalesSync2024!JWT!Refresh!Secret!Key!Production"}
export CORS_ORIGIN=${CORS_ORIGIN:-"*"}

# ============================================================================
# SYSTEM PREPARATION
# ============================================================================

prepare_system() {
    log "🚀 Starting SalesSyncAI Production Deployment"
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
        lsb-release \
        build-essential \
        python3 \
        python3-pip \
        pkg-config \
        libcairo2-dev \
        libjpeg-dev \
        libpango1.0-dev \
        libgif-dev \
        librsvg2-dev \
        libpixman-1-dev \
        libffi-dev \
        libssl-dev >> $LOG_FILE 2>&1
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
# NODE.JS INSTALLATION
# ============================================================================

install_nodejs() {
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        log "✅ Node.js already installed: $NODE_VERSION"
        return
    fi
    
    log "📦 Installing Node.js 20..."
    
    # Install Node.js 20 via NodeSource
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs >> $LOG_FILE 2>&1
    
    # Install global packages
    sudo npm install -g pm2 >> $LOG_FILE 2>&1
    
    log "✅ Node.js $(node --version) installed successfully"
}

# ============================================================================
# PROJECT DEPLOYMENT
# ============================================================================

deploy_project() {
    log "📁 Preparing deployment directory..."
    
    # Create backup if deployment exists
    if [ -d "$DEPLOY_DIR" ]; then
        log "💾 Creating backup..."
        sudo rm -rf $BACKUP_DIR
        sudo cp -r $DEPLOY_DIR $BACKUP_DIR
    fi
    
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
    
    # Create production environment file
    cat > .env.production << EOF
# Production Environment Configuration
NODE_ENV=production
PORT=3000

# Database Configuration
DATABASE_URL=postgresql://salessync_user:${POSTGRES_PASSWORD}@localhost:5432/salessync_prod
POSTGRES_DB=salessync_prod
POSTGRES_USER=salessync_user
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}

# Redis Configuration
REDIS_URL=redis://:${REDIS_PASSWORD}@localhost:6379
REDIS_PASSWORD=${REDIS_PASSWORD}

# JWT Configuration
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}

# CORS Configuration
CORS_ORIGIN=${CORS_ORIGIN}

# API Configuration
REACT_APP_API_URL=http://$(curl -s ifconfig.me):3000/api

# Logging
LOG_LEVEL=info

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_DIR=/opt/salessync/uploads

# AI Services (Optional - configure if needed)
OPENAI_API_KEY=${OPENAI_API_KEY:-}
GOOGLE_CLOUD_PROJECT_ID=${GOOGLE_CLOUD_PROJECT_ID:-}

# Email Configuration (Optional)
SMTP_HOST=${SMTP_HOST:-}
SMTP_PORT=${SMTP_PORT:-587}
SMTP_USER=${SMTP_USER:-}
SMTP_PASS=${SMTP_PASS:-}

# AWS Configuration (Optional)
AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID:-}
AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY:-}
AWS_REGION=${AWS_REGION:-us-east-1}
EOF

    # Set proper permissions
    chmod 600 .env.production
    
    log "✅ Environment configuration created"
}

# ============================================================================
# DATABASE SETUP
# ============================================================================

setup_database() {
    log "🗄️ Setting up PostgreSQL database..."
    
    # Install PostgreSQL if not present
    if ! command -v psql &> /dev/null; then
        sudo apt-get install -y postgresql postgresql-contrib >> $LOG_FILE 2>&1
        sudo systemctl start postgresql
        sudo systemctl enable postgresql
    fi
    
    # Create database and user
    sudo -u postgres psql << EOF
CREATE USER salessync_user WITH PASSWORD '${POSTGRES_PASSWORD}';
CREATE DATABASE salessync_prod OWNER salessync_user;
GRANT ALL PRIVILEGES ON DATABASE salessync_prod TO salessync_user;
ALTER USER salessync_user CREATEDB;
\q
EOF

    log "✅ PostgreSQL database configured"
}

# ============================================================================
# REDIS SETUP
# ============================================================================

setup_redis() {
    log "🔴 Setting up Redis cache..."
    
    # Install Redis if not present
    if ! command -v redis-server &> /dev/null; then
        sudo apt-get install -y redis-server >> $LOG_FILE 2>&1
    fi
    
    # Configure Redis
    sudo sed -i "s/# requirepass foobared/requirepass ${REDIS_PASSWORD}/" /etc/redis/redis.conf
    sudo sed -i "s/bind 127.0.0.1 ::1/bind 127.0.0.1/" /etc/redis/redis.conf
    
    # Start and enable Redis
    sudo systemctl start redis-server
    sudo systemctl enable redis-server
    
    log "✅ Redis cache configured"
}

# ============================================================================
# APPLICATION BUILD
# ============================================================================

build_application() {
    log "🔨 Building application..."
    
    cd $DEPLOY_DIR
    
    # Backend build
    log "📦 Building backend..."
    cd backend
    
    # Install dependencies
    npm install >> $LOG_FILE 2>&1
    
    # Generate Prisma client
    npx prisma generate >> $LOG_FILE 2>&1
    
    # Run database migrations
    npx prisma migrate deploy >> $LOG_FILE 2>&1
    
    # Build TypeScript (this should now work with our fixes!)
    npm run build >> $LOG_FILE 2>&1
    
    # Seed database with demo data
    log "🌱 Seeding database..."
    node seed-production-demo.js >> $LOG_FILE 2>&1 || warn "Database seeding failed - continuing anyway"
    
    cd ..
    
    # Frontend build
    log "🎨 Building frontend..."
    cd frontend
    
    # Install dependencies
    npm install >> $LOG_FILE 2>&1
    
    # Build React app
    REACT_APP_API_URL=http://$(curl -s ifconfig.me):3000/api npm run build >> $LOG_FILE 2>&1
    
    cd ..
    
    log "✅ Application built successfully"
}

# ============================================================================
# NGINX SETUP
# ============================================================================

setup_nginx() {
    log "🌐 Setting up Nginx..."
    
    # Install Nginx
    sudo apt-get install -y nginx >> $LOG_FILE 2>&1
    
    # Create Nginx configuration
    sudo tee /etc/nginx/sites-available/salessync << EOF
server {
    listen 80;
    server_name _;
    
    # Frontend
    location / {
        root $DEPLOY_DIR/frontend/build;
        index index.html index.htm;
        try_files \$uri \$uri/ /index.html;
        
        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "no-referrer-when-downgrade" always;
        add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    }
    
    # Backend API
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
        
        # Timeout settings
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Health check
    location /health {
        proxy_pass http://localhost:3000/health;
        access_log off;
    }
    
    # Static files caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

    # Enable site
    sudo ln -sf /etc/nginx/sites-available/salessync /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
    
    # Test and reload Nginx
    sudo nginx -t
    sudo systemctl start nginx
    sudo systemctl enable nginx
    sudo systemctl reload nginx
    
    log "✅ Nginx configured successfully"
}

# ============================================================================
# PM2 PROCESS MANAGEMENT
# ============================================================================

setup_pm2() {
    log "⚡ Setting up PM2 process management..."
    
    cd $DEPLOY_DIR
    
    # Create PM2 ecosystem file
    cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'salessync-backend',
    script: './backend/dist/index.js',
    cwd: '$DEPLOY_DIR',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_file: '.env.production',
    log_file: '/var/log/salessync-backend.log',
    out_file: '/var/log/salessync-backend-out.log',
    error_file: '/var/log/salessync-backend-error.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024',
    watch: false,
    ignore_watch: ['node_modules', 'logs', 'uploads'],
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
EOF

    # Stop existing PM2 processes
    pm2 delete all 2>/dev/null || true
    
    # Start application with PM2
    pm2 start ecosystem.config.js
    
    # Save PM2 configuration
    pm2 save
    
    # Setup PM2 startup script
    sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME
    
    log "✅ PM2 configured successfully"
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
    
    # Allow backend port (for direct API access if needed)
    sudo ufw allow 3000/tcp
    
    # Show status
    sudo ufw status
    
    log "✅ Firewall configured successfully"
}

# ============================================================================
# HEALTH CHECKS
# ============================================================================

run_health_checks() {
    log "🏥 Running health checks..."
    
    # Wait for services to start
    sleep 10
    
    # Check PostgreSQL
    if sudo -u postgres psql -d salessync_prod -c "SELECT 1;" > /dev/null 2>&1; then
        log "✅ PostgreSQL is healthy"
    else
        error "❌ PostgreSQL health check failed"
    fi
    
    # Check Redis
    if redis-cli -a $REDIS_PASSWORD ping > /dev/null 2>&1; then
        log "✅ Redis is healthy"
    else
        error "❌ Redis health check failed"
    fi
    
    # Check backend
    for i in {1..30}; do
        if curl -f http://localhost:3000/health > /dev/null 2>&1; then
            log "✅ Backend is healthy"
            break
        fi
        if [ $i -eq 30 ]; then
            error "❌ Backend health check failed after 30 attempts"
        fi
        sleep 2
    done
    
    # Check frontend
    if curl -f http://localhost/ > /dev/null 2>&1; then
        log "✅ Frontend is healthy"
    else
        error "❌ Frontend health check failed"
    fi
    
    # Check PM2 status
    pm2 status
    
    log "✅ All health checks passed!"
}

# ============================================================================
# MONITORING SETUP
# ============================================================================

setup_monitoring() {
    log "📊 Setting up monitoring..."
    
    # Create monitoring script
    sudo tee /usr/local/bin/salessync-monitor.sh << 'EOF'
#!/bin/bash

LOG_FILE="/var/log/salessync-monitor.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

# Function to log with timestamp
log_monitor() {
    echo "[$DATE] $1" >> $LOG_FILE
}

# Check services
services=("postgresql" "redis-server" "nginx")
for service in "${services[@]}"; do
    if systemctl is-active --quiet $service; then
        log_monitor "✅ $service is running"
    else
        log_monitor "❌ $service is down - attempting restart"
        systemctl restart $service
    fi
done

# Check PM2 processes
if ! pm2 status | grep -q "online"; then
    log_monitor "❌ PM2 processes down - attempting restart"
    pm2 restart all
fi

# Check disk space
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    log_monitor "⚠️ Disk usage is ${DISK_USAGE}% - cleanup recommended"
fi

# Check memory usage
MEMORY_USAGE=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
if [ $MEMORY_USAGE -gt 80 ]; then
    log_monitor "⚠️ Memory usage is ${MEMORY_USAGE}% - monitoring required"
fi
EOF

    sudo chmod +x /usr/local/bin/salessync-monitor.sh
    
    # Create cron job for monitoring
    (crontab -l 2>/dev/null; echo "*/5 * * * * /usr/local/bin/salessync-monitor.sh") | crontab -
    
    log "✅ Monitoring configured successfully"
}

# ============================================================================
# MAIN DEPLOYMENT FUNCTION
# ============================================================================

main() {
    log "🚀 Starting SalesSyncAI Production Deployment"
    log "📋 Target: AWS t4g.medium Ubuntu 22.04"
    
    # Check if running as root
    if [ "$EUID" -eq 0 ]; then
        error "Please do not run this script as root. Use a regular user with sudo privileges."
    fi
    
    # Run deployment steps
    prepare_system
    install_docker
    install_nodejs
    deploy_project
    setup_environment
    setup_database
    setup_redis
    build_application
    setup_nginx
    setup_pm2
    setup_firewall
    setup_monitoring
    run_health_checks
    
    # Final information
    PUBLIC_IP=$(curl -s ifconfig.me)
    
    log "🎉 SalesSyncAI deployed successfully!"
    echo ""
    echo "============================================================================"
    echo "🌐 DEPLOYMENT COMPLETE"
    echo "============================================================================"
    echo "📍 Public IP: $PUBLIC_IP"
    echo "🌐 Frontend URL: http://$PUBLIC_IP"
    echo "🔗 API URL: http://$PUBLIC_IP/api"
    echo "🏥 Health Check: http://$PUBLIC_IP/health"
    echo ""
    echo "📊 Management Commands:"
    echo "  • View logs: pm2 logs"
    echo "  • Restart app: pm2 restart all"
    echo "  • Monitor: pm2 monit"
    echo "  • Nginx status: sudo systemctl status nginx"
    echo "  • Database: sudo -u postgres psql -d salessync_prod"
    echo ""
    echo "📁 Important Paths:"
    echo "  • Application: $DEPLOY_DIR"
    echo "  • Logs: /var/log/salessync-*.log"
    echo "  • Nginx config: /etc/nginx/sites-available/salessync"
    echo "  • Environment: $DEPLOY_DIR/.env.production"
    echo ""
    echo "🔐 Default Credentials (CHANGE THESE!):"
    echo "  • Database Password: $POSTGRES_PASSWORD"
    echo "  • Redis Password: $REDIS_PASSWORD"
    echo ""
    echo "✅ Deployment completed successfully!"
    echo "============================================================================"
}

# ============================================================================
# SCRIPT EXECUTION
# ============================================================================

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "SalesSyncAI Production Deployment Script"
        echo ""
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --check        Run health checks only"
        echo "  --monitor      Show monitoring status"
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
        run_health_checks
        exit 0
        ;;
    --monitor)
        pm2 status
        sudo systemctl status postgresql redis-server nginx
        exit 0
        ;;
    "")
        main
        ;;
    *)
        error "Unknown option: $1. Use --help for usage information."
        ;;
esac