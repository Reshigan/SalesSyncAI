#!/bin/bash

# SalesSync SSL Setup Script with DNS Verification
# This script sets up SSL certificates for SalesSync after verifying DNS configuration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="salessync.gonxt.tech"
EMAIL="admin@gonxt.tech"
WEBROOT="/var/www/html"

echo -e "${BLUE}=== SalesSync SSL Setup Script ===${NC}"
echo "Domain: $DOMAIN"
echo "Email: $EMAIL"
echo ""

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Get current server IP
print_status "Getting current server IP address..."
SERVER_IP=$(curl -s ifconfig.me)
print_status "Server IP: $SERVER_IP"

# Check DNS resolution
print_status "Checking DNS resolution for $DOMAIN..."
DOMAIN_IP=$(dig +short $DOMAIN | head -n1)
print_status "Domain resolves to: $DOMAIN_IP"

# Compare IPs
if [ "$SERVER_IP" != "$DOMAIN_IP" ]; then
    print_error "DNS CONFIGURATION ISSUE DETECTED!"
    echo ""
    echo -e "${RED}The domain $DOMAIN is pointing to $DOMAIN_IP${NC}"
    echo -e "${RED}But this server is at $SERVER_IP${NC}"
    echo ""
    echo -e "${YELLOW}TO FIX THIS ISSUE:${NC}"
    echo "1. Log into your DNS provider (where you manage gonxt.tech domain)"
    echo "2. Update the A record for 'salessync.gonxt.tech' to point to: $SERVER_IP"
    echo "3. Wait for DNS propagation (usually 5-15 minutes)"
    echo "4. Run this script again to verify and setup SSL"
    echo ""
    echo -e "${BLUE}You can check DNS propagation with:${NC}"
    echo "dig +short salessync.gonxt.tech"
    echo ""
    echo -e "${YELLOW}Current DNS Status:${NC}"
    echo "✗ salessync.gonxt.tech → $DOMAIN_IP (should be $SERVER_IP)"
    exit 1
fi

print_status "✓ DNS configuration is correct!"

# Check if application is running
print_status "Checking if SalesSync application is running..."
if ! pm2 list | grep -q "salessync-backend.*online"; then
    print_warning "SalesSync backend is not running. Starting it..."
    cd /workspace/project/SalesSyncAI/backend
    pm2 start dist/index.js --name salessync-backend
    sleep 3
fi

# Test application response
print_status "Testing application response..."
if curl -s -f http://localhost:3000 > /dev/null; then
    print_status "✓ Application is responding on port 3000"
else
    print_error "Application is not responding on port 3000"
    print_status "Checking PM2 status..."
    pm2 status
    exit 1
fi

# Ensure webroot directory exists
print_status "Setting up webroot directory for ACME challenges..."
mkdir -p $WEBROOT/.well-known/acme-challenge
chown -R www-data:www-data $WEBROOT

# Test ACME challenge path
print_status "Testing ACME challenge path..."
echo "test-challenge-$(date +%s)" > $WEBROOT/.well-known/acme-challenge/test
if curl -s -f http://$DOMAIN/.well-known/acme-challenge/test > /dev/null; then
    print_status "✓ ACME challenge path is accessible"
    rm -f $WEBROOT/.well-known/acme-challenge/test
else
    print_error "ACME challenge path is not accessible"
    print_status "Checking Nginx configuration..."
    nginx -t
    exit 1
fi

# Generate SSL certificate
print_status "Generating SSL certificate for $DOMAIN..."
if certbot certonly --webroot -w $WEBROOT -d $DOMAIN --non-interactive --agree-tos --email $EMAIL; then
    print_status "✓ SSL certificate generated successfully!"
else
    print_error "Failed to generate SSL certificate"
    print_status "Check the logs: /var/log/letsencrypt/letsencrypt.log"
    exit 1
fi

# Update Nginx configuration with SSL
print_status "Updating Nginx configuration with SSL..."
cat > /etc/nginx/sites-available/salessync << 'EOF'
# HTTP server - redirect to HTTPS
server {
    listen 80;
    server_name salessync.gonxt.tech;
    
    # ACME challenge location for Let's Encrypt
    location /.well-known/acme-challenge/ {
        root /var/www/html;
        try_files $uri $uri/ =404;
    }
    
    # Redirect all other HTTP requests to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name salessync.gonxt.tech;
    
    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/salessync.gonxt.tech/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/salessync.gonxt.tech/privkey.pem;
    
    # SSL security settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Proxy to SalesSync application
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeout settings
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Buffer settings
        proxy_buffering on;
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
    }
}
EOF

# Test Nginx configuration
print_status "Testing Nginx configuration..."
if nginx -t; then
    print_status "✓ Nginx configuration is valid"
else
    print_error "Nginx configuration test failed"
    exit 1
fi

# Reload Nginx
print_status "Reloading Nginx..."
service nginx reload

# Set up automatic certificate renewal
print_status "Setting up automatic certificate renewal..."
if ! crontab -l 2>/dev/null | grep -q "certbot renew"; then
    (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet && service nginx reload") | crontab -
    print_status "✓ Added automatic certificate renewal to crontab"
fi

# Final verification
print_status "Performing final verification..."
sleep 5

# Test HTTP redirect
print_status "Testing HTTP to HTTPS redirect..."
HTTP_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://$DOMAIN)
if [ "$HTTP_RESPONSE" = "301" ]; then
    print_status "✓ HTTP to HTTPS redirect is working"
else
    print_warning "HTTP redirect returned status: $HTTP_RESPONSE"
fi

# Test HTTPS
print_status "Testing HTTPS connection..."
if curl -s -f https://$DOMAIN > /dev/null; then
    print_status "✓ HTTPS connection is working"
else
    print_warning "HTTPS connection test failed"
fi

# Display final status
echo ""
echo -e "${GREEN}=== SSL SETUP COMPLETE ===${NC}"
echo ""
echo -e "${GREEN}✓ SSL certificate generated for $DOMAIN${NC}"
echo -e "${GREEN}✓ Nginx configured with SSL and security headers${NC}"
echo -e "${GREEN}✓ HTTP to HTTPS redirect enabled${NC}"
echo -e "${GREEN}✓ Automatic certificate renewal configured${NC}"
echo ""
echo -e "${BLUE}Your SalesSync application is now available at:${NC}"
echo -e "${GREEN}https://$DOMAIN${NC}"
echo ""
echo -e "${YELLOW}Certificate Details:${NC}"
certbot certificates
echo ""
echo -e "${BLUE}To check certificate status:${NC} certbot certificates"
echo -e "${BLUE}To renew certificates manually:${NC} certbot renew"
echo -e "${BLUE}To check Nginx status:${NC} service nginx status"
echo -e "${BLUE}To check application status:${NC} pm2 status"