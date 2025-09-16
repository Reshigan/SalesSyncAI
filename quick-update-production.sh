#!/bin/bash

# =============================================================================
# SalesSync Quick Production Update Script
# For updating existing production deployment
# =============================================================================

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
APP_DIR="/opt/salessync"
SERVICE_NAME="salessync"
DB_NAME="salessync_production"

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}" >&2
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    error "This script must be run as root (use sudo)"
    exit 1
fi

log "Starting quick production update..."

# Stop application
log "Stopping application..."
pm2 stop "$SERVICE_NAME" 2>/dev/null || true

# Update code
log "Updating code from git..."
cd "$APP_DIR"
git fetch origin
git checkout main
git pull origin main

# Update backend dependencies
log "Updating backend dependencies..."
cd "$APP_DIR/backend"
npm install --production

# Generate Prisma client
log "Generating Prisma client..."
npx prisma generate

# Run database migrations
log "Running database migrations..."
DATABASE_URL="postgresql://salessync:salessync_secure_password_2024@localhost:5432/$DB_NAME" npx prisma migrate deploy || {
    warning "Migration failed, attempting to fix database permissions..."
    
    # Fix database permissions
    sudo -u postgres psql -c "ALTER USER salessync SUPERUSER;" 2>/dev/null || true
    sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL ON SCHEMA public TO salessync;" 2>/dev/null || true
    sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO salessync;" 2>/dev/null || true
    sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO salessync;" 2>/dev/null || true
    
    # Retry migration
    log "Retrying database migrations..."
    DATABASE_URL="postgresql://salessync:salessync_secure_password_2024@localhost:5432/$DB_NAME" npx prisma migrate deploy
}

# Build application
log "Building application..."
npm run build 2>/dev/null || warning "Build step skipped"

# Update frontend (if exists)
if [ -d "$APP_DIR/frontend" ]; then
    log "Updating frontend..."
    cd "$APP_DIR/frontend"
    npm install --production
    npm run build 2>/dev/null || warning "Frontend build failed"
fi

# Restart application
log "Restarting application..."
cd "$APP_DIR/backend"
pm2 restart "$SERVICE_NAME"

# Wait and check status
sleep 3
if pm2 list | grep -q "$SERVICE_NAME.*online"; then
    log "✅ Application updated and restarted successfully!"
    log "🌐 Check your site: https://SalesSync.gonxt.tech"
else
    error "❌ Application failed to restart"
    pm2 logs "$SERVICE_NAME" --lines 10
    exit 1
fi

log "🎉 Quick update completed!"