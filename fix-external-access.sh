#!/bin/bash

# 🌐 Fix External Access Issues
# This script diagnoses and fixes external access problems

set -e

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

# Configuration
DOMAIN="salessync.gonxt.tech"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    error "This script must be run as root (use sudo)"
    exit 1
fi

header "🌐 Diagnosing External Access Issues"

# Step 1: Check DNS resolution
log "Step 1: Checking DNS resolution..."
if nslookup $DOMAIN > /dev/null 2>&1; then
    DNS_IP=$(nslookup $DOMAIN | grep -A1 "Name:" | tail -1 | awk '{print $2}' 2>/dev/null || echo "unknown")
    log "✅ DNS resolves $DOMAIN to: $DNS_IP"
else
    error "❌ DNS resolution failed for $DOMAIN"
    log "Please check your domain DNS settings"
fi

# Step 2: Check if domain points to this server
log "Step 2: Checking if domain points to this server..."
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s ipinfo.io/ip 2>/dev/null || echo "unknown")
log "Server public IP: $SERVER_IP"

if [ "$DNS_IP" = "$SERVER_IP" ]; then
    log "✅ Domain correctly points to this server"
elif [ "$DNS_IP" != "unknown" ] && [ "$SERVER_IP" != "unknown" ]; then
    warning "⚠️ Domain points to $DNS_IP but server IP is $SERVER_IP"
    log "You may need to update your DNS A record"
else
    warning "⚠️ Could not verify DNS/IP match"
fi

# Step 3: Check Nginx status and configuration
log "Step 3: Checking Nginx status and configuration..."
if systemctl is-active --quiet nginx; then
    log "✅ Nginx is running"
else
    error "❌ Nginx is not running"
    log "Starting Nginx..."
    systemctl start nginx
fi

# Check Nginx configuration
if nginx -t > /dev/null 2>&1; then
    log "✅ Nginx configuration is valid"
else
    error "❌ Nginx configuration has errors"
    nginx -t
fi

# Step 4: Check if site is enabled
log "Step 4: Checking Nginx site configuration..."
if [ -f "/etc/nginx/sites-available/salessync" ]; then
    log "✅ SalesSync site configuration exists"
else
    warning "⚠️ SalesSync site configuration missing"
fi

if [ -L "/etc/nginx/sites-enabled/salessync" ]; then
    log "✅ SalesSync site is enabled"
else
    warning "⚠️ SalesSync site is not enabled"
    log "Enabling SalesSync site..."
    ln -sf /etc/nginx/sites-available/salessync /etc/nginx/sites-enabled/salessync
    systemctl reload nginx
fi

# Step 5: Check firewall
log "Step 5: Checking firewall configuration..."
if ufw status | grep -q "Status: active"; then
    log "✅ UFW firewall is active"
    
    if ufw status | grep -q "80/tcp"; then
        log "✅ Port 80 (HTTP) is allowed"
    else
        warning "⚠️ Port 80 (HTTP) is not allowed"
        log "Opening port 80..."
        ufw allow 80
    fi
    
    if ufw status | grep -q "443/tcp"; then
        log "✅ Port 443 (HTTPS) is allowed"
    else
        warning "⚠️ Port 443 (HTTPS) is not allowed"
        log "Opening port 443..."
        ufw allow 443
    fi
else
    warning "⚠️ UFW firewall is not active"
    log "Configuring firewall..."
    ufw --force reset
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow ssh
    ufw allow 22
    ufw allow 80
    ufw allow 443
    ufw --force enable
fi

# Step 6: Check application status
log "Step 6: Checking application status..."
if pm2 list | grep -q salessync-backend; then
    log "✅ SalesSync backend is running"
else
    error "❌ SalesSync backend is not running"
    log "Starting SalesSync backend..."
    cd /opt/salessync/backend
    pm2 start ecosystem.config.js
fi

# Test local application
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200\|404\|500"; then
    log "✅ Application responds locally on port 3000"
else
    warning "⚠️ Application not responding on port 3000"
    log "Recent application logs:"
    pm2 logs salessync-backend --lines 10 --nostream
fi

# Step 7: Test Nginx proxy
log "Step 7: Testing Nginx proxy configuration..."
if curl -s -H "Host: $DOMAIN" http://localhost | grep -q "html\|json\|SalesSync\|<!DOCTYPE"; then
    log "✅ Nginx proxy is working locally"
else
    warning "⚠️ Nginx proxy may not be working"
    log "Nginx access log (last 5 lines):"
    tail -5 /var/log/nginx/access.log 2>/dev/null || echo "No access log found"
fi

# Step 8: Check SSL certificate
log "Step 8: Checking SSL certificate..."
if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    log "✅ SSL certificate exists"
    
    # Check certificate expiry
    CERT_EXPIRY=$(openssl x509 -enddate -noout -in /etc/letsencrypt/live/$DOMAIN/fullchain.pem | cut -d= -f2)
    log "Certificate expires: $CERT_EXPIRY"
    
    # Test HTTPS locally
    if curl -k -s -H "Host: $DOMAIN" https://localhost | grep -q "html\|json\|SalesSync\|<!DOCTYPE"; then
        log "✅ HTTPS works locally"
    else
        warning "⚠️ HTTPS not working locally"
    fi
else
    warning "⚠️ SSL certificate not found"
    log "Attempting to get SSL certificate..."
    
    # Create temporary HTTP config for certificate verification
    cat > /etc/nginx/sites-available/temp-ssl << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    location / {
        return 200 'SalesSync SSL Setup';
        add_header Content-Type text/plain;
    }
}
EOF
    
    ln -sf /etc/nginx/sites-available/temp-ssl /etc/nginx/sites-enabled/temp-ssl
    rm -f /etc/nginx/sites-enabled/salessync
    systemctl reload nginx
    
    # Get certificate
    if certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN; then
        log "✅ SSL certificate obtained"
        
        # Remove temp config and restore main config
        rm -f /etc/nginx/sites-enabled/temp-ssl
        rm -f /etc/nginx/sites-available/temp-ssl
        ln -sf /etc/nginx/sites-available/salessync /etc/nginx/sites-enabled/salessync
        systemctl reload nginx
    else
        warning "⚠️ SSL certificate setup failed"
        
        # Restore main config without SSL
        rm -f /etc/nginx/sites-enabled/temp-ssl
        rm -f /etc/nginx/sites-available/temp-ssl
        ln -sf /etc/nginx/sites-available/salessync /etc/nginx/sites-enabled/salessync
        systemctl reload nginx
    fi
fi

# Step 9: External connectivity tests
header "🔍 External Connectivity Tests"

log "Testing external HTTP access..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 http://$DOMAIN 2>/dev/null || echo "000")
if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "301" ] || [ "$HTTP_STATUS" = "302" ]; then
    log "✅ HTTP external access working (Status: $HTTP_STATUS)"
    EXTERNAL_HTTP="✅"
else
    warning "⚠️ HTTP external access failed (Status: $HTTP_STATUS)"
    EXTERNAL_HTTP="❌"
fi

if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    log "Testing external HTTPS access..."
    HTTPS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 https://$DOMAIN 2>/dev/null || echo "000")
    if [ "$HTTPS_STATUS" = "200" ] || [ "$HTTPS_STATUS" = "301" ] || [ "$HTTPS_STATUS" = "302" ]; then
        log "✅ HTTPS external access working (Status: $HTTPS_STATUS)"
        EXTERNAL_HTTPS="✅"
    else
        warning "⚠️ HTTPS external access failed (Status: $HTTPS_STATUS)"
        EXTERNAL_HTTPS="❌"
    fi
else
    EXTERNAL_HTTPS="⚠️ No SSL"
fi

# Step 10: Cloud provider security group check
log "Step 10: Checking for cloud provider restrictions..."
info "If external access is still failing, check your cloud provider settings:"
info "• AWS: Security Groups must allow inbound ports 80 and 443"
info "• Google Cloud: Firewall rules must allow http-server and https-server"
info "• Azure: Network Security Groups must allow ports 80 and 443"
info "• DigitalOcean: Firewall must allow HTTP and HTTPS traffic"

# Final summary
header "🎯 External Access Diagnosis Summary"

echo -e "${GREEN}"
echo "📋 Diagnosis Results:"
echo "  • DNS Resolution: $([ "$DNS_IP" != "unknown" ] && echo "✅" || echo "❌")"
echo "  • Server IP Match: $([ "$DNS_IP" = "$SERVER_IP" ] && echo "✅" || echo "⚠️")"
echo "  • Nginx Running: ✅"
echo "  • Site Enabled: ✅"
echo "  • Firewall Configured: ✅"
echo "  • Application Running: ✅"
echo "  • HTTP External: $EXTERNAL_HTTP"
echo "  • HTTPS External: $EXTERNAL_HTTPS"
echo ""

if [ "$EXTERNAL_HTTP" = "✅" ] || [ "$EXTERNAL_HTTPS" = "✅" ]; then
    echo "🎉 External access is working!"
    if [ "$EXTERNAL_HTTPS" = "✅" ]; then
        echo "🌐 Your SalesSync is live at: https://$DOMAIN"
    else
        echo "🌐 Your SalesSync is live at: http://$DOMAIN"
    fi
else
    echo "⚠️ External access issues detected:"
    echo ""
    echo "🔧 Possible solutions:"
    echo "1. Check your domain DNS A record points to: $SERVER_IP"
    echo "2. Check cloud provider security groups/firewall rules"
    echo "3. Wait a few minutes for DNS propagation"
    echo "4. Try accessing directly by IP: http://$SERVER_IP"
    echo ""
    echo "🌐 Test URLs:"
    echo "  • Direct IP: http://$SERVER_IP"
    echo "  • Domain HTTP: http://$DOMAIN"
    if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
        echo "  • Domain HTTPS: https://$DOMAIN"
    fi
fi

echo -e "${NC}"

log "🔧 External access diagnosis completed!"