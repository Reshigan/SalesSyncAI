#!/bin/bash

# SalesSyncAI Home Deployment Test Script
# Tests the home directory deployment without actually installing

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[TEST] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

log "🧪 Testing SalesSyncAI Home Deployment Prerequisites"

# Test 1: Check if running as appropriate user
log "1. Checking user permissions..."
if [[ $EUID -eq 0 ]]; then
    info "Running as root - deployment will use sudo for system operations"
else
    info "Running as user: $(whoami) - deployment will use sudo for system operations"
fi

# Test 2: Check home directory access
log "2. Checking home directory access..."
HOME_DIR="$HOME"
APP_DIR="$HOME_DIR/salessync-prod"
info "Home directory: $HOME_DIR"
info "Target app directory: $APP_DIR"

if [ -w "$HOME_DIR" ]; then
    log "✅ Home directory is writable"
else
    error "❌ Home directory is not writable"
    exit 1
fi

# Test 3: Check for existing installations
log "3. Checking for existing installations..."
existing_found=false

check_dir() {
    local dir="$1"
    local name="$2"
    if [ -d "$dir" ]; then
        warning "Found existing installation: $name at $dir"
        existing_found=true
    else
        info "No existing installation found at: $dir"
    fi
}

check_dir "/opt/salessync" "SalesSync in /opt/salessync"
check_dir "/opt/SalesSyncAI" "SalesSyncAI in /opt/SalesSyncAI"
check_dir "/root/salessync" "SalesSync in /root/salessync"
check_dir "/root/SalesSyncAI" "SalesSyncAI in /root/SalesSyncAI"
check_dir "$APP_DIR" "Previous home installation"

if [ "$existing_found" = true ]; then
    warning "Existing installations found - cleanup will be performed"
else
    log "✅ No existing installations found"
fi

# Test 4: Check system requirements
log "4. Checking system requirements..."

# Check if we can use sudo
if sudo -n true 2>/dev/null; then
    log "✅ Sudo access available"
else
    warning "⚠️ Sudo may require password - deployment will prompt when needed"
fi

# Check internet connectivity
if curl -s --connect-timeout 5 https://github.com > /dev/null; then
    log "✅ Internet connectivity available"
else
    error "❌ No internet connectivity - cannot download packages"
    exit 1
fi

# Test 5: Check available disk space
log "5. Checking disk space..."
available_space=$(df "$HOME_DIR" | awk 'NR==2 {print $4}')
required_space=2097152  # 2GB in KB

if [ "$available_space" -gt "$required_space" ]; then
    log "✅ Sufficient disk space available ($(($available_space / 1024 / 1024))GB free)"
else
    error "❌ Insufficient disk space (need at least 2GB)"
    exit 1
fi

# Test 6: Check if ports are available
log "6. Checking port availability..."

check_port() {
    local port="$1"
    local service="$2"
    if netstat -tuln 2>/dev/null | grep -q ":$port "; then
        warning "Port $port is already in use (may be used by $service)"
    else
        log "✅ Port $port is available"
    fi
}

check_port 80 "HTTP/Nginx"
check_port 3000 "Backend API"
check_port 5432 "PostgreSQL"
check_port 6379 "Redis"

# Test 7: Check existing services
log "7. Checking existing services..."

check_service() {
    local service="$1"
    if systemctl is-active --quiet "$service" 2>/dev/null; then
        info "$service is already running"
    else
        info "$service is not running (will be installed/started)"
    fi
}

check_service postgresql
check_service redis-server
check_service nginx

# Test 8: Check Node.js
log "8. Checking Node.js..."
if command -v node &> /dev/null; then
    node_version=$(node --version)
    info "Node.js already installed: $node_version"
    
    # Check if version is acceptable (v16+)
    major_version=$(echo "$node_version" | sed 's/v\([0-9]*\).*/\1/')
    if [ "$major_version" -ge 16 ]; then
        log "✅ Node.js version is acceptable"
    else
        warning "Node.js version is old - will be updated to v20"
    fi
else
    info "Node.js not installed - will be installed"
fi

# Test 9: Check PM2
log "9. Checking PM2..."
if command -v pm2 &> /dev/null; then
    info "PM2 already installed"
    pm2_processes=$(pm2 list | grep -c "online\|stopped\|errored" || echo "0")
    if [ "$pm2_processes" -gt 0 ]; then
        warning "PM2 has $pm2_processes existing processes - will be cleaned up"
    fi
else
    info "PM2 not installed - will be installed"
fi

# Test 10: Check Git
log "10. Checking Git..."
if command -v git &> /dev/null; then
    log "✅ Git is available"
else
    info "Git not installed - will be installed"
fi

# Test 11: Simulate directory creation
log "11. Testing directory creation..."
test_dir="$HOME_DIR/salessync-test-$$"
if mkdir -p "$test_dir" && rmdir "$test_dir"; then
    log "✅ Directory creation test passed"
else
    error "❌ Cannot create directories in home folder"
    exit 1
fi

# Test 12: Check script permissions
log "12. Checking deployment script..."
script_path="$(dirname "$0")/cleanup-and-home-deploy.sh"
if [ -f "$script_path" ]; then
    if [ -x "$script_path" ]; then
        log "✅ Deployment script is executable"
    else
        warning "Deployment script is not executable - will be fixed"
        chmod +x "$script_path" 2>/dev/null || warning "Could not make script executable"
    fi
else
    error "❌ Deployment script not found at: $script_path"
    exit 1
fi

log ""
log "🎉 All prerequisite tests passed!"
log ""
log "📋 Summary:"
log "  - Home directory: $HOME_DIR"
log "  - Target installation: $APP_DIR"
log "  - User: $(whoami)"
log "  - Available space: $(($available_space / 1024 / 1024))GB"
log ""
log "🚀 Ready to run deployment script:"
log "  ./deployment/cleanup-and-home-deploy.sh"
log ""
log "💡 Optional: Set custom domain before deployment:"
log "  export DOMAIN='your-domain.com'"
log "  ./deployment/cleanup-and-home-deploy.sh"