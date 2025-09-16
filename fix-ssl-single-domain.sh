#!/bin/bash

# 🔒 Fix SSL Certificate for Single Domain
# This script gets SSL certificate for main domain only (without www)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

# Configuration
DOMAIN="salessync.gonxt.tech"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    error "This script must be run as root (use sudo)"
    exit 1
fi

log "🔒 Getting SSL certificate for $DOMAIN only..."

# Create temporary HTTP-only config for certificate verification
log "Creating temporary HTTP configuration..."
cat > /etc/nginx/sites-available/temp-ssl-single << EOF
server {
    listen 80;
    server_name $DOMAIN;
    
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
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
    }
}
EOF

# Enable temporary config
rm -f /etc/nginx/sites-enabled/salessync
ln -sf /etc/nginx/sites-available/temp-ssl-single /etc/nginx/sites-enabled/temp-ssl-single
nginx -t && systemctl reload nginx

# Get SSL certificate for main domain only
log "Obtaining SSL certificate for $DOMAIN..."
if certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN; then
    log "✅ SSL certificate obtained successfully!"
    
    # Remove temporary config
    rm -f /etc/nginx/sites-enabled/temp-ssl-single
    rm -f /etc/nginx/sites-available/temp-ssl-single
    
    # Create final HTTPS configuration
    log "Creating HTTPS Nginx configuration..."
    cat > /etc/nginx/sites-available/salessync << EOF
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN;
    
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
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript application/json;
    
    client_max_body_size 50M;
    
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
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    location /health {
        proxy_pass http://localhost:3000/health;
        access_log off;
    }
    
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
}
EOF
    
    # Enable the HTTPS site
    ln -sf /etc/nginx/sites-available/salessync /etc/nginx/sites-enabled/salessync
    
    # Test and reload Nginx
    if nginx -t; then
        systemctl reload nginx
        log "✅ HTTPS configuration enabled"
    else
        error "❌ Nginx configuration test failed"
        exit 1
    fi
    
    # Test HTTPS access
    sleep 5
    HTTPS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 https://$DOMAIN 2>/dev/null || echo "000")
    if [ "$HTTPS_STATUS" = "200" ] || [ "$HTTPS_STATUS" = "301" ] || [ "$HTTPS_STATUS" = "302" ]; then
        log "✅ HTTPS access working (Status: $HTTPS_STATUS)"
        
        echo ""
        echo "🎉 SSL Certificate Successfully Installed!"
        echo ""
        echo "🌐 Your SalesSync is now available at:"
        echo "  • HTTPS: https://$DOMAIN"
        echo "  • HTTP: http://$DOMAIN (redirects to HTTPS)"
        echo ""
        echo "🔐 Default Login:"
        echo "  • Email: admin@demo.com"
        echo "  • Password: admin123"
        echo ""
    else
        warning "⚠️ HTTPS access test failed (Status: $HTTPS_STATUS)"
        log "But certificate is installed, may need a few minutes to propagate"
    fi
    
else
    error "❌ SSL certificate setup failed"
    
    # Restore original HTTP config
    rm -f /etc/nginx/sites-enabled/temp-ssl-single
    rm -f /etc/nginx/sites-available/temp-ssl-single
    
    # Create HTTP-only config
    cat > /etc/nginx/sites-available/salessync << EOF
server {
    listen 80;
    server_name $DOMAIN;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript application/json;
    
    client_max_body_size 50M;
    
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
    }
    
    location /health {
        proxy_pass http://localhost:3000/health;
        access_log off;
    }
    
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
}
EOF
    
    ln -sf /etc/nginx/sites-available/salessync /etc/nginx/sites-enabled/salessync
    nginx -t && systemctl reload nginx
    
    echo ""
    echo "⚠️ SSL certificate setup failed, but HTTP access is working"
    echo "🌐 Your SalesSync is available at: http://$DOMAIN"
    echo ""
fi

log "🔒 SSL setup process completed!"