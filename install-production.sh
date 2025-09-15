#!/bin/bash

# 🚀 SalesSync AI - Production Installation Script
# This script automates the complete production deployment

set -e

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
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   error "This script should not be run as root. Please run as a regular user with sudo privileges."
   exit 1
fi

log "🚀 Starting SalesSync AI Production Installation..."

# Check system requirements
log "📋 Checking system requirements..."

# Check OS
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    log "✅ Linux system detected"
else
    error "❌ This script is designed for Linux systems only"
    exit 1
fi

# Check available memory
MEMORY_GB=$(free -g | awk '/^Mem:/{print $2}')
if [ "$MEMORY_GB" -lt 4 ]; then
    warn "⚠️  System has ${MEMORY_GB}GB RAM. Minimum 4GB recommended."
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    log "✅ Memory check passed: ${MEMORY_GB}GB RAM"
fi

# Check available disk space
DISK_GB=$(df -BG . | awk 'NR==2 {print $4}' | sed 's/G//')
if [ "$DISK_GB" -lt 20 ]; then
    warn "⚠️  Available disk space: ${DISK_GB}GB. Minimum 20GB recommended."
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    log "✅ Disk space check passed: ${DISK_GB}GB available"
fi

# Update system packages
log "📦 Updating system packages..."
sudo apt update -qq

# Install required packages
log "🔧 Installing required packages..."
sudo apt install -y curl wget git software-properties-common apt-transport-https ca-certificates gnupg lsb-release

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    log "🐳 Installing Docker..."
    
    # Add Docker's official GPG key
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    
    # Add Docker repository
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Install Docker
    sudo apt update -qq
    sudo apt install -y docker-ce docker-ce-cli containerd.io
    
    # Add user to docker group
    sudo usermod -aG docker $USER
    
    log "✅ Docker installed successfully"
else
    log "✅ Docker already installed"
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    log "🐳 Installing Docker Compose..."
    
    # Install Docker Compose
    sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    
    log "✅ Docker Compose installed successfully"
else
    log "✅ Docker Compose already installed"
fi

# Start Docker service
log "🔄 Starting Docker service..."
sudo systemctl start docker
sudo systemctl enable docker

# Check for port conflicts
log "🔍 Checking for port conflicts..."

# Check port 80
if sudo lsof -i :80 &> /dev/null; then
    warn "⚠️  Port 80 is in use. Attempting to resolve conflicts..."
    
    # Stop common web servers
    sudo systemctl stop nginx apache2 httpd 2>/dev/null || true
    sudo systemctl disable nginx apache2 httpd 2>/dev/null || true
    
    # Check again
    if sudo lsof -i :80 &> /dev/null; then
        error "❌ Port 80 is still in use. Please manually resolve the conflict."
        sudo lsof -i :80
        exit 1
    else
        log "✅ Port 80 conflict resolved"
    fi
else
    log "✅ Port 80 is available"
fi

# Check port 3001
if sudo lsof -i :3001 &> /dev/null; then
    warn "⚠️  Port 3001 is in use. Stopping conflicting services..."
    sudo pkill -f "node.*3001" 2>/dev/null || true
    sleep 2
    
    if sudo lsof -i :3001 &> /dev/null; then
        error "❌ Port 3001 is still in use. Please manually resolve the conflict."
        sudo lsof -i :3001
        exit 1
    else
        log "✅ Port 3001 conflict resolved"
    fi
else
    log "✅ Port 3001 is available"
fi

# Create environment file if it doesn't exist
if [ ! -f "backend/.env" ]; then
    log "📝 Creating environment configuration..."
    
    if [ -f "backend/.env.example" ]; then
        cp backend/.env.example backend/.env
        log "✅ Environment file created from template"
    else
        # Create basic .env file
        cat > backend/.env << EOF
# Database Configuration
DATABASE_URL="postgresql://salessync:salessync123@postgres:5432/salessync?schema=public"

# JWT Configuration
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
JWT_EXPIRES_IN="7d"

# Application Configuration
NODE_ENV="production"
PORT=3001

# CORS Configuration
FRONTEND_URL="http://localhost:3000"

# File Upload Configuration
MAX_FILE_SIZE="10mb"
UPLOAD_PATH="./uploads"

# Email Configuration (Optional)
SMTP_HOST=""
SMTP_PORT=""
SMTP_USER=""
SMTP_PASS=""
EOF
        log "✅ Basic environment file created"
    fi
else
    log "✅ Environment file already exists"
fi

# Stop any existing containers
log "🛑 Stopping any existing containers..."
docker-compose -f docker-compose.prod.yml down 2>/dev/null || true

# Clean up old images (optional)
read -p "🧹 Clean up old Docker images? This will free up disk space but may take longer to rebuild. (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    log "🧹 Cleaning up old Docker images..."
    docker system prune -f
    docker image prune -f
fi

# Build and start services
log "🏗️  Building and starting services..."
log "This may take 5-15 minutes depending on your internet connection and system performance..."

# Build with progress
docker-compose -f docker-compose.prod.yml up -d --build

# Wait for services to be ready
log "⏳ Waiting for services to start..."
sleep 30

# Check if containers are running
log "🔍 Checking container status..."
if ! docker-compose -f docker-compose.prod.yml ps | grep -q "Up"; then
    error "❌ Some containers failed to start. Checking logs..."
    docker-compose -f docker-compose.prod.yml logs
    exit 1
fi

# Wait a bit more for database to be fully ready
log "⏳ Waiting for database to be ready..."
sleep 30

# Seed database with demo data
log "🌱 Seeding database with demo data..."
MAX_RETRIES=3
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if docker-compose -f docker-compose.prod.yml exec -T backend node seed-production-demo.js; then
        log "✅ Database seeded successfully"
        break
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
            warn "⚠️  Database seeding failed. Retrying in 10 seconds... (Attempt $RETRY_COUNT/$MAX_RETRIES)"
            sleep 10
        else
            warn "⚠️  Database seeding failed after $MAX_RETRIES attempts. Trying JavaScript fallback..."
            if docker-compose -f docker-compose.prod.yml exec -T backend node seed-demo-simple.js; then
                log "✅ Database seeded with JavaScript fallback"
                break
            else
                error "❌ Database seeding failed completely. The application will still work but without demo data."
            fi
        fi
    fi
done

# Final health checks
log "🏥 Performing health checks..."

# Check if frontend is accessible
sleep 10
if curl -f http://localhost:3000 &> /dev/null; then
    log "✅ Frontend is accessible"
else
    warn "⚠️  Frontend health check failed"
fi

# Check if backend API is accessible
if curl -f http://localhost:3001/api/health &> /dev/null; then
    log "✅ Backend API is accessible"
else
    warn "⚠️  Backend API health check failed"
fi

# Display final status
log "📊 Final Status Check..."
docker-compose -f docker-compose.prod.yml ps

# Get server IP
SERVER_IP=$(hostname -I | awk '{print $1}')

# Installation complete
echo
echo "🎉 =================================="
echo "🎉  INSTALLATION COMPLETED!"
echo "🎉 =================================="
echo
log "✅ SalesSync AI is now running in production mode!"
echo
info "🌐 Access URLs:"
info "   Frontend: http://$SERVER_IP"
info "   Backend API: http://$SERVER_IP:3001"
info "   Health Check: http://$SERVER_IP:3001/api/health"
echo
info "🔐 Demo Login Credentials:"
info "   Admin: demo@techcorp.com / Demo123!"
info "   Manager: manager@techcorp.com / Manager123!"
info "   Agent: agent1@techcorp.com / Agent123!"
echo
info "📋 Management Commands:"
info "   View logs: docker-compose -f docker-compose.prod.yml logs -f"
info "   Restart: docker-compose -f docker-compose.prod.yml restart"
info "   Stop: docker-compose -f docker-compose.prod.yml down"
info "   Update: git pull && docker-compose -f docker-compose.prod.yml up -d --build"
echo
info "📚 For more information, see PRODUCTION_INSTALL.md"
echo

# Check if user needs to logout/login for docker group
if ! groups $USER | grep -q docker; then
    warn "⚠️  You may need to logout and login again for Docker group permissions to take effect."
fi

log "🎉 Installation completed successfully!"