#!/bin/bash

# SalesSync AI Monitoring Script
# Monitors application health and performance

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_DIR="/opt/salessync"
LOG_DIR="/var/log/salessync"
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

# Check service health
check_service_health() {
    local service=$1
    local container_name="salessync-$service"
    
    if docker ps --format "table {{.Names}}\t{{.Status}}" | grep -q "$container_name.*Up"; then
        log_success "$service service is running"
        return 0
    else
        log_error "$service service is not running"
        return 1
    fi
}

# Check application endpoints
check_endpoints() {
    log_info "Checking application endpoints..."
    
    # Check main health endpoint
    if curl -f -s "https://$DOMAIN/health" > /dev/null; then
        log_success "Main health endpoint is responding"
    else
        log_error "Main health endpoint is not responding"
        return 1
    fi
    
    # Check API health endpoint
    if curl -f -s "https://$DOMAIN/api/health" > /dev/null; then
        log_success "API health endpoint is responding"
    else
        log_error "API health endpoint is not responding"
        return 1
    fi
    
    return 0
}

# Check database connectivity
check_database() {
    log_info "Checking database connectivity..."
    
    cd $PROJECT_DIR
    if docker-compose exec -T postgres pg_isready -U salessync -d salessync > /dev/null; then
        log_success "Database is accessible"
        return 0
    else
        log_error "Database is not accessible"
        return 1
    fi
}

# Check Redis connectivity
check_redis() {
    log_info "Checking Redis connectivity..."
    
    cd $PROJECT_DIR
    if docker-compose exec -T redis redis-cli ping | grep -q "PONG"; then
        log_success "Redis is accessible"
        return 0
    else
        log_error "Redis is not accessible"
        return 1
    fi
}

# Check disk space
check_disk_space() {
    log_info "Checking disk space..."
    
    # Check root partition
    ROOT_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ $ROOT_USAGE -gt 80 ]; then
        log_warning "Root partition is ${ROOT_USAGE}% full"
    else
        log_success "Root partition usage: ${ROOT_USAGE}%"
    fi
    
    # Check Docker volumes
    DOCKER_USAGE=$(df /var/lib/docker | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ $DOCKER_USAGE -gt 80 ]; then
        log_warning "Docker partition is ${DOCKER_USAGE}% full"
    else
        log_success "Docker partition usage: ${DOCKER_USAGE}%"
    fi
}

# Check memory usage
check_memory() {
    log_info "Checking memory usage..."
    
    MEMORY_USAGE=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
    if [ $MEMORY_USAGE -gt 80 ]; then
        log_warning "Memory usage is ${MEMORY_USAGE}%"
    else
        log_success "Memory usage: ${MEMORY_USAGE}%"
    fi
}

# Check SSL certificate
check_ssl_certificate() {
    log_info "Checking SSL certificate..."
    
    if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
        EXPIRY_DATE=$(openssl x509 -enddate -noout -in /etc/letsencrypt/live/$DOMAIN/fullchain.pem | cut -d= -f2)
        EXPIRY_TIMESTAMP=$(date -d "$EXPIRY_DATE" +%s)
        CURRENT_TIMESTAMP=$(date +%s)
        DAYS_UNTIL_EXPIRY=$(( ($EXPIRY_TIMESTAMP - $CURRENT_TIMESTAMP) / 86400 ))
        
        if [ $DAYS_UNTIL_EXPIRY -lt 30 ]; then
            log_warning "SSL certificate expires in $DAYS_UNTIL_EXPIRY days"
        else
            log_success "SSL certificate is valid for $DAYS_UNTIL_EXPIRY days"
        fi
    else
        log_error "SSL certificate not found"
        return 1
    fi
}

# Check container logs for errors
check_logs() {
    log_info "Checking recent logs for errors..."
    
    cd $PROJECT_DIR
    
    # Check for errors in the last 10 minutes
    ERROR_COUNT=$(docker-compose logs --since=10m 2>&1 | grep -i error | wc -l)
    if [ $ERROR_COUNT -gt 0 ]; then
        log_warning "Found $ERROR_COUNT errors in recent logs"
        docker-compose logs --since=10m 2>&1 | grep -i error | tail -5
    else
        log_success "No errors found in recent logs"
    fi
}

# Generate monitoring report
generate_report() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local report_file="$LOG_DIR/monitoring-report-$(date +%Y%m%d).log"
    
    echo "=== SalesSync AI Monitoring Report - $timestamp ===" >> $report_file
    
    # Service status
    echo "Service Status:" >> $report_file
    for service in postgres redis backend frontend nginx; do
        if check_service_health $service >> $report_file 2>&1; then
            echo "  $service: OK" >> $report_file
        else
            echo "  $service: ERROR" >> $report_file
        fi
    done
    
    # System resources
    echo "System Resources:" >> $report_file
    echo "  Memory: $(free -h | awk 'NR==2{printf "%s/%s (%.0f%%)", $3,$2,$3*100/$2}')" >> $report_file
    echo "  Disk: $(df -h / | awk 'NR==2{printf "%s/%s (%s)", $3,$2,$5}')" >> $report_file
    echo "  Load: $(uptime | awk -F'load average:' '{print $2}')" >> $report_file
    
    echo "===========================================" >> $report_file
}

# Restart services if needed
restart_failed_services() {
    log_info "Checking if any services need restart..."
    
    cd $PROJECT_DIR
    
    local restart_needed=false
    
    # Check each service
    for service in postgres redis backend frontend nginx; do
        if ! check_service_health $service > /dev/null 2>&1; then
            log_warning "Restarting $service service..."
            docker-compose restart $service
            restart_needed=true
            sleep 5
        fi
    done
    
    if [ "$restart_needed" = true ]; then
        log_info "Waiting for services to stabilize..."
        sleep 15
        
        # Verify services are running
        if check_endpoints > /dev/null 2>&1; then
            log_success "Services restarted successfully"
        else
            log_error "Services restart failed"
            return 1
        fi
    fi
}

# Main monitoring function
main() {
    local mode=${1:-"check"}
    
    log_info "Starting SalesSync AI monitoring - Mode: $mode"
    
    mkdir -p $LOG_DIR
    
    case $mode in
        "check")
            # Basic health check
            check_service_health postgres
            check_service_health redis
            check_service_health backend
            check_service_health frontend
            check_service_health nginx
            check_endpoints
            check_database
            check_redis
            ;;
        "full")
            # Full monitoring
            check_service_health postgres
            check_service_health redis
            check_service_health backend
            check_service_health frontend
            check_service_health nginx
            check_endpoints
            check_database
            check_redis
            check_disk_space
            check_memory
            check_ssl_certificate
            check_logs
            generate_report
            ;;
        "restart")
            # Check and restart failed services
            restart_failed_services
            ;;
        *)
            log_error "Unknown mode: $mode"
            log_info "Usage: $0 [check|full|restart]"
            exit 1
            ;;
    esac
    
    log_success "Monitoring completed"
}

# Run main function
main "$@"