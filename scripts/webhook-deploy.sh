#!/bin/bash

# 🔄 GitHub Webhook Deployment Script
# This script is triggered by GitHub webhooks for automatic deployment

set -e

# Configuration
REPO_DIR="/home/ubuntu/SalesSyncAI"
LOG_FILE="/var/log/salessync-deploy.log"
BACKUP_DIR="/backups/salessync"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output and log
log_message() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        "INFO")
            echo -e "${BLUE}[INFO]${NC} $message"
            echo "[$timestamp] [INFO] $message" >> $LOG_FILE
            ;;
        "SUCCESS")
            echo -e "${GREEN}[SUCCESS]${NC} $message"
            echo "[$timestamp] [SUCCESS] $message" >> $LOG_FILE
            ;;
        "WARNING")
            echo -e "${YELLOW}[WARNING]${NC} $message"
            echo "[$timestamp] [WARNING] $message" >> $LOG_FILE
            ;;
        "ERROR")
            echo -e "${RED}[ERROR]${NC} $message"
            echo "[$timestamp] [ERROR] $message" >> $LOG_FILE
            ;;
    esac
}

# Create log file if it doesn't exist
sudo mkdir -p $(dirname $LOG_FILE)
sudo touch $LOG_FILE
sudo chown ubuntu:ubuntu $LOG_FILE

log_message "INFO" "Starting webhook deployment..."

# Validate webhook payload (basic security)
if [ -n "$GITHUB_EVENT" ] && [ "$GITHUB_EVENT" != "push" ]; then
    log_message "INFO" "Ignoring non-push event: $GITHUB_EVENT"
    exit 0
fi

if [ -n "$GITHUB_REF" ] && [ "$GITHUB_REF" != "refs/heads/main" ]; then
    log_message "INFO" "Ignoring non-main branch: $GITHUB_REF"
    exit 0
fi

# Lock file to prevent concurrent deployments
LOCK_FILE="/tmp/salessync-deploy.lock"
if [ -f "$LOCK_FILE" ]; then
    log_message "WARNING" "Deployment already in progress, exiting"
    exit 1
fi

# Create lock file
echo $$ > $LOCK_FILE
trap "rm -f $LOCK_FILE" EXIT

# Navigate to repository directory
cd $REPO_DIR

# Stop services gracefully
log_message "INFO" "Stopping services..."
pm2 stop all || true

# Create backup
log_message "INFO" "Creating backup..."
sudo mkdir -p $BACKUP_DIR
sudo tar -czf $BACKUP_DIR/backup-$(date +%Y%m%d-%H%M%S).tar.gz \
    --exclude=node_modules \
    --exclude=.git \
    --exclude=dist \
    --exclude=build \
    . || log_message "WARNING" "Backup creation failed"

# Pull latest changes
log_message "INFO" "Pulling latest changes..."
git fetch origin
git reset --hard origin/main
git clean -fd

# Deploy configuration
log_message "INFO" "Deploying configuration..."
cp backend/prisma/schema-simple.prisma backend/prisma/schema.prisma
cp backend/src/api/auth/controller-simple.ts backend/src/api/auth/controller.ts

# Install backend dependencies
log_message "INFO" "Installing backend dependencies..."
cd backend
rm -rf node_modules package-lock.json
npm install

# Generate Prisma client
log_message "INFO" "Generating Prisma client..."
npx prisma generate

# Database migration and seeding
log_message "INFO" "Updating database..."
npx prisma db push --force-reset --accept-data-loss
npx prisma db seed

# Install and build frontend
log_message "INFO" "Building frontend..."
cd ../frontend
rm -rf node_modules package-lock.json dist
npm install
npm run build

# Update Nginx configuration
log_message "INFO" "Updating Nginx..."
if [ -f "/home/ubuntu/SalesSyncAI/nginx.conf" ]; then
    sudo cp /home/ubuntu/SalesSyncAI/nginx.conf /etc/nginx/sites-available/salessync
    sudo nginx -t && sudo systemctl reload nginx
fi

# Start services
log_message "INFO" "Starting services..."
cd $REPO_DIR
pm2 delete all || true
pm2 start ecosystem.config.js
pm2 save

# Health checks
log_message "INFO" "Running health checks..."
sleep 15

# Test backend health
if curl -f -s http://localhost:3001/health > /dev/null; then
    log_message "SUCCESS" "Backend health check passed"
else
    log_message "ERROR" "Backend health check failed"
    pm2 logs backend --lines 20
    exit 1
fi

# Test API health
if curl -f -s http://localhost:3001/api/health > /dev/null; then
    log_message "SUCCESS" "API health check passed"
else
    log_message "WARNING" "API health check failed"
fi

# Test login endpoint
if curl -X POST http://localhost:3001/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email": "admin@salessync.com", "password": "admin123"}' \
    -f -s > /dev/null; then
    log_message "SUCCESS" "Login test passed"
else
    log_message "WARNING" "Login test failed"
fi

# Test external access
if curl -f -s https://ss.gonxt.tech/health > /dev/null; then
    log_message "SUCCESS" "External health check passed"
else
    log_message "WARNING" "External health check failed"
fi

log_message "SUCCESS" "Deployment completed successfully!"
log_message "INFO" "Website: https://ss.gonxt.tech"
log_message "INFO" "Backend API: https://ss.gonxt.tech/api"

# Display service status
pm2 status
sudo systemctl status nginx --no-pager -l | head -5

# Clean up old backups (keep last 10)
sudo find $BACKUP_DIR -name "backup-*.tar.gz" -type f -mtime +7 -delete || true

log_message "SUCCESS" "Webhook deployment completed successfully!"

exit 0