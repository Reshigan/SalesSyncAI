#!/bin/bash

# SalesSync AI - Final Production Deployment Script
# Handles all known issues: Docker, npm workspaces, SSL, permissions

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="ssai.gonxt.tech"
APP_DIR="$HOME/SalesSyncAI"
COMPOSE_FILE="docker-compose.prod.yml"

# Logging function
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
    error "This script should not be run as root for security reasons"
    error "Please run as a regular user with sudo privileges"
    exit 1
fi

# Check sudo access
if ! sudo -n true 2>/dev/null; then
    error "This script requires sudo privileges. Please run: sudo -v"
    exit 1
fi

log "🚀 Starting SalesSync AI Production Deployment"
log "Domain: $DOMAIN"
log "App Directory: $APP_DIR"

# Step 1: System Updates
log "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Step 2: Install essential packages
log "🔧 Installing essential packages..."
sudo apt install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release

# Step 3: Install Docker if not present
if ! command -v docker &> /dev/null; then
    log "🐳 Installing Docker..."
    
    # Remove old Docker versions
    sudo apt remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
    
    # Add Docker's official GPG key
    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    
    # Add Docker repository
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Install Docker
    sudo apt update
    sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    # Add user to docker group
    sudo usermod -aG docker $USER
    
    # Start Docker service
    sudo systemctl enable docker
    sudo systemctl start docker
    
    log "✅ Docker installed successfully"
else
    log "✅ Docker already installed"
fi

# Step 4: Install Docker Compose if not present
if ! command -v docker-compose &> /dev/null; then
    log "🔧 Installing Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    log "✅ Docker Compose installed successfully"
else
    log "✅ Docker Compose already installed"
fi

# Step 5: Install Node.js (for local builds if needed)
if ! command -v node &> /dev/null; then
    log "📦 Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs
    log "✅ Node.js installed successfully"
else
    log "✅ Node.js already installed"
fi

# Step 6: Install Nginx
if ! command -v nginx &> /dev/null; then
    log "🌐 Installing Nginx..."
    sudo apt install -y nginx
    sudo systemctl enable nginx
    log "✅ Nginx installed successfully"
else
    log "✅ Nginx already installed"
fi

# Step 7: Install Certbot for SSL
if ! command -v certbot &> /dev/null; then
    log "🔒 Installing Certbot..."
    sudo apt install -y certbot python3-certbot-nginx
    log "✅ Certbot installed successfully"
else
    log "✅ Certbot already installed"
fi

# Step 8: Clone or update repository
if [ -d "$APP_DIR" ]; then
    log "📁 Updating existing repository..."
    cd "$APP_DIR"
    git pull origin main
else
    log "📁 Cloning repository..."
    git clone https://github.com/Reshigan/SalesSyncAI.git "$APP_DIR"
    cd "$APP_DIR"
fi

# Step 9: Set up environment files
log "⚙️ Setting up environment configuration..."

# Backend environment
cat > backend/.env.production << EOF
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://salessync_user:salessync_secure_password_2024@postgres:5432/salessync_prod
REDIS_URL=redis://redis:6379
JWT_SECRET=your-super-secure-jwt-secret-key-change-this-in-production-2024
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://$DOMAIN
API_BASE_URL=https://$DOMAIN/api
FRONTEND_URL=https://$DOMAIN
UPLOAD_DIR=/app/uploads
MAX_FILE_SIZE=10485760
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
LOG_LEVEL=info
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=noreply@$DOMAIN
ADMIN_EMAIL=admin@$DOMAIN
EOF

# Frontend environment
cat > frontend/.env.production << EOF
REACT_APP_API_URL=https://$DOMAIN/api
REACT_APP_WS_URL=wss://$DOMAIN
REACT_APP_DOMAIN=$DOMAIN
REACT_APP_ENV=production
GENERATE_SOURCEMAP=false
EOF

# Root environment
cat > .env.production << EOF
DOMAIN=$DOMAIN
POSTGRES_DB=salessync_prod
POSTGRES_USER=salessync_user
POSTGRES_PASSWORD=salessync_secure_password_2024
REDIS_PASSWORD=redis_secure_password_2024
COMPOSE_PROJECT_NAME=salessync-prod
EOF

log "✅ Environment files created"

# Step 10: Create necessary directories
log "📁 Creating necessary directories..."
mkdir -p data/postgres data/redis data/uploads data/backups logs/nginx logs/app
sudo chown -R $USER:$USER data logs

# Step 11: Stop existing containers
log "🛑 Stopping existing containers..."
docker-compose -f $COMPOSE_FILE down --remove-orphans 2>/dev/null || true

# Step 12: Build and start services
log "🏗️ Building and starting services..."
docker-compose -f $COMPOSE_FILE build --no-cache
docker-compose -f $COMPOSE_FILE up -d

# Step 13: Wait for services to be ready
log "⏳ Waiting for services to start..."
sleep 30

# Step 14: Check service health
log "🏥 Checking service health..."
for i in {1..30}; do
    if curl -f http://localhost:3001/health >/dev/null 2>&1; then
        log "✅ Backend service is healthy"
        break
    fi
    if [ $i -eq 30 ]; then
        error "Backend service failed to start"
        docker-compose -f $COMPOSE_FILE logs backend
        exit 1
    fi
    sleep 2
done

for i in {1..30}; do
    if curl -f http://localhost:3000 >/dev/null 2>&1; then
        log "✅ Frontend service is healthy"
        break
    fi
    if [ $i -eq 30 ]; then
        error "Frontend service failed to start"
        docker-compose -f $COMPOSE_FILE logs frontend
        exit 1
    fi
    sleep 2
done

# Step 15: Configure Nginx
log "🌐 Configuring Nginx..."
sudo tee /etc/nginx/sites-available/$DOMAIN > /dev/null << EOF
server {
    listen 80;
    server_name $DOMAIN;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript application/json;
    
    # Frontend (React app)
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
        proxy_read_timeout 86400;
    }
    
    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }
    
    # WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Static files with caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://localhost:3000;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Enable the site
sudo ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
if sudo nginx -t; then
    log "✅ Nginx configuration is valid"
    sudo systemctl reload nginx
else
    error "Nginx configuration is invalid"
    exit 1
fi

# Step 16: Set up SSL certificate
log "🔒 Setting up SSL certificate..."
info "Please ensure your domain $DOMAIN points to this server's IP address"
info "You can set up SSL manually later with: sudo certbot --nginx -d $DOMAIN"

# Step 17: Create monitoring script
log "📊 Creating monitoring script..."
cat > monitor.sh << 'EOF'
#!/bin/bash

# SalesSync AI Monitoring Script

DOMAIN="ssai.gonxt.tech"
COMPOSE_FILE="docker-compose.prod.yml"

echo "=== SalesSync AI System Status ==="
echo "Timestamp: $(date)"
echo

# Check Docker containers
echo "=== Docker Containers ==="
docker-compose -f $COMPOSE_FILE ps
echo

# Check service health
echo "=== Service Health Checks ==="
echo -n "Frontend: "
if curl -f -s http://localhost:3000 >/dev/null; then
    echo "✅ Healthy"
else
    echo "❌ Unhealthy"
fi

echo -n "Backend: "
if curl -f -s http://localhost:3001/health >/dev/null; then
    echo "✅ Healthy"
else
    echo "❌ Unhealthy"
fi

echo -n "Database: "
if docker exec salessync-postgres-prod pg_isready -U salessync_user >/dev/null 2>&1; then
    echo "✅ Healthy"
else
    echo "❌ Unhealthy"
fi

echo -n "Redis: "
if docker exec salessync-redis-prod redis-cli ping >/dev/null 2>&1; then
    echo "✅ Healthy"
else
    echo "❌ Unhealthy"
fi

# Check disk usage
echo
echo "=== Disk Usage ==="
df -h | grep -E "(Filesystem|/dev/)"

# Check memory usage
echo
echo "=== Memory Usage ==="
free -h

# Check recent logs
echo
echo "=== Recent Application Logs ==="
docker-compose -f $COMPOSE_FILE logs --tail=10 backend frontend

echo
echo "=== Monitoring Complete ==="
EOF

chmod +x monitor.sh

# Step 18: Create backup script
log "💾 Creating backup script..."
cat > backup.sh << 'EOF'
#!/bin/bash

# SalesSync AI Backup Script

BACKUP_DIR="$HOME/backups/salessync"
DATE=$(date +%Y%m%d_%H%M%S)
COMPOSE_FILE="docker-compose.prod.yml"

mkdir -p $BACKUP_DIR

echo "Starting backup at $(date)"

# Backup database
echo "Backing up database..."
docker exec salessync-postgres-prod pg_dump -U salessync_user salessync_prod > $BACKUP_DIR/database_$DATE.sql

# Backup uploaded files
echo "Backing up uploaded files..."
docker cp salessync-backend-prod:/app/uploads $BACKUP_DIR/uploads_$DATE

# Backup configuration
echo "Backing up configuration..."
cp -r . $BACKUP_DIR/config_$DATE

# Compress backups older than 1 day
find $BACKUP_DIR -name "*.sql" -mtime +1 -exec gzip {} \;

# Remove backups older than 30 days
find $BACKUP_DIR -name "*" -mtime +30 -delete

echo "Backup completed at $(date)"
echo "Backup location: $BACKUP_DIR"
EOF

chmod +x backup.sh

# Step 19: Create update script
log "🔄 Creating update script..."
cat > update.sh << 'EOF'
#!/bin/bash

# SalesSync AI Update Script

set -e

COMPOSE_FILE="docker-compose.prod.yml"

echo "Starting update at $(date)"

# Pull latest code
echo "Pulling latest code..."
git pull origin main

# Backup before update
echo "Creating backup..."
./backup.sh

# Rebuild and restart services
echo "Rebuilding services..."
docker-compose -f $COMPOSE_FILE down
docker-compose -f $COMPOSE_FILE build --no-cache
docker-compose -f $COMPOSE_FILE up -d

# Wait for services
echo "Waiting for services to start..."
sleep 30

# Health check
echo "Performing health check..."
./monitor.sh

echo "Update completed at $(date)"
EOF

chmod +x update.sh

# Step 20: Final status check
log "🏁 Performing final status check..."
sleep 10

echo
echo "=== DEPLOYMENT SUMMARY ==="
echo "✅ System packages updated"
echo "✅ Docker and Docker Compose installed"
echo "✅ Node.js and Nginx installed"
echo "✅ Certbot installed for SSL"
echo "✅ Repository cloned/updated"
echo "✅ Environment files configured"
echo "✅ Services built and started"
echo "✅ Nginx configured"
echo "✅ Monitoring and backup scripts created"
echo

# Show service status
docker-compose -f $COMPOSE_FILE ps

echo
echo "=== NEXT STEPS ==="
echo "1. Ensure your domain $DOMAIN points to this server"
echo "2. Set up SSL certificate: sudo certbot --nginx -d $DOMAIN"
echo "3. Access your application at: http://$DOMAIN (or https:// after SSL)"
echo "4. Monitor services with: ./monitor.sh"
echo "5. Create backups with: ./backup.sh"
echo "6. Update application with: ./update.sh"
echo

log "🎉 SalesSync AI deployment completed successfully!"
log "Application should be accessible at: http://$DOMAIN"
log "Remember to set up SSL certificate for production use!"
EOF
<parameter name="security_risk">LOW