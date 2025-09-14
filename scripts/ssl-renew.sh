#!/bin/bash

# SSL Certificate Renewal Script for SalesSync AI
# Automatically renews Let's Encrypt certificates

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_DIR="/opt/salessync"
DOMAIN="assai.gonxt.tech"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check certificate expiry
check_certificate_expiry() {
    log_info "Checking certificate expiry for $DOMAIN..."
    
    if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
        log_error "Certificate not found for $DOMAIN"
        return 1
    fi
    
    # Get certificate expiry date
    EXPIRY_DATE=$(openssl x509 -enddate -noout -in /etc/letsencrypt/live/$DOMAIN/fullchain.pem | cut -d= -f2)
    EXPIRY_TIMESTAMP=$(date -d "$EXPIRY_DATE" +%s)
    CURRENT_TIMESTAMP=$(date +%s)
    DAYS_UNTIL_EXPIRY=$(( ($EXPIRY_TIMESTAMP - $CURRENT_TIMESTAMP) / 86400 ))
    
    log_info "Certificate expires in $DAYS_UNTIL_EXPIRY days"
    
    # Renew if less than 30 days
    if [ $DAYS_UNTIL_EXPIRY -lt 30 ]; then
        log_warning "Certificate expires in less than 30 days, renewal needed"
        return 0
    else
        log_info "Certificate is still valid, no renewal needed"
        return 1
    fi
}

# Renew certificate
renew_certificate() {
    log_info "Renewing SSL certificate for $DOMAIN..."
    
    cd $PROJECT_DIR
    
    # Renew certificate using certbot
    docker-compose run --rm certbot renew --webroot --webroot-path=/var/www/certbot
    
    if [ $? -eq 0 ]; then
        log_success "Certificate renewed successfully"
        
        # Reload nginx to use new certificate
        docker-compose exec nginx nginx -s reload
        
        log_success "Nginx reloaded with new certificate"
        return 0
    else
        log_error "Certificate renewal failed"
        return 1
    fi
}

# Test certificate
test_certificate() {
    log_info "Testing SSL certificate..."
    
    # Test SSL connection
    if echo | openssl s_client -servername $DOMAIN -connect $DOMAIN:443 2>/dev/null | openssl x509 -noout -dates; then
        log_success "SSL certificate test passed"
        return 0
    else
        log_error "SSL certificate test failed"
        return 1
    fi
}

# Send notification (optional)
send_notification() {
    local status=$1
    local message=$2
    
    # You can implement email/slack notifications here
    log_info "Notification: $status - $message"
    
    # Example: Send email notification
    # echo "$message" | mail -s "SSL Certificate $status - $DOMAIN" admin@gonxt.tech
}

# Main function
main() {
    log_info "Starting SSL certificate renewal check for $DOMAIN"
    
    if check_certificate_expiry; then
        if renew_certificate; then
            if test_certificate; then
                send_notification "SUCCESS" "SSL certificate renewed successfully for $DOMAIN"
                log_success "SSL certificate renewal completed successfully"
            else
                send_notification "ERROR" "SSL certificate renewed but test failed for $DOMAIN"
                log_error "Certificate renewed but test failed"
                exit 1
            fi
        else
            send_notification "ERROR" "SSL certificate renewal failed for $DOMAIN"
            log_error "Certificate renewal failed"
            exit 1
        fi
    else
        log_info "No renewal needed at this time"
    fi
}

# Run main function
main "$@"