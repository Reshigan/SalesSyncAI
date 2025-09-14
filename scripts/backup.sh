#!/bin/bash

# SalesSync AI Backup Script
# Creates automated backups of database and files

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_DIR="/opt/salessync"
BACKUP_DIR="/opt/salessync-backups"
LOG_DIR="/var/log/salessync"
DATE=$(date +%Y%m%d_%H%M%S)

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

# Create backup directories
setup_backup_dirs() {
    mkdir -p $BACKUP_DIR/database
    mkdir -p $BACKUP_DIR/files
    mkdir -p $BACKUP_DIR/config
    mkdir -p $LOG_DIR
}

# Backup database
backup_database() {
    log_info "Backing up PostgreSQL database..."
    
    cd $PROJECT_DIR
    
    # Create database backup
    if docker-compose exec -T postgres pg_dump -U salessync -d salessync --verbose > $BACKUP_DIR/database/salessync_$DATE.sql; then
        log_success "Database backup created: salessync_$DATE.sql"
        
        # Compress the backup
        gzip $BACKUP_DIR/database/salessync_$DATE.sql
        log_success "Database backup compressed"
        
        return 0
    else
        log_error "Database backup failed"
        return 1
    fi
}

# Backup uploaded files
backup_files() {
    log_info "Backing up uploaded files..."
    
    # Check if uploads directory exists
    if [ -d "$PROJECT_DIR/backend/uploads" ]; then
        if tar -czf $BACKUP_DIR/files/uploads_$DATE.tar.gz -C $PROJECT_DIR/backend uploads/; then
            log_success "Files backup created: uploads_$DATE.tar.gz"
            return 0
        else
            log_error "Files backup failed"
            return 1
        fi
    else
        log_warning "No uploads directory found, skipping files backup"
        return 0
    fi
}

# Backup configuration files
backup_config() {
    log_info "Backing up configuration files..."
    
    cd $PROJECT_DIR
    
    # Create config backup
    tar -czf $BACKUP_DIR/config/config_$DATE.tar.gz \
        .env \
        docker-compose.yml \
        nginx/ \
        scripts/ \
        2>/dev/null || true
    
    if [ -f "$BACKUP_DIR/config/config_$DATE.tar.gz" ]; then
        log_success "Configuration backup created: config_$DATE.tar.gz"
        return 0
    else
        log_error "Configuration backup failed"
        return 1
    fi
}

# Backup Docker volumes
backup_volumes() {
    log_info "Backing up Docker volumes..."
    
    cd $PROJECT_DIR
    
    # Backup postgres data volume
    if docker run --rm -v salessync_postgres_data:/data -v $BACKUP_DIR:/backup alpine tar -czf /backup/postgres_volume_$DATE.tar.gz -C /data .; then
        log_success "PostgreSQL volume backup created"
    else
        log_warning "PostgreSQL volume backup failed"
    fi
    
    # Backup redis data volume
    if docker run --rm -v salessync_redis_data:/data -v $BACKUP_DIR:/backup alpine tar -czf /backup/redis_volume_$DATE.tar.gz -C /data .; then
        log_success "Redis volume backup created"
    else
        log_warning "Redis volume backup failed"
    fi
}

# Upload to S3 (optional)
upload_to_s3() {
    local backup_type=$1
    local backup_file=$2
    
    # Check if AWS CLI is available and configured
    if command -v aws &> /dev/null && [ -n "$AWS_ACCESS_KEY_ID" ]; then
        log_info "Uploading $backup_type backup to S3..."
        
        local s3_bucket="salessync-backups-production"
        local s3_key="backups/$(date +%Y/%m/%d)/$(basename $backup_file)"
        
        if aws s3 cp "$backup_file" "s3://$s3_bucket/$s3_key"; then
            log_success "$backup_type backup uploaded to S3: $s3_key"
        else
            log_warning "$backup_type backup upload to S3 failed"
        fi
    else
        log_info "AWS CLI not configured, skipping S3 upload"
    fi
}

# Cleanup old backups
cleanup_old_backups() {
    log_info "Cleaning up old backups..."
    
    local retention_days=${BACKUP_RETENTION_DAYS:-30}
    
    # Remove database backups older than retention period
    find $BACKUP_DIR/database -name "*.sql.gz" -mtime +$retention_days -delete 2>/dev/null || true
    
    # Remove file backups older than retention period
    find $BACKUP_DIR/files -name "*.tar.gz" -mtime +$retention_days -delete 2>/dev/null || true
    
    # Remove config backups older than retention period
    find $BACKUP_DIR/config -name "*.tar.gz" -mtime +$retention_days -delete 2>/dev/null || true
    
    # Remove volume backups older than retention period
    find $BACKUP_DIR -name "*_volume_*.tar.gz" -mtime +$retention_days -delete 2>/dev/null || true
    
    log_success "Old backups cleaned up (retention: $retention_days days)"
}

# Verify backup integrity
verify_backup() {
    local backup_file=$1
    
    if [ -f "$backup_file" ]; then
        # Check if file is not empty
        if [ -s "$backup_file" ]; then
            # For gzipped files, test integrity
            if [[ "$backup_file" == *.gz ]]; then
                if gzip -t "$backup_file" 2>/dev/null; then
                    log_success "Backup integrity verified: $(basename $backup_file)"
                    return 0
                else
                    log_error "Backup integrity check failed: $(basename $backup_file)"
                    return 1
                fi
            else
                log_success "Backup file exists: $(basename $backup_file)"
                return 0
            fi
        else
            log_error "Backup file is empty: $(basename $backup_file)"
            return 1
        fi
    else
        log_error "Backup file not found: $(basename $backup_file)"
        return 1
    fi
}

# Generate backup report
generate_backup_report() {
    local report_file="$LOG_DIR/backup-report-$(date +%Y%m%d).log"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo "=== SalesSync AI Backup Report - $timestamp ===" >> $report_file
    echo "Backup Date: $DATE" >> $report_file
    echo "Backup Location: $BACKUP_DIR" >> $report_file
    echo "" >> $report_file
    
    # List created backups
    echo "Created Backups:" >> $report_file
    ls -lh $BACKUP_DIR/database/*$DATE* 2>/dev/null | awk '{print "  Database: " $9 " (" $5 ")"}' >> $report_file || echo "  Database: FAILED" >> $report_file
    ls -lh $BACKUP_DIR/files/*$DATE* 2>/dev/null | awk '{print "  Files: " $9 " (" $5 ")"}' >> $report_file || echo "  Files: SKIPPED" >> $report_file
    ls -lh $BACKUP_DIR/config/*$DATE* 2>/dev/null | awk '{print "  Config: " $9 " (" $5 ")"}' >> $report_file || echo "  Config: FAILED" >> $report_file
    
    # Disk usage
    echo "" >> $report_file
    echo "Backup Directory Usage:" >> $report_file
    du -sh $BACKUP_DIR >> $report_file
    
    echo "===========================================" >> $report_file
}

# Send notification (optional)
send_notification() {
    local status=$1
    local message=$2
    
    # You can implement email/slack notifications here
    log_info "Notification: $status - $message"
    
    # Example: Send email notification
    # echo "$message" | mail -s "Backup $status - SalesSync AI" admin@gonxt.tech
}

# Main backup function
main() {
    local backup_type=${1:-"full"}
    
    log_info "Starting SalesSync AI backup - Type: $backup_type"
    
    setup_backup_dirs
    
    local success=true
    
    case $backup_type in
        "database"|"db")
            if ! backup_database; then
                success=false
            fi
            ;;
        "files")
            if ! backup_files; then
                success=false
            fi
            ;;
        "config")
            if ! backup_config; then
                success=false
            fi
            ;;
        "volumes")
            if ! backup_volumes; then
                success=false
            fi
            ;;
        "full")
            if ! backup_database; then success=false; fi
            if ! backup_files; then success=false; fi
            if ! backup_config; then success=false; fi
            if ! backup_volumes; then success=false; fi
            ;;
        *)
            log_error "Unknown backup type: $backup_type"
            log_info "Usage: $0 [full|database|files|config|volumes]"
            exit 1
            ;;
    esac
    
    # Verify backups
    if [ "$backup_type" = "full" ] || [ "$backup_type" = "database" ]; then
        verify_backup "$BACKUP_DIR/database/salessync_$DATE.sql.gz"
    fi
    
    if [ "$backup_type" = "full" ] || [ "$backup_type" = "files" ]; then
        verify_backup "$BACKUP_DIR/files/uploads_$DATE.tar.gz"
    fi
    
    if [ "$backup_type" = "full" ] || [ "$backup_type" = "config" ]; then
        verify_backup "$BACKUP_DIR/config/config_$DATE.tar.gz"
    fi
    
    # Upload to S3 if configured
    if [ "$success" = true ]; then
        if [ "$backup_type" = "full" ] || [ "$backup_type" = "database" ]; then
            upload_to_s3 "database" "$BACKUP_DIR/database/salessync_$DATE.sql.gz"
        fi
    fi
    
    # Cleanup old backups
    cleanup_old_backups
    
    # Generate report
    generate_backup_report
    
    if [ "$success" = true ]; then
        send_notification "SUCCESS" "Backup completed successfully for SalesSync AI"
        log_success "Backup completed successfully"
    else
        send_notification "ERROR" "Backup failed for SalesSync AI"
        log_error "Backup completed with errors"
        exit 1
    fi
}

# Run main function
main "$@"