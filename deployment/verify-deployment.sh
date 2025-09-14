#!/bin/bash

# SalesSyncAI Deployment Verification Script
# Verifies that all components are running correctly

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="13.247.192.46"
APP_DIR="/opt/salessync"

# Logging functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
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

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

fail() {
    echo -e "${RED}❌ $1${NC}"
}

log "🔍 Starting SalesSyncAI Deployment Verification"
log "Target Server: $DOMAIN"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   error "This script must be run as root (use sudo)"
   exit 1
fi

# Verification results
VERIFICATION_RESULTS=()

# 1. Check system services
log "🔧 Checking system services..."

if systemctl is-active --quiet postgresql; then
    success "PostgreSQL is running"
    VERIFICATION_RESULTS+=("PostgreSQL: ✅")
else
    fail "PostgreSQL is not running"
    VERIFICATION_RESULTS+=("PostgreSQL: ❌")
fi

if systemctl is-active --quiet redis-server; then
    success "Redis is running"
    VERIFICATION_RESULTS+=("Redis: ✅")
else
    fail "Redis is not running"
    VERIFICATION_RESULTS+=("Redis: ❌")
fi

if systemctl is-active --quiet nginx; then
    success "Nginx is running"
    VERIFICATION_RESULTS+=("Nginx: ✅")
else
    fail "Nginx is not running"
    VERIFICATION_RESULTS+=("Nginx: ❌")
fi

# 2. Check PM2 processes
log "⚙️ Checking PM2 processes..."

if pm2 list | grep -q "salessync-backend.*online"; then
    success "Backend application is running"
    VERIFICATION_RESULTS+=("Backend App: ✅")
else
    fail "Backend application is not running"
    VERIFICATION_RESULTS+=("Backend App: ❌")
fi

# 3. Check application directory
log "📁 Checking application directory..."

if [ -d "$APP_DIR" ]; then
    success "Application directory exists"
    VERIFICATION_RESULTS+=("App Directory: ✅")
else
    fail "Application directory not found"
    VERIFICATION_RESULTS+=("App Directory: ❌")
fi

if [ -f "$APP_DIR/backend/.env" ]; then
    success "Backend environment file exists"
    VERIFICATION_RESULTS+=("Backend .env: ✅")
else
    fail "Backend environment file not found"
    VERIFICATION_RESULTS+=("Backend .env: ❌")
fi

if [ -d "$APP_DIR/frontend/build" ]; then
    success "Frontend build directory exists"
    VERIFICATION_RESULTS+=("Frontend Build: ✅")
else
    fail "Frontend build directory not found"
    VERIFICATION_RESULTS+=("Frontend Build: ❌")
fi

# 4. Check database connection
log "🗄️ Checking database connection..."

if sudo -u postgres psql -d salessync_prod -c "SELECT 1;" > /dev/null 2>&1; then
    success "Database connection successful"
    VERIFICATION_RESULTS+=("Database Connection: ✅")
else
    fail "Database connection failed"
    VERIFICATION_RESULTS+=("Database Connection: ❌")
fi

# Check if database has data
USER_COUNT=$(sudo -u postgres psql -d salessync_prod -t -c "SELECT COUNT(*) FROM \"User\";" 2>/dev/null | xargs || echo "0")
if [ "$USER_COUNT" -gt 0 ]; then
    success "Database contains $USER_COUNT users"
    VERIFICATION_RESULTS+=("Database Data: ✅ ($USER_COUNT users)")
else
    fail "Database appears to be empty"
    VERIFICATION_RESULTS+=("Database Data: ❌")
fi

# 5. Check Redis connection
log "🔄 Checking Redis connection..."

if redis-cli ping > /dev/null 2>&1; then
    success "Redis connection successful"
    VERIFICATION_RESULTS+=("Redis Connection: ✅")
else
    fail "Redis connection failed"
    VERIFICATION_RESULTS+=("Redis Connection: ❌")
fi

# 6. Check HTTP endpoints
log "🌐 Checking HTTP endpoints..."

# Health check
if curl -s -f "http://$DOMAIN/health" > /dev/null; then
    success "Health endpoint responding"
    VERIFICATION_RESULTS+=("Health Endpoint: ✅")
else
    fail "Health endpoint not responding"
    VERIFICATION_RESULTS+=("Health Endpoint: ❌")
fi

# Frontend
if curl -s -f "http://$DOMAIN/" > /dev/null; then
    success "Frontend is accessible"
    VERIFICATION_RESULTS+=("Frontend: ✅")
else
    fail "Frontend is not accessible"
    VERIFICATION_RESULTS+=("Frontend: ❌")
fi

# API endpoint
if curl -s -f "http://$DOMAIN/api/docs" > /dev/null; then
    success "API documentation is accessible"
    VERIFICATION_RESULTS+=("API Docs: ✅")
else
    fail "API documentation is not accessible"
    VERIFICATION_RESULTS+=("API Docs: ❌")
fi

# 7. Check log files
log "📝 Checking log files..."

if [ -f "$APP_DIR/logs/backend-combined.log" ]; then
    success "Backend log file exists"
    VERIFICATION_RESULTS+=("Backend Logs: ✅")
else
    fail "Backend log file not found"
    VERIFICATION_RESULTS+=("Backend Logs: ❌")
fi

if [ -f "/var/log/nginx/salessync_access.log" ]; then
    success "Nginx access log exists"
    VERIFICATION_RESULTS+=("Nginx Logs: ✅")
else
    fail "Nginx access log not found"
    VERIFICATION_RESULTS+=("Nginx Logs: ❌")
fi

# 8. Check firewall status
log "🔥 Checking firewall status..."

if ufw status | grep -q "Status: active"; then
    success "Firewall is active"
    VERIFICATION_RESULTS+=("Firewall: ✅")
else
    warning "Firewall is not active"
    VERIFICATION_RESULTS+=("Firewall: ⚠️")
fi

# 9. Check disk space
log "💾 Checking disk space..."

DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -lt 80 ]; then
    success "Disk usage is acceptable ($DISK_USAGE%)"
    VERIFICATION_RESULTS+=("Disk Space: ✅ ($DISK_USAGE%)")
else
    warning "Disk usage is high ($DISK_USAGE%)"
    VERIFICATION_RESULTS+=("Disk Space: ⚠️ ($DISK_USAGE%)")
fi

# 10. Check memory usage
log "🧠 Checking memory usage..."

MEMORY_USAGE=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
if [ "$MEMORY_USAGE" -lt 80 ]; then
    success "Memory usage is acceptable ($MEMORY_USAGE%)"
    VERIFICATION_RESULTS+=("Memory Usage: ✅ ($MEMORY_USAGE%)")
else
    warning "Memory usage is high ($MEMORY_USAGE%)"
    VERIFICATION_RESULTS+=("Memory Usage: ⚠️ ($MEMORY_USAGE%)")
fi

# Summary
log ""
log "📊 VERIFICATION SUMMARY"
log "======================"

for result in "${VERIFICATION_RESULTS[@]}"; do
    echo -e "  $result"
done

# Count results
TOTAL_CHECKS=${#VERIFICATION_RESULTS[@]}
SUCCESS_COUNT=$(printf '%s\n' "${VERIFICATION_RESULTS[@]}" | grep -c "✅" || echo "0")
WARNING_COUNT=$(printf '%s\n' "${VERIFICATION_RESULTS[@]}" | grep -c "⚠️" || echo "0")
FAILURE_COUNT=$(printf '%s\n' "${VERIFICATION_RESULTS[@]}" | grep -c "❌" || echo "0")

log ""
log "📈 RESULTS: $SUCCESS_COUNT passed, $WARNING_COUNT warnings, $FAILURE_COUNT failed (Total: $TOTAL_CHECKS)"

if [ "$FAILURE_COUNT" -eq 0 ]; then
    if [ "$WARNING_COUNT" -eq 0 ]; then
        success "🎉 All checks passed! Deployment is fully operational."
    else
        warning "⚠️ Deployment is operational with $WARNING_COUNT warnings."
    fi
else
    error "❌ Deployment has $FAILURE_COUNT critical issues that need attention."
fi

log ""
log "🔗 Application URLs:"
log "   Main App: http://$DOMAIN"
log "   API Docs: http://$DOMAIN/api/docs"
log "   Health:   http://$DOMAIN/health"
log "   Metrics:  http://$DOMAIN/metrics"

log ""
log "🔐 Demo Login Credentials:"
log "   Super Admin: superadmin@salessync.com / SuperAdmin123!"
log "   Demo Admin:  admin@premiumbeverages.com / DemoAdmin123!"
log "   Test Admin:  admin@testcompany.com / TestAdmin123!"

log ""
log "⚙️ Management Commands:"
log "   PM2 Status:    pm2 status"
log "   PM2 Logs:      pm2 logs salessync-backend"
log "   Restart App:   pm2 restart salessync-backend"
log "   Nginx Status:  systemctl status nginx"
log "   DB Status:     systemctl status postgresql"

if [ "$FAILURE_COUNT" -gt 0 ]; then
    exit 1
else
    exit 0
fi